package expo.modules.datasync.db.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "weight_records")
data class WeightRecordEntity(
    @PrimaryKey
    val id: String,

    @ColumnInfo(name = "member_id")
    val memberId: String,

    val weight: Double, // kg, 1 decimal

    @ColumnInfo(name = "previous_weight")
    val previousWeight: Double? = null,

    val change: Double? = null, // weight - previousWeight

    val source: String, // manual, scale

    @ColumnInfo(name = "scale_device_id")
    val scaleDeviceId: String? = null,

    @ColumnInfo(name = "session_id")
    val sessionId: String,

    @ColumnInfo(name = "device_id")
    val deviceId: String,

    @ColumnInfo(name = "measured_at")
    val measuredAt: Long,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)
