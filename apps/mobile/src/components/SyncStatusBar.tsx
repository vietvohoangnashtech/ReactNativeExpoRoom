import React, { useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppDispatch, useAppSelector } from '@/hooks/useStore';
import { loadSyncStatusThunk, triggerSyncThunk } from '@/features/sync/store/syncSlice';

function formatLastSync(lastSyncAt: string | null | undefined): string {
  if (!lastSyncAt) return 'Never';
  const diff = Date.now() - new Date(lastSyncAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function SyncStatusBar() {
  const dispatch = useAppDispatch();
  const { status, isLoading } = useAppSelector((s) => s.sync);

  useEffect(() => {
    dispatch(loadSyncStatusThunk());
  }, [dispatch]);

  const handleSync = useCallback(() => {
    console.log('[SyncStatusBar] Sync triggered');
    dispatch(triggerSyncThunk());
  }, [dispatch]);

  const dotColor = status
    ? status.failedCount > 0
      ? '#EF4444'
      : status.pendingCount > 0
        ? '#F59E0B'
        : '#22C55E'
    : '#9CA3AF';

  return (
    <View style={styles.container} accessibilityRole="toolbar" accessibilityLabel="Sync status">
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.label}>
        {status ? `Last synced: ${formatLastSync(status.lastSyncAt)}` : 'Sync status loading...'}
      </Text>
      {status ? (
        <Text style={styles.counts}>
          {status.pendingCount}P · {status.deviceSyncedCount}D · {status.backendSyncedCount}B
        </Text>
      ) : null}
      <TouchableOpacity
        style={styles.syncButton}
        onPress={handleSync}
        disabled={isLoading}
        accessibilityLabel="Trigger sync"
      >
        <Text style={[styles.syncText, isLoading && styles.syncTextLoading]}>
          {isLoading ? 'Syncing...' : 'Sync'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  counts: {
    fontSize: 11,
    color: '#999',
    marginRight: 8,
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  syncText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  syncTextLoading: {
    color: '#999',
  },
});
