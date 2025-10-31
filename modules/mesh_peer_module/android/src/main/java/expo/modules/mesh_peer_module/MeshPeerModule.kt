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

data class Message(
    val id: String,
    val content: String,
    val sender: String,
    val time: Long,
    val chat: String
)

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

  private fun DebugLog(message: String) {
    sendEvent("onDebug", mapOf("message" to message))
  }

  override fun onPeerConnected(endpointId: String) {
    DebugLog("Peer connected")
    sendEvent("onPeerConnected", mapOf("endpointId" to endpointId))
  }

  override fun onPeerDisconnected(endpointId: String) {
    sendEvent("onPeerDisconnected", mapOf("endpointId" to endpointId))
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

  override fun onNewMessages(count: Int, totalMessages: Int) {
    sendEvent("onNewMessages", mapOf(
      "count" to count,
      "totalMessages" to totalMessages
    ))
  }

  override fun definition() = ModuleDefinition {
    Name("MeshPeerModule")

    OnCreate {

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
      "onConnectionFailed",
      "onNewMessages",
      "onDebug"
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

    AsyncFunction("startDiscovery") { promise: Promise ->
      android.util.Log.d("MeshPeerModule", "startDiscovery called")
      
      if (!hasRequiredPermissions()) {
        android.util.Log.w("MeshPeerModule", "startDiscovery failed: permissions not granted")
        promise.reject("PERMISSION_DENIED", "Required permissions not granted", null)
        return@AsyncFunction
      }

      val success: Boolean = nearbyService?.startFindConnections() ?: false
      if (success) {
        android.util.Log.d("MeshPeerModule", "startDiscovery succeeded")
        promise.resolve(null)
      } else {
        android.util.Log.e("MeshPeerModule", "startDiscovery failed")
        promise.reject("DISCOVERY_FAILED", "Failed to start discovery", null)
      }
    }

    AsyncFunction("stopDiscovery") { promise: Promise ->
      nearbyService?.stopFindConnections()
      promise.resolve(null)
    }

    AsyncFunction("sendMessage") {id: String, content: String, sender: String, time: Long, chat: String, promise: Promise ->
      val message = Message(id=id, content=content, sender=sender, time=time, chat=chat)
      val success = nearbyService?.sendMessage(message) ?: false
      if (success) {
        promise.resolve(null)
      } else {
        promise.reject("SEND_FAILED", "Failed to send message", null)
      }
    }

    AsyncFunction("getConnectedPeers") { promise: Promise ->
      val peers = nearbyService?.connectionHandler?.getConnectedPeers() ?: emptyList()
      promise.resolve(peers)
    }

    AsyncFunction("disconnectFromPeer") { endpointId: String, promise: Promise ->
      nearbyService?.connectionHandler?.disconnectFromPeer(endpointId)
      promise.resolve(null)
    }

    AsyncFunction("disconnectFromAllPeers") { promise: Promise ->
      nearbyService?.connectionHandler?.disconnectFromAllPeers()
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

    AsyncFunction("getUsername") { promise: Promise ->
      try {
        val context = appContext.reactContext ?: run {
          promise.reject("NO_CONTEXT", "App context is not available", null)
          return@AsyncFunction
        }
        val sharedPrefs = context.getSharedPreferences("cruise_chat_prefs", android.content.Context.MODE_PRIVATE)
        val username = sharedPrefs.getString("username", null)
        promise.resolve(username)
      } catch (e: Exception) {
        promise.reject("GET_USERNAME_ERROR", "Failed to get username: ${e.message}", e)
      }
    }

    AsyncFunction("setUsername") { username: String, promise: Promise ->
      try {
        val context = appContext.reactContext ?: run {
          promise.reject("NO_CONTEXT", "App context is not available", null)
          return@AsyncFunction
        }
        val sharedPrefs = context.getSharedPreferences("cruise_chat_prefs", android.content.Context.MODE_PRIVATE)
        sharedPrefs.edit().putString("username", username).apply()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("SET_USERNAME_ERROR", "Failed to set username: ${e.message}", e)
      }
    }

    AsyncFunction("isServiceRunning") { promise: Promise ->
      try {
        val isRunning = nearbyService?.isServiceRunning() ?: false
        promise.resolve(isRunning)
      } catch (e: Exception) {
        promise.reject("STATE_ERROR", "Failed to get service state: ${e.message}", e)
      }
    }

    AsyncFunction("isDiscovering") { promise: Promise ->
      try {
        val discovering = nearbyService?.isDiscovering() ?: false
        promise.resolve(discovering)
      } catch (e: Exception) {
        promise.reject("STATE_ERROR", "Failed to get discovery state: ${e.message}", e)
      }
    }

    AsyncFunction("subscribeToNotifications") { chatId: String, promise: Promise ->
      try {
        val success = nearbyService?.subscribeToNotifications(chatId) ?: false
        promise.resolve(success)
      } catch (e: Exception) {
        promise.reject("SUBSCRIBE_ERROR", "Failed to subscribe to notifications: ${e.message}", e)
      }
    }

    AsyncFunction("unsubscribeFromNotifications") { chatId: String, promise: Promise ->
      try {
        val success = nearbyService?.unsubscribeFromNotifications(chatId) ?: false
        promise.resolve(success)
      } catch (e: Exception) {
        promise.reject("UNSUBSCRIBE_ERROR", "Failed to unsubscribe from notifications: ${e.message}", e)
      }
    }

    AsyncFunction("getNotificationSubscriptions") { promise: Promise ->
      try {
        val subscriptions = nearbyService?.getNotificationSubscriptions() ?: emptyList()
        promise.resolve(subscriptions)
      } catch (e: Exception) {
        promise.reject("GET_SUBSCRIPTIONS_ERROR", "Failed to get notification subscriptions: ${e.message}", e)
      }
    }

    AsyncFunction("isSubscribedToNotifications") { chatId: String, promise: Promise ->
      try {
        val isSubscribed = nearbyService?.isSubscribedToNotifications(chatId) ?: false
        promise.resolve(isSubscribed)
      } catch (e: Exception) {
        promise.reject("CHECK_SUBSCRIPTION_ERROR", "Failed to check notification subscription: ${e.message}", e)
      }
    }

    AsyncFunction("clearNotificationSubscriptions") { promise: Promise ->
      try {
        nearbyService?.clearNotificationSubscriptions()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("CLEAR_SUBSCRIPTIONS_ERROR", "Failed to clear notification subscriptions: ${e.message}", e)
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
