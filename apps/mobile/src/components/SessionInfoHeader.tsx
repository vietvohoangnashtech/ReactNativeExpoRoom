import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppSelector } from '@/hooks/useStore';

export default function SessionInfoHeader() {
  const activeSession = useAppSelector((s) => s.session.activeSession);
  const user = useAppSelector((s) => s.auth.user);

  if (!activeSession) return null;

  return (
    <View style={styles.container} accessibilityRole="header" accessibilityLabel="Session info">
      <Text style={styles.label}>
        <Text style={styles.bold}>Venue </Text>
        {activeSession.groupId}
      </Text>
      <Text style={styles.separator}>·</Text>
      <Text style={styles.label}>
        <Text style={styles.bold}>Session </Text>
        {activeSession.id.slice(0, 12)}
      </Text>
      {user ? (
        <>
          <Text style={styles.separator}>·</Text>
          <Text style={styles.consultant} numberOfLines={1}>
            {user.name}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
    flexWrap: 'wrap',
    gap: 4,
  },
  label: {
    fontSize: 11,
    color: '#666',
  },
  bold: {
    fontWeight: '600',
    color: '#333',
  },
  separator: {
    fontSize: 11,
    color: '#CCC',
  },
  consultant: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '500',
    maxWidth: 120,
  },
});
