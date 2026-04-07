package expo.modules.datasync.db.dao

import androidx.room.*
import expo.modules.datasync.db.entities.TodoEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface TodoDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(todo: TodoEntity)

    @Update
    suspend fun update(todo: TodoEntity)

    @Query("SELECT * FROM todos WHERE id = :id")
    suspend fun getById(id: String): TodoEntity?

    @Query("SELECT * FROM todos ORDER BY created_at DESC")
    suspend fun getAll(): List<TodoEntity>

    @Query("SELECT * FROM todos ORDER BY created_at DESC")
    fun observeAll(): Flow<List<TodoEntity>>

    @Query("DELETE FROM todos WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("UPDATE todos SET completed = :completed, updated_at = :updatedAt WHERE id = :id")
    suspend fun updateCompleted(id: String, completed: Boolean, updatedAt: Long = System.currentTimeMillis())
}
