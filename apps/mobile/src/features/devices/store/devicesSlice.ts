import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as DataSync from '@xpw2/datasync';
import type { DeviceRecord, DeviceSyncInfo, DiscoveredDevice } from '@xpw2/datasync';

interface DevicesState {
  devices: DeviceRecord[];
  discoveredDevices: DiscoveredDevice[];
  syncInfo: DeviceSyncInfo | null;
  isScanning: boolean;
  error: string | null;
}

const initialState: DevicesState = {
  devices: [],
  discoveredDevices: [],
  syncInfo: null,
  isScanning: false,
  error: null,
};

export const loadDevicesThunk = createAsyncThunk('devices/loadAll', async () => {
  return DataSync.getAllDevices();
});

export const startAdvertisingThunk = createAsyncThunk(
  'devices/startAdvertising',
  async (deviceName: string) => {
    await DataSync.startAdvertising(deviceName);
  }
);

export const startDiscoveryThunk = createAsyncThunk('devices/startDiscovery', async () => {
  await DataSync.startDiscovery();
});

export const stopDiscoveryThunk = createAsyncThunk('devices/stopDiscovery', async () => {
  await DataSync.stopDiscovery();
});

export const connectToDeviceThunk = createAsyncThunk(
  'devices/connect',
  async ({ deviceName, endpointId }: { deviceName: string; endpointId: string }) => {
    await DataSync.connectToDevice(deviceName, endpointId);
    return endpointId;
  }
);

export const loadSyncInfoThunk = createAsyncThunk('devices/loadSyncInfo', async () => {
  return DataSync.getDeviceSyncInfo();
});

export const loadDiscoveredDevicesThunk = createAsyncThunk(
  'devices/loadDiscovered',
  async () => {
    return DataSync.getDiscoveredDevices();
  }
);

const devicesSlice = createSlice({
  name: 'devices',
  initialState,
  reducers: {
    addDiscoveredDevice(state, action) {
      const exists = state.discoveredDevices.some(
        (d) => d.endpointId === action.payload.endpointId
      );
      if (!exists) {
        state.discoveredDevices.push(action.payload);
      }
    },
    removeDiscoveredDevice(state, action) {
      state.discoveredDevices = state.discoveredDevices.filter(
        (d) => d.endpointId !== action.payload
      );
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadDevicesThunk.fulfilled, (state, action) => {
        state.devices = action.payload;
      })
      .addCase(startDiscoveryThunk.pending, (state) => {
        state.isScanning = true;
      })
      .addCase(startDiscoveryThunk.fulfilled, (state) => {
        state.isScanning = true;
      })
      .addCase(stopDiscoveryThunk.fulfilled, (state) => {
        state.isScanning = false;
      })
      .addCase(loadSyncInfoThunk.fulfilled, (state, action) => {
        state.syncInfo = action.payload;
      })
      .addCase(loadDiscoveredDevicesThunk.fulfilled, (state, action) => {
        state.discoveredDevices = action.payload;
      });
  },
});

export const { addDiscoveredDevice, removeDiscoveredDevice } = devicesSlice.actions;
export default devicesSlice.reducer;
