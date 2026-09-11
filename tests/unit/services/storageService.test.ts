import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageService } from "@/services/storageService";
import { apiService } from "@/services/apiService";
import { getLevelProgress } from '@/types';
import type { Scene } from '@/types';
import {
  STATS_KEY,
  CUSTOM_SCENES_KEY,
  HIGH_SCORES_KEY,
  PENDING_SYNC_KEY,
} from '@/services/storageKeys';

vi.mock('@/services/apiService', () => ({
  apiService: {
    syncProgress: vi.fn().mockResolvedValue(undefined),
    saveWord: vi.fn().mockResolvedValue(undefined),
    deleteWord: vi.fn().mockResolvedValue(undefined),
  },
}));

/** Minimal valid Scene for CRUD tests. */
function makeScene(id: string): Scene {
  return {
    id,
    title: `Scene ${id}`,
    movieName: 'Movie',
    coverEmoji: '🎬',
    difficulty: 'beginner',
    category: 'Cinema',
    duration: '2:00',
    accent: 'American',
    dialogues: [],
  } as Scene;
}

function isoDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

/** Drain pending microtasks (mock-resolved promises) without touching timers. */
async function flushMicrotasks(times = 6): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Deterministic clock: scheduleCloudSync's 1200ms debounce only fires when
    // a test explicitly advances it.
    vi.useFakeTimers();
    vi.setSystemTime();
    localStorage.clear();
    service = new StorageService();
  });

  afterEach(() => {
    // Let leftover debounce timers run (harmlessly) before dropping the
    // fake clock, so no pending timer ever leaks into the next test.
    vi.advanceTimersByTime(2000);
    vi.useRealTimers();
  });

  describe('getStats', () => {
    it('should return default stats for new user', () => {
      const stats = service.getStats();
      expect(stats.xp).toBe(0);
      expect(stats.level).toBe(1);
      expect(stats.streak).toBe(1);
      expect(stats.completedScenes).toEqual([]);
    });
    it('should return copy of stats (immutability)', () => {
      const stats1 = service.getStats();
      const stats2 = service.getStats();
      expect(stats1).not.toBe(stats2);
    });
    it('should have default userName', () => {
      const stats = service.getStats();
      expect(stats.userName).toBe('Foydalanuvchi');
    });
    it('should have default userHandle', () => {
      const stats = service.getStats();
      expect(stats.userHandle).toBe('@til_organuvchi');
    });
  });

  describe('addXP', () => {
    it('should add XP and update level', () => {
      const result = service.addXP(50);
      expect(result.newLevel).toBe(2);
      expect(result.leveledUp).toBe(true);
    });
    it('should not level up for small XP', () => {
      const result = service.addXP(10);
      expect(result.leveledUp).toBe(false);
      expect(result.newLevel).toBe(1);
    });
    it('should accumulate XP', () => {
      service.addXP(25);
      const stats = service.getStats();
      expect(stats.xp).toBe(25);
    });
    it('should level up from 1 to 2 at exactly 50 XP', () => {
      const result = service.addXP(50);
      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(2);
    });
    it('should level up from 2 to 3 at exactly 150 XP', () => {
      service.addXP(150);
      const result = service.addXP(0);
      // After adding 150, level should be 3
      const stats = service.getStats();
      expect(stats.level).toBe(3);
    });
    it('should return leveledUp false when already at level', () => {
      service.addXP(10);
      const result = service.addXP(5);
      expect(result.leveledUp).toBe(false);
    });
  });

  describe('updateProfile', () => {
    it('should update name and handle', () => {
      service.updateProfile('John', '@johndoe');
      const stats = service.getStats();
      expect(stats.userName).toBe('John');
      expect(stats.userHandle).toBe('@johndoe');
    });
    it('should add @ prefix if missing', () => {
      service.updateProfile('John', 'johndoe');
      const stats = service.getStats();
      expect(stats.userHandle).toBe('@johndoe');
    });
    it('should use default name for empty string', () => {
      service.updateProfile('', '');
      const stats = service.getStats();
      expect(stats.userName).toBe('Foydalanuvchi');
    });
  });

  describe('saveWord', () => {
    it('should save a new word', () => {
      const result = service.saveWord({
        id: '1', word: 'hello', translation: 'salom',
        contextSentence: 'test', movieName: 'Movie', addedAt: Date.now()
      });
      expect(result).toBe(true);
    });
    it('should not save duplicate word', () => {
      service.saveWord({
        id: '1', word: 'hello', translation: 'salom',
        contextSentence: 'test', movieName: 'Movie', addedAt: Date.now()
      });
      const result = service.saveWord({
        id: '2', word: 'hello', translation: 'salom',
        contextSentence: 'test', movieName: 'Movie', addedAt: Date.now()
      });
      expect(result).toBe(false);
    });
    it('should be case insensitive', () => {
      service.saveWord({
        id: '1', word: 'Hello', translation: 'salom',
        contextSentence: 'test', movieName: 'Movie', addedAt: Date.now()
      });
      const result = service.isWordSaved('hello');
      expect(result).toBe(true);
    });
  });

  describe('removeSavedWord', () => {
    it('should remove a saved word', () => {
      service.saveWord({
        id: '1', word: 'hello', translation: 'salom',
        contextSentence: 'test', movieName: 'Movie', addedAt: Date.now()
      });
      service.removeSavedWord('1');
      expect(service.isWordSaved('hello')).toBe(false);
    });
  });

  describe('recordSentenceCompleted', () => {
    it('should update totalWordsTyped', () => {
      service.recordSentenceCompleted('scene1', 10, 80, 60);
      const stats = service.getStats();
      expect(stats.totalWordsTyped).toBe(10);
    });
    it('should update correctWordsTyped', () => {
      service.recordSentenceCompleted('scene1', 10, 80, 60);
      const stats = service.getStats();
      expect(stats.correctWordsTyped).toBe(8);
    });
    it('should add to completedScenes', () => {
      service.recordSentenceCompleted('scene1', 5, 100, 50);
      const stats = service.getStats();
      expect(stats.completedScenes).toContain('scene1');
    });
    it('should add to wpmHistory', () => {
      service.recordSentenceCompleted('scene1', 5, 100, 60);
      const stats = service.getStats();
      expect(stats.wpmHistory).toContain(60);
    });
    it('should limit wpmHistory to 20', () => {
      for (let i = 0; i < 25; i++) {
        service.recordSentenceCompleted(`scene${i}`, 5, 100, 60);
      }
      const stats = service.getStats();
      expect(stats.wpmHistory.length).toBeLessThanOrEqual(20);
    });
  });

  describe('getAllScenes', () => {
    it('should return initial scenes plus custom scenes', () => {
      const scenes = service.getAllScenes();
      expect(Array.isArray(scenes)).toBe(true);
    });
  });

  describe('generateChallengeLink', () => {
    it('should generate a valid URL', () => {
      const link = service.generateChallengeLink({
        sceneId: 'scene1',
        creatorName: 'Alice',
        accuracy: 90,
        wpm: 60
      });
      expect(link).toContain('scene=scene1');
      expect(link).toContain('challenge=1');
      expect(link).toContain('acc=90');
      expect(link).toContain('wpm=60');
    });
  });

  describe('parseChallengePayload', () => {
    it('should parse challenge from URLSearchParams', () => {
      const params = new URLSearchParams();
      params.set('challenge', '1');
      params.set('scene', 'scene1');
      params.set('acc', '90');
      params.set('wpm', '60');
      params.set('from', 'Alice');
      const result = service.parseChallengePayload(params);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.sceneId).toBe('scene1');
        expect(result.accuracy).toBe(90);
        expect(result.wpm).toBe(60);
        expect(result.creatorName).toBe('Alice');
      }
    });
    it('should return null if not a challenge', () => {
      const params = new URLSearchParams();
      params.set('scene', 'scene1');
      const result = service.parseChallengePayload(params);
      expect(result).toBeNull();
    });
  });

  describe('resetForGuest', () => {
    it('should reset stats to guest defaults', () => {
      service.updateProfile('John', '@johndoe');
      service.resetForGuest();
      const stats = service.getStats();
      expect(stats.userName).toBe('Mehmon');
      expect(stats.userHandle).toBe('@mehmon');
      expect(stats.xp).toBe(0);
      expect(stats.level).toBe(1);
    });
  });

  describe('getSceneHighScores', () => {
    it('should return empty array for no scores', () => {
      const scores = service.getSceneHighScores('scene1');
      expect(scores).toEqual([]);
    });
  });

  describe('recordSceneCompletionScore', () => {
    it('should record a score', () => {
      const result = service.recordSceneCompletionScore('scene1', 100, 60, 30);
      expect(result.isNewTopScore).toBe(true);
      expect(result.rank).toBe(1);
    });
    it('should return scores array', () => {
      const result = service.recordSceneCompletionScore('scene1', 80, 50, 40);
      expect(Array.isArray(result.scores)).toBe(true);
    });
  });

  describe('updateLastPosition', () => {
    it('should save last position', () => {
      service.updateLastPosition('scene1', 5);
      const pos = service.getLastPosition('scene1');
      expect(pos).toBe(5);
    });
    it('should return undefined for unknown scene', () => {
      const pos = service.getLastPosition('unknown');
      expect(pos).toBeUndefined();
    });
    it('should not persist when the index is unchanged', () => {
      service.updateLastPosition('scene1', 5);
      (localStorage.setItem as ReturnType<typeof vi.fn>).mockClear();
      service.updateLastPosition('scene1', 5);
      const statsWrites = (localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls
        .filter(call => call[0] === STATS_KEY);
      expect(statsWrites).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Constructor / persistence loading paths (legacy records, streak logic)
  // -------------------------------------------------------------------------

  describe('constructor & loadStats', () => {
    it('should extend the streak when last active yesterday', () => {
      localStorage.setItem(STATS_KEY, JSON.stringify({
        xp: 10, level: 1, streak: 5, lastActiveDate: isoDay(-1),
        completedScenes: [], totalWordsTyped: 0, correctWordsTyped: 0,
        wpmHistory: [], savedWords: [], lastPositions: {},
      }));
      const reloaded = new StorageService();
      expect(reloaded.getStats().streak).toBe(6);
      expect(reloaded.getStats().lastActiveDate).toBe(isoDay(0));
    });

    it('should reset the streak after a missed day', () => {
      localStorage.setItem(STATS_KEY, JSON.stringify({ streak: 9, lastActiveDate: isoDay(-3) }));
      const reloaded = new StorageService();
      expect(reloaded.getStats().streak).toBe(1);
    });

    it('should clamp clock-skewed future dates without touching the streak', () => {
      localStorage.setItem(STATS_KEY, JSON.stringify({ streak: 4, lastActiveDate: isoDay(1) }));
      const reloaded = new StorageService();
      expect(reloaded.getStats().streak).toBe(4);
      expect(reloaded.getStats().lastActiveDate).toBe(isoDay(0));
    });

    it('should keep the streak untouched when already active today', () => {
      localStorage.setItem(STATS_KEY, JSON.stringify({ streak: 7, lastActiveDate: isoDay(0) }));
      const reloaded = new StorageService();
      expect(reloaded.getStats().streak).toBe(7);
    });

    it('should decode legacy HTML-escaped names and normalize partial records', () => {
      localStorage.setItem(STATS_KEY, JSON.stringify({
        userName: 'O&#039;Brien',
        userHandle: 'A &amp; B &quot;x&quot; &lt;y&gt; &apos;z&apos; &#x27;w&#x27;',
        completedScenes: 'nope',
        wpmHistory: null,
        savedWords: 42,
        lastPositions: [1, 2, 3],
      }));
      const stats = new StorageService().getStats();
      expect(stats.userName).toBe("O'Brien");
      expect(stats.userHandle).toBe("A & B \"x\" <y> 'z' 'w'");
      expect(stats.completedScenes).toEqual([]);
      expect(stats.wpmHistory).toEqual([]);
      expect(stats.savedWords).toEqual([]);
      expect(stats.lastPositions).toEqual({});
    });

    it('should fall back to defaults on corrupt stats JSON', () => {
      localStorage.setItem(STATS_KEY, '{definitely not json');
      const stats = new StorageService().getStats();
      expect(stats.xp).toBe(0);
      expect(stats.userName).toBe('Foydalanuvchi');
    });

    it('should fall back to empty arrays for corrupt or non-array custom scenes', () => {
      const baseline = service.getAllScenes().length; // whatever INITIAL_SCENES ships
      localStorage.setItem(CUSTOM_SCENES_KEY, '{{{');
      expect(new StorageService().getAllScenes()).toHaveLength(baseline);
      localStorage.setItem(CUSTOM_SCENES_KEY, JSON.stringify({ not: 'an array' }));
      expect(new StorageService().getAllScenes()).toHaveLength(baseline);
    });

    it('should fall back to {} for corrupt high scores and use valid ones', () => {
      localStorage.setItem(HIGH_SCORES_KEY, 'nope');
      expect(new StorageService().getSceneHighScores('s1')).toEqual([]);

      localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify({
        s1: [{
          id: 'x', sceneId: 's1', userName: 'A', userHandle: '@a',
          accuracy: 100, wpm: 80, timeSpentSeconds: 10, score: 1, completedAt: 1,
        }],
      }));
      expect(new StorageService().getSceneHighScores('s1')[0].wpm).toBe(80);
    });
  });

  // -------------------------------------------------------------------------
  // Custom scene CRUD
  // -------------------------------------------------------------------------

  describe('custom scene CRUD', () => {
    it('should save, list and delete custom scenes (persisted to localStorage)', () => {
      const baseline = service.getAllScenes().length;
      service.saveCustomScene(makeScene('cs1'));
      service.saveCustomScene(makeScene('cs2'));
      expect(service.getAllScenes().length).toBe(baseline + 2);
      expect(readJson<Scene[]>(CUSTOM_SCENES_KEY)?.map(s => s.id)).toEqual(['cs1', 'cs2']);

      service.deleteCustomScene('cs1');
      expect(service.getAllScenes().some(s => s.id === 'cs1')).toBe(false);
      expect(readJson<Scene[]>(CUSTOM_SCENES_KEY)?.map(s => s.id)).toEqual(['cs2']);
    });

    it('should survive localStorage quota errors while saving scenes', () => {
      (localStorage.setItem as ReturnType<typeof vi.fn>)
        .mockImplementationOnce(() => { throw new Error('QuotaExceeded'); });
      expect(() => service.saveCustomScene(makeScene('cs-quota'))).not.toThrow();
      expect(() => service.deleteCustomScene('cs-quota')).not.toThrow();
    });

    it('mergeServerScenes should replace existing ids and append new ones', () => {
      service.saveCustomScene(makeScene('cs1'));
      const updated = makeScene('cs1');
      (updated as Scene).title = 'Updated';
      service.mergeServerScenes([updated, makeScene('cs9')]);
      const all = service.getAllScenes();
      const cs1 = all.find(s => s.id === 'cs1');
      expect(cs1?.title).toBe('Updated');
      expect(all.some(s => s.id === 'cs9')).toBe(true);
      // Merge is in-memory only; the persisted copy still holds the old scene.
      expect(readJson<Scene[]>(CUSTOM_SCENES_KEY)?.[0].title).toBe('Scene cs1');
    });
  });

  // -------------------------------------------------------------------------
  // High scores
  // -------------------------------------------------------------------------

  describe('getSceneHighScores ordering', () => {
    const rec = (i: number, accuracy: number, wpm: number, time: number) => ({
      id: `r${i}`, sceneId: 's1', userName: `U${i}`, userHandle: `@u${i}`,
      accuracy, wpm, timeSpentSeconds: time, score: i, completedAt: i,
    });

    it('should order by accuracy, then wpm, then fastest time — and keep TOP 3', () => {
      localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify({
        s1: [
          rec(1, 90, 50, 30),
          rec(2, 90, 50, 20),
          rec(3, 90, 70, 40),
          rec(4, 95, 10, 5),
          rec(5, 80, 99, 1),
        ],
      }));
      const fresh = new StorageService();
      const top = fresh.getSceneHighScores('s1');
      expect(top.map(r => r.id)).toEqual(['r4', 'r3', 'r2']);
    });
  });

  describe('recordSceneCompletionScore personal bests', () => {
    it('should replace own record only when strictly better', () => {
      // Legacy record with a differently-cased handle must count as "same user".
      localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify({
        s1: [{
          id: 'me', sceneId: 's1', userName: 'Foydalanuvchi', userHandle: '@Til_Organuvchi',
          accuracy: 90, wpm: 60, timeSpentSeconds: 30, score: 1, completedAt: 1,
        }],
      }));
      const fresh = new StorageService();

      // Worse accuracy → old record survives.
      fresh.recordSceneCompletionScore('s1', 80, 99, 5);
      expect(fresh.getSceneHighScores('s1')[0]).toMatchObject({ accuracy: 90, wpm: 60 });

      // Better accuracy → replaced.
      fresh.recordSceneCompletionScore('s1', 100, 60, 30);
      expect(fresh.getSceneHighScores('s1')[0]).toMatchObject({ accuracy: 100, wpm: 60 });

      // Equal accuracy, better wpm → replaced.
      fresh.recordSceneCompletionScore('s1', 100, 70, 30);
      expect(fresh.getSceneHighScores('s1')[0]).toMatchObject({ accuracy: 100, wpm: 70 });

      // Equal accuracy & wpm, faster time → replaced.
      fresh.recordSceneCompletionScore('s1', 100, 70, 12);
      expect(fresh.getSceneHighScores('s1')[0]).toMatchObject({ accuracy: 100, wpm: 70, timeSpentSeconds: 12 });

      // Equal accuracy & wpm but slower → unchanged.
      fresh.recordSceneCompletionScore('s1', 100, 70, 99);
      expect(fresh.getSceneHighScores('s1')[0].timeSpentSeconds).toBe(12);
    });

    it('should clamp timeSpentSeconds to at least 1 second', () => {
      const result = service.recordSceneCompletionScore('s1', 100, 40, 0);
      expect(result.scores[0].timeSpentSeconds).toBe(1);
    });

    it('should keep only the TOP 10 per scene and report ranks beyond 3', () => {
      const others = Array.from({ length: 10 }, (_, i) => ({
        id: `o${i}`, sceneId: 's1', userName: `Other ${i}`, userHandle: `@other${i}`,
        accuracy: 50 + i * 5, wpm: 40, timeSpentSeconds: 20, score: i, completedAt: i,
      }));
      localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify({ s1: others }));
      const fresh = new StorageService();

      // Accuracy 70 ties with @other4 (wpm 40 > my 10) → lands outside TOP 3.
      const notTop = fresh.recordSceneCompletionScore('s1', 70, 10, 60);
      expect(notTop.isNewTopScore).toBe(false);
      expect(notTop.rank).toBeGreaterThan(3);

      // The 11th entry got trimmed back down to 10 in storage.
      expect(readJson<Record<string, unknown[]>>(HIGH_SCORES_KEY)?.s1).toHaveLength(10);

      // A new personal best (my handle) replaces my mediocre record → rank 1.
      const best = fresh.recordSceneCompletionScore('s1', 100, 90, 10);
      expect(best.isNewTopScore).toBe(true);
      expect(best.rank).toBe(1);
      expect(fresh.getSceneHighScores('s1')[0].accuracy).toBe(100);
    });

    it('should push the completed scene to the cloud', () => {
      service.recordSceneCompletionScore('s1', 90, 55, 20);
      expect(apiService.syncProgress).toHaveBeenCalledWith({
        completedScene: { sceneId: 's1', accuracy: 90, wpm: 55 },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Saved words & background API calls
  // -------------------------------------------------------------------------

  describe('saved words cloud side-effects', () => {
    it('should POST new words and skip duplicates', () => {
      service.saveWord({
        id: '1', word: 'apple', translation: 'olma',
        contextSentence: '', movieName: 'Movie', addedAt: 1,
      });
      expect(apiService.saveWord).toHaveBeenCalledWith('apple', 'olma', 'Movie');
      service.saveWord({
        id: '2', word: 'APPLE', translation: 'olma',
        contextSentence: '', movieName: 'Movie', addedAt: 2,
      });
      expect(apiService.saveWord).toHaveBeenCalledTimes(1);
      expect(service.getStats().savedWords).toHaveLength(1);
    });

    it('should DELETE from the cloud only for known words', () => {
      service.saveWord({
        id: 'w1', word: 'pear', translation: 'noksha',
        contextSentence: '', movieName: 'M', addedAt: 1,
      });
      (apiService.deleteWord as ReturnType<typeof vi.fn>).mockClear();
      service.removeSavedWord('w1');
      expect(apiService.deleteWord).toHaveBeenCalledWith('pear');

      (apiService.deleteWord as ReturnType<typeof vi.fn>).mockClear();
      service.removeSavedWord('ghost-id');
      expect(apiService.deleteWord).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // syncWithServer — merge semantics
  // -------------------------------------------------------------------------

  describe('syncWithServer', () => {
    const serverUser = (over: Record<string, unknown> = {}) => ({
      id: 1, username: 'serveruser', email: 's@s.io', full_name: 'Server User',
      avatar_color: '#fff', xp: 0, streak: 1, level: 1,
      last_active_date: null, created_at: '', ...over,
    });

    it('should ignore null payloads and payloads without a user', () => {
      service.addXP(30);
      const before = service.getStats();
      service.syncWithServer(null as never);
      service.syncWithServer({} as never);
      service.syncWithServer({ user: null } as never);
      expect(service.getStats()).toEqual(before);
    });

    it('should keep the highest progress, union scenes/words and push deltas', () => {
      service.addXP(150); // → level 3 locally
      (apiService.syncProgress as ReturnType<typeof vi.fn>).mockClear();
      service.recordSentenceCompleted('local-scene', 5, 100, 50);
      service.updateLastPosition('local-scene', 5);
      service.saveWord({
        id: '1', word: 'apple', translation: 'olma',
        contextSentence: '', movieName: 'Movie', addedAt: 1,
      });
      (apiService.syncProgress as ReturnType<typeof vi.fn>).mockClear();

      service.syncWithServer({
        user: serverUser({ xp: 50, streak: 5, level: 2, full_name: 'Ali', username: 'alicode' }),
        completedSceneIds: ['server-scene'],
        lastPositions: { 'local-scene': 1, onlyServer: 3, fractional: 2.7, garbage: 'x' },
        savedWords: [
          { id: 11, word: ' APPLE ', translation: null, scene_title: null },
          { id: 12, word: 'banana', translation: 'banan', scene_title: 'Movie B' },
          { id: 13, word: 'cherry', translation: null, scene_title: null },
        ],
      } as never);

      const stats = service.getStats();
      expect(stats.xp).toBe(150);            // local XP was higher → kept
      expect(stats.streak).toBe(5);          // server streak higher
      expect(stats.level).toBe(3);           // local level (150 XP) beats server level 2
      expect(stats.userName).toBe('Ali');
      expect(stats.userHandle).toBe('@alicode');
      expect(stats.completedScenes).toEqual(expect.arrayContaining(['local-scene', 'server-scene']));
      expect(service.getLastPosition('local-scene')).toBe(5);   // local position wins
      expect(service.getLastPosition('onlyServer')).toBe(3);    // server fills the gap
      expect(service.getLastPosition('fractional')).toBe(2);    // floored
      expect(service.getLastPosition('garbage')).toBe(0);       // NaN → 0

      // Words: server duplicate merged (no double entry), new words imported,
      // null translation/scene_title coalesced to empty strings.
      expect(stats.savedWords.map(w => w.word).sort()).toEqual(['apple', 'banana', 'cherry']);
      expect(stats.savedWords.find(w => w.word === 'banana'))
        .toMatchObject({ translation: 'banan', movieName: 'Movie B' });
      expect(stats.savedWords.find(w => w.word === 'cherry'))
        .toMatchObject({ translation: '', movieName: '', contextSentence: '' });

      // Persisted + pushed back to the server after the debounce window.
      expect(readJson<{ xp: number }>(STATS_KEY)?.xp).toBe(150);
      vi.advanceTimersByTime(1200);
      expect(apiService.syncProgress).toHaveBeenCalledWith(expect.objectContaining({
        xp: 150,
        savedWords: expect.arrayContaining([
          { word: 'apple', translation: 'olma', sceneTitle: 'Movie' },
          { word: 'banana', translation: 'banan', sceneTitle: 'Movie B' },
        ]),
      }));
    });

    it('should adopt scene ids from the legacy completedScenes rows', () => {
      service.syncWithServer({
        user: serverUser({ xp: 10, level: 1, streak: 1 }),
        completedScenes: [{ id: 1, scene_id: 'fromRow', accuracy: 90, wpm: 40 }],
        lastPositions: [1, 2, 3], // array garbage → ignored
        savedWords: [],
      } as never);
      expect(service.getStats().completedScenes).toEqual(['fromRow']);
    });

    it('should adopt everything when the server is strictly ahead (no push)', () => {
      service.syncWithServer({
        user: serverUser({ xp: 900, streak: 30, level: 9, full_name: '', username: '' }),
        completedSceneIds: ['s1', 's2'],
        savedWords: [{ id: 5, word: 'kiwi', translation: 'kivi', scene_title: 'K' }],
      } as never);
      const stats = service.getStats();
      expect(stats.xp).toBe(900);
      expect(stats.streak).toBe(30);
      expect(stats.level).toBe(9);
      expect(stats.userName).toBe('Foydalanuvchi'); // full_name '' → untouched... 
      expect(stats.savedWords.map(w => w.word)).toEqual(['kiwi']);
      vi.advanceTimersByTime(1200);
      expect(apiService.syncProgress).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Cloud sync pipeline: scheduleCloudSync / syncToCloud / pending queue
  // -------------------------------------------------------------------------

  describe('scheduleCloudSync (debounce)', () => {
    it('should collapse rapid mutations into a single sync', () => {
      service.addXP(5);
      service.addXP(5);
      service.addXP(5);
      (apiService.syncProgress as ReturnType<typeof vi.fn>).mockClear();
      vi.advanceTimersByTime(1199);
      expect(apiService.syncProgress).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(apiService.syncProgress).toHaveBeenCalledTimes(1);
    });

    it('should be a no-op without a window (SSR guard)', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error — temporarily removing window to hit the guard branch
      delete globalThis.window;
      try {
        expect(() => service.scheduleCloudSync()).not.toThrow();
      } finally {
        Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
      }
    });
  });

  describe('syncToCloud', () => {
    it('should send the full payload and clear any queued sync', async () => {
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ xp: 1 }));
      service.addXP(20);
      (apiService.syncProgress as ReturnType<typeof vi.fn>).mockClear();
      await service.syncToCloud();
      expect(apiService.syncProgress).toHaveBeenCalledWith(expect.objectContaining({
        xp: 20,
        completedScenes: [],
        lastPositions: {},
        savedWords: [],
      }));
      expect(localStorage.getItem(PENDING_SYNC_KEY)).toBeNull();
    });

    it('should queue instead of sending while offline', async () => {
      const original = globalThis.navigator;
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false }, configurable: true,
      });
      try {
        await service.syncToCloud();
        expect(apiService.syncProgress).not.toHaveBeenCalled();
        expect(readJson<Record<string, unknown>>(PENDING_SYNC_KEY)).toMatchObject({ xp: 0 });
      } finally {
        Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true });
      }
    });

    it('should queue the compact payload when the request fails', async () => {
      (apiService.syncProgress as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('network down'));
      await service.syncToCloud();
      const queued = readJson<Record<string, unknown>>(PENDING_SYNC_KEY);
      expect(queued).toMatchObject({ xp: 0, completedScenes: [] });
      expect(queued && 'savedWords' in queued).toBe(false);
    });

    it('should not run two syncs concurrently', async () => {
      let release: (value: unknown) => void = () => {};
      (apiService.syncProgress as ReturnType<typeof vi.fn>)
        .mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
      const first = service.syncToCloud();
      const second = service.syncToCloud(); // hits the isSyncing guard
      release(undefined);
      await Promise.all([first, second]);
      expect(apiService.syncProgress).toHaveBeenCalledTimes(1);
    });

    it('should swallow localStorage failures while queueing and clearing', async () => {
      const original = globalThis.navigator;
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false }, configurable: true,
      });
      (localStorage.setItem as ReturnType<typeof vi.fn>)
        .mockImplementation(() => { throw new Error('quota'); });
      try {
        await expect(service.syncToCloud()).resolves.toBeUndefined();
      } finally {
        (localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation((key: string, value: string) => {
          (localStorage as unknown as { _store: Record<string, string> })._store[key] = value;
        });
        Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true });
      }
      // clearPendingSync must survive removeItem throwing too
      localStorage.setItem(PENDING_SYNC_KEY, '{}');
      (localStorage.removeItem as ReturnType<typeof vi.fn>)
        .mockImplementationOnce(() => { throw new Error('nope'); });
      await expect(service.syncToCloud()).resolves.toBeUndefined();
    });
  });

  describe('online event → flushPendingSync', () => {
    it('should flush the queued payload once the network returns', async () => {
      const payload = { xp: 42, streak: 2, level: 1, completedScenes: ['sx'] };
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(payload));
      (apiService.syncProgress as ReturnType<typeof vi.fn>).mockClear();

      window.dispatchEvent(new Event('online'));
      await flushMicrotasks();

      expect(apiService.syncProgress).toHaveBeenCalledWith(expect.objectContaining({ xp: 42 }));
      expect(localStorage.getItem(PENDING_SYNC_KEY)).toBeNull();
    });

    it('should stay silent when there is nothing queued', async () => {
      (apiService.syncProgress as ReturnType<typeof vi.fn>).mockClear();
      window.dispatchEvent(new Event('online'));
      await flushMicrotasks();
      expect(apiService.syncProgress).not.toHaveBeenCalled();
    });

    it('should keep the queue when the payload is corrupt', async () => {
      localStorage.setItem(PENDING_SYNC_KEY, '{{{corrupt');
      (apiService.syncProgress as ReturnType<typeof vi.fn>).mockClear();
      window.dispatchEvent(new Event('online'));
      await flushMicrotasks();
      expect(apiService.syncProgress).not.toHaveBeenCalled();
      expect(localStorage.getItem(PENDING_SYNC_KEY)).toBe('{{{corrupt');
    });

    it('should keep the queue when the flush request fails', async () => {
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ xp: 7 }));
      (apiService.syncProgress as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline again'));
      window.dispatchEvent(new Event('online'));
      await flushMicrotasks();
      expect(apiService.syncProgress).toHaveBeenCalled();
      expect(localStorage.getItem(PENDING_SYNC_KEY)).toContain('"xp":7');
      (apiService.syncProgress as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    });
  });

  // -------------------------------------------------------------------------
  // Remaining small branches
  // -------------------------------------------------------------------------

  describe('misc paths', () => {
    it('recordSentenceCompleted should skip the wpm log and dup scene entries', () => {
      service.recordSentenceCompleted('dup', 4, 100, 0);
      service.recordSentenceCompleted('dup', 4, 100, 30);
      const stats = service.getStats();
      expect(stats.wpmHistory).toEqual([30]);
      expect(stats.completedScenes.filter(id => id === 'dup')).toHaveLength(1);
      expect(stats.totalWordsTyped).toBe(8);
    });

    it('resetForGuest should clear vocabulary too', () => {
      service.saveWord({
        id: '1', word: 'lemon', translation: 'limon',
        contextSentence: '', movieName: 'M', addedAt: 1,
      });
      service.resetForGuest();
      expect(service.getStats().savedWords).toEqual([]);
      expect(service.isWordSaved('lemon')).toBe(false);
    });

    it('updateProfile should trim input and keep an existing @ handle', () => {
      service.updateProfile('  Ada  ', '@already');
      const stats = service.getStats();
      expect(stats.userName).toBe('Ada');
      expect(stats.userHandle).toBe('@already');
    });

    it('saveStats should swallow quota errors', () => {
      (localStorage.setItem as ReturnType<typeof vi.fn>)
        .mockImplementationOnce(() => { throw new Error('QuotaExceeded'); });
      expect(() => service.saveStats()).not.toThrow();
    });

    it('generateChallengeLink should include the creator handle', () => {
      const link = service.generateChallengeLink({
        sceneId: 's1', creatorName: 'Ann Lee', creatorHandle: '@ann', accuracy: 88, wpm: 41,
      });
      expect(link).toContain('/practice?');
      // Params are pre-encoded with encodeURIComponent and URLSearchParams
      // encodes them again on serialization — decode once to check values.
      const query = new URL(link).searchParams;
      expect(query.get('from')).toBe(encodeURIComponent('Ann Lee'));
      expect(query.get('h')).toBe(encodeURIComponent('@ann'));
    });

    it('parseChallengePayload should fall back to sane defaults on garbage numbers', () => {
      const params = new URLSearchParams({ challenge: '1', scene: 's9', acc: 'abc', wpm: 'x', h: '@h%20x' });
      const payload = service.parseChallengePayload(params);
      expect(payload).toEqual({
        sceneId: 's9',
        creatorName: 'Do‘stingiz',
        creatorHandle: '@h x',
        accuracy: 100,
        wpm: 40,
      });
    });
  });

  describe('level formula sanity (via addXP)', () => {
    it('stays consistent with getLevelProgress for a big grant', () => {
      service.addXP(1000);
      expect(service.getStats().level).toBe(getLevelProgress(1000).level);
    });
  });

  describe('server scenes management and synchronization', () => {
    it('incorporates server scenes cleanly into getAllScenes', () => {
      const initialCount = service.getAllScenes().length;
      const serverScene = makeScene('server_scene_1');
      service.setServerScenes([serverScene]);

      const scenes = service.getAllScenes();
      expect(scenes.length).toBe(initialCount + 1);
      expect(scenes.some((s) => s.id === 'server_scene_1')).toBe(true);
    });

    it('replaces previous server scenes when server scenes list updates', () => {
      const initialCount = service.getAllScenes().length;
      service.setServerScenes([makeScene('server_scene_1')]);
      expect(service.getAllScenes().some((s) => s.id === 'server_scene_1')).toBe(true);

      // Server deleted server_scene_1 and added server_scene_2
      service.setServerScenes([makeScene('server_scene_2')]);
      const updatedScenes = service.getAllScenes();
      expect(updatedScenes.length).toBe(initialCount + 1);
      expect(updatedScenes.some((s) => s.id === 'server_scene_1')).toBe(false);
      expect(updatedScenes.some((s) => s.id === 'server_scene_2')).toBe(true);
    });

    it('does not duplicate scenes if server scene matches existing custom scene id', () => {
      const customScene = makeScene('scene_x');
      service.saveCustomScene(customScene);

      const overrideScene = { ...makeScene('scene_x'), title: 'Overridden Title' };
      service.setServerScenes([overrideScene]);

      const scenes = service.getAllScenes();
      expect(scenes.length).toBe(1);
      const matched = scenes.find((s) => s.id === 'scene_x');
      expect(matched?.title).toBe('Overridden Title');
    });
  });
});

