import { BleManager, Device, Characteristic, Subscription } from 'react-native-ble-plx';
import {
  parseWeightMeasurement,
  WEIGHT_SERVICE_UUID,
  WEIGHT_MEASUREMENT_CHAR_UUID,
} from './weightParser';
import type { ScaleDevice, ScaleReading } from './types';

/**
 * BleScaleReader — BLE scale connection and weight reading.
 *
 * Scans for devices advertising the Weight Measurement Service (0x181D),
 * connects, subscribes to weight characteristic notifications,
 * and parses IEEE 11073 weight data.
 */
export class BleScaleReader {
  private manager: BleManager;
  private connectedDevice: Device | null = null;
  private monitorSubscription: Subscription | null = null;

  onScaleFound?: (device: ScaleDevice) => void;
  onWeightReading?: (reading: ScaleReading) => void;
  onConnectionChanged?: (connected: boolean) => void;

  constructor() {
    this.manager = new BleManager();
  }

  /**
   * Scan for BLE scales advertising the Weight Measurement Service.
   * Calls onScaleFound for each discovered scale.
   */
  startScan(timeoutMs = 10000): void {
    this.manager.startDeviceScan(
      [WEIGHT_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          return;
        }
        if (device && device.name) {
          this.onScaleFound?.({
            id: device.id,
            name: device.name,
            rssi: device.rssi ?? -100,
            isConnectable: device.isConnectable ?? true,
          });
        }
      }
    );

    // Auto-stop scan after timeout
    setTimeout(() => this.stopScan(), timeoutMs);
  }

  stopScan(): void {
    this.manager.stopDeviceScan();
  }

  /**
   * Connect to a BLE scale and subscribe to weight measurements.
   */
  async connect(deviceId: string): Promise<boolean> {
    try {
      // Disconnect existing if any
      if (this.connectedDevice) {
        await this.disconnect();
      }

      const device = await this.manager.connectToDevice(deviceId, {
        requestMTU: 512,
      });

      await device.discoverAllServicesAndCharacteristics();
      this.connectedDevice = device;
      this.onConnectionChanged?.(true);

      // Subscribe to weight measurement notifications
      this.monitorSubscription = device.monitorCharacteristicForService(
        WEIGHT_SERVICE_UUID,
        WEIGHT_MEASUREMENT_CHAR_UUID,
        (error: Error | null, characteristic: Characteristic | null) => {
          if (error) {
            return;
          }
          if (characteristic?.value) {
            const reading = parseWeightMeasurement(
              characteristic.value,
              device.id,
              device.name ?? 'Unknown Scale'
            );
            if (reading) {
              this.onWeightReading?.(reading);
            }
          }
        }
      );

      // Monitor disconnection
      this.manager.onDeviceDisconnected(deviceId, () => {
        this.connectedDevice = null;
        this.monitorSubscription?.remove();
        this.monitorSubscription = null;
        this.onConnectionChanged?.(false);
      });

      return true;
    } catch {
      this.onConnectionChanged?.(false);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.monitorSubscription?.remove();
    this.monitorSubscription = null;

    if (this.connectedDevice) {
      try {
        await this.manager.cancelDeviceConnection(this.connectedDevice.id);
      } catch {
        // Ignore disconnect errors
      }
      this.connectedDevice = null;
      this.onConnectionChanged?.(false);
    }
  }

  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  getConnectedDevice(): ScaleDevice | null {
    if (!this.connectedDevice) return null;
    return {
      id: this.connectedDevice.id,
      name: this.connectedDevice.name ?? 'Unknown',
      rssi: this.connectedDevice.rssi ?? -100,
      isConnectable: true,
    };
  }

  destroy(): void {
    this.disconnect();
    this.manager.destroy();
  }
}
