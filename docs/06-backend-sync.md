# 06 — Backend Sync

Backend synchronization uploads the local event log to a central server using **WorkManager** for reliable background execution. This is independent of the cross-tablet sync (see [05-cross-tablet-sync.md](./05-cross-tablet-sync.md)).

---

## WorkManager Background Sync

**Dependency:** `androidx.work:work-runtime-ktx:2.10.0`

WorkManager guarantees execution even if the app is backgrounded or the device reboots.

### Scheduling (`SyncScheduler.kt`)

```kotlin
object SyncScheduler {

    private const val SYNC_WORK_TAG = "xpw2_backend_sync"

    // Periodic sync every 15 minutes when network is available
    fun schedulePeriodicSync(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .addTag(SYNC_WORK_TAG)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            SYNC_WORK_TAG,
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }

    // One-shot sync (triggered after a session ends or when connectivity restored)
    fun triggerImmediateSync(context: Context) {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build())
            .addTag(SYNC_WORK_TAG)
            .build()

        WorkManager.getInstance(context).enqueue(request)
    }
}
```

### SyncWorker

```kotlin
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            val engine = DataSyncEngine(applicationContext)
            val outbox = EventOutbox(engine, ...)
            outbox.processPendingBackendSync()
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }
}
```

---

## Batch Upload Pattern

Events are uploaded in batches (up to 50 at a time) to reduce HTTP overhead:

```kotlin
// EventOutbox.kt
suspend fun processPendingBackendSync() {
    val pending = db.outboxDao().getPendingEntries(limit = 50)
        .filter { it.status == "Pending" || it.status == "DeviceSynced" }

    if (pending.isEmpty()) return

    val events = pending.mapNotNull { entry ->
        db.eventDao().getEventById(entry.eventId)
    }

    val success = onBackendSyncBatch(pending.zip(events))
    if (success) {
        pending.forEach { entry ->
            db.outboxDao().updateStatus(entry.eventId, "BackendSynced")
        }
    } else {
        pending.forEach { entry ->
            db.outboxDao().markFailed(
                eventId = entry.eventId,
                retryCount = entry.retryCount + 1,
                errorMessage = "Upload failed"
            )
        }
    }
}
```

---

## Retry with Exponential Backoff

WorkManager handles retry scheduling. The `SyncWorker` returns `Result.retry()` on transient failures. WorkManager uses exponential backoff (default: initial 30s, doubles per attempt, max 5 hours).

For fine-grained control, the backoff policy is also configured on the work request:

```kotlin
OneTimeWorkRequestBuilder<SyncWorker>()
    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
    .build()
```

The `OutboxEntity.retryCount` tracks application-level retries independently of WorkManager retries, for observability and giving up after a threshold.

---

## `IBackendApi` Interface

The backend API is abstracted behind an interface, allowing a mock implementation during development:

```kotlin
interface IBackendApi {
    suspend fun uploadEvents(events: List<EventData>): UploadResult
    suspend fun fetchServerEvents(deviceId: String, since: Long): List<EventData>
}

data class UploadResult(
    val accepted: Int,
    val rejected: Int,
    val errors: List<String>
)
```

### Mock Implementation

```kotlin
class MockBackendApi : IBackendApi {
    override suspend fun uploadEvents(events: List<EventData>): UploadResult {
        // Simulate network delay
        delay(200)
        return UploadResult(accepted = events.size, rejected = 0, errors = emptyList())
    }

    override suspend fun fetchServerEvents(deviceId: String, since: Long): List<EventData> {
        delay(100)
        return emptyList()
    }
}
```

**Switching to real API:** Replace `MockBackendApi` with a Retrofit or Ktor implementation in `BackendSyncManager`. The interface contract remains the same.

---

## Sync Status Events

The native module emits sync status updates to React Native:

```typescript
// Emitted after each backend sync attempt
{
  type: 'backendSync';
  accepted: number;
  rejected: number;
  errors: string[];
}
```

The Redux `sync` slice listens to these events to update the UI sync indicator.

---

## Observability

Track sync health via the `OutboxEntity` table:

| Query | Meaning |
|-------|---------|
| `WHERE status = 'Pending'` | Events not yet synced anywhere |
| `WHERE status = 'Failed' AND retry_count >= 3` | Stuck events (need investigation) |
| `WHERE status = 'BackendSynced'` | Successfully uploaded |

A "sync dashboard" screen in the `devices` feature can surface this data to the operator.
