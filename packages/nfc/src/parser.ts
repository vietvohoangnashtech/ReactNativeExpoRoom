import type { NfcMemberCard } from './types';

/**
 * Parse NDEF text record payload into NfcMemberCard.
 *
 * Expected JSON format on card:
 * { "memberId": "...", "name": "...", "membershipNumber": "..." }
 *
 * Falls back to raw text if JSON parsing fails.
 */
export function parseNdefTextRecord(payload: string): NfcMemberCard | null {
  try {
    const data = JSON.parse(payload);

    if (!data.memberId || !data.name) {
      return null;
    }

    return {
      memberId: String(data.memberId),
      name: String(data.name),
      membershipNumber: String(data.membershipNumber ?? ''),
      rawData: payload,
    };
  } catch {
    return null;
  }
}

/**
 * Decode NDEF text record bytes to string.
 * NDEF text record format: [status byte][language code][text]
 * Status byte bit 7: encoding (0=UTF-8, 1=UTF-16)
 * Status byte bits 0-5: language code length
 */
export function decodeNdefText(bytes: number[]): string {
  if (bytes.length < 3) return '';

  const statusByte = bytes[0];
  const langCodeLength = statusByte & 0x3f;
  const textStartIndex = 1 + langCodeLength;

  if (textStartIndex >= bytes.length) return '';

  const textBytes = bytes.slice(textStartIndex);
  return String.fromCharCode(...textBytes);
}

/**
 * Convert tag ID byte array to hex string.
 */
export function tagIdToHex(id: number[]): string {
  return id.map((byte) => byte.toString(16).padStart(2, '0')).join(':');
}
