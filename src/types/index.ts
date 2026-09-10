export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface WordInfo {
  word: string;
  translation: string;
  definition: string;
  partOfSpeech?: string;
  phonetics?: string;
}

export interface DialogueSentence {
  id: string;
  character: string;
  characterAvatar: string;
  characterColor?: string;
  startTime: number;
  endTime: number;
  text: string;
  cleanText: string; // text without punctuation for matching
  uzbekTranslation: string;
  russianTranslation?: string;
  wordDictionary: Record<string, WordInfo>;
  audioUrl?: string;
  tip?: string;
}

export interface Scene {
  id: string;
  title: string;
  movieName: string;
  coverEmoji: string;
  coverImage?: string;
  difficulty: Difficulty;
  category: 'Cartoon' | 'Cinema' | 'Anime' | 'Daily Life';
  duration: string;
  accent: 'American' | 'British' | 'Neutral';
  youtubeVideoId?: string; // YouTube video ID for embedded interactive playback
  videoUrl?: string; // primary URL (CDN / Streaming / local)
  cdnVideoUrl?: string; // fast global cloud edge CDN fallback
  streamingUrl?: string; // HLS / DASH adaptive streaming endpoint
  dialogues: DialogueSentence[];
}

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  lastActiveDate: string;
  completedScenes: string[];
  totalWordsTyped: number;
  correctWordsTyped: number;
  wpmHistory: number[];
  savedWords: SavedWord[];
  userName?: string;
  userHandle?: string;
  lastPositions?: Record<string, number>;
}

/**
 * Progress toward the next level. Must be derived from the SAME formula
 * storageService.addXP uses, otherwise the profile progress bar disagrees
 * with the real level thresholds.
 *
 * addXP formula: level = floor(sqrt(xp / 25 + 0.25) - 0.5) + 1
 * => level L starts at 25 * L * (L - 1) XP (L2=50, L3=150, L4=300, ...)
 */
export function getLevelProgress(xp: number): {
  level: number;
  levelStartXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpNeededForLevel: number;
  progressPct: number;
} {
  const safeXp = Math.max(0, Math.floor(xp) || 0);
  const level = Math.max(1, Math.floor(Math.sqrt((safeXp / 25) + 0.25) - 0.5) + 1);
  const levelStartXp = 25 * level * (level - 1);
  const nextLevelXp = 25 * (level + 1) * level;
  const xpIntoLevel = safeXp - levelStartXp;
  const xpNeededForLevel = Math.max(1, nextLevelXp - levelStartXp);
  const progressPct = Math.min(100, Math.max(5, Math.round((xpIntoLevel / xpNeededForLevel) * 100)));
  return { level, levelStartXp, nextLevelXp, xpIntoLevel, xpNeededForLevel, progressPct };
}

export interface SavedWord {
  id: string;
  word: string;
  translation: string;
  contextSentence: string;
  movieName: string;
  addedAt: number;
}

export interface DictationFeedback {
  userTokens: {
    word: string;
    isCorrect: boolean;
    expectedWord: string;
    status: 'correct' | 'incorrect' | 'missing' | 'extra';
  }[];
  isComplete: boolean;
  accuracy: number;
  errorsCount: number;
  revealedCount: number;
}

export interface HighScoreRecord {
  id: string;
  sceneId: string;
  userName: string;
  userHandle: string;
  accuracy: number;        // masalan: 100 (%)
  wpm: number;             // masalan: 65 (WPM)
  timeSpentSeconds: number;// qancha soniyada yakunlangani
  score: number;           // aniqlik va tezlik bo'yicha integrallashgan ball
  completedAt: number;     // sana timestamp
}

export interface ChallengePayload {
  sceneId: string;
  creatorName: string;
  creatorHandle?: string;
  accuracy: number;
  wpm: number;
  timeSpentSeconds?: number;
}


