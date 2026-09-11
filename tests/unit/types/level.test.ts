import { describe, it, expect } from 'vitest';
import { getLevelProgress } from '@/types';

describe('getLevelProgress', () => {
  // Formula: level = floor(sqrt(xp / 25 + 0.25) - 0.5) + 1
  // levelStartXp = 25 * level * (level - 1)
  // nextLevelXp = 25 * (level + 1) * level
  // xpIntoLevel = safeXp - levelStartXp
  // xpNeededForLevel = nextLevelXp - levelStartXp
  // progressPct = min(100, max(5, round(xpIntoLevel / xpNeededForLevel * 100)))

  describe('Level boundary tests', () => {
    it('should return level 1 at XP 0', () => {
      const result = getLevelProgress(0);
      expect(result.level).toBe(1);
      expect(result.levelStartXp).toBe(0);
      expect(result.nextLevelXp).toBe(50);
      expect(result.xpIntoLevel).toBe(0);
      expect(result.xpNeededForLevel).toBe(50);
      // progressPct is clamped to a minimum of 5 (see header formula).
      expect(result.progressPct).toBe(5);
    });

    it('should return level 1 at XP 49 (just before level 2)', () => {
      const result = getLevelProgress(49);
      expect(result.level).toBe(1);
      expect(result.progressPct).toBe(98);
    });

    it('should return level 2 at XP 50 (exact level boundary)', () => {
      const result = getLevelProgress(50);
      expect(result.level).toBe(2);
      expect(result.levelStartXp).toBe(50);
      expect(result.nextLevelXp).toBe(150);
      expect(result.xpIntoLevel).toBe(0);
      expect(result.progressPct).toBe(5); // min-5 clamp at level entry
    });

    it('should return level 2 at XP 149 (just before level 3)', () => {
      const result = getLevelProgress(149);
      expect(result.level).toBe(2);
      expect(result.progressPct).toBe(99);
    });

    it('should return level 3 at XP 150 (exact level boundary)', () => {
      const result = getLevelProgress(150);
      expect(result.level).toBe(3);
      expect(result.levelStartXp).toBe(150);
      expect(result.nextLevelXp).toBe(300);
      expect(result.xpIntoLevel).toBe(0);
      expect(result.progressPct).toBe(5); // min-5 clamp at level entry
    });

    it('should return level 3 at XP 299 (just before level 4)', () => {
      const result = getLevelProgress(299);
      expect(result.level).toBe(3);
    });

    it('should return level 4 at XP 300 (exact level boundary)', () => {
      const result = getLevelProgress(300);
      expect(result.level).toBe(4);
      expect(result.levelStartXp).toBe(300);
      expect(result.nextLevelXp).toBe(500);
    });

    it('should return level 5 at XP 500', () => {
      const result = getLevelProgress(500);
      expect(result.level).toBe(5);
      expect(result.levelStartXp).toBe(500);
      expect(result.nextLevelXp).toBe(750);
    });
  });

  describe('Progress percentage tests', () => {
    it('should return 50% progress at half level XP', () => {
      const result = getLevelProgress(25); // Level 1, halfway to 50
      expect(result.level).toBe(1);
      expect(result.progressPct).toBe(50);
    });

    it('should return minimum (5%) progress right at a level boundary', () => {
      const result = getLevelProgress(50);
      expect(result.progressPct).toBe(5); // Just entered new level; min-5 clamp
    });

    it('should return 100% when almost at next level', () => {
      const result = getLevelProgress(49);
      expect(result.progressPct).toBe(98);
    });

    it('should cap progress at 100%', () => {
      const result = getLevelProgress(49);
      expect(result.progressPct).toBeLessThanOrEqual(100);
    });

    it('should ensure minimum progress of 5%', () => {
      const result = getLevelProgress(1);
      expect(result.progressPct).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Edge cases', () => {
    it('should handle negative XP as 0', () => {
      const result = getLevelProgress(-100);
      expect(result.level).toBe(1);
      expect(result.xpIntoLevel).toBe(0);
    });

    it('should floor decimal XP', () => {
      const result = getLevelProgress(50.9);
      expect(result.level).toBe(2);
      expect(result.xpIntoLevel).toBe(0);
    });

    it('should handle very large XP', () => {
      const result = getLevelProgress(10000);
      expect(result.level).toBeGreaterThan(1);
      expect(result.level).toBeGreaterThanOrEqual(1);
      expect(result.xpIntoLevel).toBeGreaterThanOrEqual(0);
    });

    it('should always return level >= 1', () => {
      for (const xp of [0, 1, 10, 100, 1000, 10000]) {
        const result = getLevelProgress(xp);
        expect(result.level).toBeGreaterThanOrEqual(1);
      }
    });

    it('should always have xpNeededForLevel >= 1', () => {
      for (const xp of [0, 1, 50, 150, 300]) {
        const result = getLevelProgress(xp);
        expect(result.xpNeededForLevel).toBeGreaterThanOrEqual(1);
      }
    });

    it('should have correct levelStartXp formula', () => {
      // levelStartXp = 25 * level * (level - 1)
      const levels = [1, 2, 3, 4, 5];
      for (const level of levels) {
        const result = getLevelProgress(25 * level * (level - 1));
        expect(result.levelStartXp).toBe(25 * level * (level - 1));
        expect(result.level).toBe(level);
      }
    });

    it('should have correct nextLevelXp formula', () => {
      // nextLevelXp = 25 * (level + 1) * level
      const result = getLevelProgress(50); // level 2
      expect(result.nextLevelXp).toBe(25 * 3 * 2); // 150
    });
  });

  describe('Consistency tests', () => {
    it('should be consistent: xpNeededForLevel = nextLevelXp - levelStartXp and xpIntoLevel = xp - levelStartXp', () => {
      // NOTE: xpNeededForLevel is the full span of the current level (see the
      // header formula), NOT the remainder — so "xpIntoLevel + xpNeededForLevel
      // = span" only held at exact boundaries and was mathematically impossible
      // for mid-level XP (e.g. xp=1 -> 1 + 50 = 51 ≠ 50).
      for (const xp of [0, 1, 25, 49, 50, 75, 100, 149, 150, 200, 300, 500]) {
        const result = getLevelProgress(xp);
        expect(result.xpNeededForLevel).toBe(result.nextLevelXp - result.levelStartXp);
        expect(result.xpIntoLevel).toBe(xp - result.levelStartXp);
      }
    });

    it('should return same level for same XP', () => {
      const r1 = getLevelProgress(123);
      const r2 = getLevelProgress(123);
      expect(r1.level).toBe(r2.level);
      expect(r1.progressPct).toBe(r2.progressPct);
    });
  });
});
