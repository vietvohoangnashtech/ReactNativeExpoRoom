import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNfcReader } from '@xpw2/nfc';
import { useAppDispatch, useAppSelector } from '@/hooks/useStore';
import { clearSelectedMember, identifyMemberByNfcThunk } from '../store/memberSlice';
import FeatureLayout from '@/components/FeatureLayout';
import RegisterMemberScreen from './RegisterMemberScreen';

type MemberMode = 'identify' | 'register';

export default function MembersScreen() {
  const [mode, setMode] = useState<MemberMode>('identify');

  return (
    <FeatureLayout title="Members">
      {/* Segment Control */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segment, mode === 'identify' && styles.segmentActive]}
          onPress={() => setMode('identify')}
          accessibilityLabel="Switch to Identify mode"
          accessibilityState={{ selected: mode === 'identify' }}
        >
          <Text style={[styles.segmentText, mode === 'identify' && styles.segmentTextActive]}>
            Identify
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, mode === 'register' && styles.segmentActive]}
          onPress={() => setMode('register')}
          accessibilityLabel="Switch to Register mode"
          accessibilityState={{ selected: mode === 'register' }}
        >
          <Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>
            Register
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'identify' ? <IdentifyPanel /> : <RegisterMemberScreen />}
    </FeatureLayout>
  );
}

// ─── Identify Panel ──────────────────────────────────────────────────────────

