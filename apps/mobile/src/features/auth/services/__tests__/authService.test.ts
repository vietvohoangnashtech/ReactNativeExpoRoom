import * as SecureStore from 'expo-secure-store';
import type { AuthTokens, UserProfile } from '@xpw2/shared';
import {
  login,
  storeTokens,
  getStoredTokens,
  clearTokens,
  getProfile,
} from '../authService';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_EMAIL = 'test@xpw2.com';
const VALID_PASSWORD = 'password';

const mockTokens: AuthTokens = {
  accessToken: 'access-token-xyz',
  refreshToken: 'refresh-token-xyz',
  expiresAt: '2026-12-31T00:00:00.000Z',
};

const expectedUser: UserProfile = {
  id: 'consultant-001',
  email: 'consultant@xpw2.com',
  name: 'Test Consultant',
  role: 'consultant',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      const tokens = await login(VALID_EMAIL, VALID_PASSWORD);

      expect(tokens).toMatchObject({
        accessToken: expect.stringContaining('mock-access-'),
        refreshToken: expect.stringContaining('mock-refresh-'),
        expiresAt: expect.any(String),
      });
    });

    it('should store tokens in SecureStore on successful login', async () => {
      await login(VALID_EMAIL, VALID_PASSWORD);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'xpw2_access_token',
        expect.any(String)
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'xpw2_refresh_token',
        expect.any(String)
      );
    });

    it('should throw an error for invalid credentials', async () => {
      await expect(login('wrong@xpw2.com', 'badpass')).rejects.toThrow('Invalid credentials');
    });

    it('should throw an error for empty email', async () => {
      await expect(login('', VALID_PASSWORD)).rejects.toThrow('Invalid credentials');
    });

    it('should throw an error for empty password', async () => {
      await expect(login(VALID_EMAIL, '')).rejects.toThrow('Invalid credentials');
    });

    it('should not store tokens on failed login', async () => {
      await expect(login('bad@xpw2.com', 'wrong')).rejects.toThrow();

      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should not expose password in returned token structure', async () => {
      const tokens = await login(VALID_EMAIL, VALID_PASSWORD);
      const tokenString = JSON.stringify(tokens);

      expect(tokenString).not.toContain(VALID_PASSWORD);
    });
  });

  // ── getProfile ────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('should return a valid user profile', async () => {
      const profile = await getProfile();

      expect(profile).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        name: expect.any(String),
        role: expect.stringMatching(/^(consultant|admin)$/),
      });
    });

    it('should not expose sensitive data in the profile', async () => {
      const profile = await getProfile();
      const profileString = JSON.stringify(profile);

      expect(profileString).not.toContain('password');
      expect(profileString).not.toContain('token');
      expect(profileString).not.toContain('secret');
    });
  });

  // ── storeTokens ───────────────────────────────────────────────────────────

  describe('storeTokens', () => {
    it('should write accessToken to SecureStore', async () => {
      await storeTokens(mockTokens);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'xpw2_access_token',
        'access-token-xyz'
      );
    });

    it('should write refreshToken to SecureStore', async () => {
      await storeTokens(mockTokens);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'xpw2_refresh_token',
        'refresh-token-xyz'
      );
    });
  });

  // ── getStoredTokens ───────────────────────────────────────────────────────

  describe('getStoredTokens', () => {
    it('should return tokens when both keys exist in SecureStore', async () => {
      await storeTokens(mockTokens);

      const tokens = await getStoredTokens();

      expect(tokens).not.toBeNull();
      expect(tokens!.accessToken).toBe('access-token-xyz');
      expect(tokens!.refreshToken).toBe('refresh-token-xyz');
    });

    it('should return null when accessToken is missing', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'xpw2_access_token') return Promise.resolve(null);
        return Promise.resolve('refresh-token-xyz');
      });

      const tokens = await getStoredTokens();

      expect(tokens).toBeNull();
    });

    it('should return null when refreshToken is missing', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'xpw2_refresh_token') return Promise.resolve(null);
        return Promise.resolve('access-token-xyz');
      });

      const tokens = await getStoredTokens();

      expect(tokens).toBeNull();
    });

    it('should return null when SecureStore is empty', async () => {
      // In-memory store is cleared in beforeEach via jest.setup.js
      const tokens = await getStoredTokens();

      expect(tokens).toBeNull();
    });
  });

  // ── clearTokens ───────────────────────────────────────────────────────────

  describe('clearTokens', () => {
    it('should delete both keys from SecureStore', async () => {
      await storeTokens(mockTokens);
      await clearTokens();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('xpw2_access_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('xpw2_refresh_token');
    });

    it('should result in null tokens after clearing', async () => {
      await storeTokens(mockTokens);
      await clearTokens();

      const tokens = await getStoredTokens();
      expect(tokens).toBeNull();
    });
  });
});
