package expo.modules.datasync.db.dao

import androidx.room.*
import expo.modules.datasync.db.entities.SessionEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SessionDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(session: SessionEntity)

    @Update
    suspend fun update(session: SessionEntity)

    @Query("SELECT * FROM sessions WHERE id = :id")
    suspend fun getById(id: String): SessionEntity?

    @Query("SELECT * FROM sessions WHERE status = 'active' LIMIT 1")
    suspend fun getActiveSession(): SessionEntity?

    @Query("SELECT * FROM sessions ORDER BY created_at DESC")
    suspend fun getAll(): List<SessionEntity>

    @Query("SELECT * FROM sessions ORDER BY created_at DESC")
    fun observeAll(): Flow<List<SessionEntity>>

    @Query("UPDATE sessions SET status = :status, ended_at = :endedAt, updated_at = :updatedAt WHERE id = :id")
    suspend fun updateStatus(id: String, status: String, endedAt: Long? = null, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE sessions SET member_count = :count, updated_at = :updatedAt WHERE id = :id")
    suspend fun updateMemberCount(id: String, count: Int, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE sessions SET event_count = event_count + 1, updated_at = :updatedAt WHERE id = :id")
    suspend fun incrementEventCount(id: String, updatedAt: Long = System.currentTimeMillis())
}
