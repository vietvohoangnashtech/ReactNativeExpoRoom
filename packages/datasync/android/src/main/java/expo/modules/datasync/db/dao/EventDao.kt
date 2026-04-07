package expo.modules.datasync.db.dao

import androidx.room.*
import expo.modules.datasync.db.entities.EventEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface EventDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(event: EventEntity): Long

    @Query("SELECT * FROM events WHERE event_id = :eventId")
    suspend fun getById(eventId: String): EventEntity?

    @Query("SELECT * FROM events WHERE session_id = :sessionId ORDER BY occurred_at ASC")
    suspend fun getBySessionId(sessionId: String): List<EventEntity>

    @Query("SELECT * FROM events WHERE event_type = :eventType ORDER BY occurred_at DESC")
    suspend fun getByType(eventType: String): List<EventEntity>

    @Query("SELECT * FROM events WHERE idempotency_key = :key")
    suspend fun getByIdempotencyKey(key: String): EventEntity?

    @Query("SELECT * FROM events ORDER BY occurred_at DESC")
    fun observeAll(): Flow<List<EventEntity>>

    @Query("SELECT COUNT(*) FROM events WHERE session_id = :sessionId")
    suspend fun countBySession(sessionId: String): Int

    @Query("SELECT * FROM events WHERE event_id IN (:eventIds)")
    suspend fun getByIds(eventIds: List<String>): List<EventEntity>
}
