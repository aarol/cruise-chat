package expo.modules.mesh_peer_module

import android.util.Log
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*

class ConnectionHandler {

    private val TAG = "NearbyService"
    private val SERVICE_ID = "com.anonymous.cruisechat"

    private val currName = generateRandomString()

    interface ConnectionCallbacks {
        fun onPeerConnected(endpointId: String)
        fun onPeerDisconnected(endpointId: String)
        fun onConnectionFailed(endpointId: String, error: String)

        fun onPayloadReceived(endpointId: String, payload: Payload)
    }
    
    private var listener: ConnectionCallbacks? = null
    fun setListener(listener: ConnectionCallbacks?) { this.listener = listener }
    private lateinit var connectionsClient: ConnectionsClient
    private val connectedEndpoints = mutableSetOf<String>()
    private val strategy = Strategy.P2P_CLUSTER

    fun Init(service: NearbyService) {
        connectionsClient = Nearby.getConnectionsClient(service)
    }

    fun startAdvertising(): Boolean {
        val advertisingOptions = AdvertisingOptions.Builder().setStrategy(strategy).build()
        return try {
            connectionsClient.startAdvertising(
                currName,
                SERVICE_ID,
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
                SERVICE_ID,
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
    
    fun stopAdvertising(): Boolean {
        Log.d(TAG, "stop advertising")
        connectionsClient.stopAdvertising()
        return true
    }
    
    fun stopDiscovery(): Boolean {
        Log.d(TAG, "stop discovery")
        connectionsClient.stopDiscovery()
        return true
    }
    
    
    fun sendPayload(endpointId: String, payload: Payload) {
        if (connectedEndpoints.contains(endpointId))
            connectionsClient.sendPayload(endpointId, payload)
    }
    fun sendPayloads(payload: Payload) {
        connectedEndpoints.forEach { endpointId ->
            sendPayload(endpointId, payload)
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
                    connectedEndpoints.add(endpointId)
                    listener?.onPeerConnected(endpointId)
                    
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
            listener?.onPayloadReceived(endpointId, payload)
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
            // Handle payload transfer updates if needed
        }
    }

    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            Log.d(TAG, "Endpoint found: " + info.endpointName)
            if (currName < info.endpointName) {
                Log.d(TAG, "Connecting to endpoint")
                connectionsClient.requestConnection(
                    currName,
                    endpointId,
                    connectionLifecycleCallback
                ).addOnSuccessListener {
                    Log.d(TAG, "Connection successful")
                }.addOnFailureListener { exception ->
                    Log.d(TAG, "❌ Connection failed: ${exception.message}")
                }
            } else {
                Log.d(TAG, "Waiting for connection from endpoint")
            }
        }

        override fun onEndpointLost(endpointId: String) {
            // listener?.onPeerLost(endpointId)
        }
    }

    fun generateRandomString(length: Int = 10): String {
        val chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        return (1..length)
            .map { chars.random() }
            .joinToString("")
    }
}