package expo.modules.mesh_peer_module

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.URL
import java.nio.charset.StandardCharsets

import android.location.LocationManager
import android.bluetooth.BluetoothManager
import android.net.wifi.WifiManager
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.ConnectionResult

// SQLite imports
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import java.io.File

class MeshPeerModule : Module() {
  private lateinit var connectionsClient: ConnectionsClient
  private val connectedEndpoints = mutableSetOf<String>()
  
  // Strategy for connections - CLUSTER allows many-to-many connections
  private val strategy = Strategy.P2P_CLUSTER

  // SQLite database helper methods
  private fun getDatabasePath(): String {
    val context = appContext.reactContext!!
    return File(context.filesDir, "SQLite/cruise-chat.db").absolutePath
  }

  private fun getAllMessageIds(): List<String> {
    val messageIds = mutableListOf<String>()
    
    try {
      val dbPath = getDatabasePath()
      val database = SQLiteDatabase.openDatabase(dbPath, null, SQLiteDatabase.OPEN_READONLY)
      
      val cursor = database.rawQuery("SELECT id FROM messages ORDER BY created_at DESC", null)
      
      if (cursor.moveToFirst()) {
        do {
          val messageId = cursor.getString(cursor.getColumnIndexOrThrow("id"))
          messageIds.add(messageId)
        } while (cursor.moveToNext())
      }
      
      cursor.close()
      database.close()
      
      DebugLog("Retrieved ${messageIds.size} message IDs from database")
      
    } catch (e: SQLiteException) {
      DebugLog("SQLite error: ${e.message}")
    } catch (e: Exception) {
      DebugLog("Database error: ${e.message}")
    }
    
    return messageIds
  }

  companion object {
    private const val REQUEST_CODE_PERMISSIONS = 1234
  }

