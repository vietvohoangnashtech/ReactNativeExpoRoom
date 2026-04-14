# 05 — Cross-Tablet Sync

FitSync supports real-time event synchronization between tablets in the same room using **Wi-Fi Direct** (Android `android.net.wifi.p2p` + DNS-SD service discovery, no internet or Google Play Services required).

---

## Overview

```text
Tablet A (Pay role)              Tablet B (Weigh role)
┌────────────────────┐           ┌────────────────────┐
│  DNS-SD Advertise  │           │  DNS-SD Discover   │
│  _fitsync._tcp     │◄─────────►│  setDnsSdResponse  │
│  TXT: name|androidId│  Wi-Fi   │  Listeners()       │
└─────────┬──────────┘  Direct   └──────────┬─────────┘
          │                                  │
          │  WifiP2pManager.connect()         │
          │  → group negotiation             │
          │  → one becomes Group Owner (GO)  │
          │                                  │
    TCP ServerSocket             TCP Socket (connects to GO)
    port 8988 (if GO)            port 8988
          │                                  │
          │  IDENT handshake (Android ID)    │
          │◄────────────────────────────────►│
          │                                  │
     Send event batch JSON ──────────────► Receive + Deduplicate
     (length-prefix framing)               (insert to Room,
                                            skip if idempotencyKey exists)
```

---

## Wi-Fi Direct + DNS-SD

**API:** `android.net.wifi.p2p` (built-in, no Google Play Services)
**Service type:** `_fitsync._tcp` (DNS-SD local service discovery)
**Transport:** TCP on port `8988` with 4-byte length-prefix framing

### Advertising

A tablet registers a DNS-SD local service so nearby devices can discover it:

```kotlin
// WifiDirectManager.kt
fun startAdvertising(encodedName: String) {
    registerReceiver()
    val record = mapOf("name" to encodedName)   // TXT: "DisplayName|androidId"
    val serviceInfo = WifiP2pDnsSdServiceInfo.newInstance(
        "fitsync", "_fitsync._tcp", record
    )
    wifiP2pManager.clearLocalServices(channel, ...)
    wifiP2pManager.addLocalService(channel, serviceInfo, ...)
}
```

### Discovery

```kotlin
// WifiDirectManager.kt
fun startDiscovery() {
    registerReceiver()
    wifiP2pManager.setDnsSdResponseListeners(
        channel,
        { instanceName, _, srcDevice -> /* service found */ },
        { _, txtRecordMap, srcDevice ->
            val encodedName = txtRecordMap["name"] ?: return@setDnsSdResponseListeners
            val (displayName, remoteDeviceId) = parseEncodedName(encodedName)
            val endpointId = remoteDeviceId ?: srcDevice.deviceAddress
            onEndpointDiscovered?.invoke(
                DiscoveredEndpoint(endpointId, displayName, remoteDeviceId,
                    SERVICE_TYPE, srcDevice.deviceAddress)
            )
        }
    )
    wifiP2pManager.addServiceRequest(channel, WifiP2pDnsSdServiceRequest.newInstance(), ...)
    wifiP2pManager.discoverServices(channel, ...)
}
```

### Device Name Encoding

Device names are encoded with the Android ID (stable identifier, same as `DeviceEntity.id`):

```kotlin
// ExpoDataSyncModule.kt
val encodedName = "$deviceName|${getDeviceId()}"
wifiDirectManager.startAdvertising(encodedName)

// Parsed inside WifiDirectManager
private fun parseEncodedName(encodedName: String): Pair<String, String?> {
    val idx = encodedName.lastIndexOf('|')
    return if (idx > 0) Pair(encodedName.substring(0, idx), encodedName.substring(idx + 1))
    else Pair(encodedName, null)
}
```

### Connection Lifecycle

Connections are **auto-accepted** — no 4-digit code or user confirmation required.
After `WifiP2pManager.connect()` the group forms, then a TCP + IDENT handshake
establishes the data channel:

```kotlin
// WifiDirectManager.kt — BroadcastReceiver handles WIFI_P2P_CONNECTION_CHANGED_ACTION
wifiP2pManager.requestConnectionInfo(channel) { info ->
    if (info.isGroupOwner) transport.startServer()         // TCP ServerSocket :8988
    else transport.connectToGroupOwner(goAddress)          // TCP client → GO's IP
}

// WifiDirectTransport.kt — first frame on every new socket is the IDENT
private fun sendIdent(socketKey: String) {
    send(socketKey, "IDENT:$myAndroidId".toByteArray(Charsets.UTF_8))
}

// WifiDirectManager.kt — onPeerIdentified fires after IDENT received
transport.onPeerIdentified = { socketKey, peerId ->
    onConnectionRequest?.invoke(peerId, displayName, peerId, "", true)  // authDigits = ""
    onConnectionChanged?.invoke(peerId, true)
}
```

