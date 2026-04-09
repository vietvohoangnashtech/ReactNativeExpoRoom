import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppDispatch, useAppSelector } from '@/hooks/useStore';
import { logoutThunk } from '@/features/auth/store/authSlice';
import {
  startSessionThunk,
  loadActiveSessionThunk,
} from '@/features/session/store/sessionSlice';
import { startOutboxThunk, schedulePeriodicSyncThunk } from '@/features/sync/store/syncSlice';
import SyncStatusBar from '@/components/SyncStatusBar';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockGroup {
  id: string;
  name: string;
}

interface MockSession {
  id: string;
  label: string;
  day: string;
  time: string;
}

const MOCK_GROUPS: MockGroup[] = [
  { id: 'tupton', name: 'Tupton' },
  { id: 'mansfield', name: 'Mansfield' },
  { id: 'alfreton', name: 'Alfreton' },
];

const MOCK_SESSIONS: Record<string, MockSession[]> = {
  tupton: [
    { id: 't1', label: 'Wed 9:00am session 1', day: 'Wednesday', time: '9:00am - 10:30am' },
    { id: 't2', label: 'Wed 5:30pm session 2', day: 'Wednesday', time: '5:30pm - 7:00pm' },
  ],
  mansfield: [
    { id: 'm1', label: 'Thu 9:30am session 1', day: 'Thursday', time: '9:30am - 11:00am' },
    { id: 'm2', label: 'Sat 8:00am session 1', day: 'Saturday', time: '8:00am - 9:30am' },
  ],
  alfreton: [
    { id: 'a1', label: 'Fri 10:00am session 1', day: 'Friday', time: '10:00am - 11:30am' },
  ],
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SessionSelectScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const { isLoading } = useAppSelector((s) => s.session);

  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<MockSession | null>(null);

  const sessions = selectedGroup ? MOCK_SESSIONS[selectedGroup] ?? [] : [];

  useEffect(() => {
    console.log('[SessionSelect] Screen mounted, user:', user?.name);
  }, [user]);

  const handleGroupSelect = useCallback((groupId: string) => {
    console.log('[SessionSelect] Group selected:', groupId);
    setSelectedGroup(groupId);
    setSelectedSession(null);
  }, []);

  const handleSessionSelect = useCallback((session: MockSession) => {
    console.log('[SessionSelect] Session selected:', session.label);
    setSelectedSession(session);
  }, []);

  const handleEnter = useCallback(async () => {
    if (!selectedGroup || !selectedSession) return;
    const consultantId = user?.id ?? 'unknown';
    console.log('[SessionSelect] Starting session:', { groupId: selectedGroup, consultantId });

    await dispatch(startSessionThunk({ groupId: selectedGroup, consultantId }));
    await dispatch(loadActiveSessionThunk());
    dispatch(startOutboxThunk());
    dispatch(schedulePeriodicSyncThunk());

    console.log('[SessionSelect] Session started, navigating to features');
    router.replace('/(features)');
  }, [selectedGroup, selectedSession, user, dispatch, router]);

  const handleSignOut = useCallback(() => {
    console.log('[SessionSelect] Signing out');
    dispatch(logoutThunk());
  }, [dispatch]);

  return (
    <View style={styles.container}>
      <SyncStatusBar />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Greeting */}
        <Text style={styles.greeting}>hey there!</Text>
        <Text style={styles.subtitle}>
          which <Text style={styles.bold}>group and session</Text>
        </Text>
        <Text style={styles.subtitle}>do you plan to open next?</Text>

        {/* Group Selector */}
        <View style={styles.groupRow}>
          {MOCK_GROUPS.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={[
                styles.groupButton,
                selectedGroup === group.id && styles.groupButtonSelected,
              ]}
              onPress={() => handleGroupSelect(group.id)}
              accessibilityLabel={`Select ${group.name} group`}
              accessibilityState={{ selected: selectedGroup === group.id }}
            >
              <Text
                style={[
                  styles.groupText,
                  selectedGroup === group.id && styles.groupTextSelected,
                ]}
              >
                {group.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Session Picker */}
        {selectedGroup ? (
          <View style={styles.sessionList}>
            {sessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={[
                  styles.sessionItem,
                  selectedSession?.id === session.id && styles.sessionItemSelected,
                ]}
                onPress={() => handleSessionSelect(session)}
                accessibilityLabel={`Select ${session.label}`}
                accessibilityState={{ selected: selectedSession?.id === session.id }}
              >
                <Text style={styles.sessionIcon}>⏱</Text>
                <Text style={styles.sessionLabel}>{session.label}</Text>
                {selectedSession?.id === session.id ? (
                  <Text style={styles.sessionCheck}>✓</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Enter Button */}
        {selectedGroup && selectedSession ? (
          <TouchableOpacity
            style={styles.enterButton}
            onPress={handleEnter}
            disabled={isLoading}
            accessibilityLabel={`Enter session as ${user?.name ?? 'consultant'}`}
          >
            <Text style={styles.enterText}>
              {isLoading ? 'Starting...' : `${user?.name ?? 'Consultant'}`}
            </Text>
            <Text style={styles.enterArrow}> ›</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        accessibilityLabel="Sign out"
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 32,
  },
  greeting: {
    fontSize: 28,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 22,
    color: '#666',
    textAlign: 'center',
    lineHeight: 30,
  },
  bold: {
    fontWeight: 'bold',
    color: '#333',
  },
  groupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 32,
    marginBottom: 24,
  },
  groupButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  groupButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  groupText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  groupTextSelected: {
    color: '#fff',
  },
  sessionList: {
    gap: 8,
    marginBottom: 24,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    gap: 10,
  },
  sessionItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F7FF',
  },
  sessionIcon: {
    fontSize: 16,
  },
  sessionLabel: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  sessionCheck: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  enterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    alignSelf: 'center',
  },
  enterText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  enterArrow: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
  },
  signOutButton: {
    alignSelf: 'flex-start',
    margin: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
  },
  signOutText: {
    fontSize: 14,
    color: '#999',
  },
});
