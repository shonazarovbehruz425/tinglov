import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as dbModule from '@/server/db';

vi.mock('node:sqlite', () => {
  // Must be a `function`, not an arrow: server/db.ts calls
  // `new DatabaseSync(...)`, and Vitest 5 spies construct their
  // implementation (arrow functions are not constructors).
  const DatabaseSync = vi.fn(function () {
    return {
      exec: vi.fn(),
      prepare: vi.fn().mockReturnThis(),
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn().mockReturnThis(),
    };
  });
  // Vitest 5 mock factories must provide every binding the importer uses,
  // including `default` (CJS interop accesses it even for named-only imports).
  return { DatabaseSync, default: { DatabaseSync } };
});

vi.mock('node:path', () => {
  const resolve = vi.fn().mockReturnValue(':memory:');
  // server/db.ts uses `import path from 'node:path'` (default import).
  return { resolve, default: { resolve } };
});

process.env.DATABASE_PATH = ':memory:';
process.env.NODE_ENV = 'test';

const {
  findUserByEmail, findUserByUsername, findUserById, createUser,
  updateUserStats, updateUserAuthMeta, saveUserWord, deleteUserWord,
  getUserSavedWords, recordUserCompletedScene, getUserCompletedScenes,
  getGlobalLeaderboard, getAllUsers, deleteUserById,
  updateUserStatsAdmin, getAdminStats, getAllAdminScenes,
  createAdminScene, deleteAdminScene, db
} = dbModule;

