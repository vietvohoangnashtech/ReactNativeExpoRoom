import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import sessionReducer from '@/features/session/store/sessionSlice';
import syncReducer from '@/features/sync/store/syncSlice';
import authReducer from '@/features/auth/store/authSlice';
import todoReducer from '@/features/todo/store/todoSlice';
import MoreScreen from '../MoreScreen';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

function makeStore(overrides: Record<string, unknown> = {}) {
  return configureStore({
    reducer: { session: sessionReducer, sync: syncReducer, auth: authReducer, todo: todoReducer },
    preloadedState: overrides as never,
  });
}

function renderWithStore(overrides: Record<string, unknown> = {}) {
  const store = makeStore(overrides);
  return { store, ...render(<Provider store={store}><MoreScreen /></Provider>) };
}

describe('MoreScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should render Sync Status card title', () => {
    renderWithStore();
    expect(screen.getByText(/Sync Status/)).toBeTruthy();
  });

  it('should render Trigger Sync button', () => {
    renderWithStore();
    expect(screen.getByText('Trigger Sync Now')).toBeTruthy();
  });

  it('should render menu items — Support, Todos, End Session', () => {
    renderWithStore();
    expect(screen.getByText('Support')).toBeTruthy();
    expect(screen.getByText('Todos (Sync Test)')).toBeTruthy();
    expect(screen.getByText('End Session')).toBeTruthy();
  });

  it('should navigate to support view when Support pressed', () => {
    renderWithStore();
    fireEvent.press(screen.getByLabelText('Open Support'));
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });

  it('should navigate to todos view when Todos pressed', () => {
    renderWithStore();
    fireEvent.press(screen.getByLabelText('Open Todos'));
    expect(screen.getByLabelText('New todo title')).toBeTruthy();
  });
});
