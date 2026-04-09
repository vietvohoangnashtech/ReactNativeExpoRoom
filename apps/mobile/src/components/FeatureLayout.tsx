import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SyncStatusBar from './SyncStatusBar';
import SessionInfoHeader from './SessionInfoHeader';

interface FeatureLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function FeatureLayout({ children, title }: FeatureLayoutProps) {
  return (
    <View style={styles.container}>
      <SyncStatusBar />
      <SessionInfoHeader />
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    color: '#000',
  },
  content: {
    flex: 1,
  },
});
