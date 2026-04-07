package expo.modules.datasync.db.dao

import androidx.room.*
import expo.modules.datasync.db.entities.OutboxEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface OutboxDao {
    @Insert
    suspend fun insert(entry: OutboxEntity): Long

    @Update
    suspend fun update(entry: OutboxEntity)

    @Query("SELECT * FROM outbox WHERE status = 'Pending' ORDER BY created_at ASC")
    suspend fun getPending(): List<OutboxEntity>

    @Query("SELECT * FROM outbox WHERE status = 'Pending' ORDER BY created_at ASC LIMIT :limit")
    suspend fun getPendingBatch(limit: Int): List<OutboxEntity>

    @Query("SELECT * FROM outbox WHERE status = 'Failed' AND retry_count < :maxRetries ORDER BY created_at ASC")
    suspend fun getRetryable(maxRetries: Int): List<OutboxEntity>

    @Query("UPDATE outbox SET status = :status, last_attempt_at = :now WHERE event_id IN (:eventIds)")
    suspend fun updateStatusForEvents(eventIds: List<String>, status: String, now: Long = System.currentTimeMillis())

    @Query("UPDATE outbox SET status = 'Failed', retry_count = retry_count + 1, last_attempt_at = :now, error_message = :error WHERE event_id IN (:eventIds)")
    suspend fun markFailed(eventIds: List<String>, error: String, now: Long = System.currentTimeMillis())

    @Query("SELECT COUNT(*) FROM outbox WHERE status = :status")
    suspend fun countByStatus(status: String): Int

    @Query("SELECT * FROM outbox ORDER BY created_at DESC")
    fun observeAll(): Flow<List<OutboxEntity>>

    // Sync status summary
    @Query("""
        SELECT 
            SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pendingCount,
            SUM(CASE WHEN status = 'DeviceSynced' THEN 1 ELSE 0 END) as deviceSyncedCount,
            SUM(CASE WHEN status = 'BackendSynced' THEN 1 ELSE 0 END) as backendSyncedCount,
            SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failedCount
        FROM outbox
    """)
    suspend fun getSyncCounts(): SyncCountResult

    @Query("SELECT MAX(last_attempt_at) FROM outbox WHERE status = 'BackendSynced'")
    suspend fun getLastBackendSyncTime(): Long?
}

data class SyncCountResult(
    val pendingCount: Int,
    val deviceSyncedCount: Int,
    val backendSyncedCount: Int,
    val failedCount: Int
)
