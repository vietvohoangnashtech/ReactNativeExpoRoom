package expo.modules.datasync.db.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "awards")
data class AwardEntity(
    @PrimaryKey
    val id: String,

    @ColumnInfo(name = "member_id")
    val memberId: String,

    val type: String, // first_week, weight_loss_5, etc.

    val description: String,

    @ColumnInfo(name = "granted_at")
    val grantedAt: Long,

    @ColumnInfo(name = "session_id")
    val sessionId: String,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)
