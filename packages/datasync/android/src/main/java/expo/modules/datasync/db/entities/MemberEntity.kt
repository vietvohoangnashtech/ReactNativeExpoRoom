package expo.modules.datasync.db.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "members")
data class MemberEntity(
    @PrimaryKey
    val id: String,

    val name: String,

    val email: String? = null,

    val phone: String? = null,

    @ColumnInfo(name = "nfc_card_id")
    val nfcCardId: String? = null,

    @ColumnInfo(name = "membership_number")
    val membershipNumber: String? = null,

    @ColumnInfo(name = "current_weight")
    val currentWeight: Double? = null,

    @ColumnInfo(name = "target_weight")
    val targetWeight: Double? = null,

    val height: Double? = null,

    val bmi: Double? = null,

    val notes: String? = null,

    @ColumnInfo(name = "joined_at")
    val joinedAt: Long,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)
