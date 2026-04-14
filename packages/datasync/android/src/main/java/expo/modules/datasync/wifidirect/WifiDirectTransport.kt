package expo.modules.datasync.wifidirect

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.IOException
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket

/**
 * WifiDirectTransport — TCP socket layer for Wi-Fi Direct P2P event sync.
 *
 * Protocol: 4-byte big-endian length prefix + payload bytes.
 * First message on every new connection is an IDENT frame: "IDENT:<myAndroidId>".
 * Subsequent messages are opaque event-batch payloads delivered to [onDataReceived].
 *
 * Roles:
 *  - Group Owner: calls [startServer] → accepts inbound TCP clients on [SERVER_PORT].
 *  - Group Client: calls [connectToGroupOwner] → connects to GO's IP on [SERVER_PORT].
 *
 * Thread-safety: mutable state accessed under `synchronized(this)`.
 * Blocking I/O runs on Dispatchers.IO coroutines — safe for the provided CoroutineScope.
 */
class WifiDirectTransport(
    private val scope: CoroutineScope,
    private val myAndroidId: String,
) {
    companion object {
        private const val TAG = "WifiDirectTransport"
        const val SERVER_PORT = 8988
        private const val CONNECT_TIMEOUT_MS = 10_000
        private const val MAX_FRAME_BYTES = 10 * 1024 * 1024 // 10 MB safety cap
    }

    /**
     * Called once per new connection after the IDENT frame is received.
     * [socketKey] = peer's IP address string.
     * [peerId]    = peer's Android ID ("IDENT:<peerId>").
     */
    var onPeerIdentified: ((socketKey: String, peerId: String) -> Unit)? = null

    /** Called for all non-IDENT frames after identification is complete. */
    var onDataReceived: ((socketKey: String, data: ByteArray) -> Unit)? = null

    /** Called when any socket closes (either cleanly or on error). */
    var onPeerDisconnected: ((socketKey: String) -> Unit)? = null

    // ─── Mutable state (guarded by synchronized(this)) ──────────────────

    private val sockets = mutableMapOf<String, Socket>()
    private val writers = mutableMapOf<String, DataOutputStream>()

    /** Socket keys whose first incoming frame is still the IDENT frame. */
    private val pendingIdent = mutableSetOf<String>()

    private var serverSocket: ServerSocket? = null

    // ─── Group Owner (TCP server) ────────────────────────────────────────

    fun startServer() {
        scope.launch(Dispatchers.IO) {
            try {
                val server = ServerSocket(SERVER_PORT).also {
                    synchronized(this@WifiDirectTransport) { serverSocket = it }
                }
                Log.d(TAG, "TCP server listening on :$SERVER_PORT")
                while (isActive) {
                    try {
                        val socket = server.accept()
                        val key = socket.inetAddress.hostAddress ?: socket.inetAddress.toString()
                        Log.d(TAG, "Client connected: $key")
                        registerSocket(key, socket)
                    } catch (e: IOException) {
                        if (isActive) Log.e(TAG, "Accept error: ${e.message}")
                    }
                }
            } catch (e: IOException) {
                Log.e(TAG, "Server socket error: ${e.message}")
            }
        }
    }

    fun stopServer() {
        synchronized(this) {
            serverSocket?.runCatching { close() }
            serverSocket = null
        }
    }

    // ─── Group Client (TCP client) ───────────────────────────────────────

    fun connectToGroupOwner(goAddress: String) {
        scope.launch(Dispatchers.IO) {
            try {
                val socket = Socket()
                socket.connect(InetSocketAddress(goAddress, SERVER_PORT), CONNECT_TIMEOUT_MS)
                Log.d(TAG, "Connected to GO: $goAddress")
                registerSocket(goAddress, socket)
            } catch (e: IOException) {
                Log.e(TAG, "Failed to connect to GO $goAddress: ${e.message}")
                onPeerDisconnected?.invoke(goAddress)
            }
        }
    }

    // ─── Send ────────────────────────────────────────────────────────────

    fun send(socketKey: String, data: ByteArray) {
        val writer = synchronized(this) { writers[socketKey] }
        if (writer == null) {
            Log.w(TAG, "No writer for $socketKey — dropping ${data.size}B")
            return
        }
        scope.launch(Dispatchers.IO) {
            try {
                synchronized(writer) {
                    writer.writeInt(data.size)
                    writer.write(data)
                    writer.flush()
                }
                Log.d(TAG, "Sent ${data.size}B to $socketKey")
            } catch (e: IOException) {
                Log.e(TAG, "Send error to $socketKey: ${e.message}")
                closeSocket(socketKey)
            }
        }
    }

    // ─── Lifecycle ───────────────────────────────────────────────────────

    fun closeSocket(socketKey: String) {
        synchronized(this) {
            writers.remove(socketKey)
            pendingIdent.remove(socketKey)
            sockets.remove(socketKey)?.runCatching { close() }
        }
        Log.d(TAG, "Closed socket: $socketKey")
        onPeerDisconnected?.invoke(socketKey)
    }

    fun closeAll() {
        stopServer()
        val keys = synchronized(this) { sockets.keys.toList() }
        keys.forEach { key ->
            synchronized(this) {
                writers.remove(key)
                pendingIdent.remove(key)
                sockets.remove(key)?.runCatching { close() }
            }
            Log.d(TAG, "Closed socket: $key")
        }
    }

    fun connectedKeys(): Set<String> = synchronized(this) { sockets.keys.toSet() }

    // ─── Private ─────────────────────────────────────────────────────────

    private fun registerSocket(key: String, socket: Socket) {
        synchronized(this) {
            sockets[key]?.runCatching { close() } // close any stale socket
            sockets[key] = socket
            writers[key] = DataOutputStream(socket.getOutputStream().buffered())
            pendingIdent.add(key)
        }
        sendIdent(key)
        scope.launch(Dispatchers.IO) {
            try {
                readLoop(key, socket)
            } catch (e: Exception) {
                Log.e(TAG, "Exception in readLoop: ${e.message}")
            }
        }
    }

    /** Sends "IDENT:<myAndroidId>" as the first frame on [socketKey]. */
    private fun sendIdent(socketKey: String) {
        val identBytes = "IDENT:$myAndroidId".toByteArray(Charsets.UTF_8)
        send(socketKey, identBytes)
    }

    private suspend fun readLoop(key: String, socket: Socket) {
        try {
            val reader = DataInputStream(socket.getInputStream().buffered())
            while (!socket.isClosed) {
                val length = reader.readInt()
                if (length <= 0 || length > MAX_FRAME_BYTES) {
                    Log.w(TAG, "Invalid frame length $length from $key — closing")
                    break
                }
                val data = ByteArray(length)
                reader.readFully(data)

                val isIdent = synchronized(this) { pendingIdent.remove(key) }
                if (isIdent) {
                    val text = data.toString(Charsets.UTF_8)
                    if (text.startsWith("IDENT:")) {
                        val peerId = text.removePrefix("IDENT:")
                        Log.d(TAG, "IDENT from $key: peerId=$peerId")
                        onPeerIdentified?.invoke(key, peerId)
                    } else {
                        Log.w(TAG, "First frame from $key was not IDENT: $text — closing")
                        break
                    }
                } else {
                    onDataReceived?.invoke(key, data)
                }
            }
        } catch (e: IOException) {
            if (!socket.isClosed) Log.e(TAG, "Read error from $key: ${e.message}")
        } finally {
            closeSocket(key)
        }
    }
}
