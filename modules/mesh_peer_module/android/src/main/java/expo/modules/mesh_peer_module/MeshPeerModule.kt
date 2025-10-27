package expo.modules.mesh_peer_module

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
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

class MeshPeerModule : Module() {
  private lateinit var connectionsClient: ConnectionsClient
  private val connectedEndpoints = mutableSetOf<String>()
  
  // Strategy for connections - CLUSTER allows many-to-many connections
  private val strategy = Strategy.P2P_CLUSTER
  
  // Helper function for debug logging
  private fun DebugLog(message: String) {
    sendEvent("onDebug", mapOf("message" to message))
  }

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
      connectionsClient = Nearby.getConnectionsClient(appContext.reactContext!!)
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
      "onMessageReceive" // Keep for backward compatibility
    )

    // Legacy functions for compatibility
    Function("hello") {
      "CruiseChat with Nearby Connections! 🚢"
    }

    AsyncFunction("setValueAsync") { value: String ->
      // Broadcast message to all connected endpoints
      val payload = Payload.fromBytes(value.toByteArray(StandardCharsets.UTF_8))
      for (endpointId in connectedEndpoints) {
        connectionsClient.sendPayload(endpointId, payload)
      }
      sendEvent("onMessageReceive", mapOf("value" to value))
    }

    // New Nearby Connections functions. This function doesn't run it seems
    AsyncFunction("requestPermissions") { promise: Promise ->
      DebugLog("Requesting permissions on kotlin side")
      val requiredPermissions = arrayOf(
        Manifest.permission.BLUETOOTH,
        Manifest.permission.BLUETOOTH_ADMIN,
        Manifest.permission.ACCESS_WIFI_STATE,
        Manifest.permission.CHANGE_WIFI_STATE,
        Manifest.permission.ACCESS_COARSE_LOCATION,
        Manifest.permission.ACCESS_FINE_LOCATION
      )
      
      // Check if we have all permissions
      if (hasRequiredPermissions()) {
        promise.resolve(mapOf("granted" to true))
        return@AsyncFunction
      }
      
      // For now, return the permissions we need - React Native will handle the request
      promise.resolve(mapOf(
        "granted" to false,
        "permissions" to requiredPermissions.toList()
      ))
    }

    AsyncFunction("checkPermissions") { promise: Promise ->
      promise.resolve(mapOf("granted" to hasRequiredPermissions()))
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

    // Keep the view functionality for compatibility
    View(MeshPeerModuleView::class) {
      Prop("url") { view: MeshPeerModuleView, url: URL ->
        view.webView.loadUrl(url.toString())
      }
      Events("onLoad")
    }
  }

  private fun hasRequiredPermissions(): Boolean {
    return true;

    val context = appContext.reactContext ?: return false
    val requiredPermissions = arrayOf(
      Manifest.permission.BLUETOOTH,
      Manifest.permission.BLUETOOTH_ADMIN,
      Manifest.permission.ACCESS_WIFI_STATE,
      Manifest.permission.CHANGE_WIFI_STATE,
      Manifest.permission.ACCESS_COARSE_LOCATION
    )
    
    return requiredPermissions.all { permission ->
      ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    }
  }
}
