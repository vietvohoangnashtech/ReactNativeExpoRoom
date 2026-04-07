package expo.modules.datasync.db.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Outbox entry for reliable event synchronisation.
 * Each event gets an outbox entry tracking its sync status.
 *
 * Status flow: Pending → DeviceSynced → BackendSynced
 *              Pending → Failed (retry scheduled)
 */
@Entity(
    tableName = "outbox",
    foreignKeys = [
        ForeignKey(
            entity = EventEntity::class,
            parentColumns = ["event_id"],
            childColumns = ["event_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["event_id"], unique = true),
        Index(value = ["status"])
    ]
)
data class OutboxEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "event_id")
    val eventId: String,

    val status: String = "Pending", // Pending, DeviceSynced, BackendSynced, Failed

    @ColumnInfo(name = "retry_count")
    val retryCount: Int = 0,

    @ColumnInfo(name = "last_attempt_at")
    val lastAttemptAt: Long? = null,

    @ColumnInfo(name = "error_message")
    val errorMessage: String? = null,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)
