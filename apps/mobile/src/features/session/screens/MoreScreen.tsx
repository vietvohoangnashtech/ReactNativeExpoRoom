import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppDispatch, useAppSelector } from '@/hooks/useStore';
import { endSessionThunk } from '@/features/session/store/sessionSlice';
import { loadSyncStatusThunk, triggerSyncThunk } from '@/features/sync/store/syncSlice';
import FeatureLayout from '@/components/FeatureLayout';
import { TodoListContent } from '@/features/todo/screens/TodoListScreen';

type MoreView = 'menu' | 'support' | 'todos';

export default function MoreScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const activeSession = useAppSelector((s) => s.session.activeSession);
  const { status: syncStatus, isLoading: syncLoading } = useAppSelector((s) => s.sync);
  const [view, setView] = useState<MoreView>('menu');

  useEffect(() => {
    dispatch(loadSyncStatusThunk());
  }, [dispatch]);

  const handleEndSession = useCallback(async () => {
    if (!activeSession) return;
    console.log('[Session] Ending session:', activeSession.id);
    await dispatch(endSessionThunk(activeSession.id));
    console.log('[Session] Session ended, navigating to session-select');
    router.replace('/session-select');
  }, [activeSession, dispatch, router]);

  const handleTriggerSync = useCallback(() => {
    console.log('[Sync] Manual sync triggered from More screen');
    dispatch(triggerSyncThunk());
  }, [dispatch]);

  if (view === 'support') {
    return (
      <FeatureLayout title="Support">
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderIcon}>❤️</Text>
          <Text style={styles.placeholderTitle}>Support</Text>
          <Text style={styles.placeholderText}>Coming soon</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => setView('menu')}>
            <Text style={styles.backBtnText}>← Back to More</Text>
          </TouchableOpacity>
        </View>
      </FeatureLayout>
    );
  }

  if (view === 'todos') {
    return (
      <FeatureLayout title="Todos (Sync Test)">
        <TouchableOpacity style={styles.backBtnInline} onPress={() => setView('menu')}>
          <Text style={styles.backBtnText}>← Back to More</Text>
        </TouchableOpacity>
        <TodoListContent />
      </FeatureLayout>
    );
  }

  return (
    <FeatureLayout title="More">
      <ScrollView contentContainerStyle={styles.menuContent}>
        {/* Sync Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Sync Status</Text>
          {syncStatus ? (
            <View style={styles.syncGrid}>
              <View style={styles.syncItem}>
                <Text style={styles.syncCount}>{syncStatus.pendingCount}</Text>
                <Text style={styles.syncLabel}>Pending</Text>
              </View>
              <View style={styles.syncItem}>
                <Text style={styles.syncCount}>{syncStatus.deviceSyncedCount}</Text>
                <Text style={styles.syncLabel}>Device</Text>
              </View>
              <View style={styles.syncItem}>
                <Text style={styles.syncCount}>{syncStatus.backendSyncedCount}</Text>
                <Text style={styles.syncLabel}>Backend</Text>
              </View>
              <View style={styles.syncItem}>
                <Text style={[styles.syncCount, syncStatus.failedCount > 0 && styles.failedCount]}>
                  {syncStatus.failedCount}
                </Text>
                <Text style={styles.syncLabel}>Failed</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.loadingText}>Loading sync status...</Text>
          )}
          <TouchableOpacity
            style={styles.syncButton}
            onPress={handleTriggerSync}
            disabled={syncLoading}
            accessibilityLabel="Trigger sync"
          >
            <Text style={styles.syncButtonText}>
              {syncLoading ? 'Syncing...' : 'Trigger Sync Now'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setView('support')}
          accessibilityLabel="Open Support"
        >
          <Text style={styles.menuIcon}>❤️</Text>
          <Text style={styles.menuText}>Support</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setView('todos')}
          accessibilityLabel="Open Todos"
        >
          <Text style={styles.menuIcon}>✅</Text>
          <Text style={styles.menuText}>Todos (Sync Test)</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.endSessionItem]}
          onPress={handleEndSession}
          accessibilityLabel="End session"
        >
          <Text style={styles.menuIcon}>🚪</Text>
          <Text style={[styles.menuText, styles.endSessionText]}>End Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </FeatureLayout>
  );
}

const styles = StyleSheet.create({
  menuContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  syncGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  syncItem: {
    alignItems: 'center',
  },
  syncCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  failedCount: {
    color: '#EF4444',
  },
  syncLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  loadingText: {
    color: '#999',
    marginBottom: 12,
  },
  syncButton: {
    backgroundColor: '#ff9500',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  menuIcon: {
    fontSize: 20,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  menuArrow: {
    fontSize: 22,
    color: '#CCC',
  },
  endSessionItem: {
    borderWidth: 1,
    borderColor: '#ff3b30',
    borderStyle: 'dashed',
  },
  endSessionText: {
    color: '#ff3b30',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },
  placeholderIcon: {
    fontSize: 48,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  backBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  backBtnInline: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtnText: {
    fontSize: 14,
    color: '#007AFF',
  },
});
