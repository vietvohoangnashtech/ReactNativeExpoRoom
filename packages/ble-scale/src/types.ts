export interface ScaleReading {
  weight: number; // kg
  unit: 'kg' | 'lb' | 'st';
  stable: boolean;
  timestamp: string;
  deviceId: string;
  deviceName: string;
}

export interface ScaleDevice {
  id: string;
  name: string;
  rssi: number;
  isConnectable: boolean;
}

export interface ScaleStatus {
  isScanning: boolean;
  isConnected: boolean;
  connectedDevice: ScaleDevice | null;
  lastReading: ScaleReading | null;
}
