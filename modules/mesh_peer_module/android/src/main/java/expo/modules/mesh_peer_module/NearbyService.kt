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

class NearbyService : Service() {

    private val CHANNEL_ID = "nearby_service_channel"
    private val TAG = "NearbyService"
    
    // Message sync protocol types
    private val MSG_TYPE_SYNC_REQUEST = "sync_request"
    private val MSG_TYPE_SYNC_RESPONSE = "sync_response"
    private val MSG_TYPE_MESSAGE_BATCH = "message_batch"
    private val MSG_TYPE_CHAT_MESSAGE = "chat_message"
    
    private lateinit var connectionsClient: ConnectionsClient
    private val connectedEndpoints = mutableSetOf<String>()
    private val strategy = Strategy.P2P_CLUSTER
    private val binder = LocalBinder()
    
    // Persistent database connection
    private var database: SQLiteDatabase? = null
    
    // Callback to notify the module about events
    interface NearbyServiceListener {
        fun onPeerDiscovered(endpointId: String, name: String)
        fun onPeerConnected(endpointId: String)
        fun onPeerDisconnected(endpointId: String)
        fun onPeerLost(endpointId: String)
        fun onMessageReceived(endpointId: String, message: String)
        fun onConnectionFailed(endpointId: String, error: String)
        fun onNewMessages(count: Int, totalMessages: Int)
    }
    
    private var listener: NearbyServiceListener? = null
    
