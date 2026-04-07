package expo.modules.datasync.db.dao

import androidx.room.*
import expo.modules.datasync.db.entities.WeightRecordEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface WeightRecordDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(record: WeightRecordEntity)

    @Query("SELECT * FROM weight_records WHERE id = :id")
    suspend fun getById(id: String): WeightRecordEntity?

    @Query("SELECT * FROM weight_records WHERE member_id = :memberId ORDER BY measured_at DESC")
    suspend fun getByMemberId(memberId: String): List<WeightRecordEntity>

    @Query("SELECT * FROM weight_records WHERE member_id = :memberId ORDER BY measured_at DESC LIMIT 1")
    suspend fun getLatestByMemberId(memberId: String): WeightRecordEntity?

    @Query("SELECT * FROM weight_records WHERE session_id = :sessionId ORDER BY measured_at DESC")
    suspend fun getBySessionId(sessionId: String): List<WeightRecordEntity>

    @Query("SELECT * FROM weight_records ORDER BY measured_at DESC")
    fun observeAll(): Flow<List<WeightRecordEntity>>

    @Query("DELETE FROM weight_records WHERE id = :id")
    suspend fun deleteById(id: String)
}
