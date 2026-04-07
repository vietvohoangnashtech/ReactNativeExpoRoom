package expo.modules.datasync.engine

import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * EventOutbox — outbox pattern processor.
 *
 * Periodically scans for pending events and routes them to:
 * - DeviceSyncManager (cross-tablet P2P sync via Nearby Connections)
 * - BackendSyncManager (HTTP batch upload to server)
 *
 * Implements exponential backoff for retries.
 */
class EventOutbox(
    private val engine: DataSyncEngine,
    private val onDeviceSyncBatch: suspend (List<DataSyncEngine.OutboxEntry>) -> Boolean,
    private val onBackendSyncBatch: suspend (List<DataSyncEngine.OutboxEntry>) -> Boolean
) {
    companion object {
        private const val TAG = "EventOutbox"
        private const val DEVICE_SYNC_INTERVAL_MS = 30_000L // 30 seconds
        private const val BATCH_SIZE = 50
        private const val MAX_RETRIES = 5
        private const val INITIAL_BACKOFF_MS = 1_000L
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val _isProcessing = MutableStateFlow(false)
    val isProcessing: StateFlow<Boolean> = _isProcessing.asStateFlow()

    private var deviceSyncJob: Job? = null
    private var retrySyncJob: Job? = null

    // ─── Start / Stop ───────────────────────────────────────────────────

    fun startProcessing() {
        if (deviceSyncJob?.isActive == true) return
        Log.d(TAG, "Starting outbox processing")

        deviceSyncJob = scope.launch {
            while (isActive) {
                processDeviceSyncBatch()
                delay(DEVICE_SYNC_INTERVAL_MS)
            }
        }

        retrySyncJob = scope.launch {
            while (isActive) {
                processRetryBatch()
                delay(DEVICE_SYNC_INTERVAL_MS * 2)
            }
        }
    }

    fun stopProcessing() {
        Log.d(TAG, "Stopping outbox processing")
        deviceSyncJob?.cancel()
        retrySyncJob?.cancel()
    }

    // ─── Manual Trigger ─────────────────────────────────────────────────

    suspend fun processNow() {
        processDeviceSyncBatch()
    }

    // ─── Device Sync Batch ──────────────────────────────────────────────

    private suspend fun processDeviceSyncBatch() {
        _isProcessing.value = true
        try {
            val pending = engine.getPendingOutboxEntries(BATCH_SIZE)
            if (pending.isEmpty()) {
                _isProcessing.value = false
                return
            }

            Log.d(TAG, "Processing ${pending.size} pending events for device sync")

            val success = onDeviceSyncBatch(pending)
            val eventIds = pending.map { it.event.eventId }

            if (success) {
                engine.markDeviceSynced(eventIds)
                Log.d(TAG, "Device sync succeeded for ${eventIds.size} events")
            } else {
                Log.w(TAG, "Device sync failed for batch — events remain pending")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Device sync batch error: ${e.message}")
        } finally {
            _isProcessing.value = false
        }
    }

    // ─── Backend Sync Batch ─────────────────────────────────────────────

    suspend fun processBackendSyncBatch(): Int {
        _isProcessing.value = true
        var syncedCount = 0
        try {
            // Backend sync targets DeviceSynced entries (already exchanged with peer)
            // and Pending entries (if no peer device connected)
            val pending = engine.getPendingOutboxEntries(BATCH_SIZE)
            if (pending.isEmpty()) return 0

            Log.d(TAG, "Processing ${pending.size} events for backend sync")

            val success = onBackendSyncBatch(pending)
            val eventIds = pending.map { it.event.eventId }

            if (success) {
                engine.markBackendSynced(eventIds)
                syncedCount = eventIds.size
                Log.d(TAG, "Backend sync succeeded for $syncedCount events")
            } else {
                engine.markFailed(eventIds, "Backend sync failed")
                Log.w(TAG, "Backend sync failed for batch")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Backend sync batch error: ${e.message}")
        } finally {
            _isProcessing.value = false
        }
        return syncedCount
    }

    // ─── Retry Failed Events ────────────────────────────────────────────

    private suspend fun processRetryBatch() {
        try {
            val retryable = engine.getRetryableOutboxEntries(MAX_RETRIES)
            if (retryable.isEmpty()) return

            Log.d(TAG, "Retrying ${retryable.size} failed events")

            for (entry in retryable) {
                val backoff = calculateBackoff(entry.outbox.retryCount)
                delay(backoff)

                val success = try {
                    onDeviceSyncBatch(listOf(entry))
                } catch (e: Exception) {
                    false
                }

                if (success) {
                    engine.markDeviceSynced(listOf(entry.event.eventId))
                } else {
                    engine.markFailed(
                        listOf(entry.event.eventId),
                        "Retry ${entry.outbox.retryCount + 1} failed"
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Retry batch error: ${e.message}")
        }
    }

    private fun calculateBackoff(retryCount: Int): Long {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        val backoff = INITIAL_BACKOFF_MS * (1L shl retryCount.coerceAtMost(4))
        return backoff.coerceAtMost(60_000L)
    }

    fun destroy() {
        scope.cancel()
    }
}
