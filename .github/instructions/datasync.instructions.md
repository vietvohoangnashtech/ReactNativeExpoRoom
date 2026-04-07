---
applyTo: "**/datasync/**/*.kt,**/datasync/**/*.ts,**/datasync/**/*.tsx"
---

# DataSync Module Conventions

## Event Model

- All state changes are recorded as immutable events via `DataSync.recordEvent(eventType, payload, sessionId)`
- Events include: `eventId`, `deviceId`, `sessionId`, `eventType`, `occurredAt`, `payload`, `idempotencyKey`, `correlationId`
- Idempotency keys are auto-generated (`{deviceId}:{eventType}:{timestamp}`)
- Use `recordEventWithCorrelation()` when linking related events

## Outbox Pattern

- Events flow: **Pending → DeviceSynced → BackendSynced**
- Failed events retry with exponential backoff via WorkManager
- Never skip the outbox — all events must go through it

## Kotlin Bridge Rules

- All `AsyncFunction` bodies calling suspend functions MUST use the `Coroutine` infix:
  ```kotlin
  AsyncFunction("functionName") Coroutine { args ->
    engine.suspendCall()
  }
  ```
- Import: `import expo.modules.kotlin.functions.Coroutine`
- Non-suspend functions use regular `AsyncFunction("name") { args -> ... }` syntax
- Do NOT use `useCoroutines()` or `useExpoPublishing()` in build.gradle

## Room Database

- All entities use `@Entity` with explicit `tableName`
- DAOs use `@Dao` with suspend functions for all operations
- Use `@Insert(onConflict = OnConflictStrategy.IGNORE)` for event deduplication
- SQLCipher encryption via `SupportFactory` with Android Keystore passphrase
- KSP annotation processor (not kapt) — Room 2.7.1+

## Event Types (10 total)

```
SessionStarted | SessionEnded
MemberRegistered | MemberIdentified
PaymentRecorded | WeightRecorded
AwardGranted
TodoCreated | TodoUpdated | TodoDeleted
```

## Cross-Tablet Sync

- Google Nearby Connections with P2P_CLUSTER strategy
- Events serialized as JSON via kotlinx-serialization
- Dedup on insert via idempotencyKey (Room IGNORE strategy)
