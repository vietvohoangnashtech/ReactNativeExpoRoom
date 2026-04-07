package expo.modules.datasync.db.dao

import androidx.room.*
import expo.modules.datasync.db.entities.MemberEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface MemberDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(member: MemberEntity)

    @Update
    suspend fun update(member: MemberEntity)

    @Query("SELECT * FROM members WHERE id = :id")
    suspend fun getById(id: String): MemberEntity?

    @Query("SELECT * FROM members WHERE nfc_card_id = :nfcCardId")
    suspend fun getByNfcCardId(nfcCardId: String): MemberEntity?

    @Query("SELECT * FROM members WHERE name LIKE '%' || :query || '%' OR membership_number LIKE '%' || :query || '%'")
    suspend fun search(query: String): List<MemberEntity>

    @Query("SELECT * FROM members ORDER BY name ASC")
    suspend fun getAll(): List<MemberEntity>

    @Query("SELECT * FROM members ORDER BY name ASC")
    fun observeAll(): Flow<List<MemberEntity>>

    @Query("DELETE FROM members WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("UPDATE members SET current_weight = :weight, bmi = :bmi, updated_at = :updatedAt WHERE id = :id")
    suspend fun updateWeight(id: String, weight: Double, bmi: Double?, updatedAt: Long = System.currentTimeMillis())

    @Query("SELECT COUNT(*) FROM members")
    suspend fun count(): Int
}