From JS (`authenticationDigits` is always `""`):

```typescript
// acceptConnection() is a no-op — auto-accepted via IDENT handshake
// rejectConnection() immediately disconnects the peer
```

---

## Payload Exchange

### Sending a Batch

The `EventOutbox` collects pending events and sends them as a JSON batch.
`WifiDirectTransport` uses **4-byte length-prefix framing** — no chunking needed:

```kotlin
// NearbyPayloadHandler.kt (unchanged — pure JSON serialization, no transport dependency)
fun createOutgoingBatch(
    batchId: String,
    deviceId: String,
    entries: List<DataSyncEngine.OutboxEntry>
): ByteArray { ... }

// WifiDirectManager.kt
fun sendPayload(endpointId: String, data: ByteArray) {
    val socketKey = idToSocket[endpointId]
    transport.send(socketKey, data)  // writes [4-byte-len][data] over TCP
}
```

### Receiving a Batch

```kotlin
// WifiDirectTransport.kt — readLoop (Dispatchers.IO coroutine)
val length = reader.readInt()          // 4-byte big-endian length
val data = ByteArray(length)
reader.readFully(data)
onDataReceived?.invoke(socketKey, data)   // socketKey → peerId → onPayloadReceived

// NearbyPayloadHandler.kt (unchanged)
suspend fun handleIncomingPayload(endpointId: String, data: ByteArray): Int {
    val batch = json.decodeFromString<EventBatch>(data.toString(Charsets.UTF_8))
    var accepted = 0
    for (event in batch.events) {
        val isNew = engine.recordRemoteEvent(entity)
        if (isNew) accepted++  // false = duplicate (idempotencyKey already seen)
    }
    return accepted
}
```

---

## Conflict Resolution

Conflicts are resolved through **idempotency keys**:

1. Each event has a stable `idempotencyKey` of the form `"deviceId:eventId"` (see [04-event-model.md](./04-event-model.md))
2. `DataSyncEngine.recordRemoteEvent()` checks `eventDao().getByIdempotencyKey()` before inserting
3. If an event arrives with an `idempotencyKey` already in the DB, it is silently skipped
4. No merge logic is needed — events are immutable facts

**Example:** If Tablet A sends the same event batch twice (network retry), all events from the second batch are skipped because their `idempotencyKey` values are already present.

---

## JS Event Bridge

The native layer emits six events to React Native via the Expo Modules event system:

```typescript
// packages/datasync/src/index.ts

// New peer discovered via DNS-SD
export function addDeviceFoundListener(
  callback: (event: DeviceFoundPayload) => void,
): EventSubscription {
  return emitter.addListener('onDeviceFound', callback);
}

// Device lost from Nearby discovery
export function addDeviceLostListener(
  callback: (event: DeviceLostPayload) => void,
): EventSubscription {
  return emitter.addListener('onDeviceLost', callback);
}

// Device connected / disconnected (after accept/reject)
export function addDeviceConnectionChangedListener(
  callback: (event: DeviceConnectionChangedPayload) => void,
): EventSubscription {
  return emitter.addListener('onDeviceConnectionChanged', callback);
}

// Incoming connection request — show auth digits UI
export function addConnectionRequestListener(
  callback: (event: ConnectionRequestPayload) => void,
): EventSubscription {
  return emitter.addListener('onConnectionRequest', callback);
}

// Sync batch completed
export function addSyncStatusChangedListener(
  callback: (event: SyncStatusChangedPayload) => void,
): EventSubscription {
  return emitter.addListener('onSyncStatusChanged', callback);
}

// Local event recorded
export function addEventRecordedListener(
  callback: (event: EventRecordedPayload) => void,
): EventSubscription {
  return emitter.addListener('onEventRecorded', callback);
}
```

---

## Device Roles

| Role       | Responsibilities                          |
| ---------- | ----------------------------------------- |
| `pay`      | Records payments, identifies members      |
| `weigh`    | Records weight measurements via BLE scale |
| `combined` | Both roles on a single tablet             |

Role is stored in `DeviceEntity` and exchanged during the initial connection handshake via the endpoint name.
