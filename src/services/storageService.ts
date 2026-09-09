import { UserStats, SavedWord, Scene, HighScoreRecord, ChallengePayload } from '../types';
import { INITIAL_SCENES } from '../data/scenes';

const STATS_KEY = 'lingua_movie_user_stats';
const CUSTOM_SCENES_KEY = 'lingua_movie_custom_scenes';
const HIGH_SCORES_KEY = 'lingua_movie_scene_highscores';

export class StorageService {
  private stats: UserStats;
  private customScenes: Scene[];
  private highScores: Record<string, HighScoreRecord[]>; // sceneId -> HighScoreRecord[]

  constructor() {
    this.stats = this.loadStats();
    this.customScenes = this.loadCustomScenes();
    this.highScores = this.loadHighScores();
    this.checkAndUpdateStreak();
  }

  private loadStats(): UserStats {
    try {
      const data = localStorage.getItem(STATS_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Fallback
    }

    return {
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
      userHandle: '@til_organuvchi'
    };
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

    // Check rank of current user
    const rankIndex = this.highScores[sceneId].findIndex(r => r.id === newRecord.id);
    const rank = rankIndex >= 0 ? rankIndex + 1 : 999;
    const top3 = this.getSceneHighScores(sceneId);

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
    this.stats.userName = name.trim() || 'Foydalanuvchi';
    const trimmedHandle = handle.trim();
    this.stats.userHandle = trimmedHandle ? (trimmedHandle.startsWith('@') ? trimmedHandle : `@${trimmedHandle}`) : '@til_organuvchi';
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
    return [...INITIAL_SCENES, ...this.customScenes];
  }

  public saveCustomScene(scene: Scene): void {
    this.customScenes.push(scene);
    try {
      localStorage.setItem(CUSTOM_SCENES_KEY, JSON.stringify(this.customScenes));
    } catch {
      // Ignore
    }
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
    
    // Dynamic progressive leveling:
    // Level 1: 0-49 XP, Level 2: 50 XP, Level 3: 130 XP, Level 4: 240 XP, Level 5: 380 XP...
    // Formula: level = floor(sqrt(xp / 25 + 0.25) - 0.5) + 1
    // Provides frequent rewarding level-ups in the beginning to sustain high user motivation.
    const newLevel = Math.max(1, Math.floor(Math.sqrt((this.stats.xp / 25) + 0.25) - 0.5) + 1);
    this.stats.level = newLevel;
    this.saveStats();

    return {
      leveledUp: newLevel > oldLevel,
      newLevel
    };
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
  }

  public saveWord(word: SavedWord): boolean {
    const exists = this.stats.savedWords.some(w => w.word.toLowerCase() === word.word.toLowerCase());
    if (!exists) {
      this.stats.savedWords.unshift(word);
      this.saveStats();
      return true;
    }
    return false;
  }

  public removeSavedWord(wordId: string): void {
    this.stats.savedWords = this.stats.savedWords.filter(w => w.id !== wordId);
    this.saveStats();
  }

  public isWordSaved(wordText: string): boolean {
    return this.stats.savedWords.some(w => w.word.toLowerCase() === wordText.toLowerCase());
  }

  private checkAndUpdateStreak(): void {
    const today = new Date().toISOString().split('T')[0];
    if (this.stats.lastActiveDate === today) {
      return;
    }

    const lastDate = new Date(this.stats.lastActiveDate);
    const currentDate = new Date(today);
    const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
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
