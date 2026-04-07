package expo.modules.datasync.db.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "devices")
data class DeviceEntity(
    @PrimaryKey
    val id: String,

    @ColumnInfo(name = "device_name")
    val deviceName: String,

    @ColumnInfo(name = "nearby_endpoint_id")
    val nearbyEndpointId: String? = null,

    val role: String = "combined", // pay, weigh, combined

    @ColumnInfo(name = "connection_status")
    val connectionStatus: String = "disconnected", // discovered, connecting, connected, disconnected

    @ColumnInfo(name = "last_seen_at")
    val lastSeenAt: Long? = null,

    @ColumnInfo(name = "is_paired")
    val isPaired: Boolean = false,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)
