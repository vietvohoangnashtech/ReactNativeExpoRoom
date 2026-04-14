package expo.modules.datasync.wifidirect

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.NetworkInfo
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pInfo
import android.net.wifi.p2p.WifiP2pManager
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceInfo
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceRequest
import android.os.Build
import android.os.Looper
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * WifiDirectManager — Wi-Fi Direct P2P transport for cross-tablet event sync.
 *
 * Replaces Google Nearby Connections. Uses [WifiP2pManager] + DNS-SD service
 * discovery to advertise/discover FitSync peers, and [WifiDirectTransport]
 * (TCP sockets) to exchange event-batch payloads.
 *
 * ## Identity
 * endpointId = peer's Android device ID, encoded in the DNS-SD TXT record as
 * "DisplayName|androidId" and confirmed via the TCP IDENT handshake. This matches
 * DeviceEntity.id in Room and is stable across reconnections.
 *
 * ## Connection flow
 * 1. Advertising tablet: [startAdvertising] → DNS-SD _fitsync._tcp service registered.
 * 2. Discovering tablet: [startDiscovery] → DNS-SD TXT listener fires [onEndpointDiscovered].
 * 3. Discovering tablet: [requestConnection] → [WifiP2pManager.connect] → group forms.
 * 4. Both tablets: [WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION] fires.
 *    → Group Owner starts TCP server; client connects to GO address.
 *    → IDENT handshake exchanges Android IDs.
 *    → [onConnectionRequest] fires (authDigits = "" — auto-accept).
 *    → [onConnectionChanged] fires (connected = true).
 *
 * ## Public interface
 * Intentionally mirrors NearbyManager to keep [ExpoDataSyncModule] changes minimal.
 */
