export interface NfcMemberCard {
  memberId: string;
  name: string;
  membershipNumber: string;
  rawData?: string;
  tagId?: string;
  tagType?: string;
}

export interface NfcScanResult {
  success: boolean;
  card?: NfcMemberCard;
  error?: string;
  tagId?: string;
}

export interface NfcStatus {
  isSupported: boolean;
  isEnabled: boolean;
}
