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


