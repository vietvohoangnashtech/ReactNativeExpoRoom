# 05 — Cross-Tablet Sync

XPW2 supports real-time event synchronization between tablets in the same room using **Google Nearby Connections** (P2P WiFi/Bluetooth, no internet required).

---

## Overview

```
Tablet A (Pay role)          Tablet B (Weigh role)
┌──────────────┐             ┌──────────────┐
│  Advertising │◄───────────►│  Discovering │
│  + Accepting │  P2P WiFi / │  + Requesting│
│              │  BLE        │  connection  │
└──────┬───────┘             └──────┬───────┘
       │                            │
       │  Connected (bidirectional) │
       │                            │
  Send Payload ──────────────► Receive + Deduplicate
  (event batch JSON)             (insert to Room,
                                  skip if idempotencyKey exists)
```

---

## Google Nearby Connections

**API:** `com.google.android.gms:play-services-nearby:19.3.0`  
**Strategy:** `Strategy.P2P_CLUSTER` — all devices can connect to each other (mesh-like)

### Advertising

A tablet announces itself to nearby devices:

```kotlin
// NearbyManager.kt
fun startAdvertising(deviceName: String) {
    val advertisingOptions = AdvertisingOptions.Builder()
        .setStrategy(Strategy.P2P_CLUSTER)
        .build()

    Nearby.getConnectionsClient(context).startAdvertising(
        deviceName,
        SERVICE_ID,          // "com.xpw2.datasync"
        connectionLifecycleCallback,
        advertisingOptions
    )
}
```

### Discovery

```kotlin
fun startDiscovery() {
    val discoveryOptions = DiscoveryOptions.Builder()
        .setStrategy(Strategy.P2P_CLUSTER)
        .build()

    Nearby.getConnectionsClient(context).startDiscovery(
        SERVICE_ID,
        endpointDiscoveryCallback,  // fires onEndpointFound / onEndpointLost
        discoveryOptions
    )
}
```

### Connection Lifecycle

```kotlin
private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
    override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
        // Auto-accept all connections from the same SERVICE_ID
        Nearby.getConnectionsClient(context).acceptConnection(endpointId, payloadCallback)
    }

    override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
        if (result.status.isSuccess) {
            _connectedEndpoints.update { it + Endpoint(endpointId, info.endpointName) }
            onConnectionChanged?.invoke(endpointId, true)
        }
    }

    override fun onDisconnected(endpointId: String) {
        _connectedEndpoints.update { endpoints -> endpoints.filter { it.endpointId != endpointId } }
        onConnectionChanged?.invoke(endpointId, false)
    }
}
```

---

## Payload Exchange

### Sending a Batch

The `EventOutbox` collects pending events and sends them as a JSON batch:

```kotlin
// NearbyPayloadHandler.kt
fun createOutgoingBatch(
    batchId: String,
    deviceId: String,
    entries: List<OutboxWithEvent>
): ByteArray {
    val batch = SyncBatch(
        batchId = batchId,
        sourceDeviceId = deviceId,
        events = entries.map { it.event.toEventData() }
    )
    return json.encodeToString(batch).toByteArray(Charsets.UTF_8)
}

// NearbyManager.kt
fun sendPayload(endpointId: String, data: ByteArray) {
    Nearby.getConnectionsClient(context)
        .sendPayload(endpointId, Payload.fromBytes(data))
}
```

### Receiving a Batch

```kotlin
private val payloadCallback = object : PayloadCallback() {
    override fun onPayloadReceived(endpointId: String, payload: Payload) {
        payload.asBytes()?.let { bytes ->
            onPayloadReceived?.invoke(endpointId, bytes)
        }
    }
}

// NearbyPayloadHandler.kt
suspend fun handleIncomingPayload(endpointId: String, data: ByteArray): Int {
    val batch = json.decodeFromString<SyncBatch>(data.toString(Charsets.UTF_8))
    var accepted = 0
    for (event in batch.events) {
        val rowId = engine.insertEventIfAbsent(event)
        if (rowId != -1L) accepted++  // -1 means IGNORE (duplicate)
    }
    return accepted
}
```

---

## Conflict Resolution

Conflicts are resolved through **idempotency keys**:

1. Each event has a stable `idempotencyKey` (see [04-event-model.md](./04-event-model.md))
2. Room uses `OnConflictStrategy.IGNORE` on the `events` table
3. If an event arrives with an `idempotencyKey` already in the DB, it is silently skipped
4. No merge logic is needed — events are immutable facts

**Example:** Tablet A and Tablet B both record `WeightRecorded` for the same member in the same session. This is a legitimate duplicate only if they have the same `idempotencyKey`. Different `idempotencyKey` values means two separate weighings, both of which are stored.

---

## JS Event Bridge

The native layer emits events to React Native via the Expo Modules event system:

```typescript
// packages/datasync/src/index.ts

// New device discovered
export function addDeviceFoundListener(
  listener: (e: { endpointId: string; endpointName: string }) => void
): EventSubscription {
  return ExpoDataSync.addListener('onDeviceFound', listener);
}

// Device connected / disconnected
export function addDeviceConnectionListener(
  listener: (e: { endpointId: string; connected: boolean }) => void
): EventSubscription {
  return ExpoDataSync.addListener('onDeviceConnectionChanged', listener);
}

// Sync completed for a batch
export function addSyncStatusListener(
  listener: (e: SyncStatusEvent) => void
): EventSubscription {
  return ExpoDataSync.addListener('onSyncStatusChanged', listener);
}
```

---

## Device Roles

| Role | Responsibilities |
|------|----------------|
| `pay` | Records payments, identifies members |
| `weigh` | Records weight measurements via BLE scale |
| `combined` | Both roles on a single tablet |

Role is stored in `DeviceEntity` and exchanged during the initial connection handshake via the endpoint name.
