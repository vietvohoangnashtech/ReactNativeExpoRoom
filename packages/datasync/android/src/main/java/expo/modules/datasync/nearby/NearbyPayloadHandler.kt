package expo.modules.datasync.nearby

import android.util.Log
import expo.modules.datasync.db.entities.EventEntity
import expo.modules.datasync.engine.DataSyncEngine
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString

/**
 * Handles incoming Nearby Connections payloads.
 *
 * Parses JSON event batches from peer tablets, deduplicates via idempotencyKey,
 * and records events into the local DataSync engine.
 */
class NearbyPayloadHandler(
    private val engine: DataSyncEngine
) {
    companion object {
        private const val TAG = "NearbyPayloadHandler"
    }

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    // ─── Serializable event batch for Nearby transfer ───────────────────

    @Serializable
    data class EventBatch(
        val batchId: String,
        val deviceId: String,
        val events: List<SerializableEvent>
    )

    @Serializable
    data class SerializableEvent(
        val eventId: String,
        val deviceId: String,
        val sessionId: String,
        val eventType: String,
        val occurredAt: Long,
        val payload: String,
        val idempotencyKey: String,
        val correlationId: String
    )

    // ─── Incoming Payload Processing ────────────────────────────────────

    /**
     * Process raw bytes received from a peer device.
     * Returns number of new events accepted.
     */
    suspend fun handleIncomingPayload(endpointId: String, data: ByteArray): Int {
        return try {
            val jsonString = data.toString(Charsets.UTF_8)
            val batch = json.decodeFromString<EventBatch>(jsonString)
            Log.d(TAG, "Received batch ${batch.batchId} with ${batch.events.size} events from $endpointId")
            processBatch(batch)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to process payload from $endpointId: ${e.message}")
            0
        }
    }

    /**
     * Process a deserialized event batch.
     */
    private suspend fun processBatch(batch: EventBatch): Int {
        var accepted = 0
        for (event in batch.events) {
            val entity = EventEntity(
                eventId = event.eventId,
                deviceId = event.deviceId,
                sessionId = event.sessionId,
                eventType = event.eventType,
                occurredAt = event.occurredAt,
                payload = event.payload,
                idempotencyKey = event.idempotencyKey,
                correlationId = event.correlationId
            )

            val wasNew = engine.recordRemoteEvent(entity)
            if (wasNew) accepted++
        }
        Log.d(TAG, "Accepted $accepted/${batch.events.size} events from batch ${batch.batchId}")
        return accepted
    }

    // ─── Outgoing Batch Creation ────────────────────────────────────────

    /**
     * Create a serialized event batch from outbox entries for sending to a peer.
     */
    fun createOutgoingBatch(
        batchId: String,
        deviceId: String,
        entries: List<DataSyncEngine.OutboxEntry>
    ): ByteArray {
        val events = entries.map { entry ->
            SerializableEvent(
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

        val batch = EventBatch(
            batchId = batchId,
            deviceId = deviceId,
            events = events
        )

        return json.encodeToString(batch).toByteArray(Charsets.UTF_8)
    }
}