    inner class LocalBinder : Binder() {
        fun getService(): NearbyService = this@NearbyService
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "NearbyService onCreate() called")
        initializeDatabase()
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
            Log.d(TAG, "Starting advertising")
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
            Log.d(TAG, "Starting discovery")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start discovery: ${e.message}")
            false
        }
    }
    
    fun stopAdvertising() {
        Log.d(TAG, "stop advertising")
        connectionsClient.stopAdvertising()
    }
    
    fun stopDiscovery() {
        Log.d(TAG, "stop discovery")
        connectionsClient.stopDiscovery()
    }
    
    fun sendMessage(endpointId: String, message: String): Boolean {
        Log.d(TAG, "Sending message")
        return if (connectedEndpoints.contains(endpointId)) {
            try {
                val chatMessage = JSONObject().apply {
                    put("type", MSG_TYPE_CHAT_MESSAGE)
                    put("content", message)
                }
                val payload = Payload.fromBytes(chatMessage.toString().toByteArray(StandardCharsets.UTF_8))
                connectionsClient.sendPayload(endpointId, payload)
                true
            } catch (e: Exception) {
                Log.e(TAG, "Error sending message to $endpointId: ${e.message}")
                false
            }
        } else {
            false
        }
    }
    
    fun broadcastMessage(message: String): Boolean {
        return try {
            val chatMessage = JSONObject().apply {
                put("type", MSG_TYPE_CHAT_MESSAGE)
                put("content", message)
            }
            val payload = Payload.fromBytes(chatMessage.toString().toByteArray(StandardCharsets.UTF_8))
            connectedEndpoints.forEach { endpointId ->
                connectionsClient.sendPayload(endpointId, payload)
            }
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error broadcasting message: ${e.message}")
            false
        }
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

    /**
     * Connection lifecycle callback that handles the message synchronization flow between peers.
     * 
     * Message Sync Protocol Flow:
     * 1. When a connection is established (STATUS_OK), each peer sends a sync_request containing
     *    their list of known message IDs to the other peer
     * 2. Upon receiving a sync_request, each peer compares the received message IDs with their
     *    local database and identifies missing messages  
     * 3. Each peer sends a sync_response containing the IDs of messages they want to receive
     * 4. Upon receiving a sync_response, each peer sends a message_batch containing the full
     *    message data for all requested message IDs
     * 5. Received messages are stored in the local database and normal chat operation continues
     * 6. Regular chat_message types are handled as before for real-time messaging
     * 
     * This ensures that when two devices connect, they automatically sync their message history
     * and both peers end up with a complete view of all messages exchanged in the mesh network.
     */
    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, connectionInfo: ConnectionInfo) {
            Log.d(TAG, "Connection initiated")
            connectionsClient.acceptConnection(endpointId, payloadCallback)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            Log.d(TAG, "Connection made with code " + result.status.statusCode)
            when (result.status.statusCode) {
                ConnectionsStatusCodes.STATUS_OK -> {
                    Log.d(TAG, "Setup init 1")
                    Log.d(TAG, "" + (connectedEndpoints == null))
                    Log.d(TAG, "" + (connectedEndpoints))
                    Log.d(TAG, "" + (listener))
                    connectedEndpoints.add(endpointId)
                    Log.d(TAG, "middle")
                    listener?.onPeerConnected(endpointId)
                    
                    Log.d(TAG, "Setup init 2")
                    // Initiate message synchronization by sending our known message IDs
                    initiateSyncWithPeer(endpointId)
                }
                ConnectionsStatusCodes.STATUS_CONNECTION_REJECTED -> {
                    listener?.onConnectionFailed(endpointId, "Connection rejected")
                }
                else -> {
                    Log.d(TAG, "Connection made, but it errored.")
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
            Log.d(TAG, "Got some load")
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
                                val content = jsonMessage.getString("content")
                                // Store message in SQLite database
                                storeMessage(content, endpointId)
                                // Notify listener
                                listener?.onMessageReceived(endpointId, content)
                            }
                        }
                    } catch (e: Exception) {
                        // If JSON parsing fails, treat as regular chat message for backward compatibility
                        Log.w(TAG, "Failed to parse message as JSON, treating as plain text: ${e.message}")
                        storeMessage(messageData, endpointId)
                        listener?.onMessageReceived(endpointId, messageData)
                    }
                }
            }
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
            // Handle payload transfer updates if needed
        }
    }

    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            Log.d(TAG, "Endpoint foudn!!!!. We send: ${"CruiseChat_${Build.MODEL}" < info.endpointName}")
            if ("CruiseChat_${Build.MODEL}" < info.endpointName) {
                connectionsClient.requestConnection(
                    "CruiseChat_${android.os.Build.MODEL}",
                    endpointId,
                    connectionLifecycleCallback
                ).addOnSuccessListener {
                    Log.d(TAG, "Connection successful")
                }.addOnFailureListener { exception ->
                    Log.d(TAG, "❌ Connection failed: ${exception.message}")
                }
            }
            
            listener?.onPeerDiscovered(endpointId, info.endpointName)
        }

        override fun onEndpointLost(endpointId: String) {
            listener?.onPeerLost(endpointId)
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
    
    private fun storeMessage(content: String, senderId: String) {
        try {
            val messageId = UUID.randomUUID().toString()
            val timestamp = System.currentTimeMillis() / 1000 // Unix timestamp
            
            val insertSql = """
                INSERT INTO messages (id, content, user_id, message_type, created_at) 
                VALUES (?, ?, ?, ?, ?)
            """.trimIndent()
            
            database!!.execSQL(insertSql, arrayOf(messageId, content, senderId, "text", timestamp))
            
            Log.d(TAG, "Message stored in database: $messageId")
            
            // Notify listener about new message
            notifyNewMessages(1)
            
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
            Log.d(TAG, "Notified listener about $newMessageCount new messages (total: $totalMessages)")
        } catch (e: Exception) {
            Log.e(TAG, "Error notifying about new messages: ${e.message}")
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
            connectionsClient.sendPayload(endpointId, payload)
            
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
            connectionsClient.sendPayload(endpointId, payload)
            
            // Also send messages that the peer doesn't have
            val messagesToSend = localMessageIds - receivedIds
            if (messagesToSend.isNotEmpty()) {
                sendMessageBatch(endpointId, messagesToSend.toList())
            }
            
            Log.d(TAG, "Handled sync request from $endpointId: requesting ${missingMessageIds.size} messages, sending ${messagesToSend.size} messages")
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
                Log.d(TAG, "Sending ${idsToSend.size} messages to $endpointId in response to sync request")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling sync response from $endpointId: ${e.message}")
        }
    }
    
    private fun handleMessageBatch(endpointId: String, jsonMessage: JSONObject) {
        try {
            val messages = jsonMessage.getJSONArray("messages")
            var storedCount = 0
            
            for (i in 0 until messages.length()) {
                val messageObj = messages.getJSONObject(i)
                val messageId = messageObj.getString("id")
                val content = messageObj.getString("content")
                val userId = messageObj.getString("user_id")
                val messageType = messageObj.getString("message_type")
                val createdAt = messageObj.getLong("created_at")
                
                if (storeMessageWithId(messageId, content, userId, messageType, createdAt)) {
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
            connectionsClient.sendPayload(endpointId, payload)
            
            Log.d(TAG, "Sent message batch to $endpointId with ${messages.length()} messages")
        } catch (e: Exception) {
            Log.e(TAG, "Error sending message batch to $endpointId: ${e.message}")
        }
    }
    
    private fun getMessagesByIds(messageIds: List<String>): JSONArray {
        val messages = JSONArray()
        
        try {
            if (messageIds.isEmpty()) return messages
            
            val placeholders = messageIds.joinToString(",") { "?" }
            val query = "SELECT id, content, user_id, message_type, created_at FROM messages WHERE id IN ($placeholders)"
            
            val cursor = database?.rawQuery(query, messageIds.toTypedArray())
            
            cursor?.use {
                if (cursor.moveToFirst()) {
                    do {
                        val messageObj = JSONObject().apply {
                            put("id", cursor.getString(cursor.getColumnIndexOrThrow("id")))
                            put("content", cursor.getString(cursor.getColumnIndexOrThrow("content")))
                            put("user_id", cursor.getString(cursor.getColumnIndexOrThrow("user_id")))
                            put("message_type", cursor.getString(cursor.getColumnIndexOrThrow("message_type")))
                            put("created_at", cursor.getLong(cursor.getColumnIndexOrThrow("created_at")))
                        }
                        messages.put(messageObj)
                    } while (cursor.moveToNext())
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting messages by IDs: ${e.message}")
        }
        
        return messages
    }
    
    private fun storeMessageWithId(messageId: String, content: String, userId: String, messageType: String, createdAt: Long): Boolean {
        try {
            // Check if message already exists
            val existsQuery = "SELECT COUNT(*) FROM messages WHERE id = ?"
            val cursor = database?.rawQuery(existsQuery, arrayOf(messageId))
            
            val exists = cursor?.use {
                it.moveToFirst() && it.getInt(0) > 0
            } ?: false
            
            if (exists) {
                Log.d(TAG, "Message $messageId already exists, skipping")
                return false
            }
            
            val insertSql = """
                INSERT INTO messages (id, content, user_id, message_type, created_at) 
                VALUES (?, ?, ?, ?, ?)
            """.trimIndent()
            
            database?.execSQL(insertSql, arrayOf(messageId, content, userId, messageType, createdAt))
            
            Log.d(TAG, "Stored synced message: $messageId")
            return true
            
        } catch (e: SQLiteException) {
            Log.e(TAG, "SQLite error storing synced message $messageId: ${e.message}")
            return false
        } catch (e: Exception) {
            Log.e(TAG, "Error storing synced message $messageId: ${e.message}")
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
        disconnectFromAllPeers()
        stopAdvertising()
        stopDiscovery()
        closeDatabase()
        Log.d(TAG, "NearbyService destroyed")
    }
}