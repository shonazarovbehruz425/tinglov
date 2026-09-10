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

  CREATE TABLE IF NOT EXISTS admin_scenes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    video_url TEXT NOT NULL,
    poster_url TEXT,
    dialogues_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp DESC);
  CREATE INDEX IF NOT EXISTS idx_saved_words_user ON saved_words(user_id);
  CREATE INDEX IF NOT EXISTS idx_completed_scenes_user ON completed_scenes(user_id);
  CREATE INDEX IF NOT EXISTS idx_admin_scenes_created ON admin_scenes(created_at DESC);
`);

// Safe migrations for auth_provider, uuid and last_positions
try {
  db.exec(`ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'email';`);
} catch {}
try {
  db.exec(`ALTER TABLE users ADD COLUMN uuid TEXT;`);
} catch {}
try {
  db.exec(`ALTER TABLE users ADD COLUMN last_positions TEXT;`);
} catch {}

export interface DbUser {
  id: number;
  uuid?: string | null;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  avatar_color: string;
  xp: number;
  streak: number;
  level: number;
  last_active_date: string | null;
  auth_provider?: 'google' | 'email';
  last_positions?: string | null;
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
  auth_provider?: 'google' | 'email';
  uuid?: string | null;
}): DbUser {
  const color = params.avatar_color || '#A3E635';
  const provider = params.auth_provider || 'email';
  const stmt = db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, avatar_color, xp, streak, level, last_active_date, auth_provider, uuid)
    VALUES (?, ?, ?, ?, ?, 0, 1, 1, date('now'), ?, ?)
  `);
  const result = stmt.run(
    params.username.trim().toLowerCase(),
    params.email.trim().toLowerCase(),
    params.password_hash,
    params.full_name.trim(),
    color,
    provider,
    params.uuid || null
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
  last_positions?: string;
}): void {
  const current = findUserById(userId);
  if (!current) return;

  const xp = stats.xp !== undefined ? stats.xp : current.xp;
  const streak = stats.streak !== undefined ? stats.streak : current.streak;
  const level = stats.level !== undefined ? stats.level : current.level;
  const lastActive = stats.last_active_date || current.last_active_date;
  const fullName = stats.full_name || current.full_name;
  const avatarColor = stats.avatar_color || current.avatar_color;
  const lastPositions = stats.last_positions !== undefined ? stats.last_positions : current.last_positions;

  const stmt = db.prepare(`
    UPDATE users
    SET xp = ?, streak = ?, level = ?, last_active_date = ?, full_name = ?, avatar_color = ?, last_positions = ?
    WHERE id = ?
  `);
  stmt.run(xp, streak, level, lastActive, fullName, avatarColor, lastPositions, userId);
}

/**
 * Updates OAuth metadata for an existing user (provider, Supabase uuid and
 * placeholder email). Used by /api/auth/session after the caller's identity
 * has been verified against Supabase.
 */
