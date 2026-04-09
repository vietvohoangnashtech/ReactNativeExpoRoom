import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Text } from 'react-native';
import syncReducer from '@/features/sync/store/syncSlice';
import sessionReducer from '@/features/session/store/sessionSlice';
import authReducer from '@/features/auth/store/authSlice';
import FeatureLayout from '../FeatureLayout';

function makeStore(overrides: Record<string, unknown> = {}) {
  return configureStore({
    reducer: { sync: syncReducer, session: sessionReducer, auth: authReducer },
    preloadedState: overrides as never,
  });
}

function renderWithStore(props: { title?: string } = {}, overrides: Record<string, unknown> = {}) {
  const store = makeStore(overrides);
  return {
    store,
    ...render(
      <Provider store={store}>
        <FeatureLayout title={props.title}>
          <Text>Child Content</Text>
        </FeatureLayout>
      </Provider>
    ),
  };
}

describe('FeatureLayout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should render children', () => {
    renderWithStore();
    expect(screen.getByText('Child Content')).toBeTruthy();
  });

  it('should render title when provided', () => {
    renderWithStore({ title: 'Test Title' });
    expect(screen.getByText('Test Title')).toBeTruthy();
  });

  it('should render SyncStatusBar', () => {
    renderWithStore();
    expect(screen.getByText('Sync')).toBeTruthy();
  });
});
