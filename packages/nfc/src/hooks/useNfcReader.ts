import { useCallback, useEffect, useRef, useState } from 'react';
import { NfcReader } from '../NfcReader';
import type { NfcScanResult, NfcStatus } from '../types';

export function useNfcReader() {
  const readerRef = useRef<NfcReader>(new NfcReader());
  const [status, setStatus] = useState<NfcStatus>({ isSupported: false, isEnabled: false });
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<NfcScanResult | null>(null);

  useEffect(() => {
    const reader = readerRef.current;
    reader.getStatus().then(setStatus);
    return () => {
      reader.cleanup();
    };
  }, []);

  const scanForMemberCard = useCallback(async (): Promise<NfcScanResult> => {
    setIsScanning(true);
    setLastResult(null);
    try {
      const result = await readerRef.current.scanForMemberCard();
      setLastResult(result);
      return result;
    } finally {
      setIsScanning(false);
    }
  }, []);

  const readTagId = useCallback(async (): Promise<string | null> => {
    setIsScanning(true);
    try {
      return await readerRef.current.readTagId();
    } finally {
      setIsScanning(false);
    }
  }, []);

  const cancel = useCallback(() => {
    readerRef.current.cancel();
    setIsScanning(false);
  }, []);

  return {
    status,
    isScanning,
    lastResult,
    scanForMemberCard,
    readTagId,
    cancel,
  };
}
