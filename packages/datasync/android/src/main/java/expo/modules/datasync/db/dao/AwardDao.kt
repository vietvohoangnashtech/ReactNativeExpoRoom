package expo.modules.datasync.db.dao

import androidx.room.*
import expo.modules.datasync.db.entities.AwardEntity

@Dao
interface AwardDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(award: AwardEntity)

    @Query("SELECT * FROM awards WHERE member_id = :memberId ORDER BY granted_at DESC")
    suspend fun getByMemberId(memberId: String): List<AwardEntity>

    @Query("SELECT * FROM awards WHERE session_id = :sessionId ORDER BY granted_at DESC")
    suspend fun getBySessionId(sessionId: String): List<AwardEntity>

    @Query("DELETE FROM awards WHERE id = :id")
    suspend fun deleteById(id: String)
}
