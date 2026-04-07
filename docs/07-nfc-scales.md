# 07 — NFC & BLE Scales

Two hardware integrations enable fast member identification (NFC) and automated weight capture (BLE scales).

---

## NFC — Member Card Reader

**Package:** `@xpw2/nfc` (`packages/nfc/`)  
**Library:** `react-native-nfc-manager@3.15.0`

### Architecture

```
NFC Tag (NDEF)
   │
   ▼
NfcReader.scanForMemberCard()    ← packages/nfc/src/NfcReader.ts
   │
   ▼
parseNdefTextRecord()             ← packages/nfc/src/parser.ts
   │
   ▼
{ memberId, name, nfcCardId }     ← NfcScanResult
   │
   ▼
Redux: dispatch(identifyMember({ method: 'nfc', ... }))
   │
   ▼
DataSync.recordEvent('MemberIdentified', payload)
```

### Initialization

```typescript
import { NfcReader } from '@xpw2/nfc';

const nfc = new NfcReader();

// Check support before any scan
const { isSupported, isEnabled } = await nfc.getStatus();
if (!isSupported) { /* show unsupported UI */ }
if (!isEnabled)   { /* prompt user to enable NFC in settings */ }
```

### Scanning

```typescript
const result = await nfc.scanForMemberCard();

if (result.success && result.memberData) {
  dispatch(identifyMember({
    memberId:   result.memberData.memberId,
    method:     'nfc',
    nfcCardId:  result.tagId,
  }));
} else {
  // result.error contains the failure reason
}
```

### NFC Tag Format

Tags use **NDEF Text records** containing a JSON payload:

```json
{
  "memberId": "m-uuid-here",
  "name": "Jane Smith",
  "membershipNumber": "XPW-00123"
}
```

The tag UID (`tagId`) is extracted as a hex string and stored as `nfcCardId` on the member record.

### NDEF Parser (`packages/nfc/src/parser.ts`)

```typescript
export function decodeNdefText(payload: number[]): string {
  // NDEF Text Record format:
  // byte[0]: status byte — bit 7 = UTF vs UTF-16, bits 5-0 = language code length
  // byte[1..langLen]: language code (e.g., "en")
  // remaining: actual text content
  const statusByte = payload[0];
  const langLen    = statusByte & 0x3f;
  return String.fromCharCode(...payload.slice(1 + langLen));
}
```

### Android Permissions

```xml
<!-- apps/mobile/android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.NFC" />
<uses-feature android:name="android.hardware.nfc" android:required="false" />
```

`required="false"` allows the app to install on non-NFC devices (NFC features degrade gracefully).

---

## BLE Scales

**Package:** `@xpw2/ble-scale` (`packages/ble-scale/`)  
**Library:** `react-native-ble-plx@3.2.1`

### Architecture

```
BLE Scale Device
   │  Weight Measurement characteristic (UUID: 0000181D-...)
   ▼
BleScaleReader.startWeighing()    ← packages/ble-scale/src/BleScaleReader.ts
   │
   ▼
parseWeightMeasurement(base64)    ← packages/ble-scale/src/weightParser.ts
   │
   ▼
ScaleReading { weight, unit, stable, deviceId }
   │
   ▼
Redux: dispatch(recordWeight({ weight, source: 'scale', ... }))
   │
   ▼
DataSync.recordEvent('WeightRecorded', payload)
```

### BLE Service and Characteristic UUIDs

```typescript
// packages/ble-scale/src/weightParser.ts
const WEIGHT_SERVICE_UUID        = '0000181D-0000-1000-8000-00805F9B34FB';
const WEIGHT_MEASUREMENT_CHAR    = '00002A9D-0000-1000-8000-00805F9B34FB';
```

These are Bluetooth SIG standardized UUIDs for the **Weight Scale** profile.

### IEEE 11073 Weight Data Parsing

The Weight Measurement characteristic uses IEEE 11073 binary encoding:

```
Byte layout:
  byte[0]      — flags
                  bit 0: 0 = SI (kg), 1 = Imperial (lb)
                  bit 1: timestamp present
                  bit 2: user ID present
                  bit 3: BMI + height present
                  bit 4: measurement unstable (still settling)
  bytes[1-2]   — weight (uint16 little-endian)
                  SI units:       value × 0.005 = kg
                  Imperial units: value × 0.01  = lb
```

```typescript
export function parseWeightMeasurement(
  base64Value: string,
  deviceId: string,
  deviceName: string
): ScaleReading | null {
  const bytes      = base64ToBytes(base64Value);
  if (bytes.length < 3) return null;

  const flags      = bytes[0];
  const isImperial = (flags & 0x01) !== 0;
  const isUnstable = (flags & 0x10) !== 0;

  const rawWeight  = bytes[1] | (bytes[2] << 8);
  const weight     = isImperial
    ? Math.round(rawWeight * 0.01 * 10) / 10   // lb
    : Math.round(rawWeight * 0.005 * 10) / 10; // kg

  return {
    weight,
    unit: isImperial ? 'lb' : 'kg',
    stable: !isUnstable,
    timestamp: new Date().toISOString(),
    deviceId,
    deviceName,
  };
}
```

### Unit Conversion

```typescript
export function toKg(reading: ScaleReading): number {
  switch (reading.unit) {
    case 'kg': return reading.weight;
    case 'lb': return Math.round(reading.weight * 0.453592 * 10) / 10;
    case 'st': return Math.round(reading.weight * 6.35029  * 10) / 10;
  }
}
```

### `useScaleWeight` Hook

```typescript
// packages/ble-scale/src/hooks/useScaleWeight.ts
export function useScaleWeight(deviceId: string | null) {
  const [reading, setReading] = useState<ScaleReading | null>(null);
  const [status, setStatus]   = useState<'idle' | 'scanning' | 'connected' | 'error'>('idle');

  useEffect(() => {
    if (!deviceId) return;
    const reader = new BleScaleReader();
    reader.startWeighing(deviceId, (r) => {
      if (r.stable) setReading(r);
    }, setStatus);
    return () => reader.stopWeighing();
  }, [deviceId]);

  return { reading, status };
}
```

### Android Permissions

```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"
    android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

---

## Member Identification Flow (Combined)

```
1. Operator presses "Identify Member"
2. NFC scan initiated (or manual search fallback)
3. Tag read → memberId extracted
4. DataSync.getMemberById(memberId) → member loaded
5. MemberIdentified event recorded
6. If weigh role: BLE scale scan auto-starts for this member
7. Stable weight reading received
8. WeightRecorded event recorded with memberId
```
