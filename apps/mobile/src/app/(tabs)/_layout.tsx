import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';

const version = Constants.expoConfig?.version ?? '—';
const buildNumber =
  Constants.expoConfig?.android?.versionCode?.toString() ??
  Constants.expoConfig?.ios?.buildNumber ??
  '—';

export default function TabLayout() {
  return (
    <View style={styles.container}>
      <Tabs
        style={styles.tabs}
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: '#007AFF',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'NFC Test',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📳</Text>,
          }}
        />
        <Tabs.Screen
          name="members"
          options={{
            title: 'Members',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text>,
          }}
        />
        <Tabs.Screen
          name="weigh"
          options={{
            title: 'Weigh',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚖️</Text>,
          }}
        />
        <Tabs.Screen
          name="devices"
          options={{
            title: 'Devices',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📡</Text>,
          }}
        />
        <Tabs.Screen
          name="todos"
          options={{
            title: 'Todos',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>✅</Text>,
          }}
        />
      </Tabs>
      <Text style={styles.buildLabel}>{`v${version} (${buildNumber})`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabs: {
    flex: 1,
  },
  buildLabel: {
    position: 'absolute',
    bottom: 4,
    right: 8,
    fontSize: 10,
    color: 'rgba(128, 128, 128, 0.6)',
    pointerEvents: 'none',
  },
});
