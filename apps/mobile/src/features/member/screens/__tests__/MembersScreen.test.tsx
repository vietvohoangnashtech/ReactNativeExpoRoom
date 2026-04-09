import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import memberReducer from '@/features/member/store/memberSlice';
import sessionReducer from '@/features/session/store/sessionSlice';
import syncReducer from '@/features/sync/store/syncSlice';
import authReducer from '@/features/auth/store/authSlice';
import MembersScreen from '../MembersScreen';

function makeStore(overrides: Record<string, unknown> = {}) {
  return configureStore({
    reducer: { member: memberReducer, session: sessionReducer, sync: syncReducer, auth: authReducer },
    preloadedState: overrides as never,
  });
}

function renderWithStore(overrides: Record<string, unknown> = {}) {
  const store = makeStore(overrides);
  return { store, ...render(<Provider store={store}><MembersScreen /></Provider>) };
}

describe('MembersScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should render Identify segment', () => {
    renderWithStore();
    expect(screen.getByText('Identify')).toBeTruthy();
  });

  it('should render Register segment', () => {
    renderWithStore();
    expect(screen.getByText('Register')).toBeTruthy();
  });

  it('should render Scan NFC button in identify mode', () => {
    renderWithStore();
    expect(screen.getByText('Scan NFC Card')).toBeTruthy();
  });

  it('should switch to register mode on segment press', () => {
    renderWithStore();
    fireEvent.press(screen.getByText('Register'));
    // RegisterMemberScreen content should appear
    expect(screen.getByPlaceholderText('Full name')).toBeTruthy();
  });

  it('should show NFC raw JSON panel when scan result exists', () => {
    const { useNfcReader } = require('@xpw2/nfc');
    (useNfcReader as jest.Mock).mockReturnValue({
      status: { isSupported: true, isEnabled: true },
      isScanning: false,
      lastResult: { success: true, tagId: 'AB:CD:EF', memberId: 'm-001' },
      scanForMemberCard: jest.fn().mockResolvedValue({ success: true }),
      readTagId: jest.fn(),
      cancel: jest.fn(),
    });

    renderWithStore();
    expect(screen.getByText(/NFC Raw Result/)).toBeTruthy();
  });
});
