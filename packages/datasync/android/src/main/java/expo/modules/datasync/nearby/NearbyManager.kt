package expo.modules.datasync.nearby

import android.content.Context
import android.util.Log
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * NearbyManager — Google Nearby Connections wrapper for cross-tablet sync.
 *
 * Uses P2P_CLUSTER strategy for tablet-to-tablet event exchange.
 * Payload type: BYTES (≤32KB per message, chunked for larger batches).
 */
class NearbyManager(private val context: Context) {

    companion object {
        private const val TAG = "NearbyManager"
        const val SERVICE_ID = "com.xpw2.datasync"
        private const val MAX_PAYLOAD_BYTES = 32 * 1024 // 32KB
    }

    private val connectionsClient: ConnectionsClient by lazy {
        Nearby.getConnectionsClient(context)
    }

    // ─── State ──────────────────────────────────────────────────────────

    data class DiscoveredEndpoint(
        val endpointId: String,
        val endpointName: String,
        val serviceId: String
    )

    data class ConnectedEndpoint(
        val endpointId: String,
        val endpointName: String
    )

    private val _isAdvertising = MutableStateFlow(false)
    val isAdvertising: StateFlow<Boolean> = _isAdvertising.asStateFlow()

    private val _isDiscovering = MutableStateFlow(false)
    val isDiscovering: StateFlow<Boolean> = _isDiscovering.asStateFlow()

    private val _discoveredEndpoints = MutableStateFlow<List<DiscoveredEndpoint>>(emptyList())
    val discoveredEndpoints: StateFlow<List<DiscoveredEndpoint>> = _discoveredEndpoints.asStateFlow()

    private val _connectedEndpoints = MutableStateFlow<List<ConnectedEndpoint>>(emptyList())
    val connectedEndpoints: StateFlow<List<ConnectedEndpoint>> = _connectedEndpoints.asStateFlow()

    // Callback interface for payload and connection events
    var onPayloadReceived: ((endpointId: String, data: ByteArray) -> Unit)? = null
    var onConnectionChanged: ((endpointId: String, connected: Boolean) -> Unit)? = null
    var onEndpointDiscovered: ((endpoint: DiscoveredEndpoint) -> Unit)? = null
    var onEndpointLost: ((endpointId: String) -> Unit)? = null

    // ─── Advertising ────────────────────────────────────────────────────

    fun startAdvertising(deviceName: String) {
        val advertisingOptions = AdvertisingOptions.Builder()
            .setStrategy(Strategy.P2P_CLUSTER)
            .build()

        connectionsClient.startAdvertising(
            deviceName,
            SERVICE_ID,
            connectionLifecycleCallback,
            advertisingOptions
        ).addOnSuccessListener {
            _isAdvertising.value = true
            Log.d(TAG, "Advertising started as '$deviceName'")
        }.addOnFailureListener { e ->
            _isAdvertising.value = false
            Log.e(TAG, "Advertising failed: ${e.message}")
        }
    }

    fun stopAdvertising() {
        connectionsClient.stopAdvertising()
        _isAdvertising.value = false
        Log.d(TAG, "Advertising stopped")
    }

    // ─── Discovery ──────────────────────────────────────────────────────

    fun startDiscovery() {
        val discoveryOptions = DiscoveryOptions.Builder()
            .setStrategy(Strategy.P2P_CLUSTER)
            .build()

        connectionsClient.startDiscovery(
            SERVICE_ID,
            endpointDiscoveryCallback,
            discoveryOptions
        ).addOnSuccessListener {
            _isDiscovering.value = true
            Log.d(TAG, "Discovery started")
        }.addOnFailureListener { e ->
            _isDiscovering.value = false
            Log.e(TAG, "Discovery failed: ${e.message}")
        }
    }

    fun stopDiscovery() {
        connectionsClient.stopDiscovery()
        _isDiscovering.value = false
        _discoveredEndpoints.value = emptyList()
        Log.d(TAG, "Discovery stopped")
    }

    // ─── Connection ─────────────────────────────────────────────────────

    fun requestConnection(deviceName: String, endpointId: String) {
        connectionsClient.requestConnection(
            deviceName,
            endpointId,
            connectionLifecycleCallback
        ).addOnSuccessListener {
            Log.d(TAG, "Connection requested to $endpointId")
        }.addOnFailureListener { e ->
            Log.e(TAG, "Connection request failed: ${e.message}")
        }
    }

