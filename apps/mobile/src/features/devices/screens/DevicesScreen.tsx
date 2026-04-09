import React, { useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../../hooks/useStore';
import {
  loadDevicesThunk,
  startAdvertisingThunk,
  startDiscoveryThunk,
  stopDiscoveryThunk,
  connectToDeviceThunk,
  loadSyncInfoThunk,
  loadDiscoveredDevicesThunk,
} from '../store/devicesSlice';
import * as DataSync from '@xpw2/datasync';
import FeatureLayout from '@/components/FeatureLayout';

export default function DevicesScreen() {
  const dispatch = useAppDispatch();
  const { discoveredDevices, syncInfo, isScanning } = useAppSelector((s) => s.devices);

  useEffect(() => {
    console.log('[Nearby] Loading devices and sync info...');
    dispatch(loadDevicesThunk());
    dispatch(loadSyncInfoThunk());

    const sub = DataSync.addDeviceFoundListener((event) => {
      console.log('[Nearby] Device found event:', event);
      dispatch(loadDiscoveredDevicesThunk());
    });

    return () => sub.remove();
  }, [dispatch]);

  useEffect(() => {
    console.log('[Nearby] Sync info updated:', {
      advertising: syncInfo?.isAdvertising,
      discovering: syncInfo?.isDiscovering,
      connected: syncInfo?.connectedDeviceName ?? 'none',
    });
  }, [syncInfo]);

  const handleStartScan = useCallback(async () => {
    console.log('[Nearby] Starting scan...');
    const name = await DataSync.getDeviceName();
    dispatch(startAdvertisingThunk(name));
    dispatch(startDiscoveryThunk());
  }, [dispatch]);

  const handleStopScan = useCallback(() => {
    console.log('[Nearby] Stopping scan');
    dispatch(stopDiscoveryThunk());
    DataSync.stopAdvertising();
  }, [dispatch]);

  const handleConnect = useCallback(
    async (endpointId: string) => {
      console.log('[Nearby] Connecting to endpoint:', endpointId);
      const name = await DataSync.getDeviceName();
      dispatch(connectToDeviceThunk({ deviceName: name, endpointId }));
    },
    [dispatch]
  );

  return (
    <FeatureLayout title="Devices">
      {/* Connection Status Badge */}
      <View style={[styles.connectionBadge, syncInfo?.connectedDeviceName ? styles.badgeConnected : styles.badgeDisconnected]}>
        <Text style={[styles.badgeText, syncInfo?.connectedDeviceName ? styles.badgeTextConnected : styles.badgeTextDisconnected]}>
          {syncInfo?.connectedDeviceName
            ? `Nearby: Connected to ${syncInfo.connectedDeviceName}`
            : 'Nearby: Not connected'}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Advertising:</Text>
        <Text style={styles.statusValue}>{syncInfo?.isAdvertising ? 'Yes' : 'No'}</Text>
        <Text style={styles.statusLabel}>Discovering:</Text>
        <Text style={styles.statusValue}>{syncInfo?.isDiscovering ? 'Yes' : 'No'}</Text>
      </View>

      <View style={styles.buttonRow}>
        {isScanning ? (
          <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={handleStopScan}>
            <Text style={styles.buttonText}>Stop Scan</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleStartScan}>
            <Text style={styles.buttonText}>Scan for Devices</Text>
          </TouchableOpacity>
        )}
      </View>

      {isScanning ? <ActivityIndicator style={styles.spinner} /> : null}

      <Text style={styles.sectionTitle}>Discovered ({discoveredDevices.length})</Text>
      <FlatList
        data={discoveredDevices}
        keyExtractor={(item) => item.endpointId}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.deviceItem}
            onPress={() => handleConnect(item.endpointId)}
          >
            <Text style={styles.deviceName}>{item.endpointName}</Text>
            <Text style={styles.deviceId}>{item.endpointId}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{isScanning ? 'Scanning...' : 'No devices found'}</Text>
        }
      />
    </FeatureLayout>
  );
}

const styles = StyleSheet.create({
  connectionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  badgeConnected: {
    backgroundColor: '#d4edda',
  },
  badgeDisconnected: {
    backgroundColor: '#f8d7da',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  badgeTextConnected: {
    color: '#155724',
  },
  badgeTextDisconnected: {
    color: '#721c24',
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  statusLabel: {
    color: '#666',
  },
  statusValue: {
    fontWeight: '600',
    marginRight: 12,
  },
  buttonRow: {
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#ff3b30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  spinner: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  deviceItem: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
  },
  deviceId: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    marginTop: 16,
  },
});
