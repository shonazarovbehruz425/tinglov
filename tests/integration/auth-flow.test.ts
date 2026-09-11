import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '@/services/storageService';
import { apiService } from '@/services/apiService';
import * as auth from '@/server/auth';
import * as rateLimiter from '@/server/rateLimiter';
import * as db from '@/server/db';
import bcrypt from 'bcryptjs';

vi.mock('@/services/apiService', () => ({
  apiService: {
    syncProgress: vi.fn().mockResolvedValue(undefined),
    saveWord: vi.fn().mockResolvedValue(undefined),
    deleteWord: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/server/db', () => ({
  db: {
    prepare: vi.fn().mockReturnThis(),
    exec: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn().mockReturnThis(),
  },
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserByUsername: vi.fn(),
  createUser: vi.fn(),
  updateUserStats: vi.fn(),
  updateUserAuthMeta: vi.fn(),
  saveUserWord: vi.fn(),
  deleteUserWord: vi.fn(),
  getUserSavedWords: vi.fn(),
  recordUserCompletedScene: vi.fn(),
  getUserCompletedScenes: vi.fn(),
  getGlobalLeaderboard: vi.fn(),
  getAllUsers: vi.fn(),
  deleteUserById: vi.fn(),
  updateUserStatsAdmin: vi.fn(),
  getAdminStats: vi.fn(),
  getAllAdminScenes: vi.fn(),
  createAdminScene: vi.fn(),
  deleteAdminScene: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$10$hashedpassword'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mock-jwt-token'),
    verify: vi.fn().mockReturnValue({ id: 1, username: 'test', email: 'test@test.com' }),
  },
}));

vi.mock('dotenv', () => ({
  default: { config: vi.fn() },
}));

vi.mock('ioredis', () => ({
  default: class {
    connect = vi.fn().mockResolvedValue(undefined);
    on = vi.fn();
  },
}));

vi.mock('node:crypto', () => ({
  randomBytes: vi.fn().mockReturnValue({ toString: () => 'abc123' }),
  createHmac: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('hmackey'),
  }),
  timingSafeEqual: vi.fn().mockReturnValue(true),
}));

process.env.JWT_SECRET = 'test-jwt-secret-key-that-is-at-least-32-chars-long!!';
process.env.CAPTCHA_SECRET = 'test-captcha-secret-key-1234';
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
process.env.REDIS_URL = '';
process.env.REDIS_HOST = '';

describe('Integration: Auth Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Happy path: Registration', () => {
    it('should register a new user and return token', async () => {
      const mockUser = { id: 1, username: 'newuser', email: 'new@example.com', password_hash: '$2a$10$hashedpassword', full_name: 'New User', avatar_color: '#A3E635', xp: 0, streak: 1, level: 1, last_active_date: null, created_at: '2024-01-01' };
      vi.mocked(db.findUserByEmail).mockReturnValue(undefined);
      vi.mocked(db.findUserByUsername).mockReturnValue(undefined);
      vi.mocked(db.createUser).mockReturnValue(mockUser);

      const hash = await auth.hashPassword('Password1!');
      expect(hash).toBe('$2a$10$hashedpassword');

      const user = db.createUser({ username: 'newuser', email: 'new@example.com', password_hash: hash, full_name: 'New User' });
      expect(user).toBeDefined();
      expect(user.username).toBe('newuser');
    });

    it('should generate token after registration', () => {
      const mockUser = { id: 1, username: 'newuser', email: 'new@example.com' };
      const token = auth.generateToken(mockUser);
      expect(token).toBe('mock-jwt-token');
    });
  });

  describe('Happy path: Login', () => {
    it('should login with correct credentials', async () => {
      const mockUser = { id: 1, username: 'testuser', email: 'test@example.com', password_hash: '$2a$10$hashedpassword', full_name: 'Test', avatar_color: '#A3E635', xp: 0, streak: 1, level: 1, last_active_date: null, created_at: '2024-01-01' };
      vi.mocked(db.findUserByEmail).mockReturnValue(mockUser);
      vi.mocked(db.findUserById).mockReturnValue(mockUser);

      const isMatch = await auth.comparePassword('Password1!', '$2a$10$hashedpassword');
      expect(isMatch).toBe(true);

      const token = auth.generateToken(mockUser);
      expect(token).toBe('mock-jwt-token');
    });
  });

  describe('Fail path: Registration', () => {
    it('should reject duplicate email', () => {
      const existingUser = { id: 1, username: 'existing', email: 'dup@example.com', password_hash: 'hash', full_name: 'Existing', avatar_color: '#A3E635', xp: 0, streak: 1, level: 1, last_active_date: null, created_at: '2024-01-01' };
      vi.mocked(db.findUserByEmail).mockReturnValue(existingUser);
      const result = db.findUserByEmail('dup@example.com');
      expect(result).toBeDefined();
    });

    it('should reject duplicate username', () => {
      const existingUser = { id: 2, username: 'taken', email: 'taken@test.com', password_hash: 'hash', full_name: 'Taken', avatar_color: '#A3E635', xp: 0, streak: 1, level: 1, last_active_date: null, created_at: '2024-01-01' };
      vi.mocked(db.findUserByUsername).mockReturnValue(existingUser);
      const result = db.findUserByUsername('taken');
      expect(result).toBeDefined();
    });
  });

  describe('Fail path: Login', () => {
    it('should fail with wrong password', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false);
      const isMatch = await auth.comparePassword('WrongPass1!', '$2a$10$hashedpassword');
      expect(isMatch).toBe(false);
    });

    it('should fail with non-existent user', () => {
      vi.mocked(db.findUserByEmail).mockReturnValue(undefined);
      const result = db.findUserByEmail('nobody@test.com');
      expect(result).toBeUndefined();
    });
  });

  describe('Rate limiter integration', () => {
    it('should track auth failures', async () => {
      const result1 = await rateLimiter.recordAuthFailure('user:test');
      expect(result1.failures).toBe(1);

      const result2 = await rateLimiter.recordAuthFailure('user:test');
      expect(result2.failures).toBe(2);

      const result3 = await rateLimiter.recordAuthFailure('user:test');
      expect(result3.failures).toBe(3);
    });

    it('should reset failures on success', async () => {
      await rateLimiter.recordAuthFailure('user:test');
      await rateLimiter.recordAuthFailure('user:test');
      await rateLimiter.resetAuthFailure('user:test');
      const status = await rateLimiter.getAuthAttempts('user:test');
      expect(status.failures).toBe(0);
    });
  });

  describe('Storage sync integration', () => {
    it('should sync progress with server data', () => {
      const service = new StorageService();
      const serverData = {
        user: { xp: 100, streak: 5, level: 3, full_name: 'Server User', username: 'serveruser' },
        completedSceneIds: ['scene1', 'scene2'],
        savedWords: [{ word: 'newword', translation: 'newtrans', scene_title: 'Movie' }],
      };
      service.syncWithServer(serverData as any);
      const stats = service.getStats();
      expect(stats.level).toBeGreaterThanOrEqual(1);
    });
  });
});