  private val requiredPermissions: List<String>
    get() {
      val basePermissions = mutableListOf<String>()
      
      // Location permission (required for all versions)
      basePermissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
      
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
      // Android 12+ (API 31+)
      basePermissions.addAll(listOf(
        Manifest.permission.BLUETOOTH_ADVERTISE,
        Manifest.permission.BLUETOOTH_CONNECT,
        Manifest.permission.BLUETOOTH_SCAN,
        Manifest.permission.NEARBY_WIFI_DEVICES
      ))
      } else {
      // Android 11 and below
      basePermissions.addAll(listOf(
        Manifest.permission.BLUETOOTH,
        Manifest.permission.BLUETOOTH_ADMIN
      ))
      }
      
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
      // Android 13+ (API 33+)
      basePermissions.add(Manifest.permission.POST_NOTIFICATIONS)
      }
      
      return basePermissions
    }
  // Helper function for debug logging
  private fun DebugLog(message: String) {
    sendEvent("onDebug", mapOf("message" to message))
  }

  // Kinda unnecessary function
  private fun checkPrerequisites() {
    DebugLog("=== CHECKING PREREQUISITES ===")
    
    // Check Google Play Services
    val googleApiAvailability = GoogleApiAvailability.getInstance()
    val resultCode = googleApiAvailability.isGooglePlayServicesAvailable(appContext.reactContext!!)
    DebugLog("Google Play Services: ${if (resultCode == ConnectionResult.SUCCESS) "✅ Available" else "❌ Unavailable ($resultCode)"}")
    
    // Check location manager
    val locationManager = appContext.reactContext!!.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val isLocationEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) || 
                          locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    DebugLog("Location Services: ${if (isLocationEnabled) "✅ Enabled" else "❌ Disabled"}")
    
    // Check Bluetooth
    val bluetoothManager = appContext.reactContext!!.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    val bluetoothAdapter = bluetoothManager.adapter
    DebugLog("Bluetooth: ${if (bluetoothAdapter?.isEnabled == true) "✅ Enabled" else "❌ Disabled"}")
    
    // Check WiFi
    val wifiManager = appContext.reactContext!!.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
    DebugLog("WiFi: ${if (wifiManager.isWifiEnabled) "✅ Enabled" else "❌ Disabled"}")
  }
  
  private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
    override fun onConnectionInitiated(endpointId: String, connectionInfo: ConnectionInfo) {
      // Automatically accept the connection
      connectionsClient.acceptConnection(endpointId, payloadCallback)
    }

    override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
      when (result.status.statusCode) {
        ConnectionsStatusCodes.STATUS_OK -> {
          connectedEndpoints.add(endpointId)
          sendEvent("onPeerConnected", mapOf(
            "endpointId" to endpointId
          ))
        }
        ConnectionsStatusCodes.STATUS_CONNECTION_REJECTED -> {
          sendEvent("onConnectionFailed", mapOf(
            "endpointId" to endpointId,
            "error" to "Connection rejected"
          ))
        }
        else -> {
          sendEvent("onConnectionFailed", mapOf(
            "endpointId" to endpointId,
            "error" to "Connection failed with status: ${result.status.statusCode}"
          ))
        }
      }
    }

    override fun onDisconnected(endpointId: String) {
      connectedEndpoints.remove(endpointId)
      sendEvent("onPeerDisconnected", mapOf(
        "endpointId" to endpointId
      ))
    }
  }

  private val payloadCallback = object : PayloadCallback() {
    override fun onPayloadReceived(endpointId: String, payload: Payload) {
      when (payload.type) {
        Payload.Type.BYTES -> {
          val message = String(payload.asBytes()!!, StandardCharsets.UTF_8)
          sendEvent("onMessageReceived", mapOf(
            "endpointId" to endpointId,
            "message" to message
          ))
        }
      }
    }

    override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
      // Handle payload transfer updates if needed
    }
  }

  private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
    override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
      DebugLog("We found one endpoint")
      // Automatically request connection to discovered endpoints
      connectionsClient.requestConnection(
        "CruiseChat_${android.os.Build.MODEL}", // Use your endpoint name
        endpointId,
        connectionLifecycleCallback
      ).addOnSuccessListener {
        DebugLog("✅ Connection request sent successfully")
      }.addOnFailureListener { exception ->
        DebugLog("❌ Connection request failed: ${exception.message}")
      }
      
      sendEvent("onPeerDiscovered", mapOf(
        "endpointId" to endpointId,
        "name" to info.endpointName
      ))
    }

    override fun onEndpointLost(endpointId: String) {
      sendEvent("onPeerLost", mapOf(
        "endpointId" to endpointId
      ))
    }
  }

  override fun definition() = ModuleDefinition {
    Name("MeshPeerModule")

    // Initialize Nearby Connections client
    OnCreate {
      val ctx = appContext.reactContext!!
      connectionsClient = Nearby.getConnectionsClient(ctx)
    }

    // Define events that can be sent to JavaScript
    Events(
      "onPeerDiscovered",
      "onPeerConnected", 
      "onPeerDisconnected",
      "onPeerLost",
      "onMessageReceived",
      "onConnectionFailed",
      "onAdvertisingStarted",
      "onDiscoveryStarted",
      "onError",
      "onDebug",
    )

    AsyncFunction("checkPermissions") { promise: Promise ->
      val context = appContext.reactContext ?: run {
        promise.reject("NO_CONTEXT", "App context is not available", null)
        return@AsyncFunction
      }
      val allGranted = requiredPermissions.all {
        ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
      }
      promise.resolve(allGranted)
    }

    AsyncFunction("requestPermissions") { promise: Promise ->
      DebugLog("Using permissions for API ${android.os.Build.VERSION.SDK_INT}: $requiredPermissions")

      val activity = appContext.currentActivity ?: run {
        promise.reject("NO_ACTIVITY", "Activity not available", null)
        return@AsyncFunction
      }

      val notGranted = requiredPermissions.filter {
        ContextCompat.checkSelfPermission(activity, it) != PackageManager.PERMISSION_GRANTED
      }

      if (notGranted.isEmpty()) {
        // Everything already granted
        DebugLog("All permissions granted")
        promise.resolve(true)
        return@AsyncFunction
      }
      DebugLog("Asking permissions as not everything granted.")

      ActivityCompat.requestPermissions(activity, notGranted.toTypedArray(), REQUEST_CODE_PERMISSIONS)
      promise.resolve(true)
    }

    AsyncFunction("startAdvertising") { promise: Promise ->
      if (!hasRequiredPermissions()) {
        promise.reject("PERMISSION_DENIED", "Required permissions not granted", null)
        return@AsyncFunction
      }
      checkPrerequisites()

      val advertisingOptions = AdvertisingOptions.Builder().setStrategy(strategy).build()
      connectionsClient.startAdvertising(
        "CruiseChat_${android.os.Build.MODEL}",
        "CruiseChat",
        connectionLifecycleCallback,
        advertisingOptions
      ).addOnSuccessListener {
        DebugLog("Started advertising!")
        sendEvent("onAdvertisingStarted", emptyMap<String, Any>())
        promise.resolve(null)
      }.addOnFailureListener { exception ->
        DebugLog("Failed to start advertising!")
        promise.reject("ADVERTISING_FAILED", "Failed to start advertising: ${exception.message}", exception)
      }
    }

    AsyncFunction("startDiscovery") { promise: Promise ->
      if (!hasRequiredPermissions()) {
        promise.reject("PERMISSION_DENIED", "Required permissions not granted", null)
        return@AsyncFunction
      }

      checkPrerequisites()

      val discoveryOptions = DiscoveryOptions.Builder().setStrategy(strategy).build()
      
      connectionsClient.startDiscovery(
        "CruiseChat", // Service ID
        endpointDiscoveryCallback,
        discoveryOptions
      ).addOnSuccessListener {
        DebugLog("Started discovering!")
        sendEvent("onDiscoveryStarted", emptyMap<String, Any>())
        promise.resolve(null)
      }.addOnFailureListener { exception ->
        promise.reject("DISCOVERY_FAILED", "Failed to start discovery: ${exception.message}", exception)
      }
    }

    AsyncFunction("stopAdvertising") { promise: Promise ->
      connectionsClient.stopAdvertising()
      promise.resolve(null)
    }

    AsyncFunction("stopDiscovery") { promise: Promise ->
      connectionsClient.stopDiscovery()
      promise.resolve(null)
    }

    AsyncFunction("sendMessage") { endpointId: String, message: String, promise: Promise ->
      if (!connectedEndpoints.contains(endpointId)) {
        promise.reject("NOT_CONNECTED", "Not connected to endpoint: $endpointId", null)
        return@AsyncFunction
      }

      val payload = Payload.fromBytes(message.toByteArray(StandardCharsets.UTF_8))
      connectionsClient.sendPayload(endpointId, payload)
        .addOnSuccessListener {
          promise.resolve(null)
        }
        .addOnFailureListener { exception ->
          promise.reject("SEND_FAILED", "Failed to send message: ${exception.message}", exception)
        }
    }

    AsyncFunction("broadcastMessage") { message: String, promise: Promise ->
      if (connectedEndpoints.isEmpty()) {
        promise.reject("NO_CONNECTIONS", "No connected endpoints", null)
        return@AsyncFunction
      }

      val payload = Payload.fromBytes(message.toByteArray(StandardCharsets.UTF_8))
      for (endpointId in connectedEndpoints) {
        connectionsClient.sendPayload(endpointId, payload)
      }
      promise.resolve(null)
    }

    AsyncFunction("getConnectedPeers") { promise: Promise ->
      promise.resolve(connectedEndpoints.toList())
    }

    AsyncFunction("disconnectFromPeer") { endpointId: String, promise: Promise ->
      connectionsClient.disconnectFromEndpoint(endpointId)
      connectedEndpoints.remove(endpointId)
      promise.resolve(null)
    }

    AsyncFunction("disconnectFromAllPeers") { promise: Promise ->
      connectionsClient.stopAllEndpoints()
      connectedEndpoints.clear()
      promise.resolve(null)
    }

    AsyncFunction("startNearbyService") { promise: Promise ->
      try {
        Log.d("MeshPeerModule", "startNearbyService called")
        val context = appContext.reactContext!!
        Log.d("MeshPeerModule", "Got context: $context")
        
        val intent = Intent(context, NearbyService::class.java)
        Log.d("MeshPeerModule", "Created intent for NearbyService")
        
        val result = context.startForegroundService(intent)
        Log.d("MeshPeerModule", "startForegroundService returned: $result")
        
        promise.resolve("Service started successfully")
      } catch (e: Exception) {
        Log.e("MeshPeerModule", "Failed to start service: ${e.message}", e)
        promise.reject("SERVICE_START_FAILED", "Failed to start Nearby service: ${e.message}", e)
      }
    }

    AsyncFunction("stopNearbyService") { promise: Promise ->
      try {
        val context = appContext.reactContext!!
        val intent = Intent(context, NearbyService::class.java)
        context.stopService(intent)
        promise.resolve("Service stopped successfully")
      } catch (e: Exception) {
        promise.reject("SERVICE_STOP_FAILED", "Failed to stop Nearby service: ${e.message}", e)
      }
    }

    AsyncFunction("getAllMessageIds") { promise: Promise ->
      try {
        val messageIds = getAllMessageIds()
        promise.resolve(messageIds)
      } catch (e: Exception) {
        promise.reject("DATABASE_ERROR", "Failed to get message IDs: ${e.message}", e)
      }
    }

    // Keep the view functionality for compatibility
    View(MeshPeerModuleView::class) {
      Prop("url") { view: MeshPeerModuleView, url: URL ->
        view.webView.loadUrl(url.toString())
      }
      Events("onLoad")
    }
  }

  private fun hasRequiredPermissions(): Boolean {

    val context = appContext.reactContext ?: return false
    return requiredPermissions.all { permission ->
      ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    }
  }

}
