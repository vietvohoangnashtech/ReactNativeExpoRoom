import NfcManager, { NfcTech, Ndef, TagEvent } from 'react-native-nfc-manager';
import { parseNdefTextRecord, decodeNdefText, tagIdToHex } from './parser';
import type { NfcScanResult, NfcStatus } from './types';

/**
 * NfcReader — core NFC reading logic wrapping react-native-nfc-manager.
 *
 * Supports:
 * - NDEF tag reading (text records with member JSON)
 * - Tag ID extraction
 * - NFC status checking
 */
export class NfcReader {
  private isInitialized = false;

  async init(): Promise<boolean> {
    if (this.isInitialized) return true;
    try {
      const supported = await NfcManager.isSupported();
      if (!supported) return false;
      await NfcManager.start();
      this.isInitialized = true;
      return true;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<NfcStatus> {
    try {
      const isSupported = await NfcManager.isSupported();
      const isEnabled = isSupported ? await NfcManager.isEnabled() : false;
      return { isSupported, isEnabled };
    } catch {
      return { isSupported: false, isEnabled: false };
    }
  }

  /**
   * Scan for an NFC tag and read NDEF data.
   * Returns member card data if the tag contains valid member JSON.
   */
  async scanForMemberCard(): Promise<NfcScanResult> {
    try {
      await this.init();
      await NfcManager.requestTechnology(NfcTech.Ndef);

      const tag: TagEvent | null = await NfcManager.getTag();
      if (!tag) {
        return { success: false, error: 'No tag detected' };
      }

      const tagId = tag.id ? tagIdToHex(tag.id as unknown as number[]) : undefined;
      const tagType = tag.techTypes?.[0] ?? undefined;

      // Parse NDEF message
      if (tag.ndefMessage && tag.ndefMessage.length > 0) {
        for (const record of tag.ndefMessage) {
          if (record.tnf === Ndef.TNF_WELL_KNOWN) {
            const text = decodeNdefText(record.payload as number[]);
            const card = parseNdefTextRecord(text);
            if (card) {
              return {
                success: true,
                card: { ...card, tagId, tagType },
                tagId,
              };
            }
          }
        }
      }

      return {
        success: false,
        error: 'Tag does not contain valid member data',
        tagId,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'NFC scan failed';
      return { success: false, error: message };
    } finally {
      try {
        await NfcManager.cancelTechnologyRequest();
      } catch {
        // Ignore cancel errors
      }
    }
  }

  /**
   * Read just the tag ID without NDEF data.
   */
  async readTagId(): Promise<string | null> {
    try {
      await this.init();
      await NfcManager.requestTechnology(NfcTech.NfcA);
      const tag = await NfcManager.getTag();
      return tag?.id ? tagIdToHex(tag.id as unknown as number[]) : null;
    } catch {
      return null;
    } finally {
      try {
        await NfcManager.cancelTechnologyRequest();
      } catch {
        // Ignore
      }
    }
  }

  cancel(): void {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }

  cleanup(): void {
    if (this.isInitialized) {
      NfcManager.cancelTechnologyRequest().catch(() => {});
      this.isInitialized = false;
    }
  }
}
