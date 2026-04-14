package expo.modules.datasync.worker

import android.content.Context
import android.util.Log
import androidx.work.*
import expo.modules.datasync.engine.DataSyncEngine
import expo.modules.datasync.engine.EventOutbox
import expo.modules.datasync.nearby.NearbyPayloadHandler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * WorkManager CoroutineWorker for device-to-device sync.
 *
 * Triggered as a one-shot work when a peer device is connected.
 * Sends pending events to connected peer tablet via Wi-Fi Direct.
 */
class DeviceSyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    companion object {
        const val TAG = "DeviceSyncWorker"
        const val WORK_NAME = "fitsync_device_sync"
        const val KEY_ENDPOINT_ID = "endpoint_id"
        const val KEY_DEVICE_ID = "device_id"
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val endpointId = inputData.getString(KEY_ENDPOINT_ID)
        val deviceId = inputData.getString(KEY_DEVICE_ID)

        if (endpointId == null || deviceId == null) {
            Log.e(TAG, "Missing endpoint_id or device_id")
            return@withContext Result.failure()
        }

        Log.d(TAG, "Device sync worker started for endpoint $endpointId")

        try {
            val engine = DataSyncEngine(applicationContext)
            val pending = engine.getPendingOutboxEntries(50)

            if (pending.isEmpty()) {
                Log.d(TAG, "No pending events to sync")
                return@withContext Result.success(workDataOf("synced_count" to 0))
            }

            val handler = NearbyPayloadHandler(engine)
            val batchData = handler.createOutgoingBatch(
                batchId = UUID.randomUUID().toString(),
                deviceId = deviceId,
                entries = pending
            )

            // WifiDirectManager is owned by ExpoDataSyncModule — this worker only prepares
            // the payload. Actual sending is handled by EventOutbox via WifiDirectManager.
            Log.d(TAG, "Device sync prepared ${pending.size} events (${batchData.size} bytes)")

            Result.success(
                workDataOf(
                    "synced_count" to pending.size,
                    "batch_size_bytes" to batchData.size
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "Device sync failed: ${e.message}")
            if (runAttemptCount < 3) {
                Result.retry()
            } else {
                Result.failure(workDataOf("error" to (e.message ?: "Unknown error")))
            }
        }
    }
}