describe('server/db', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Several tests override db.prepare with an ad-hoc implementation that
    // returns a fresh inline object ({ run, get } with brand-new vi.fn()s on
    // every call). clearAllMocks() does not undo implementations, so restore
    // prepare to the original "returns the db instance itself" behavior.
    vi.mocked(db.prepare).mockReset().mockReturnThis();
  });

  describe('db initialization', () => {
    it('should create DatabaseSync instance', () => {
      expect(dbModule.db).toBeDefined();
    });
    it('should have exec method', () => {
      expect(typeof db.exec).toBe('function');
    });
    it('should have prepare method', () => {
      expect(typeof db.prepare).toBe('function');
    });
  });

  describe('findUserByEmail', () => {
    it('should find user by email', () => {
      const mockUser = { id: 1, username: 'test', email: 'test@test.com', password_hash: 'hash' };
      vi.mocked(db.prepare().get).mockReturnValue(mockUser);
      const result = findUserByEmail('test@test.com');
      expect(result).toEqual(mockUser);
    });
    it('should return undefined for non-existent email', () => {
      vi.mocked(db.prepare().get).mockReturnValue(undefined);
      const result = findUserByEmail('nobody@test.com');
      expect(result).toBeUndefined();
    });
  });

  describe('findUserByUsername', () => {
    it('should find user by username', () => {
      const mockUser = { id: 1, username: 'test', email: 'test@test.com', password_hash: 'hash' };
      vi.mocked(db.prepare().get).mockReturnValue(mockUser);
      const result = findUserByUsername('test');
      expect(result).toEqual(mockUser);
    });
    it('should return undefined for non-existent username', () => {
      vi.mocked(db.prepare().get).mockReturnValue(undefined);
      const result = findUserByUsername('nobody');
      expect(result).toBeUndefined();
    });
  });

  describe('findUserById', () => {
    it('should find user by id', () => {
      const mockUser = { id: 1, username: 'test', email: 'test@test.com', password_hash: 'hash' };
      vi.mocked(db.prepare().get).mockReturnValue(mockUser);
      const result = findUserById(1);
      expect(result).toEqual(mockUser);
    });
    it('should return undefined for non-existent id', () => {
      vi.mocked(db.prepare().get).mockReturnValue(undefined);
      const result = findUserById(999);
      expect(result).toBeUndefined();
    });
  });

  describe('createUser', () => {
    it('should create a user', () => {
      const mockResult = { lastInsertRowid: 1 };
      vi.mocked(db.prepare().run).mockReturnValue(mockResult);
      vi.mocked(db.prepare().get).mockReturnValue({ id: 1, username: 'test', email: 'test@test.com', password_hash: 'hash', full_name: 'Test', avatar_color: '#A3E635', xp: 0, streak: 1, level: 1, last_active_date: null, created_at: '2024-01-01' });
      const result = createUser({ username: 'test', email: 'test@test.com', password_hash: 'hash', full_name: 'Test' });
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });
  });

  describe('updateUserStats', () => {
    it('should update user stats', () => {
      const mockUser = { id: 1, username: 'test', email: 'test@test.com', password_hash: 'hash', full_name: 'Test', avatar_color: '#A3E635', xp: 0, streak: 1, level: 1, last_active_date: null, created_at: '2024-01-01' };
      vi.mocked(db.prepare).mockImplementation((sql: string) => ({
        run: vi.fn(),
        get: vi.fn().mockReturnValue(mockUser),
      }));
      updateUserStats(1, { xp: 100 });
      expect(db.prepare).toHaveBeenCalled();
    });
  });

  describe('saveUserWord', () => {
    it('should save a word', () => {
      saveUserWord(1, 'hello', 'salom', 'Movie');
      expect(db.prepare).toHaveBeenCalled();
    });
  });

  describe('deleteUserWord', () => {
    it('should delete a word', () => {
      deleteUserWord(1, 'hello');
      expect(db.prepare).toHaveBeenCalled();
    });
  });

  describe('getUserSavedWords', () => {
    it('should return saved words', () => {
      vi.mocked(db.prepare().all).mockReturnValue([]);
      const result = getUserSavedWords(1);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('recordUserCompletedScene', () => {
    it('should record completion', () => {
      recordUserCompletedScene(1, 'scene1', 100, 60);
      expect(db.prepare).toHaveBeenCalled();
    });
  });

  describe('getUserCompletedScenes', () => {
    it('should return completed scenes', () => {
      vi.mocked(db.prepare().all).mockReturnValue([]);
      const result = getUserCompletedScenes(1);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getGlobalLeaderboard', () => {
    it('should return leaderboard', () => {
      vi.mocked(db.prepare().all).mockReturnValue([]);
      const result = getGlobalLeaderboard(10);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getAllUsers', () => {
    it('should return all users', () => {
      vi.mocked(db.prepare().all).mockReturnValue([]);
      const result = getAllUsers();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('deleteUserById', () => {
    it('should return true when user deleted', () => {
      vi.mocked(db.prepare().run).mockReturnValue({ changes: 1 });
      const result = deleteUserById(1);
      expect(result).toBe(true);
    });
    it('should return false when user not found', () => {
      vi.mocked(db.prepare().run).mockReturnValue({ changes: 0 });
      const result = deleteUserById(999);
      expect(result).toBe(false);
    });
  });

  describe('updateUserStatsAdmin', () => {
    it('should update admin stats', () => {
      const mockUser = { id: 1, username: 'test', email: 'test@test.com', password_hash: 'hash', full_name: 'Test', avatar_color: '#A3E635', xp: 0, streak: 1, level: 1, last_active_date: null, created_at: '2024-01-01' };
      vi.mocked(db.prepare).mockImplementation((sql: string) => ({
        run: vi.fn(),
        get: vi.fn().mockReturnValue(mockUser),
      }));
      updateUserStatsAdmin(1, { xp: 100 });
      expect(db.prepare).toHaveBeenCalled();
    });
  });

  describe('getAdminStats', () => {
    it('should return admin stats', () => {
      vi.mocked(db.prepare).mockImplementation((sql: string) => ({
        run: vi.fn(),
        get: vi.fn().mockReturnValue({ count: 0 }),
      }));
      const result = getAdminStats();
      expect(result).toHaveProperty('totalUsers');
      expect(result).toHaveProperty('totalSavedWords');
      expect(result).toHaveProperty('totalCompletedScenes');
    });
  });

  describe('createAdminScene', () => {
    it('should create an admin scene', () => {
      const mockScene = { id: '1', title: 'Test', category: 'Cartoon', difficulty: 'beginner', video_url: 'https://x.com', poster_url: null, dialogues_json: '[]', created_at: '2024-01-01' };
      vi.mocked(db.prepare).mockImplementation((sql: string) => ({
        run: vi.fn(),
        get: vi.fn().mockReturnValue(mockScene),
      }));
      const result = createAdminScene({ id: '1', title: 'Test', category: 'Cartoon', difficulty: 'beginner', video_url: 'https://x.com', dialogues_json: '[]' });
      expect(result).toBeDefined();
    });
  });

  describe('deleteAdminScene', () => {
    it('should return true when scene deleted', () => {
      vi.mocked(db.prepare().run).mockReturnValue({ changes: 1 });
      expect(deleteAdminScene('1')).toBe(true);
    });
    it('should return false when scene not found', () => {
      vi.mocked(db.prepare().run).mockReturnValue({ changes: 0 });
      expect(deleteAdminScene('999')).toBe(false);
    });
  });
});
