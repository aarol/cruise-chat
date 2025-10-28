package expo.modules.mesh_peer_module

import android.app.Notification
import android.app.PendingIntent
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.Binder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import java.nio.charset.StandardCharsets

// SQLite imports
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import java.io.File
import java.util.UUID

class NearbyService : Service() {

    private val CHANNEL_ID = "nearby_service_channel"
    private val TAG = "NearbyService"
    
    private lateinit var connectionsClient: ConnectionsClient
    private val connectedEndpoints = mutableSetOf<String>()
    private val strategy = Strategy.P2P_CLUSTER
    private val binder = LocalBinder()
    
    // Callback to notify the module about events
    interface NearbyServiceListener {
        fun onPeerDiscovered(endpointId: String, name: String)
        fun onPeerConnected(endpointId: String)
        fun onPeerDisconnected(endpointId: String)
        fun onPeerLost(endpointId: String)
        fun onMessageReceived(endpointId: String, message: String)
        fun onConnectionFailed(endpointId: String, error: String)
    }
    
    private var listener: NearbyServiceListener? = null
    
    inner class LocalBinder : Binder() {
        fun getService(): NearbyService = this@NearbyService
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "NearbyService onCreate() called")
        createNotificationChannel()
        connectionsClient = Nearby.getConnectionsClient(this)
    }

    override fun onStartCommand(intent: Intent?, startFlags: Int, startId: Int): Int {
        Log.d(TAG, "NearbyService onStartCommand() called")

        val appIntent = packageManager.getLaunchIntentForPackage(applicationContext.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        }
        val pendingIntent: PendingIntent = PendingIntent.getActivity(this, 0, appIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Nearby Connections")
            .setContentText("Discovering nearby devices...")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setShowWhen(true)
            .setContentIntent(pendingIntent)
            .setAutoCancel(false)
            .build()

        try {
            startForeground(1, notification)
            Log.d(TAG, "Started foreground service with notification")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error starting foreground service: ${e.message}", e)
        }

        return START_STICKY
    }

    fun setListener(listener: NearbyServiceListener?) {
        this.listener = listener
    }
    
    fun startAdvertising(): Boolean {
        val advertisingOptions = AdvertisingOptions.Builder().setStrategy(strategy).build()
        return try {
            connectionsClient.startAdvertising(
                "CruiseChat_${android.os.Build.MODEL}",
                "CruiseChat",
                connectionLifecycleCallback,
                advertisingOptions
            )
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start advertising: ${e.message}")
            false
        }
    }
    
    fun startDiscovery(): Boolean {
        val discoveryOptions = DiscoveryOptions.Builder().setStrategy(strategy).build()
        return try {
            connectionsClient.startDiscovery(
                "CruiseChat",
                endpointDiscoveryCallback,
                discoveryOptions
            )
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start discovery: ${e.message}")
            false
        }
    }
    
    fun stopAdvertising() {
        connectionsClient.stopAdvertising()
    }
    
    fun stopDiscovery() {
        connectionsClient.stopDiscovery()
    }
    
    fun sendMessage(endpointId: String, message: String): Boolean {
        return if (connectedEndpoints.contains(endpointId)) {
            val payload = Payload.fromBytes(message.toByteArray(StandardCharsets.UTF_8))
            connectionsClient.sendPayload(endpointId, payload)
            true
        } else {
            false
        }
    }
    
    fun broadcastMessage(message: String): Boolean {
        if (connectedEndpoints.isEmpty()) return false
        
        val payload = Payload.fromBytes(message.toByteArray(StandardCharsets.UTF_8))
        connectedEndpoints.forEach { endpointId ->
            connectionsClient.sendPayload(endpointId, payload)
        }
        return true
    }
    
    fun getConnectedPeers(): List<String> = connectedEndpoints.toList()
    
    fun disconnectFromPeer(endpointId: String) {
        connectionsClient.disconnectFromEndpoint(endpointId)
        connectedEndpoints.remove(endpointId)
    }
    
    fun disconnectFromAllPeers() {
        connectionsClient.stopAllEndpoints()
        connectedEndpoints.clear()
    }

    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, connectionInfo: ConnectionInfo) {
            connectionsClient.acceptConnection(endpointId, payloadCallback)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            when (result.status.statusCode) {
                ConnectionsStatusCodes.STATUS_OK -> {
                    connectedEndpoints.add(endpointId)
                    listener?.onPeerConnected(endpointId)
                }
                ConnectionsStatusCodes.STATUS_CONNECTION_REJECTED -> {
                    listener?.onConnectionFailed(endpointId, "Connection rejected")
                }
                else -> {
                    listener?.onConnectionFailed(endpointId, "Connection failed with status: ${result.status.statusCode}")
                }
            }
        }

        override fun onDisconnected(endpointId: String) {
            connectedEndpoints.remove(endpointId)
            listener?.onPeerDisconnected(endpointId)
        }
    }

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            when (payload.type) {
                Payload.Type.BYTES -> {
                    val message = String(payload.asBytes()!!, StandardCharsets.UTF_8)
                    
                    // Store message in SQLite database
                    storeMessage(message, endpointId)
                    
                    // Notify listener
                    listener?.onMessageReceived(endpointId, message)
                }
            }
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
            // Handle payload transfer updates if needed
        }
    }

    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            connectionsClient.requestConnection(
                "CruiseChat_${android.os.Build.MODEL}",
                endpointId,
                connectionLifecycleCallback
            )
            
            listener?.onPeerDiscovered(endpointId, info.endpointName)
        }

        override fun onEndpointLost(endpointId: String) {
            listener?.onPeerLost(endpointId)
        }
    }
    
    private fun storeMessage(content: String, senderId: String) {
        try {
            val dbPath = getDatabasePath()
            val database = SQLiteDatabase.openDatabase(dbPath, null, SQLiteDatabase.OPEN_READWRITE)
            
            val messageId = UUID.randomUUID().toString()
            val timestamp = System.currentTimeMillis() / 1000 // Unix timestamp
            
            val insertSql = """
                INSERT INTO messages (id, content, user_id, message_type, created_at) 
                VALUES (?, ?, ?, ?, ?)
            """.trimIndent()
            
            database.execSQL(insertSql, arrayOf(messageId, content, senderId, "text", timestamp))
            database.close()
            
            Log.d(TAG, "Message stored in database: $messageId")
            
        } catch (e: SQLiteException) {
            Log.e(TAG, "SQLite error storing message: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Error storing message: ${e.message}")
        }
    }
    
    private fun getDatabasePath(): String {
        return File(filesDir, "SQLite/cruise-chat.db").absolutePath
    }
    
    fun getAllMessageIds(): List<String> {
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
            
        } catch (e: SQLiteException) {
            Log.e(TAG, "SQLite error getting message IDs: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Error getting message IDs: ${e.message}")
        }
        
        return messageIds
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Nearby Service Channel",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows status of nearby device connections"
                setShowBadge(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(serviceChannel)
        }
    }

    override fun onBind(intent: Intent?): IBinder {
        return binder
    }
    
    override fun onDestroy() {
        super.onDestroy()
        disconnectFromAllPeers()
        stopAdvertising()
        stopDiscovery()
        Log.d(TAG, "NearbyService destroyed")
    }
}