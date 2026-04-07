package expo.modules.datasync.engine

import android.util.Log
import expo.modules.datasync.db.entities.EventEntity
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString

/**
 * BackendSyncManager — handles batch upload of events to the backend API.
 *
 * Implements the IBackendApi interface so the real backend can be swapped in later.
 * Ships with MockBackendApi for testing.
 */
class BackendSyncManager(
    private val api: IBackendApi = MockBackendApi()
) {
    companion object {
        private const val TAG = "BackendSyncManager"
    }

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    /**
     * Upload a batch of events to the backend.
     * Returns true if the backend accepted the batch.
     */
    suspend fun uploadBatch(entries: List<DataSyncEngine.OutboxEntry>): Boolean {
        if (entries.isEmpty()) return true

        val request = SyncRequest(
            events = entries.map { entry ->
                SyncEventPayload(
                    eventId = entry.event.eventId,
                    deviceId = entry.event.deviceId,
                    sessionId = entry.event.sessionId,
                    eventType = entry.event.eventType,
                    occurredAt = entry.event.occurredAt,
                    payload = entry.event.payload,
                    idempotencyKey = entry.event.idempotencyKey,
                    correlationId = entry.event.correlationId
                )
            }
        )

        return try {
            val response = api.syncEvents(request)
            Log.d(TAG, "Backend sync response: accepted=${response.acceptedCount}, rejected=${response.rejectedCount}")
            response.success
        } catch (e: Exception) {
            Log.e(TAG, "Backend sync failed: ${e.message}")
            false
        }
    }
}

// ─── API Interface ──────────────────────────────────────────────────────

interface IBackendApi {
    suspend fun syncEvents(request: SyncRequest): SyncResponse
    suspend fun fetchUpdates(deviceId: String, since: Long): List<SyncEventPayload>
}

// ─── Data Transfer Objects ──────────────────────────────────────────────

@Serializable
data class SyncRequest(
    val events: List<SyncEventPayload>
)

@Serializable
data class SyncEventPayload(
    val eventId: String,
    val deviceId: String,
    val sessionId: String,
    val eventType: String,
    val occurredAt: Long,
    val payload: String,
    val idempotencyKey: String,
    val correlationId: String
)

@Serializable
data class SyncResponse(
    val success: Boolean,
    val acceptedCount: Int,
    val rejectedCount: Int,
    val rejectedEventIds: List<String> = emptyList(),
    val message: String? = null
)

// ─── Mock Backend API ───────────────────────────────────────────────────

class MockBackendApi : IBackendApi {
    companion object {
        private const val TAG = "MockBackendApi"
    }

    override suspend fun syncEvents(request: SyncRequest): SyncResponse {
        Log.d(TAG, "Mock: accepting ${request.events.size} events")
        // Simulate network delay
        kotlinx.coroutines.delay(500)
        return SyncResponse(
            success = true,
            acceptedCount = request.events.size,
            rejectedCount = 0
        )
    }

    override suspend fun fetchUpdates(deviceId: String, since: Long): List<SyncEventPayload> {
        Log.d(TAG, "Mock: no server-side updates")
        return emptyList()
    }
}
