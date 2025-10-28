package expo.modules.mesh_peer_module

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.IBinder
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.URL

class MeshPeerModule : Module(), NearbyService.NearbyServiceListener {
  private var nearbyService: NearbyService? = null
  private var serviceBound = false

  companion object {
    private const val REQUEST_CODE_PERMISSIONS = 1234
  }

  private val requiredPermissions: List<String>
    get() {
      val basePermissions = mutableListOf<String>()
      
      basePermissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
      
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
        basePermissions.addAll(listOf(
          Manifest.permission.BLUETOOTH_ADVERTISE,
          Manifest.permission.BLUETOOTH_CONNECT,
          Manifest.permission.BLUETOOTH_SCAN,
          Manifest.permission.NEARBY_WIFI_DEVICES
        ))
      } else {
        basePermissions.addAll(listOf(
          Manifest.permission.BLUETOOTH,
          Manifest.permission.BLUETOOTH_ADMIN
        ))
      }
      
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
        basePermissions.add(Manifest.permission.POST_NOTIFICATIONS)
      }
      
      return basePermissions
    }

  // Service connection callbacks
  private val serviceConnection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
      val binder = service as NearbyService.LocalBinder
      nearbyService = binder.getService()
      serviceBound = true
      nearbyService?.setListener(this@MeshPeerModule)
    }

    override fun onServiceDisconnected(name: ComponentName?) {
      nearbyService = null
      serviceBound = false
    }
  }

  // NearbyService.NearbyServiceListener implementation
  override fun onPeerDiscovered(endpointId: String, name: String) {
    sendEvent("onPeerDiscovered", mapOf(
      "endpointId" to endpointId,
      "name" to name
    ))
  }

  override fun onPeerConnected(endpointId: String) {
    sendEvent("onPeerConnected", mapOf("endpointId" to endpointId))
  }

  override fun onPeerDisconnected(endpointId: String) {
    sendEvent("onPeerDisconnected", mapOf("endpointId" to endpointId))
  }

  override fun onPeerLost(endpointId: String) {
    sendEvent("onPeerLost", mapOf("endpointId" to endpointId))
  }

  override fun onMessageReceived(endpointId: String, message: String) {
    sendEvent("onMessageReceived", mapOf(
      "endpointId" to endpointId,
      "message" to message
    ))
  }

  override fun onConnectionFailed(endpointId: String, error: String) {
    sendEvent("onConnectionFailed", mapOf(
      "endpointId" to endpointId,
      "error" to error
    ))
  }

  override fun definition() = ModuleDefinition {
    Name("MeshPeerModule")

    OnCreate {
      // Bind to the NearbyService
      bindToNearbyService()
    }

    OnDestroy {
      unbindFromNearbyService()
    }

    Events(
      "onPeerDiscovered",
      "onPeerConnected", 
      "onPeerDisconnected",
      "onPeerLost",
      "onMessageReceived",
      "onConnectionFailed"
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
      val activity = appContext.currentActivity ?: run {
        promise.reject("NO_ACTIVITY", "Activity not available", null)
        return@AsyncFunction
      }

      val notGranted = requiredPermissions.filter {
        ContextCompat.checkSelfPermission(activity, it) != PackageManager.PERMISSION_GRANTED
      }

      if (notGranted.isEmpty()) {
        promise.resolve(true)
        return@AsyncFunction
      }

      ActivityCompat.requestPermissions(activity, notGranted.toTypedArray(), REQUEST_CODE_PERMISSIONS)
      promise.resolve(true)
    }

    AsyncFunction("startAdvertising") { promise: Promise ->
      android.util.Log.d("MeshPeerModule", "startAdvertising called")
      
      if (!hasRequiredPermissions()) {
      android.util.Log.w("MeshPeerModule", "startAdvertising failed: permissions not granted")
      promise.reject("PERMISSION_DENIED", "Required permissions not granted", null)
      return@AsyncFunction
      }
      
      val success = nearbyService?.startAdvertising() ?: false
      if (success) {
      android.util.Log.d("MeshPeerModule", "startAdvertising succeeded")
      promise.resolve(null)
      } else {
      android.util.Log.e("MeshPeerModule", "startAdvertising failed")
      promise.reject("ADVERTISING_FAILED", "Failed to start advertising", null)
      }
    }

    AsyncFunction("startDiscovery") { promise: Promise ->
      android.util.Log.d("MeshPeerModule", "startDiscovery called")
      
      if (!hasRequiredPermissions()) {
        android.util.Log.w("MeshPeerModule", "startDiscovery failed: permissions not granted")
        promise.reject("PERMISSION_DENIED", "Required permissions not granted", null)
        return@AsyncFunction
      }

      val success = nearbyService?.startDiscovery() ?: false
      if (success) {
        android.util.Log.d("MeshPeerModule", "startDiscovery succeeded")
        promise.resolve(null)
      } else {
        android.util.Log.e("MeshPeerModule", "startDiscovery failed")
        promise.reject("DISCOVERY_FAILED", "Failed to start discovery", null)
      }
    }

    AsyncFunction("stopAdvertising") { promise: Promise ->
      nearbyService?.stopAdvertising()
      promise.resolve(null)
    }

    AsyncFunction("stopDiscovery") { promise: Promise ->
      nearbyService?.stopDiscovery()
      promise.resolve(null)
    }

    AsyncFunction("sendMessage") { endpointId: String, message: String, promise: Promise ->
      val success = nearbyService?.sendMessage(endpointId, message) ?: false
      if (success) {
        promise.resolve(null)
      } else {
        promise.reject("SEND_FAILED", "Failed to send message", null)
      }
    }

    AsyncFunction("broadcastMessage") { message: String, promise: Promise ->
      val success = nearbyService?.broadcastMessage(message) ?: false
      if (success) {
        promise.resolve(null)
      } else {
        promise.reject("BROADCAST_FAILED", "Failed to broadcast message", null)
      }
    }

    AsyncFunction("getConnectedPeers") { promise: Promise ->
      val peers = nearbyService?.getConnectedPeers() ?: emptyList()
      promise.resolve(peers)
    }

    AsyncFunction("disconnectFromPeer") { endpointId: String, promise: Promise ->
      nearbyService?.disconnectFromPeer(endpointId)
      promise.resolve(null)
    }

    AsyncFunction("disconnectFromAllPeers") { promise: Promise ->
      nearbyService?.disconnectFromAllPeers()
      promise.resolve(null)
    }

    AsyncFunction("startNearbyService") { promise: Promise ->
      try {
        val context = appContext.reactContext!!
        val intent = Intent(context, NearbyService::class.java)
        context.startForegroundService(intent)
        bindToNearbyService()
        promise.resolve("Service started successfully")
      } catch (e: Exception) {
        promise.reject("SERVICE_START_FAILED", "Failed to start Nearby service: ${e.message}", e)
      }
    }

    AsyncFunction("stopNearbyService") { promise: Promise ->
      try {
        unbindFromNearbyService()
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
        val messageIds = nearbyService?.getAllMessageIds() ?: emptyList()
        promise.resolve(messageIds)
      } catch (e: Exception) {
        promise.reject("DATABASE_ERROR", "Failed to get message IDs: ${e.message}", e)
      }
    }

    View(MeshPeerModuleView::class) {
      Prop("url") { view: MeshPeerModuleView, url: URL ->
        view.webView.loadUrl(url.toString())
      }
      Events("onLoad")
    }
  }

  private fun bindToNearbyService() {
    val context = appContext.reactContext ?: return
    val intent = Intent(context, NearbyService::class.java)
    context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
  }

  private fun unbindFromNearbyService() {
    if (serviceBound) {
      val context = appContext.reactContext ?: return
      context.unbindService(serviceConnection)
      serviceBound = false
      nearbyService?.setListener(null)
      nearbyService = null
    }
  }

  private fun hasRequiredPermissions(): Boolean {
    val context = appContext.reactContext ?: return false
    return requiredPermissions.all { permission ->
      ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    }
  }
}