function IdentifyPanel() {
  const dispatch = useAppDispatch();
  const { selectedMember } = useAppSelector((s) => s.member);
  const activeSession = useAppSelector((s) => s.session.activeSession);
  const { status, isScanning, lastResult, scanForMemberCard, cancel } = useNfcReader();
  const [showRawJson, setShowRawJson] = useState(true);

  useEffect(() => {
    if (selectedMember) {
      console.log('[NFC] Member identified:', {
        id: selectedMember.id,
        name: selectedMember.name,
        nfcCardId: selectedMember.nfcCardId,
      });
    }
  }, [selectedMember]);

  useEffect(() => {
    if (lastResult) {
      console.log('[NFC] Raw scan result:', JSON.stringify(lastResult, null, 2));
    }
  }, [lastResult]);

  const handleScan = useCallback(async () => {
    console.log('[NFC] Scan started');
    const result = await scanForMemberCard();
    console.log('[NFC] Scan complete:', JSON.stringify(result, null, 2));

    if (result.success) {
      const lookupKey = result.tagId ?? result.card?.memberId;
      console.log('[NFC] Looking up member by key:', lookupKey);
      if (lookupKey) {
        const sessionId = activeSession?.id ?? 'test-session';
        dispatch(identifyMemberByNfcThunk({ nfcCardId: lookupKey, sessionId }));
      } else {
        console.warn('[NFC] Scan succeeded but no lookup key found');
      }
    } else {
      console.warn('[NFC] Scan failed:', result.error);
    }
  }, [scanForMemberCard, dispatch, activeSession]);

  return (
    <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
      {/* NFC Status */}
      <View style={styles.nfcStatusRow}>
        <Text style={styles.nfcStatusText}>
          NFC: {status.isSupported ? (status.isEnabled ? '✅ Ready' : '⚠️ Disabled') : '❌ Not Supported'}
        </Text>
      </View>

      {/* Scan Button */}
      <TouchableOpacity
        style={[styles.scanButton, isScanning && styles.scanningButton]}
        onPress={isScanning ? cancel : handleScan}
        disabled={!status.isEnabled}
        accessibilityLabel={isScanning ? 'Cancel NFC scan' : 'Scan NFC card'}
      >
        {isScanning ? (
          <>
            <ActivityIndicator color="#fff" />
            <Text style={styles.scanButtonText}>Scanning... Tap to Cancel</Text>
          </>
        ) : (
          <Text style={styles.scanButtonText}>Scan NFC Card</Text>
        )}
      </TouchableOpacity>

      {/* NFC Raw JSON Panel — DEV FEATURE */}
      {lastResult ? (
        <View
          style={[
            styles.jsonCard,
            lastResult.success && selectedMember ? styles.jsonCardSuccess : null,
            lastResult.success && !selectedMember ? styles.jsonCardWarning : null,
            !lastResult.success ? styles.jsonCardError : null,
          ]}
        >
          <TouchableOpacity
            style={styles.jsonToggle}
            onPress={() => setShowRawJson((v) => !v)}
            accessibilityLabel="Toggle raw NFC JSON"
          >
            <Text style={styles.jsonToggleText}>
              {showRawJson ? '▼' : '▶'} NFC Raw Result
            </Text>
            <Text style={styles.jsonTagId}>
              Tag: {lastResult.tagId ?? 'unknown'}
            </Text>
          </TouchableOpacity>
          {showRawJson ? (
            <ScrollView style={styles.jsonScroll} nestedScrollEnabled>
              <Text style={styles.jsonText} selectable>
                {JSON.stringify(lastResult, null, 2)}
              </Text>
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      {/* Error */}
      {lastResult && !lastResult.success ? (
        <Text style={styles.error}>{lastResult.error}</Text>
      ) : null}

      {/* No match warning */}
      {lastResult && lastResult.success && !selectedMember ? (
        <View style={styles.notFoundCard}>
          <Text style={styles.notFoundText}>⚠️ Tag scanned but no matching member found.</Text>
          <Text style={styles.notFoundHint}>
            Tag UID: {lastResult.tagId ?? 'unknown'}
          </Text>
          <Text style={styles.notFoundHint}>Register this NFC card first.</Text>
        </View>
      ) : null}

      {/* Identified Member Card */}
      {selectedMember ? (
        <View style={styles.memberCard}>
          <View style={styles.memberCardHeader}>
            <Text style={styles.memberName}>{selectedMember.name}</Text>
            <TouchableOpacity
              onPress={() => {
                console.log('[NFC] Clearing selected member');
                dispatch(clearSelectedMember());
              }}
              accessibilityLabel="Clear member"
            >
              <Text style={styles.clearButton}>✕ Clear</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.memberDetail}>🪪 ID: {selectedMember.id}</Text>
          {selectedMember.email ? (
            <Text style={styles.memberDetail}>📧 {selectedMember.email}</Text>
          ) : null}
          {selectedMember.phone ? (
            <Text style={styles.memberDetail}>📱 {selectedMember.phone}</Text>
          ) : null}
          {selectedMember.membershipNumber ? (
            <Text style={styles.memberDetail}>🏷️ {selectedMember.membershipNumber}</Text>
          ) : null}
          {selectedMember.currentWeight ? (
            <Text style={styles.memberDetail}>⚖️ Last Weight: {selectedMember.currentWeight} kg</Text>
          ) : null}
          {selectedMember.nfcCardId ? (
            <Text style={styles.memberDetail}>📳 NFC UID: {selectedMember.nfcCardId}</Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 8,
    backgroundColor: '#E5E5E5',
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#fff',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  segmentTextActive: {
    color: '#007AFF',
  },
  panel: {
    flex: 1,
  },
  panelContent: {
    padding: 16,
  },
  nfcStatusRow: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  nfcStatusText: {
    fontSize: 14,
    color: '#666',
  },
  scanButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  scanningButton: {
    backgroundColor: '#ff9500',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  // NFC Raw JSON
  jsonCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    marginBottom: 12,
    overflow: 'hidden',
  },
  jsonCardSuccess: {
    borderColor: '#22C55E',
  },
  jsonCardWarning: {
    borderColor: '#F59E0B',
  },
  jsonCardError: {
    borderColor: '#EF4444',
  },
  jsonToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FAFAFA',
  },
  jsonToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  jsonTagId: {
    fontSize: 11,
    color: '#999',
  },
  jsonScroll: {
    maxHeight: 200,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  jsonText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#333',
    lineHeight: 16,
  },
  error: {
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  notFoundCard: {
    backgroundColor: '#FFF8E1',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  notFoundText: {
    fontWeight: '600',
    marginBottom: 4,
  },
  notFoundHint: {
    color: '#666',
    fontSize: 13,
  },
  memberCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  memberCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  memberName: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  clearButton: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  memberDetail: {
    color: '#444',
    marginBottom: 4,
    fontSize: 14,
  },
});