export function updateUserAuthMeta(id: number, meta: { auth_provider?: string; uuid?: string | null; email?: string }): void {
  const current = findUserById(id);
  if (!current) return;
  const provider = (meta.auth_provider === 'google' ? 'google' : 'email') as 'google' | 'email';
  const uuid = meta.uuid || current.uuid || null;
  const emailIsPlaceholder = !current.email
    || current.email.endsWith('@user.tinglov')
    || current.email.endsWith('@tinglov.uz');
  let email = current.email;
  if (meta.email && emailIsPlaceholder && meta.email !== current.email) {
    email = meta.email;
  }
  try {
    db.prepare(`UPDATE users SET auth_provider = ?, uuid = ?, email = ? WHERE id = ?`).run(provider, uuid, email, id);
  } catch {
    // Email UNIQUE conflict (another account already owns it) — keep current email
  }
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

export interface DbAdminScene {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  video_url: string;
  poster_url: string | null;
  dialogues_json: string;
  created_at: string;
}

export function getAllUsers(search?: string): Array<Omit<DbUser, 'password_hash'>> {
  if (search && search.trim()) {
    const term = `%${search.trim().toLowerCase()}%`;
    const stmt = db.prepare(`
      SELECT id, uuid, username, email, full_name, avatar_color, xp, streak, level, last_active_date, auth_provider, created_at
      FROM users
      WHERE username LIKE ? OR email LIKE ? OR full_name LIKE ?
      ORDER BY id DESC
    `);
    return stmt.all(term, term, term) as Array<Omit<DbUser, 'password_hash'>>;
  }
  const stmt = db.prepare(`
    SELECT id, uuid, username, email, full_name, avatar_color, xp, streak, level, last_active_date, auth_provider, created_at
    FROM users
    ORDER BY id DESC
  `);
  return stmt.all() as Array<Omit<DbUser, 'password_hash'>>;
}

export function deleteUserById(id: number): boolean {
  const stmt = db.prepare(`DELETE FROM users WHERE id = ?`);
  const result = stmt.run(id);
  return Number(result.changes) > 0;
}

export function updateUserStatsAdmin(id: number, updates: { xp?: number; streak?: number; level?: number }): void {
  const current = findUserById(id);
  if (!current) return;
  const xp = updates.xp !== undefined ? updates.xp : current.xp;
  const streak = updates.streak !== undefined ? updates.streak : current.streak;
  const level = updates.level !== undefined ? updates.level : current.level;
  const stmt = db.prepare(`UPDATE users SET xp = ?, streak = ?, level = ? WHERE id = ?`);
  stmt.run(xp, streak, level, id);
}

export function getAdminStats(): {
  totalUsers: number;
  usersToday: number;
  totalSavedWords: number;
  totalCompletedScenes: number;
  totalCustomScenes: number;
} {
  const totalUsersRow = db.prepare(`SELECT COUNT(*) as count FROM users`).get() as { count: number };
  const usersTodayRow = db.prepare(`SELECT COUNT(*) as count FROM users WHERE date(created_at) = date('now')`).get() as { count: number };
  const savedWordsRow = db.prepare(`SELECT COUNT(*) as count FROM saved_words`).get() as { count: number };
  const completedScenesRow = db.prepare(`SELECT COUNT(*) as count FROM completed_scenes`).get() as { count: number };
  const customScenesRow = db.prepare(`SELECT COUNT(*) as count FROM admin_scenes`).get() as { count: number };

  return {
    totalUsers: totalUsersRow?.count || 0,
    usersToday: usersTodayRow?.count || 0,
    totalSavedWords: savedWordsRow?.count || 0,
    totalCompletedScenes: completedScenesRow?.count || 0,
    totalCustomScenes: customScenesRow?.count || 0,
  };
}

export function getAllAdminScenes(): DbAdminScene[] {
  const stmt = db.prepare(`SELECT * FROM admin_scenes ORDER BY created_at DESC`);
  return stmt.all() as DbAdminScene[];
}

export function createAdminScene(scene: {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  video_url: string;
  poster_url?: string;
  dialogues_json: string;
}): DbAdminScene {
  const stmt = db.prepare(`
    INSERT INTO admin_scenes (id, title, category, difficulty, video_url, poster_url, dialogues_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      category = excluded.category,
      difficulty = excluded.difficulty,
      video_url = excluded.video_url,
      poster_url = excluded.poster_url,
      dialogues_json = excluded.dialogues_json
  `);
  stmt.run(
    scene.id,
    scene.title.trim(),
    scene.category.trim(),
    scene.difficulty.trim(),
    scene.video_url.trim(),
    scene.poster_url?.trim() || '',
    scene.dialogues_json
  );

  const getStmt = db.prepare(`SELECT * FROM admin_scenes WHERE id = ? LIMIT 1`);
  return getStmt.get(scene.id) as DbAdminScene;
}

export function deleteAdminScene(id: string): boolean {
  const stmt = db.prepare(`DELETE FROM admin_scenes WHERE id = ?`);
  const result = stmt.run(id);
  return Number(result.changes) > 0;
}
