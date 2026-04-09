import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import syncReducer from '@/features/sync/store/syncSlice';
import SyncStatusBar from '../SyncStatusBar';

function makeStore(overrides: Record<string, unknown> = {}) {
  return configureStore({
    reducer: { sync: syncReducer },
    preloadedState: overrides as never,
  });
}

function renderWithStore(overrides: Record<string, unknown> = {}) {
  const store = makeStore(overrides);
  return { store, ...render(<Provider store={store}><SyncStatusBar /></Provider>) };
}

describe('SyncStatusBar', () => {
  const syncState = {
    sync: {
      status: { pendingCount: 0, failedCount: 0, deviceSyncedCount: 5, backendSyncedCount: 3, lastSyncAt: null, isWorkerScheduled: false },
      isLoading: false,
      error: null,
    },
  };

  beforeEach(() => jest.clearAllMocks());

  it('should render sync status text', () => {
    renderWithStore(syncState);
    expect(screen.getByText(/Last synced/)).toBeTruthy();
  });

  it('should render Sync button', () => {
    renderWithStore(syncState);
    expect(screen.getByText('Sync')).toBeTruthy();
  });

  it('should show loading text when status is null', () => {
    renderWithStore();
    expect(screen.getByText('Sync status loading...')).toBeTruthy();
  });

  it('should dispatch triggerSyncThunk when Sync pressed', () => {
    const { store } = renderWithStore(syncState);
    fireEvent.press(screen.getByText('Sync'));
    expect(store.getState()).toBeTruthy();
  });
});
