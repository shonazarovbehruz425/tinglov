// internal
import { UserStats, SavedWord, Scene, HighScoreRecord, ChallengePayload, getLevelProgress } from '../types';
import { INITIAL_SCENES } from '../data/scenes';
import { apiService, MeResponse, SyncProgressPayload } from './apiService';
import { STATS_KEY, CUSTOM_SCENES_KEY, HIGH_SCORES_KEY, PENDING_SYNC_KEY } from './storageKeys';

/**
 * Decodes legacy HTML-escaped values. Older builds stored userName/userHandle
 * pre-escaped (O'Brien → O&#039;Brien), which then compounded on every save.
 * Names are now stored raw and escaped only at render time.
 */
function unescapeHtml(value: string): string {
  if (!value) return value;
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&amp;/g, '&');
}

export class StorageService {
  private stats: UserStats;
  private customScenes: Scene[];
  private serverScenes: Scene[] = [];
  private highScores: Record<string, HighScoreRecord[]>; // sceneId -> HighScoreRecord[]
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isSyncing = false;

  constructor() {
    this.stats = this.loadStats();
    this.customScenes = this.loadCustomScenes();
    this.highScores = this.loadHighScores();
    this.checkAndUpdateStreak();

    // Listen to network reconnection to flush offline progress
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.flushPendingSync().catch(() => {});
      });
    }
  }

  private loadStats(): UserStats {
    const defaults: UserStats = {
      xp: 0,
      level: 1,
      streak: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      completedScenes: [],
      totalWordsTyped: 0,
      correctWordsTyped: 0,
      wpmHistory: [],
      savedWords: [],
      userName: 'Foydalanuvchi',
      userHandle: '@til_organuvchi',
      lastPositions: {}
    };

    try {
      const data = localStorage.getItem(STATS_KEY);
      if (data) {
        const parsed = JSON.parse(data) as Partial<UserStats>;
        // Normalize legacy/partial records so missing fields can never crash
        const merged: UserStats = {
          ...defaults,
          ...parsed,
          completedScenes: Array.isArray(parsed.completedScenes) ? parsed.completedScenes : [],
          wpmHistory: Array.isArray(parsed.wpmHistory) ? parsed.wpmHistory : [],
          savedWords: Array.isArray(parsed.savedWords) ? parsed.savedWords : [],
          lastPositions: parsed.lastPositions && typeof parsed.lastPositions === 'object' && !Array.isArray(parsed.lastPositions)
            ? parsed.lastPositions
            : {},
          userName: parsed.userName ? unescapeHtml(parsed.userName) : defaults.userName,
          userHandle: parsed.userHandle ? unescapeHtml(parsed.userHandle) : defaults.userHandle
        };
        return merged;
      }
    } catch {
      // Fallback
    }

    return defaults;
  }

  private loadCustomScenes(): Scene[] {
    try {
      const data = localStorage.getItem(CUSTOM_SCENES_KEY);
      if (data) {
        const parsed: Scene[] = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // Fallback
    }
    return [];
  }

  private loadHighScores(): Record<string, HighScoreRecord[]> {
    try {
      const data = localStorage.getItem(HIGH_SCORES_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Fallback
    }
    return {};
  }

  private saveHighScores(): void {
    try {
      localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(this.highScores));
    } catch {
      // Ignore
    }
  }

  /**
   * Returns TOP 3 scores for a given scene, strictly ordered:
   * 1. Higher accuracy (100% first)
   * 2. Higher WPM (faster typing)
   * 3. Lower timeSpentSeconds (completed in less time)
   */
  public getSceneHighScores(sceneId: string): HighScoreRecord[] {
    const list = this.highScores[sceneId] || [];
    return [...list]
      .sort((a, b) => {
        if (b.accuracy !== a.accuracy) {
          return b.accuracy - a.accuracy;
        }
        if (b.wpm !== a.wpm) {
          return b.wpm - a.wpm;
        }
        return a.timeSpentSeconds - b.timeSpentSeconds;
      })
      .slice(0, 3);
  }

  /**
   * Records a user's completion score for a scene.
   * Updates user's personal best if already exists, or inserts new entry.
   * Returns whether the record made it into TOP 3.
   */
  public recordSceneCompletionScore(
    sceneId: string,
    accuracy: number,
    wpm: number,
    timeSpentSeconds: number
  ): { isNewTopScore: boolean; rank: number; scores: HighScoreRecord[] } {
    if (!this.highScores[sceneId]) {
      this.highScores[sceneId] = [];
    }

    const currentUserName = this.stats.userName || 'Foydalanuvchi';
    const currentUserHandle = this.stats.userHandle || '@til_organuvchi';
    const compositeScore = Math.round((accuracy * 100) + (wpm * 10) - Math.min(timeSpentSeconds * 0.5, 300));

    // Check if current user already has a record on this scene
    const existingIndex = this.highScores[sceneId].findIndex(
      r => r.userHandle.toLowerCase() === currentUserHandle.toLowerCase() ||
           (r.userName.toLowerCase() === currentUserName.toLowerCase() && r.userHandle === currentUserHandle)
    );

    const newRecord: HighScoreRecord = {
      id: `hs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sceneId,
      userName: currentUserName,
      userHandle: currentUserHandle,
      accuracy,
      wpm,
      timeSpentSeconds: Math.max(1, Math.round(timeSpentSeconds)),
      score: compositeScore,
      completedAt: Date.now()
    };

    if (existingIndex >= 0) {
      const existing = this.highScores[sceneId][existingIndex];
      // Update if current attempt has better accuracy, or same accuracy and higher WPM
      const isBetter = accuracy > existing.accuracy ||
        (accuracy === existing.accuracy && wpm > existing.wpm) ||
        (accuracy === existing.accuracy && wpm === existing.wpm && timeSpentSeconds < existing.timeSpentSeconds);

      if (isBetter) {
        this.highScores[sceneId][existingIndex] = newRecord;
      }
    } else {
      this.highScores[sceneId].push(newRecord);
    }

    // Re-sort all records for this scene
    this.highScores[sceneId].sort((a, b) => {
      if (b.accuracy !== a.accuracy) {
        return b.accuracy - a.accuracy;
      }
      if (b.wpm !== a.wpm) {
        return b.wpm - a.wpm;
      }
      return a.timeSpentSeconds - b.timeSpentSeconds;
    });

    // Keep top 10 in storage per scene
    if (this.highScores[sceneId].length > 10) {
      this.highScores[sceneId] = this.highScores[sceneId].slice(0, 10);
    }

    this.saveHighScores();

    // Check rank of the user's BEST record for this scene (not just this
    // attempt — when the previous best already stands, its rank is reported).
    const bestIndex = this.highScores[sceneId].findIndex(r =>
      r.userHandle.toLowerCase() === currentUserHandle.toLowerCase()
    );
    const rank = bestIndex >= 0 ? bestIndex + 1 : 999;
    const top3 = this.getSceneHighScores(sceneId);

    // Push scene completion to cloud
    apiService.syncProgress({
      completedScene: {
        sceneId,
        accuracy,
        wpm
      }
    }).catch(() => {});

    return {
      isNewTopScore: rank <= 3,
      rank,
      scores: top3
    };
  }

  /**
   * Generates a portable shareable challenge link for a scene
   */
  public generateChallengeLink(payload: ChallengePayload): string {
    const origin = window.location.origin;
    const path = window.location.pathname.replace(/\/+$/, '') || '';
    const params = new URLSearchParams();
    params.set('scene', payload.sceneId);
    params.set('challenge', '1');
    params.set('acc', payload.accuracy.toString());
    params.set('wpm', payload.wpm.toString());
    params.set('from', encodeURIComponent(payload.creatorName));
    if (payload.creatorHandle) {
      params.set('h', encodeURIComponent(payload.creatorHandle));
    }
    return `${origin}${path}/practice?${params.toString()}`;
  }

  /**
   * Parses challenge data from URL search parameters if present
   */
  public parseChallengePayload(searchParams: URLSearchParams): ChallengePayload | null {
    const isChallenge = searchParams.get('challenge') === '1';
    const sceneId = searchParams.get('scene');
    if (!isChallenge || !sceneId) return null;

    const acc = parseInt(searchParams.get('acc') || '0', 10);
    const wpm = parseInt(searchParams.get('wpm') || '0', 10);
    const creatorName = decodeURIComponent(searchParams.get('from') || 'Do‘stingiz');
    const creatorHandle = searchParams.get('h') ? decodeURIComponent(searchParams.get('h')!) : undefined;

    return {
      sceneId,
      creatorName,
      creatorHandle,
      accuracy: isNaN(acc) ? 100 : acc,
      wpm: isNaN(wpm) ? 40 : wpm
    };
  }



  public getStats(): UserStats {
    return { ...this.stats };
  }

  public updateProfile(name: string, handle: string): void {
    const rawName = name.trim() || 'Foydalanuvchi';
    // Store RAW text; every render site escapes via escapeHtml(). Pre-escaping
    // here caused double-escaped names (O&#039;Brien) that compounded on save.
    this.stats.userName = rawName;
    const trimmedHandle = handle.trim();
    const rawHandle = trimmedHandle ? (trimmedHandle.startsWith('@') ? trimmedHandle : `@${trimmedHandle}`) : '@til_organuvchi';
    this.stats.userHandle = rawHandle;
    this.saveStats();
  }

  public resetForGuest(): void {
    this.stats = {
      xp: 0,
      streak: 1,
      level: 1,
      totalWordsTyped: 0,
      correctWordsTyped: 0,
      wpmHistory: [],
      completedScenes: [],
      savedWords: [],
      lastActiveDate: new Date().toISOString().split('T')[0],
      userName: 'Mehmon',
      userHandle: '@mehmon',
      lastPositions: {}
    };
    this.saveStats();
  }

  public saveStats(): void {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(this.stats));
    } catch {
      // Ignore
    }
  }

  public getAllScenes(): Scene[] {
    const existingIds = new Set<string>();
    const result: Scene[] = [];

    // 1. Hardcoded initial scenes
    for (const s of INITIAL_SCENES) {
      existingIds.add(s.id);
      result.push(s);
    }

    // 2. Server scenes (override initial if same id, or add as new)
    for (const s of this.serverScenes) {
      const existingIdx = result.findIndex(existing => existing.id === s.id);
      if (existingIdx >= 0) {
        result[existingIdx] = s;
      } else {
        existingIds.add(s.id);
        result.push(s);
      }
    }

    // 3. User-created local custom scenes (only if not already provided by server/initial)
    for (const s of this.customScenes) {
      if (!existingIds.has(s.id)) {
        existingIds.add(s.id);
        result.push(s);
      }
    }

    return result;
  }

  public saveCustomScene(scene: Scene): void {
    this.customScenes.push(scene);
    try {
      localStorage.setItem(CUSTOM_SCENES_KEY, JSON.stringify(this.customScenes));
    } catch {
      // Ignore
    }
  }

  public setServerScenes(scenes: Scene[]): void {
    this.serverScenes = Array.isArray(scenes) ? scenes : [];
  }

  public mergeServerScenes(scenes: Scene[]): void {
    this.setServerScenes(scenes);
  }

  public deleteCustomScene(sceneId: string): void {
    this.customScenes = this.customScenes.filter(s => s.id !== sceneId);
    try {
      localStorage.setItem(CUSTOM_SCENES_KEY, JSON.stringify(this.customScenes));
    } catch {
      // Ignore
    }
  }

  public addXP(amount: number): { leveledUp: boolean; newLevel: number } {
    const oldLevel = this.stats.level;
    this.stats.xp += amount;

    // Single source of truth for leveling (shared with Profile/ProfileModal UI)
    const { level } = getLevelProgress(this.stats.xp);
    this.stats.level = level;
    this.saveStats();

    // Trigger debounced cloud synchronization
    this.scheduleCloudSync();

    return {
      leveledUp: level > oldLevel,
      newLevel: level
    };
  }

  /**
   * Remembers the furthest replica reached in a scene so practice can resume
   * where the user left off (persisted locally and synced to the cloud).
   */
  public updateLastPosition(sceneId: string, sentenceIndex: number): void {
    if (!this.stats.lastPositions) {
      this.stats.lastPositions = {};
    }
    const current = this.stats.lastPositions[sceneId];
    if (current !== sentenceIndex) {
      this.stats.lastPositions[sceneId] = sentenceIndex;
      this.saveStats();
      this.scheduleCloudSync();
    }
  }

  public getLastPosition(sceneId: string): number | undefined {
    return this.stats.lastPositions?.[sceneId];
  }

  public recordSentenceCompleted(sceneId: string, wordsCount: number, accuracy: number, wpm: number): void {
    this.stats.totalWordsTyped += wordsCount;
    this.stats.correctWordsTyped += Math.round((wordsCount * accuracy) / 100);
    if (wpm > 0) {
      this.stats.wpmHistory.push(wpm);
      if (this.stats.wpmHistory.length > 20) {
        this.stats.wpmHistory.shift();
      }
    }

    if (!this.stats.completedScenes.includes(sceneId)) {
      this.stats.completedScenes.push(sceneId);
    }
    this.saveStats();

    // Trigger debounced cloud synchronization
    this.scheduleCloudSync();
  }

  public saveWord(word: SavedWord): boolean {
    const exists = this.stats.savedWords.some(w => w.word.toLowerCase() === word.word.toLowerCase());
    if (!exists) {
      this.stats.savedWords.unshift(word);
      this.saveStats();

      // Send to server in background
      apiService.saveWord(word.word, word.translation, word.movieName).catch(() => {});
      return true;
    }
    return false;
  }

  public removeSavedWord(wordId: string): void {
    const target = this.stats.savedWords.find(w => w.id === wordId);
    this.stats.savedWords = this.stats.savedWords.filter(w => w.id !== wordId);
    this.saveStats();

    // Delete from server in background
    if (target) {
      apiService.deleteWord(target.word).catch(() => {});
    }
  }

  public isWordSaved(wordText: string): boolean {
    return this.stats.savedWords.some(w => w.word.toLowerCase() === wordText.toLowerCase());
  }

  /**
   * Merges server-side progress and dictionary into local state.
   * Resolves conflicts by preserving highest level/XP and union of completed scenes/words.
   */
  public syncWithServer(serverData: MeResponse): void {
    if (!serverData || !serverData.user) return;

    const sUser = serverData.user;
    const localXP = this.stats.xp;
    const localStreak = this.stats.streak;
    const localLevel = this.stats.level;

    // 1. Keep highest progress metrics
    this.stats.xp = Math.max(localXP, sUser.xp || 0);
    this.stats.streak = Math.max(localStreak, sUser.streak || 1);
    this.stats.level = Math.max(localLevel, sUser.level || 1);

    if (sUser.full_name) {
      // Store raw; render sites escape. (Previously escaped here → double-escape.)
      this.stats.userName = sUser.full_name;
    }
    if (sUser.username) {
      this.stats.userHandle = `@${sUser.username}`;
    }

    // 2. Merge completed scenes
    const serverSceneIds: string[] = serverData.completedSceneIds ||
      (Array.isArray(serverData.completedScenes) ? serverData.completedScenes.map((s) => s.scene_id) : []);

    const mergedScenes = Array.from(new Set([...this.stats.completedScenes, ...serverSceneIds]));
    this.stats.completedScenes = mergedScenes;
    const hasNewLocalScenes = mergedScenes.length > serverSceneIds.length;

    // 2.1 Merge last-viewed replica positions: local value wins when present
    // (it reflects the most recent activity), server fills in missing scenes.
    const serverPositions = serverData.lastPositions;
    if (serverPositions && typeof serverPositions === 'object' && !Array.isArray(serverPositions)) {
      if (!this.stats.lastPositions) {
        this.stats.lastPositions = {};
      }
      for (const [sceneId, idx] of Object.entries(serverPositions)) {
        if (this.stats.lastPositions[sceneId] === undefined) {
          this.stats.lastPositions[sceneId] = Math.max(0, Math.floor(Number(idx)) || 0);
        }
      }
    }

    // 3. Merge saved words
    const localWordsMap = new Map<string, SavedWord>();
    this.stats.savedWords.forEach(w => localWordsMap.set(w.word.toLowerCase().trim(), w));

    if (Array.isArray(serverData.savedWords)) {
      serverData.savedWords.forEach(sw => {
        const key = sw.word.toLowerCase().trim();
        if (!localWordsMap.has(key)) {
          localWordsMap.set(key, {
            id: `sw_${sw.id || Date.now()}_${sw.word}`,
            word: sw.word,
            translation: sw.translation || '',
            contextSentence: '',
            movieName: sw.scene_title || '',
            addedAt: Date.now(),
          });
        }
      });
    }
    this.stats.savedWords = Array.from(localWordsMap.values());
    const hasNewLocalWords = this.stats.savedWords.length > (serverData.savedWords?.length || 0);

    this.saveStats();

    // 4. If local state had newer XP, scenes, or words that server didn't have, push them to server
    const needsPushToServer = (localXP > (sUser.xp || 0)) ||
      hasNewLocalScenes ||
      hasNewLocalWords;

    if (needsPushToServer) {
      this.scheduleCloudSync();
    }
  }

  /**
   * Debounced background sync to cloud
   */
  public scheduleCloudSync(): void {
    if (typeof window === 'undefined') return;
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(() => {
      this.syncToCloud().catch(() => {});
    }, 1200);
  }

  /**
   * Sends current user progress and vocabulary to backend & cloud
   */
  public async syncToCloud(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      const payload = {
        xp: this.stats.xp,
        streak: this.stats.streak,
        level: this.stats.level,
        lastActiveDate: this.stats.lastActiveDate,
        completedScenes: this.stats.completedScenes,
        lastPositions: this.stats.lastPositions || {},
        savedWords: this.stats.savedWords.map(sw => ({
          word: sw.word,
          translation: sw.translation,
          sceneTitle: sw.movieName
        }))
      };

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.savePendingSync(payload);
        return;
      }

      await apiService.syncProgress(payload);
      this.clearPendingSync();
    } catch {
      // If network fails, queue into pending sync
      this.savePendingSync({
        xp: this.stats.xp,
        streak: this.stats.streak,
        level: this.stats.level,
        lastActiveDate: this.stats.lastActiveDate,
        completedScenes: this.stats.completedScenes
      });
    } finally {
      this.isSyncing = false;
    }
  }

  private savePendingSync(payload: SyncProgressPayload): void {
    try {
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(payload));
    } catch {}
  }

  private clearPendingSync(): void {
    try {
      localStorage.removeItem(PENDING_SYNC_KEY);
    } catch {}
  }

  private async flushPendingSync(): Promise<void> {
    try {
      const raw = localStorage.getItem(PENDING_SYNC_KEY);
      if (!raw) return;
      const payload = JSON.parse(raw) as SyncProgressPayload;
      if (payload) {
        await apiService.syncProgress(payload);
        this.clearPendingSync();
      }
    } catch {}
  }

  private checkAndUpdateStreak(): void {
    const today = new Date().toISOString().split('T')[0];
    if (this.stats.lastActiveDate === today) {
      return;
    }

    const lastDate = new Date(this.stats.lastActiveDate);
    const currentDate = new Date(today);

    // Handle future dates: if lastActiveDate is in the future, don't increment streak
    if (lastDate > currentDate) {
      this.stats.lastActiveDate = today;
      this.saveStats();
      return;
    }

    const diffTime = currentDate.getTime() - lastDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      this.stats.streak += 1;
    } else if (diffDays > 1) {
      this.stats.streak = 1;
    }

    this.stats.lastActiveDate = today;
    this.saveStats();
  }
}

export const storageService = new StorageService();
