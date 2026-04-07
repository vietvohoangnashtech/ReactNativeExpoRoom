import type { ScaleReading } from './types';

// BLE Weight Measurement Service (Bluetooth SIG standard)
const WEIGHT_SERVICE_UUID = '0000181D-0000-1000-8000-00805F9B34FB';
const WEIGHT_MEASUREMENT_CHAR_UUID = '00002A9D-0000-1000-8000-00805F9B34FB';

/**
 * Parse IEEE 11073 Weight Measurement characteristic value.
 *
 * Byte layout (base64 decoded):
 * - byte[0]: flags
 *   bit 0: 0=SI (kg), 1=Imperial (lb)
 *   bit 1: timestamp present
 *   bit 2: user ID present
 *   bit 3: BMI + height present
 *   bit 4: measurement unstable
 * - bytes[1-2]: weight (uint16, little-endian)
 *   SI: resolution 0.005 kg (value * 0.005)
 *   Imperial: resolution 0.01 lb (value * 0.01)
 */
export function parseWeightMeasurement(
  base64Value: string,
  deviceId: string,
  deviceName: string
): ScaleReading | null {
  try {
    const bytes = base64ToBytes(base64Value);
    if (bytes.length < 3) return null;

    const flags = bytes[0];
    const isImperial = (flags & 0x01) !== 0;
    const isUnstable = (flags & 0x10) !== 0;

    // Weight is uint16 little-endian at bytes 1-2
    const rawWeight = bytes[1] | (bytes[2] << 8);

    let weight: number;
    let unit: 'kg' | 'lb' | 'st';

    if (isImperial) {
      weight = rawWeight * 0.01; // pounds
      unit = 'lb';
    } else {
      weight = rawWeight * 0.005; // kg
      unit = 'kg';
    }

    // Round to 1 decimal
    weight = Math.round(weight * 10) / 10;

    return {
      weight,
      unit,
      stable: !isUnstable,
      timestamp: new Date().toISOString(),
      deviceId,
      deviceName,
    };
  } catch {
    return null;
  }
}

/**
 * Convert a weight reading to kg regardless of source unit.
 */
export function toKg(reading: ScaleReading): number {
  switch (reading.unit) {
    case 'kg':
      return reading.weight;
    case 'lb':
      return Math.round(reading.weight * 0.453592 * 10) / 10;
    case 'st':
      return Math.round(reading.weight * 6.35029 * 10) / 10;
  }
}

function base64ToBytes(base64: string): number[] {
  const binaryString = atob(base64);
  const bytes: number[] = [];
  for (let i = 0; i < binaryString.length; i++) {
    bytes.push(binaryString.charCodeAt(i));
  }
  return bytes;
}

export { WEIGHT_SERVICE_UUID, WEIGHT_MEASUREMENT_CHAR_UUID };
