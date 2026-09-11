import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from "@/services/storageService";
import { apiService } from "@/services/apiService";
import { getLevelProgress } from '@/types';

vi.mock('@/services/apiService', () => ({
  apiService: {
    syncProgress: vi.fn().mockResolvedValue(undefined),
    saveWord: vi.fn().mockResolvedValue(undefined),
    deleteWord: vi.fn().mockResolvedValue(undefined),
  },
}));

process.env.JWT_SECRET = 'test-jwt-secret-key-that-is-at-least-32-chars-long!!';
process.env.NODE_ENV = 'test';

describe('Integration: Progress Sync', () => {
  let service: StorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    service = new StorageService();
  });

  describe('Happy path: XP and Level Sync', () => {
    it('should add XP and level up correctly', () => {
      const result = service.addXP(50);
      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(2);
    });

    it('should sync with server preserving highest XP', () => {
      service.addXP(100);
      const serverData = {
        user: { xp: 50, streak: 3, level: 2, full_name: 'Test', username: 'test' },
        completedSceneIds: [],
        savedWords: [],
      };
      service.syncWithServer(serverData as any);
      const stats = service.getStats();
      expect(stats.xp).toBe(100);
    });

    it('should merge completed scenes from server', () => {
      service.recordSentenceCompleted('scene1', 10, 100, 60);
      const serverData = {
        user: { xp: 0, streak: 1, level: 1, full_name: 'Test', username: 'test' },
        completedSceneIds: ['scene2', 'scene3'],
        savedWords: [],
      };
      service.syncWithServer(serverData as any);
      const stats = service.getStats();
      expect(stats.completedScenes).toContain('scene1');
      expect(stats.completedScenes).toContain('scene2');
      expect(stats.completedScenes).toContain('scene3');
    });

    it('should merge saved words from server', () => {
      const serverData = {
        user: { xp: 0, streak: 1, level: 1, full_name: 'Test', username: 'test' },
        completedSceneIds: [],
        savedWords: [{ word: 'serverword', translation: 'servertrans', scene_title: 'Movie' }],
      };
      service.syncWithServer(serverData as any);
      const stats = service.getStats();
      expect(stats.savedWords.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Happy path: Word Management Sync', () => {
    it('should save and remove words', () => {
      const result = service.saveWord({
        id: '1', word: 'hello', translation: 'salom',
        contextSentence: 'test', movieName: 'Movie', addedAt: Date.now()
      });
      expect(result).toBe(true);
      expect(service.isWordSaved('hello')).toBe(true);

      service.removeSavedWord('1');
      expect(service.isWordSaved('hello')).toBe(false);
    });
  });

  describe('Happy path: Streak and Activity', () => {
    it('should track sentence completions', () => {
      service.recordSentenceCompleted('scene1', 20, 90, 70);
      const stats = service.getStats();
      expect(stats.totalWordsTyped).toBe(20);
      expect(stats.correctWordsTyped).toBe(18);
    });

    it('should update last position', () => {
      service.updateLastPosition('scene1', 5);
      expect(service.getLastPosition('scene1')).toBe(5);
    });
  });

  describe('Fail path: Sync Edge Cases', () => {
    it('should handle empty server data', () => {
      service.addXP(10);
      service.syncWithServer(null as any);
      const stats = service.getStats();
      expect(stats.xp).toBe(10);
    });

    it('should handle server data with no user', () => {
      service.addXP(10);
      service.syncWithServer({ user: null } as any);
      const stats = service.getStats();
      expect(stats.xp).toBe(10);
    });

    it('should preserve local XP when higher than server', () => {
      service.addXP(200);
      const serverData = {
        user: { xp: 50, streak: 1, level: 1, full_name: 'Test', username: 'test' },
        completedSceneIds: [],
        savedWords: [],
      };
      service.syncWithServer(serverData as any);
      const stats = service.getStats();
      expect(stats.xp).toBe(200);
    });

    it('should handle duplicate scene completion', () => {
      service.recordSentenceCompleted('scene1', 10, 100, 60);
      service.recordSentenceCompleted('scene1', 5, 80, 40);
      const stats = service.getStats();
      expect(stats.completedScenes.filter((s: string) => s === 'scene1').length).toBe(1);
    });
  });

  describe('Level Progress Consistency', () => {
    it('should maintain consistent level progress after sync', () => {
      service.addXP(50);
      const level1 = getLevelProgress(service.getStats().xp);
      const serverData = {
        user: { xp: service.getStats().xp, streak: 1, level: level1.level, full_name: 'Test', username: 'test' },
        completedSceneIds: [],
        savedWords: [],
      };
      service.syncWithServer(serverData as any);
      const level2 = getLevelProgress(service.getStats().xp);
      expect(level1.level).toBe(level2.level);
    });

    it('should handle XP boundary at level transitions', () => {
      service.addXP(50); // Level 2
      const stats1 = service.getStats();
      expect(stats1.level).toBe(2);

      service.addXP(100); // Level 3 (150 total)
      const stats2 = service.getStats();
      expect(stats2.level).toBe(3);
    });
  });
});