class WifiDirectManager(
    private val context: Context,
    private val myAndroidId: String,
) {
    companion object {
        private const val TAG = "WifiDirectManager"
        const val SERVICE_TYPE = "_fitsync._tcp"
        private const val SERVICE_INSTANCE = "fitsync"
        private const val TXT_KEY_NAME = "name"
    }

    // ─── Inner types (mirror NearbyManager) ─────────────────────────────

    data class DiscoveredEndpoint(
        val endpointId: String,         // peer's Android ID
        val endpointName: String,       // display name
        val remoteDeviceId: String?,    // same as endpointId for Wi-Fi Direct
        val serviceId: String,          // SERVICE_TYPE constant
        val peerMac: String,            // Wi-Fi Direct MAC — used internally by requestConnection
    )

    data class ConnectedEndpoint(
        val endpointId: String,         // peer's Android ID
        val endpointName: String,
        val remoteDeviceId: String?,    // same as endpointId
    )

    data class PendingConnection(
        val displayName: String,
        val remoteDeviceId: String?,
        val authDigits: String = "",    // always empty — auto-accept
    )

    // ─── State ──────────────────────────────────────────────────────────

    private val _isAdvertising = MutableStateFlow(false)
    val isAdvertising: StateFlow<Boolean> = _isAdvertising.asStateFlow()

    private val _isDiscovering = MutableStateFlow(false)
    val isDiscovering: StateFlow<Boolean> = _isDiscovering.asStateFlow()

    private val _discoveredEndpoints = MutableStateFlow<List<DiscoveredEndpoint>>(emptyList())
    val discoveredEndpoints: StateFlow<List<DiscoveredEndpoint>> = _discoveredEndpoints.asStateFlow()

    private val _connectedEndpoints = MutableStateFlow<List<ConnectedEndpoint>>(emptyList())
    val connectedEndpoints: StateFlow<List<ConnectedEndpoint>> = _connectedEndpoints.asStateFlow()

    // ─── Callbacks (same interface as NearbyManager) ─────────────────────

    var onPayloadReceived: ((endpointId: String, data: ByteArray) -> Unit)? = null
    var onConnectionChanged: ((endpointId: String, connected: Boolean) -> Unit)? = null
    var onEndpointDiscovered: ((endpoint: DiscoveredEndpoint) -> Unit)? = null
    var onEndpointLost: ((endpointId: String) -> Unit)? = null

    /**
     * Fires when a peer is identified after TCP IDENT handshake.
     * [authenticationDigits] is always "" — connections are auto-accepted.
     * [isIncoming] is always true so that the responder role is presented consistently.
     */
    var onConnectionRequest: ((
        endpointId: String,
        endpointName: String,
        remoteDeviceId: String?,
        authenticationDigits: String,
        isIncoming: Boolean,
    ) -> Unit)? = null

    // ─── Wi-Fi Direct infrastructure ─────────────────────────────────────

    private val wifiP2pManager: WifiP2pManager =
        context.getSystemService(Context.WIFI_P2P_SERVICE) as WifiP2pManager

    private val channel: WifiP2pManager.Channel =
        wifiP2pManager.initialize(context, Looper.getMainLooper(), null)

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val transport = WifiDirectTransport(scope, myAndroidId)

    // ─── ID / socket routing ─────────────────────────────────────────────

    /** peer Android ID → Wi-Fi Direct MAC (populated during DNS-SD discovery) */
    private val idToMac = mutableMapOf<String, String>()

    /** socket key (peer IP) → peer Android ID */
    private val socketToId = mutableMapOf<String, String>()

    /** peer Android ID → socket key (peer IP) */
    private val idToSocket = mutableMapOf<String, String>()

    // ─── Init ─────────────────────────────────────────────────────────────

    private var isReceiverRegistered = false

    init {
        setupTransportCallbacks()
    }

    private fun setupTransportCallbacks() {
        transport.onPeerIdentified = { socketKey, peerId ->
            val displayName =
                _discoveredEndpoints.value.find { it.endpointId == peerId }?.endpointName ?: peerId
            socketToId[socketKey] = peerId
            idToSocket[peerId] = socketKey
            Log.d(TAG, "Peer identified: id=$peerId socketKey=$socketKey")

            if (_connectedEndpoints.value.none { it.endpointId == peerId }) {
                _connectedEndpoints.value = _connectedEndpoints.value + ConnectedEndpoint(
                    endpointId = peerId,
                    endpointName = displayName,
                    remoteDeviceId = peerId,
                )
                // Auto-accept: fire onConnectionRequest then immediately onConnectionChanged
                onConnectionRequest?.invoke(peerId, displayName, peerId, "", true)
                onConnectionChanged?.invoke(peerId, true)
            }
        }

        transport.onDataReceived = { socketKey, data ->
            val peerId = socketToId[socketKey]
            if (peerId != null) {
                onPayloadReceived?.invoke(peerId, data)
            } else {
                Log.w(TAG, "Data from unidentified socket $socketKey — ignored")
            }
        }

        transport.onPeerDisconnected = { socketKey ->
            val peerId = socketToId.remove(socketKey)
            if (peerId != null) {
                idToSocket.remove(peerId)
                _connectedEndpoints.value =
                    _connectedEndpoints.value.filter { it.endpointId != peerId }
                onConnectionChanged?.invoke(peerId, false)
                Log.d(TAG, "Peer disconnected: $peerId")
            }
        }
    }

    // ─── BroadcastReceiver ───────────────────────────────────────────────

    private val wifiP2pReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
                    val networkInfo: NetworkInfo? =
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            intent.getParcelableExtra(
                                WifiP2pManager.EXTRA_NETWORK_INFO,
                                NetworkInfo::class.java,
                            )
                        } else {
                            @Suppress("DEPRECATION")
                            intent.getParcelableExtra(WifiP2pManager.EXTRA_NETWORK_INFO)
                        }
                    if (networkInfo?.isConnected == true) {
                        wifiP2pManager.requestConnectionInfo(channel) { info ->
                            onConnectionInfoAvailable(info)
                        }
                    } else {
                        Log.d(TAG, "Wi-Fi Direct group dissolved — closing all sockets")
                        transport.closeAll()
                        val prev = _connectedEndpoints.value.toList()
                        _connectedEndpoints.value = emptyList()
                        socketToId.clear()
                        idToSocket.clear()
                        prev.forEach { onConnectionChanged?.invoke(it.endpointId, false) }
                    }
                }
                WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
                    // DNS-SD handles discovery — raw peer list not needed
                }
                WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION -> {
                    val state = intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE, -1)
                    Log.d(TAG, "Wi-Fi P2P state changed: $state")
                }
                WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION -> {
                    // Own device info updated — no action needed
                }
            }
        }
    }

    private fun registerReceiver() {
        if (isReceiverRegistered) return
        val filter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION)
        }
        context.registerReceiver(wifiP2pReceiver, filter)
        isReceiverRegistered = true
        Log.d(TAG, "BroadcastReceiver registered")
    }

    private fun unregisterReceiver() {
        if (!isReceiverRegistered) return
        try {
            context.unregisterReceiver(wifiP2pReceiver)
        } catch (e: IllegalArgumentException) {
            Log.w(TAG, "Receiver not registered: ${e.message}")
        }
        isReceiverRegistered = false
        Log.d(TAG, "BroadcastReceiver unregistered")
    }

    // ─── Connection info handler ─────────────────────────────────────────

    private fun onConnectionInfoAvailable(info: WifiP2pInfo) {
        if (!info.groupFormed) return
        val goAddr = info.groupOwnerAddress?.hostAddress
        Log.d(TAG, "Group formed: isGO=${info.isGroupOwner} goAddr=$goAddr")
        if (info.isGroupOwner) {
            transport.startServer()
        } else {
            if (goAddr != null) {
                transport.connectToGroupOwner(goAddr)
            } else {
                Log.e(TAG, "Group Owner address is null — cannot connect TCP")
            }
        }
    }

    // ─── Advertising ─────────────────────────────────────────────────────

    fun startAdvertising(encodedName: String) {
        registerReceiver()
        val record = mapOf(TXT_KEY_NAME to encodedName)
        val serviceInfo =
            WifiP2pDnsSdServiceInfo.newInstance(SERVICE_INSTANCE, SERVICE_TYPE, record)

        wifiP2pManager.clearLocalServices(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                addService(serviceInfo)
            }
            override fun onFailure(reason: Int) {
                Log.w(TAG, "clearLocalServices failed ($reason) — adding service anyway")
                addService(serviceInfo)
            }
        })
    }

    private fun addService(serviceInfo: WifiP2pDnsSdServiceInfo) {
        wifiP2pManager.addLocalService(channel, serviceInfo, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                _isAdvertising.value = true
                Log.d(TAG, "DNS-SD service registered")
            }

            override fun onFailure(reason: Int) {
                _isAdvertising.value = false
                Log.e(TAG, "addLocalService failed: reason=$reason")
            }
        })
    }

    fun stopAdvertising() {
        wifiP2pManager.clearLocalServices(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                _isAdvertising.value = false
                Log.d(TAG, "DNS-SD service removed")
            }

            override fun onFailure(reason: Int) {
                _isAdvertising.value = false
                Log.w(TAG, "clearLocalServices failed: reason=$reason")
            }
        })
    }

    // ─── Discovery ───────────────────────────────────────────────────────

    fun startDiscovery() {
        registerReceiver()

        wifiP2pManager.setDnsSdResponseListeners(
            channel,
            { instanceName, registrationType, srcDevice ->
                Log.d(TAG, "DNS-SD service found: $instanceName from ${srcDevice.deviceAddress}")
            },
            { _, txtRecordMap, srcDevice ->
                val encodedName = txtRecordMap[TXT_KEY_NAME] ?: return@setDnsSdResponseListeners
                val (displayName, remoteDeviceId) = parseEncodedName(encodedName)
                val peerMac = srcDevice.deviceAddress
                val endpointId = remoteDeviceId ?: peerMac
                Log.d(TAG, "DNS-SD TXT: name=$displayName id=$remoteDeviceId mac=$peerMac")

                if (remoteDeviceId != null) idToMac[remoteDeviceId] = peerMac

                val endpoint = DiscoveredEndpoint(
                    endpointId = endpointId,
                    endpointName = displayName,
                    remoteDeviceId = remoteDeviceId,
                    serviceId = SERVICE_TYPE,
                    peerMac = peerMac,
                )
                val current = _discoveredEndpoints.value.toMutableList()
                current.removeAll { it.endpointId == endpointId }
                current.add(endpoint)
                _discoveredEndpoints.value = current
                onEndpointDiscovered?.invoke(endpoint)
            },
        )

        val serviceRequest = WifiP2pDnsSdServiceRequest.newInstance()
        wifiP2pManager.clearServiceRequests(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                addServiceRequestAndDiscover(serviceRequest)
            }
            override fun onFailure(reason: Int) {
                Log.w(TAG, "clearServiceRequests failed ($reason) — continuing")
                addServiceRequestAndDiscover(serviceRequest)
            }
        })
    }

    private fun addServiceRequestAndDiscover(request: WifiP2pDnsSdServiceRequest) {
        wifiP2pManager.addServiceRequest(channel, request, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                wifiP2pManager.discoverServices(
                    channel,
                    object : WifiP2pManager.ActionListener {
                        override fun onSuccess() {
                            _isDiscovering.value = true
                            Log.d(TAG, "Service discovery started")
                        }

                        override fun onFailure(reason: Int) {
                            _isDiscovering.value = false
                            Log.e(TAG, "discoverServices failed: reason=$reason")
                        }
                    },
                )
            }

            override fun onFailure(reason: Int) {
                Log.e(TAG, "addServiceRequest failed: reason=$reason")
            }
        })
    }

    fun stopDiscovery() {
        wifiP2pManager.stopPeerDiscovery(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                _isDiscovering.value = false
                _discoveredEndpoints.value = emptyList()
                Log.d(TAG, "Discovery stopped")
            }

            override fun onFailure(reason: Int) {
                _isDiscovering.value = false
                Log.w(TAG, "stopPeerDiscovery failed: reason=$reason")
            }
        })
    }

    // ─── Connection ──────────────────────────────────────────────────────

    /**
     * Initiates a Wi-Fi Direct connection to [endpointId] (peer's Android ID).
     * Internally resolves Android ID → MAC address from the discovery map.
     */
    fun requestConnection(deviceName: String, endpointId: String) {
        val peerMac = idToMac[endpointId]
            ?: _discoveredEndpoints.value.find { it.endpointId == endpointId }?.peerMac
        if (peerMac == null) {
            Log.e(TAG, "requestConnection($endpointId): MAC not found — was the peer discovered?")
            return
        }
        val config = WifiP2pConfig().apply { deviceAddress = peerMac }
        wifiP2pManager.connect(channel, config, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                Log.d(TAG, "Connection request sent to $peerMac (id=$endpointId)")
            }

            override fun onFailure(reason: Int) {
                Log.e(TAG, "connect() failed: reason=$reason")
            }
        })
    }

    fun disconnect(endpointId: String) {
        val socketKey = idToSocket.remove(endpointId)
        if (socketKey != null) {
            socketToId.remove(socketKey)
            transport.closeSocket(socketKey)
        }
        _connectedEndpoints.value = _connectedEndpoints.value.filter { it.endpointId != endpointId }
        if (_connectedEndpoints.value.isEmpty()) removeGroup()
        onConnectionChanged?.invoke(endpointId, false)
        Log.d(TAG, "Disconnected from $endpointId")
    }

    fun disconnectAll() {
        transport.closeAll()
        val prev = _connectedEndpoints.value.toList()
        _connectedEndpoints.value = emptyList()
        socketToId.clear()
        idToSocket.clear()
        removeGroup()
        prev.forEach { onConnectionChanged?.invoke(it.endpointId, false) }
        Log.d(TAG, "Disconnected from all endpoints")
    }

    private fun removeGroup() {
        wifiP2pManager.removeGroup(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                Log.d(TAG, "Wi-Fi Direct group removed")
            }
            override fun onFailure(reason: Int) {
                Log.w(TAG, "removeGroup failed: reason=$reason")
            }
        })
    }

    // ─── Payload ─────────────────────────────────────────────────────────

    fun sendPayload(endpointId: String, data: ByteArray) {
        val socketKey = idToSocket[endpointId]
        if (socketKey == null) {
            Log.w(TAG, "sendPayload($endpointId): no socket — dropping ${data.size}B")
            return
        }
        transport.send(socketKey, data)
    }

    // ─── NearbyManager interface compatibility stubs ──────────────────────

    /**
     * Wi-Fi Direct connections are auto-accepted after TCP IDENT handshake.
     * This is a no-op kept for API compatibility with the JS bridge.
     */
    fun acceptConnection(endpointId: String) {
        Log.d(TAG, "acceptConnection($endpointId) — auto-accepted, no-op")
    }

    /** Reject: immediately disconnect the peer. */
    fun rejectConnection(endpointId: String) = disconnect(endpointId)

    // ─── Lifecycle ────────────────────────────────────────────────────────

    fun destroy() {
        stopAdvertising()
        stopDiscovery()
        disconnectAll()
        unregisterReceiver()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            channel.close()
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    /** Splits "DisplayName|androidId" → (displayName, androidId). Backward-compatible. */
    private fun parseEncodedName(encodedName: String): Pair<String, String?> {
        val idx = encodedName.lastIndexOf('|')
        return if (idx > 0) {
            Pair(encodedName.substring(0, idx), encodedName.substring(idx + 1))
        } else {
            Pair(encodedName, null)
        }
    }
}