    fun disconnect(endpointId: String) {
        connectionsClient.disconnectFromEndpoint(endpointId)
        val current = _connectedEndpoints.value.toMutableList()
        current.removeAll { it.endpointId == endpointId }
        _connectedEndpoints.value = current
        onConnectionChanged?.invoke(endpointId, false)
        Log.d(TAG, "Disconnected from $endpointId")
    }

    fun disconnectAll() {
        connectionsClient.stopAllEndpoints()
        _connectedEndpoints.value = emptyList()
        Log.d(TAG, "Disconnected from all endpoints")
    }

    // ─── Send Payload ───────────────────────────────────────────────────

    /**
     * Send data to a connected endpoint. Data is chunked if > MAX_PAYLOAD_BYTES.
     */
    fun sendPayload(endpointId: String, data: ByteArray) {
        if (data.size <= MAX_PAYLOAD_BYTES) {
            val payload = Payload.fromBytes(data)
            connectionsClient.sendPayload(endpointId, payload)
            Log.d(TAG, "Sent ${data.size} bytes to $endpointId")
        } else {
            // Chunk the data
            var offset = 0
            var chunkIndex = 0
            while (offset < data.size) {
                val end = (offset + MAX_PAYLOAD_BYTES).coerceAtMost(data.size)
                val chunk = data.copyOfRange(offset, end)
                val payload = Payload.fromBytes(chunk)
                connectionsClient.sendPayload(endpointId, payload)
                offset = end
                chunkIndex++
            }
            Log.d(TAG, "Sent ${data.size} bytes in $chunkIndex chunks to $endpointId")
        }
    }

    /**
     * Send string data (JSON) to a connected endpoint.
     */
    fun sendPayload(endpointId: String, jsonData: String) {
        sendPayload(endpointId, jsonData.toByteArray(Charsets.UTF_8))
    }

    /**
     * Broadcast data to all connected endpoints.
     */
    fun broadcastPayload(data: ByteArray) {
        val endpoints = _connectedEndpoints.value
        for (endpoint in endpoints) {
            sendPayload(endpoint.endpointId, data)
        }
    }

    // ─── Callbacks ──────────────────────────────────────────────────────

    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            Log.d(TAG, "Endpoint found: $endpointId (${info.endpointName})")
            val endpoint = DiscoveredEndpoint(
                endpointId = endpointId,
                endpointName = info.endpointName,
                serviceId = info.serviceId
            )
            val current = _discoveredEndpoints.value.toMutableList()
            current.removeAll { it.endpointId == endpointId }
            current.add(endpoint)
            _discoveredEndpoints.value = current
            onEndpointDiscovered?.invoke(endpoint)
        }

        override fun onEndpointLost(endpointId: String) {
            Log.d(TAG, "Endpoint lost: $endpointId")
            val current = _discoveredEndpoints.value.toMutableList()
            current.removeAll { it.endpointId == endpointId }
            _discoveredEndpoints.value = current
            onEndpointLost?.invoke(endpointId)
        }
    }

    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            Log.d(TAG, "Connection initiated with $endpointId (${info.endpointName})")
            // Auto-accept all connections (for P2P trusted environment)
            connectionsClient.acceptConnection(endpointId, payloadCallback)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            when (result.status.statusCode) {
                ConnectionsStatusCodes.STATUS_OK -> {
                    Log.d(TAG, "Connected to $endpointId")
                    val name = _discoveredEndpoints.value
                        .find { it.endpointId == endpointId }?.endpointName ?: endpointId
                    val current = _connectedEndpoints.value.toMutableList()
                    current.removeAll { it.endpointId == endpointId }
                    current.add(ConnectedEndpoint(endpointId, name))
                    _connectedEndpoints.value = current
                    onConnectionChanged?.invoke(endpointId, true)
                }
                else -> {
                    Log.w(TAG, "Connection failed to $endpointId: ${result.status}")
                    onConnectionChanged?.invoke(endpointId, false)
                }
            }
        }

        override fun onDisconnected(endpointId: String) {
            Log.d(TAG, "Disconnected from $endpointId")
            val current = _connectedEndpoints.value.toMutableList()
            current.removeAll { it.endpointId == endpointId }
            _connectedEndpoints.value = current
            onConnectionChanged?.invoke(endpointId, false)
        }
    }

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            payload.asBytes()?.let { bytes ->
                Log.d(TAG, "Payload received from $endpointId: ${bytes.size} bytes")
                onPayloadReceived?.invoke(endpointId, bytes)
            }
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
            // For BYTES payloads, transfer is immediate
        }
    }

    // ─── Lifecycle ──────────────────────────────────────────────────────

    fun destroy() {
        stopAdvertising()
        stopDiscovery()
        disconnectAll()
    }
}
