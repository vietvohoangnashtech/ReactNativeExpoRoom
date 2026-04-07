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

export default function DevicesScreen() {
  const dispatch = useAppDispatch();
  const { discoveredDevices, syncInfo, isScanning } = useAppSelector((s) => s.devices);

  useEffect(() => {
    dispatch(loadDevicesThunk());
    dispatch(loadSyncInfoThunk());

    const sub = DataSync.addDeviceFoundListener((event) => {
      dispatch(loadDiscoveredDevicesThunk());
    });

    return () => sub.remove();
  }, [dispatch]);

  const handleStartScan = useCallback(async () => {
    const name = await DataSync.getDeviceName();
    dispatch(startAdvertisingThunk(name));
    dispatch(startDiscoveryThunk());
  }, [dispatch]);

  const handleStopScan = useCallback(() => {
    dispatch(stopDiscoveryThunk());
    DataSync.stopAdvertising();
  }, [dispatch]);

  const handleConnect = useCallback(
    async (endpointId: string) => {
      const name = await DataSync.getDeviceName();
      dispatch(connectToDeviceThunk({ deviceName: name, endpointId }));
    },
    [dispatch]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Devices</Text>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Advertising:</Text>
        <Text style={styles.statusValue}>{syncInfo?.isAdvertising ? 'Yes' : 'No'}</Text>
        <Text style={styles.statusLabel}>Discovering:</Text>
        <Text style={styles.statusValue}>{syncInfo?.isDiscovering ? 'Yes' : 'No'}</Text>
      </View>

      {syncInfo?.connectedDeviceName ? (
        <View style={styles.connectedBox}>
          <Text style={styles.connectedText}>Connected: {syncInfo.connectedDeviceName}</Text>
        </View>
      ) : null}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
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
  connectedBox: {
    backgroundColor: '#d4edda',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  connectedText: {
    color: '#155724',
    fontWeight: '600',
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
