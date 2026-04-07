import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/store/authSlice';
import sessionReducer from '../features/session/store/sessionSlice';
import todoReducer from '../features/todo/store/todoSlice';
import devicesReducer from '../features/devices/store/devicesSlice';
import memberReducer from '../features/member/store/memberSlice';
import syncReducer from '../features/sync/store/syncSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    session: sessionReducer,
    todo: todoReducer,
    devices: devicesReducer,
    member: memberReducer,
    sync: syncReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
