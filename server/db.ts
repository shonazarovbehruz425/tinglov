import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'tinglov.db');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode for better concurrency performance
db.exec(`PRAGMA journal_mode = WAL;`);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_color TEXT DEFAULT '#A3E635',
    xp INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 1,
    level INTEGER DEFAULT 1,
    last_active_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS saved_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    word TEXT NOT NULL,
    translation TEXT,
    scene_title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, word)
  );

  CREATE TABLE IF NOT EXISTS completed_scenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    scene_id TEXT NOT NULL,
    accuracy INTEGER DEFAULT 100,
    wpm INTEGER DEFAULT 0,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp DESC);
  CREATE INDEX IF NOT EXISTS idx_saved_words_user ON saved_words(user_id);
  CREATE INDEX IF NOT EXISTS idx_completed_scenes_user ON completed_scenes(user_id);
`);

export interface DbUser {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  avatar_color: string;
  xp: number;
  streak: number;
  level: number;
  last_active_date: string | null;
  created_at: string;
}

export interface DbSavedWord {
  id: number;
  user_id: number;
  word: string;
  translation: string | null;
  scene_title: string | null;
  created_at: string;
}

export interface DbCompletedScene {
  id: number;
  user_id: number;
  scene_id: string;
  accuracy: number;
  wpm: number;
  completed_at: string;
}

export function findUserByEmail(email: string): DbUser | undefined {
  const stmt = db.prepare(`SELECT * FROM users WHERE email = ? LIMIT 1`);
  return stmt.get(email.trim().toLowerCase()) as DbUser | undefined;
}

export function findUserByUsername(username: string): DbUser | undefined {
  const stmt = db.prepare(`SELECT * FROM users WHERE username = ? LIMIT 1`);
  return stmt.get(username.trim().toLowerCase()) as DbUser | undefined;
}

export function findUserById(id: number): DbUser | undefined {
  const stmt = db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`);
  return stmt.get(id) as DbUser | undefined;
}

export function createUser(params: {
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  avatar_color?: string;
}): DbUser {
  const color = params.avatar_color || '#A3E635';
  const stmt = db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, avatar_color, xp, streak, level, last_active_date)
    VALUES (?, ?, ?, ?, ?, 0, 1, 1, date('now'))
  `);
  const result = stmt.run(
    params.username.trim().toLowerCase(),
    params.email.trim().toLowerCase(),
    params.password_hash,
    params.full_name.trim(),
    color
  );

  return findUserById(Number(result.lastInsertRowid))!;
}

export function updateUserStats(userId: number, stats: {
  xp?: number;
  streak?: number;
  level?: number;
  last_active_date?: string;
  full_name?: string;
  avatar_color?: string;
}): void {
  const current = findUserById(userId);
  if (!current) return;

  const xp = stats.xp !== undefined ? stats.xp : current.xp;
  const streak = stats.streak !== undefined ? stats.streak : current.streak;
  const level = stats.level !== undefined ? stats.level : current.level;
  const lastActive = stats.last_active_date || current.last_active_date;
  const fullName = stats.full_name || current.full_name;
  const avatarColor = stats.avatar_color || current.avatar_color;

  const stmt = db.prepare(`
    UPDATE users
    SET xp = ?, streak = ?, level = ?, last_active_date = ?, full_name = ?, avatar_color = ?
    WHERE id = ?
  `);
  stmt.run(xp, streak, level, lastActive, fullName, avatarColor, userId);
}

export function saveUserWord(userId: number, word: string, translation?: string, sceneTitle?: string): void {
  const stmt = db.prepare(`
    INSERT INTO saved_words (user_id, word, translation, scene_title)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, word) DO UPDATE SET
      translation = excluded.translation,
      scene_title = excluded.scene_title,
      created_at = CURRENT_TIMESTAMP
  `);
  stmt.run(userId, word.trim().toLowerCase(), translation || '', sceneTitle || '');
}

export function deleteUserWord(userId: number, word: string): void {
  const stmt = db.prepare(`DELETE FROM saved_words WHERE user_id = ? AND word = ?`);
  stmt.run(userId, word.trim().toLowerCase());
}

export function getUserSavedWords(userId: number): DbSavedWord[] {
  const stmt = db.prepare(`SELECT * FROM saved_words WHERE user_id = ? ORDER BY created_at DESC`);
  return stmt.all(userId) as DbSavedWord[];
}

export function recordUserCompletedScene(userId: number, sceneId: string, accuracy: number, wpm: number): void {
  const stmt = db.prepare(`
    INSERT INTO completed_scenes (user_id, scene_id, accuracy, wpm)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(userId, sceneId, accuracy, wpm);
}

export function getUserCompletedScenes(userId: number): DbCompletedScene[] {
  const stmt = db.prepare(`SELECT * FROM completed_scenes WHERE user_id = ? ORDER BY completed_at DESC`);
  return stmt.all(userId) as DbCompletedScene[];
}

export function getGlobalLeaderboard(limit = 10): Array<{
  id: number;
  username: string;
  full_name: string;
  avatar_color: string;
  xp: number;
  streak: number;
  level: number;
}> {
  const stmt = db.prepare(`
    SELECT id, username, full_name, avatar_color, xp, streak, level
    FROM users
    ORDER BY xp DESC
    LIMIT ?
  `);
  return stmt.all(limit) as Array<{
    id: number;
    username: string;
    full_name: string;
    avatar_color: string;
    xp: number;
    streak: number;
    level: number;
  }>;
}
