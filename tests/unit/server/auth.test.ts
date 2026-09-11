import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as auth from '@/server/auth';
import * as rateLimiter from '@/server/rateLimiter';
import * as db from '@/server/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

process.env.JWT_SECRET = 'test-jwt-secret-key-that-is-at-least-32-chars-long!!';
process.env.CAPTCHA_SECRET = 'test-captcha-secret-key-1234';
process.env.NODE_ENV = 'test';

describe('server/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const hash = await auth.hashPassword('Password1!');
      expect(hash).toBe('$2a$10$hashedpassword');
    });
    it('should call bcrypt.hash', async () => {
      await auth.hashPassword('test');
      expect(bcrypt.hash).toHaveBeenCalledWith('test', 10);
    });
  });

  describe('comparePassword', () => {
    it('should compare password with hash', async () => {
      const result = await auth.comparePassword('Password1!', '$2a$10$hashedpassword');
      expect(result).toBe(true);
    });
    it('should call bcrypt.compare', async () => {
      await auth.comparePassword('test', 'hash');
      expect(bcrypt.compare).toHaveBeenCalledWith('test', 'hash');
    });
  });

  describe('generateToken', () => {
    it('should generate a JWT token', () => {
      const token = auth.generateToken({ id: 1, username: 'test', email: 'test@test.com' });
      expect(token).toBe('mock-jwt-token');
    });
    it('should call jwt.sign with correct payload', () => {
      auth.generateToken({ id: 1, username: 'test', email: 'test@test.com' });
      expect(jwt.sign).toHaveBeenCalled();
    });
    it('should set expiresIn to 7d', () => {
      auth.generateToken({ id: 1, username: 'test', email: 'test@test.com' });
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({ expiresIn: '7d' })
      );
    });
  });

  describe('extractToken', () => {
    it('should extract token from cookie', () => {
      const req = { cookies: { token: 'my-token' }, headers: {} };
      expect(auth.extractToken(req as any)).toBe('my-token');
    });
    it('should extract token from Authorization header', () => {
      const req = { cookies: {}, headers: { authorization: 'Bearer my-token' } };
      expect(auth.extractToken(req as any)).toBe('my-token');
    });
    it('should return null when no token', () => {
      const req = { cookies: {}, headers: {} };
      expect(auth.extractToken(req as any)).toBeNull();
    });
    it('should parse cookie header', () => {
      const req = { cookies: {}, headers: { cookie: 'token=my-token' } };
      expect(auth.extractToken(req as any)).toBe('my-token');
    });
  });

  describe('requireAuth', () => {
    it('should return 401 when no token', () => {
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      const req = { cookies: {}, headers: {} };
      auth.requireAuth(req as any, res as any, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
    it('should call next with valid token', () => {
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      const req = {
        cookies: {},
        headers: { authorization: 'Bearer mock-jwt-token' },
        user: undefined,
      };
      // requireAuth() looks the user up after verifying the token; without a
      // stubbed findUserById the mocked db returns undefined -> 401 path.
      vi.mocked(db.findUserById).mockReturnValue({
        id: 1, username: 'test', email: 'test@test.com',
      } as any);
      auth.requireAuth(req as any, res as any, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
    });
    it('should return 401 for invalid token', () => {
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      const req = {
        cookies: {},
        headers: { authorization: 'Bearer invalid-token' },
      };
      // An invalid token makes the real jwt.verify throw; mockReturnValue from
      // a previous test is not cleared by vi.clearAllMocks(), so override it.
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('invalid signature');
      });
      auth.requireAuth(req as any, res as any, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('generateAdminToken', () => {
    it('should generate admin token', () => {
      const token = auth.generateAdminToken('admin');
      expect(token).toBe('mock-jwt-token');
    });
    it('should set expiresIn to 7d (aligned with admin cookie maxAge)', () => {
      auth.generateAdminToken('admin');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({ expiresIn: '7d' })
      );
    });
  });

  describe('requireAdminAuth', () => {
    it('should return 401 when no admin token', () => {
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      const req = { cookies: {}, headers: {} };
      auth.requireAdminAuth(req as any, res as any, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
    it('should return 403 for non-admin', () => {
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      const req = {
        cookies: { admin_token: 'mock-jwt-token' },
        headers: {},
        admin: undefined,
      };
      vi.mocked(jwt.verify).mockReturnValue({ username: 'user', role: 'user' });
      auth.requireAdminAuth(req as any, res as any, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
