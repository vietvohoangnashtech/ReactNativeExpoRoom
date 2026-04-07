package expo.modules.datasync.worker

import android.content.Context
import android.util.Log
import androidx.work.*
import java.util.concurrent.TimeUnit

/**
 * SyncScheduler — manages WorkManager scheduling for periodic and one-shot sync.
 */
object SyncScheduler {
    private const val TAG = "SyncScheduler"

    // ─── Backend Sync (Periodic) ────────────────────────────────────────

    fun schedulePeriodicBackendSync(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()

        val request = PeriodicWorkRequestBuilder<BackendSyncWorker>(
            15, TimeUnit.MINUTES // Android minimum
        )
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                WorkRequest.MIN_BACKOFF_MILLIS,
                TimeUnit.MILLISECONDS
            )
            .addTag(BackendSyncWorker.TAG)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            BackendSyncWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )

        Log.d(TAG, "Periodic backend sync scheduled (15 min)")
    }

    fun cancelPeriodicBackendSync(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(BackendSyncWorker.WORK_NAME)
        Log.d(TAG, "Periodic backend sync cancelled")
    }

    // ─── Immediate Backend Sync (One-Shot) ──────────────────────────────

    fun triggerImmediateBackendSync(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = OneTimeWorkRequestBuilder<BackendSyncWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                WorkRequest.MIN_BACKOFF_MILLIS,
                TimeUnit.MILLISECONDS
            )
            .addTag(BackendSyncWorker.TAG)
            .build()

        WorkManager.getInstance(context).enqueue(request)
        Log.d(TAG, "Immediate backend sync triggered")
    }

    // ─── Device Sync (One-Shot) ─────────────────────────────────────────

    fun triggerDeviceSync(context: Context, endpointId: String, deviceId: String) {
        val data = workDataOf(
            DeviceSyncWorker.KEY_ENDPOINT_ID to endpointId,
            DeviceSyncWorker.KEY_DEVICE_ID to deviceId
        )

        val request = OneTimeWorkRequestBuilder<DeviceSyncWorker>()
            .setInputData(data)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                WorkRequest.MIN_BACKOFF_MILLIS,
                TimeUnit.MILLISECONDS
            )
            .addTag(DeviceSyncWorker.TAG)
            .build()

        WorkManager.getInstance(context).enqueue(request)
        Log.d(TAG, "Device sync triggered for endpoint $endpointId")
    }

    // ─── Status ─────────────────────────────────────────────────────────

    fun isBackendSyncScheduled(context: Context): Boolean {
        val statuses = WorkManager.getInstance(context)
            .getWorkInfosForUniqueWork(BackendSyncWorker.WORK_NAME)
            .get()
        return statuses.any { it.state == WorkInfo.State.ENQUEUED || it.state == WorkInfo.State.RUNNING }
    }

    fun cancelAll(context: Context) {
        WorkManager.getInstance(context).cancelAllWorkByTag(BackendSyncWorker.TAG)
        WorkManager.getInstance(context).cancelAllWorkByTag(DeviceSyncWorker.TAG)
        Log.d(TAG, "All sync work cancelled")
    }
}
