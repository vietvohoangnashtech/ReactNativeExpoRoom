import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function FeaturesLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999',
      }}
    >
      <Tabs.Screen
        name="index"
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
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⋯</Text>,
        }}
      />
    </Tabs>
  );
}
