import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import sessionReducer from '@/features/session/store/sessionSlice';
import syncReducer from '@/features/sync/store/syncSlice';
import SessionSelectScreen from '../SessionSelectScreen';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

function makeStore(overrides: Record<string, unknown> = {}) {
  return configureStore({
    reducer: { auth: authReducer, session: sessionReducer, sync: syncReducer },
    preloadedState: overrides as never,
  });
}

function renderWithStore(overrides: Record<string, unknown> = {}) {
  const store = makeStore(overrides);
  return { store, ...render(<Provider store={store}><SessionSelectScreen /></Provider>) };
}

describe('SessionSelectScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render group buttons', () => {
    renderWithStore();
    expect(screen.getByText('Tupton')).toBeTruthy();
    expect(screen.getByText('Mansfield')).toBeTruthy();
    expect(screen.getByText('Alfreton')).toBeTruthy();
  });

  it('should render greeting text', () => {
    renderWithStore();
    expect(screen.getByText('hey there!')).toBeTruthy();
  });

  it('should show sessions after selecting a group', () => {
    renderWithStore();
    fireEvent.press(screen.getByText('Tupton'));
    // Should render session items for Tupton group
    const sessions = screen.getAllByText(/⏱/);
    expect(sessions.length).toBeGreaterThan(0);
  });

  it('should render Sign out button', () => {
    renderWithStore();
    expect(screen.getByLabelText('Sign out')).toBeTruthy();
  });

  it('should highlight selected group', () => {
    renderWithStore();
    fireEvent.press(screen.getByText('Tupton'));
    const button = screen.getByLabelText('Select Tupton group');
    expect(button.props.accessibilityState.selected).toBe(true);
  });
});
