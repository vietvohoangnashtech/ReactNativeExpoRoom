package expo.modules.datasync.db.dao

import androidx.room.*
import expo.modules.datasync.db.entities.PaymentEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PaymentDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(payment: PaymentEntity)

    @Query("SELECT * FROM payments WHERE id = :id")
    suspend fun getById(id: String): PaymentEntity?

    @Query("SELECT * FROM payments WHERE member_id = :memberId ORDER BY occurred_at DESC")
    suspend fun getByMemberId(memberId: String): List<PaymentEntity>

    @Query("SELECT * FROM payments WHERE session_id = :sessionId ORDER BY occurred_at DESC")
    suspend fun getBySessionId(sessionId: String): List<PaymentEntity>

    @Query("SELECT * FROM payments ORDER BY occurred_at DESC")
    fun observeAll(): Flow<List<PaymentEntity>>

    @Query("DELETE FROM payments WHERE id = :id")
    suspend fun deleteById(id: String)
}
