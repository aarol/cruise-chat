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

// JSON imports
import org.json.JSONObject
import org.json.JSONArray

class NearbyService : Service(), ConnectionHandler.ConnectionCallbacks {

    private val CHANNEL_ID = "nearby_service_channel"
    private val TAG = "NearbyService"
    
    // Message sync protocol types
    private val MSG_TYPE_SYNC_REQUEST = "sync_request"
    private val MSG_TYPE_SYNC_RESPONSE = "sync_response"
    private val MSG_TYPE_MESSAGE_BATCH = "message_batch"
    private val MSG_TYPE_CHAT_MESSAGE = "chat_message"
    
    private val binder = LocalBinder()

    interface NearbyServiceListener {
        fun onPeerConnected(endpointId: String)
        fun onPeerDisconnected(endpointId: String)
        fun onConnectionFailed(endpointId: String, error: String)

        fun onNewMessages(count: Int, totalMessages: Int)
        fun onMessageReceived(endpointId: String, message: String)
    }
    
    private var listener: NearbyServiceListener? = null
    
    // Persistent database connection
    private var database: SQLiteDatabase? = null
    public var connectionHandler: ConnectionHandler = ConnectionHandler()
    
    // State tracking
    private var isServiceRunning = false
    private var isDiscovering = false
    
    
    inner class LocalBinder : Binder() {
        fun getService(): NearbyService = this@NearbyService
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "NearbyService onCreate() called")
        initializeDatabase()
        createNotificationChannel()
        connectionHandler.setListener(this@NearbyService)
        connectionHandler.Init(this)
    }

    override fun onStartCommand(intent: Intent?, startFlags: Int, startId: Int): Int {
        Log.d(TAG, "NearbyService onStartCommand() called")
        isServiceRunning = true

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

    public fun startFindConnections(): Boolean {
        val res1: Boolean = connectionHandler.startDiscovery()
        val res2: Boolean = connectionHandler.startAdvertising()
        isDiscovering = res1 && res2
        return isDiscovering
    }
    public fun stopFindConnections(): Boolean {
        val res1: Boolean = connectionHandler.stopDiscovery()
        val res2: Boolean = connectionHandler.stopAdvertising()
        isDiscovering = false
        return res1 && res2
    }
    
    public fun isServiceRunning(): Boolean {
        return isServiceRunning
    }
    
    public fun isDiscovering(): Boolean {
        return isDiscovering
    }

    fun setListener(listener: NearbyServiceListener?) {
        this.listener = listener
    }
    
    override fun onPeerConnected(endpointId: String) {
        // Initiate message synchronization by sending our known message IDs
        initiateSyncWithPeer(endpointId)
        listener?.onPeerConnected(endpointId)
    }
    override fun onPeerDisconnected(endpointId: String) {
        listener?.onPeerDisconnected(endpointId)
    }
    override fun onConnectionFailed(endpointId: String, error: String) {
        listener?.onConnectionFailed(endpointId, error)
    }

    override fun onPayloadReceived(endpointId: String, payload: Payload) {
        when (payload.type) {
            Payload.Type.BYTES -> {
                val messageData = String(payload.asBytes()!!, StandardCharsets.UTF_8)
                
                try {
                    val jsonMessage = JSONObject(messageData)
                    val messageType = jsonMessage.getString("type")
                    
                    when (messageType) {
                        MSG_TYPE_SYNC_REQUEST -> handleSyncRequest(endpointId, jsonMessage)
                        MSG_TYPE_SYNC_RESPONSE -> handleSyncResponse(endpointId, jsonMessage)
                        MSG_TYPE_MESSAGE_BATCH -> handleMessageBatch(endpointId, jsonMessage)
                        MSG_TYPE_CHAT_MESSAGE -> {
                            // Create message object from JSON
                            val message = Message(
                                id = jsonMessage.getString("id"),
                                content = jsonMessage.getString("content"),
                                sender = jsonMessage.optString("sender", endpointId),
                                time = jsonMessage.getLong("created_at"),
                                chat = jsonMessage.optString("chat", "default")
                            )
                            
                            Log.d(TAG, "📨 Received chat message from $endpointId | ID: ${message.id} | Content: ${message.content}")
                            
                            // Check if we already have this message
                            if (!messageExists(message.id)) {
                                Log.d(TAG, "✅ New message, storing and broadcasting | ID: ${message.id}")
                                
                                // Store message in SQLite database
                                val stored = storeMessage(message)
                                Log.d(TAG, "💾 Message stored: $stored | ID: ${message.id}")
                                
                                // Broadcast to all connected peers (except sender)
                                val connectedPeers = connectionHandler.getConnectedPeers().size
                                Log.d(TAG, "📡 Broadcasting message to $connectedPeers peers (excluding sender $endpointId)")
                                broadcastMessageToOthers(messageData)
                                
                                // Notify listener
                                listener?.onMessageReceived(endpointId, message.content)
                                notifyNewMessages(1)
                                Log.d(TAG, "🔔 Notified listener about new message | ID: ${message.id}")
                            } else {
                                Log.d(TAG, "Message ${message.id} already exists, skipping")
                            }
                        }
                    }
                } catch (e: Exception) {
                    // If JSON parsing fails, treat as regular chat message for backward compatibility
                    Log.w(TAG, "Failed to parse message as JSON. ${e.message}")
                }
            }
        }
    }

    private fun initializeDatabase() {
        try {
            val dbPath = getDatabasePath()
            database = SQLiteDatabase.openDatabase(dbPath, null, SQLiteDatabase.OPEN_READWRITE)
            Log.d(TAG, "Database connection established")
        } catch (e: SQLiteException) {
            Log.e(TAG, "Failed to initialize database: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing database: ${e.message}")
        }
    }
    
    private fun closeDatabase() {
        try {
            database?.close()
            database = null
            Log.d(TAG, "Database connection closed")
        } catch (e: Exception) {
            Log.e(TAG, "Error closing database: ${e.message}")
        }
    }
    
    private fun getDatabasePath(): String {
        return File(filesDir, "SQLite/cruise-chat.db").absolutePath
    }
    
    fun sendMessage(message: Message): Boolean {
        return try {
            val messageId = message.id
            val timestamp = message.time
            
            Log.d(TAG, "📤 Sending new message | ID: $messageId | Content: $message")
            
            val chatMessage = JSONObject().apply {
                put("type", MSG_TYPE_CHAT_MESSAGE)
                put("id", message.id)
                put("content", message.content)
                put("chat", message.chat)
                put("sender", message.sender)
                put("created_at", message.time)
            }
            
            // Store locally first
            val stored = storeMessage(message)
            Log.d(TAG, "💾 Message stored locally: $stored | ID: $messageId")
            
            // Then broadcast to all peers
            val connectedPeers = connectionHandler.getConnectedPeers()
            Log.d(TAG, "📡 Broadcasting to ${connectedPeers.size} connected peers: $connectedPeers")
            
            val payload = Payload.fromBytes(chatMessage.toString().toByteArray(StandardCharsets.UTF_8))
            connectionHandler.sendPayloads(payload)
            
            Log.d(TAG, "✅ Message broadcast complete | ID: $messageId")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error broadcasting message: ${e.message}")
            false
        }
    }
    
    fun getAllMessageIds(): List<String> {
        val messageIds = mutableListOf<String>()
        
        try {
            val cursor = database!!.rawQuery("SELECT id FROM messages ORDER BY created_at DESC", null)
            
            cursor.use { // Use 'use' to ensure cursor is closed automatically
                if (cursor.moveToFirst()) {
                    do {
                        val messageId = cursor.getString(cursor.getColumnIndexOrThrow("id"))
                        messageIds.add(messageId)
                    } while (cursor.moveToNext())
                }
            }
            
        } catch (e: SQLiteException) {
            Log.e(TAG, "SQLite error getting message IDs: ${e.message}")
            // Try to recover by reinitializing database
            initializeDatabase()
        } catch (e: Exception) {
            Log.e(TAG, "Error getting message IDs: ${e.message}")
        }
        
        return messageIds
    }
    
    fun getMessageCount(): Int {
        try {
            val db = database ?: run {
                Log.w(TAG, "Database not initialized for message count")
                return 0
            }
            
            val cursor = db.rawQuery("SELECT COUNT(*) FROM messages", null)
            cursor.use {
                return if (cursor.moveToFirst()) {
                    cursor.getInt(0)
                } else {
                    0
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting message count: ${e.message}")
            return 0
        }
    }
    
    fun isDatabaseReady(): Boolean {
        return database != null && database?.isOpen == true
    }
    
    private fun notifyNewMessages(newMessageCount: Int) {
        try {
            val totalMessages = getMessageCount()
            listener?.onNewMessages(newMessageCount, totalMessages)
            Log.d(TAG, "Notified listener about $newMessageCount new messages (total: ${totalMessages})")
        } catch (e: Exception) {
            Log.e(TAG, "Error notifying about new messages: ${e.message}")
        }
    }
    
    private fun messageExists(messageId: String): Boolean {
        return try {
            val existsQuery = "SELECT COUNT(*) FROM messages WHERE id = ?"
            val cursor = database?.rawQuery(existsQuery, arrayOf(messageId))
            
            cursor?.use {
                it.moveToFirst() && it.getInt(0) > 0
            } ?: false
        } catch (e: Exception) {
            Log.e(TAG, "Error checking if message exists: ${e.message}")
            false
        }
    }
    
    private fun broadcastMessageToOthers(messageJson: String) {
        try {
            val payload = Payload.fromBytes(messageJson.toByteArray(StandardCharsets.UTF_8))
            connectionHandler.sendPayloads(payload)
            Log.d(TAG, "Broadcasted message to all peers")
        } catch (e: Exception) {
            Log.e(TAG, "Error broadcasting message: ${e.message}")
        }
    }
    
    // Message synchronization methods
    
    private fun initiateSyncWithPeer(endpointId: String) {
        try {
            val knownMessageIds = getAllMessageIds()
            val syncRequest = JSONObject().apply {
                put("type", MSG_TYPE_SYNC_REQUEST)
                put("messageIds", JSONArray(knownMessageIds))
            }
            
            val payload = Payload.fromBytes(syncRequest.toString().toByteArray(StandardCharsets.UTF_8))
            connectionHandler.sendPayload(endpointId, payload)
            
            Log.d(TAG, "Sent sync request to $endpointId with ${knownMessageIds.size} known message IDs")
        } catch (e: Exception) {
            Log.e(TAG, "Error initiating sync with peer $endpointId: ${e.message}")
        }
    }
    
    private fun handleSyncRequest(endpointId: String, jsonMessage: JSONObject) {
        try {
            val receivedMessageIds = jsonMessage.getJSONArray("messageIds")
            val receivedIds = mutableSetOf<String>()
            
            // Convert JSONArray to Set
            for (i in 0 until receivedMessageIds.length()) {
                receivedIds.add(receivedMessageIds.getString(i))
            }
            
            val localMessageIds = getAllMessageIds().toSet()
            
            // Find messages we need from the peer (they have but we don't)
            val missingMessageIds = receivedIds - localMessageIds
            
            // Send sync response with the IDs we want to receive
            val syncResponse = JSONObject().apply {
                put("type", MSG_TYPE_SYNC_RESPONSE)
                put("requestedIds", JSONArray(missingMessageIds.toList()))
            }
            
            val payload = Payload.fromBytes(syncResponse.toString().toByteArray(StandardCharsets.UTF_8))
            connectionHandler.sendPayload(endpointId, payload)
            
            Log.d(TAG, "Handled sync request from $endpointId: requesting ${missingMessageIds.size} messages")
        } catch (e: Exception) {
            Log.e(TAG, "Error handling sync request from $endpointId: ${e.message}")
        }
    }
    
    private fun handleSyncResponse(endpointId: String, jsonMessage: JSONObject) {
        try {
            val requestedIds = jsonMessage.getJSONArray("requestedIds")
            val idsToSend = mutableListOf<String>()
            
            // Convert JSONArray to List
            for (i in 0 until requestedIds.length()) {
                idsToSend.add(requestedIds.getString(i))
            }
            
            if (idsToSend.isNotEmpty()) {
                sendMessageBatch(endpointId, idsToSend)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling sync response from $endpointId: ${e.message}")
        }
    }
    
    private fun handleMessageBatch(endpointId: String, jsonMessage: JSONObject) {
        Log.d(TAG, "Received message batch from $endpointId. Processing...")
        try {
            val messages = jsonMessage.getJSONArray("messages")
            var storedCount = 0
            
            for (i in 0 until messages.length()) {
                val messageObj = messages.getJSONObject(i)
                val messageId = messageObj.getString("id")
                val content = messageObj.getString("content")
                val userId = messageObj.getString("user_id")
                val createdAt = messageObj.getLong("created_at")
                val chat = messageObj.optString("chat", "default")
                
                val message = Message(messageId, content, userId, createdAt, chat)
                if (storeMessage(message)) {
                    storedCount++
                }
            }
            
            // Notify listener about new synced messages if any were stored
            if (storedCount > 0) {
                notifyNewMessages(storedCount)
            }
            
            Log.d(TAG, "Received message batch from $endpointId: stored $storedCount/${messages.length()} messages")
        } catch (e: Exception) {
            Log.e(TAG, "Error handling message batch from $endpointId: ${e.message}")
        }
    }
    
    private fun sendMessageBatch(endpointId: String, messageIds: List<String>) {
        try {
            val messages = getMessagesByIds(messageIds)
            val messageBatch = JSONObject().apply {
                put("type", MSG_TYPE_MESSAGE_BATCH)
                put("messages", JSONArray(messages))
            }
            
            val payload = Payload.fromBytes(messageBatch.toString().toByteArray(StandardCharsets.UTF_8))
            connectionHandler.sendPayload(endpointId, payload)
            
            Log.d(TAG, "Sent message batch to $endpointId with ${messages.size} messages")
        } catch (e: Exception) {
            Log.e(TAG, "Error sending message batch to $endpointId: ${e.message}")
        }
    }
    
    private fun getMessagesByIds(messageIds: List<String>): List<JSONObject> {
        val messages = mutableListOf<JSONObject>()
        try {
            if (messageIds.isEmpty()) return messages
            
            val placeholders = messageIds.joinToString(",") { "?" }
            val query = "SELECT id, content, user_id, chat_id, created_at FROM messages WHERE id IN ($placeholders)"
            
            val cursor = database?.rawQuery(query, messageIds.toTypedArray())
            
            cursor?.use {
                if (cursor.moveToFirst()) {
                    do {
                        val messageObj = JSONObject().apply {
                            put("id", cursor.getString(cursor.getColumnIndexOrThrow("id")))
                            put("content", cursor.getString(cursor.getColumnIndexOrThrow("content")))
                            put("user_id", cursor.getString(cursor.getColumnIndexOrThrow("user_id")))
                            put("chat_id", cursor.getString(cursor.getColumnIndexOrThrow("chat_id")))
                            put("created_at", cursor.getLong(cursor.getColumnIndexOrThrow("created_at")))
                        }
                        messages.add(messageObj)
                    } while (cursor.moveToNext())
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting messages by IDs: ${e.message}")
        }
        
        return messages
    }
    
    private fun storeMessage(message: Message): Boolean {
        try {
            // Check if message already exists
            val existsQuery = "SELECT COUNT(*) FROM messages WHERE id = ?"
            val cursor = database?.rawQuery(existsQuery, arrayOf(message.id))
            
            val exists = cursor?.use {
                it.moveToFirst() && it.getInt(0) > 0
            } ?: false
            
            if (exists) {
                Log.d(TAG, "Message ${message.id} already exists, skipping")
                return false
            }
            
            val insertSql = """
                INSERT INTO messages (id, content, user_id, chat_id, created_at) 
                VALUES (?, ?, ?, ?, ?)
            """.trimIndent()
            
            database?.execSQL(insertSql, arrayOf(message.id, message.content, message.sender, "text", message.time))
            
            Log.d(TAG, "Stored synced message: ${message.id}")
            return true
            
        } catch (e: SQLiteException) {
            Log.e(TAG, "SQLite error storing synced message ${message.id}: ${e.message}")
            return false
        } catch (e: Exception) {
            Log.e(TAG, "Error storing synced message ${message.id}: ${e.message}")
            return false
        }
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
        connectionHandler.disconnectFromAllPeers()
        connectionHandler.stopAdvertising()
        connectionHandler.stopDiscovery()
        isServiceRunning = false
        isDiscovering = false
        closeDatabase()
        Log.d(TAG, "NearbyService destroyed")
    }
}