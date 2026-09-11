// server/index.ts dagi User endpoint'lari (/api/user/sync, /api/user/words,
// /api/leaderboard) shu faylga ko'chirildi. Route'lar to'liq yo'l bilan
// berilgan — index.ts da PREFIXSIZ ulanadi: app.use(userRoutes);
// Middleware tartibi kanonik index.ts bilan AYNAN bir xil:
//   sync → requireAuth, requireCsrf | words → requireAuth, requireCsrf | leaderboard → (public)

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../auth';
import {
  updateUserStats,
  saveUserWord,
  deleteUserWord,
  getUserSavedWords,
  getUserCompletedScenes,
  recordUserCompletedScene,
  findUserById,
  getGlobalLeaderboard,
  invalidateAdminStatsCache,
} from '../db';
import { safeValidate } from '../../src/utils/validation';
import { requireCsrf } from '../middleware/csrf';

// --- Server-side Zod schemas (anti-cheat / injection guards) ---
const accuracySchema = z.coerce.number().int().min(0).max(100);
const wpmSchema = z.coerce.number().int().min(0).max(300);
const wordSchema = z.string().trim().min(1).max(100);
const translationSchema = z.string().trim().max(500).optional().default('');
const sceneTitleSchema = z.string().trim().max(200).optional().default('');
const sceneIdSchema = z.string().trim().min(1).max(120);

const savedWordInputSchema = z.object({
  word: wordSchema,
  translation: translationSchema,
  sceneTitle: sceneTitleSchema,
});

const userSyncSchema = z.object({
  xp: z.coerce.number().int().min(0).max(1000000).optional(),
  streak: z.coerce.number().int().min(1).max(3650).optional(),
  level: z.coerce.number().int().min(1).max(100).optional(),
  lastActiveDate: z.string().trim().max(20).optional(),
  savedWords: z.array(savedWordInputSchema).max(100).optional().default([]),
  completedScene: z.object({
    sceneId: sceneIdSchema,
    accuracy: accuracySchema.optional().default(100),
    wpm: wpmSchema.optional().default(0),
  }).optional(),
  completedScenes: z.array(sceneIdSchema).max(50).optional().default([]),
  lastPositions: z.record(z.string().max(120), z.coerce.number().int().min(0).max(1000000)).optional(),
}).passthrough();

const userWordsSchema = z.object({
  action: z.enum(['save', 'delete']).optional().default('save'),
  word: wordSchema,
  translation: translationSchema,
  sceneTitle: sceneTitleSchema,
}).passthrough();

// --- XP anti-cheat: client xp hech qachon ishonilmaydi ---
const XP_MAX = 1000000;
const MAX_REWARD_PER_SYNC = 50;
function xpRewardForScene(accuracy: number, wpm: number): number {
  const a = Math.max(0, Math.min(100, Math.floor(accuracy)));
  const w = Math.max(0, Math.min(300, Math.floor(wpm)));
  const reward = 10 + Math.round(a * 0.3) + Math.min(10, Math.floor(w / 30));
  return Math.max(0, Math.min(MAX_REWARD_PER_SYNC, reward));
}
function levelForXp(xp: number): number {
  return Math.max(1, Math.min(100, Math.floor(xp / 500) + 1));
}

function sanitizeUser(user: any) {
  const { password_hash, ...safe } = user;
  return safe;
}

function sanitizeLastPositions(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const clean: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const idx = Math.max(0, Math.floor(Number(value)));
    if (key && Number.isFinite(idx) && Object.keys(clean).length < 200) {
      clean[key.slice(0, 120)] = idx;
    }
  }
  return Object.keys(clean).length > 0 ? JSON.stringify(clean) : undefined;
}

// 4. Sync Progress
const syncHandler = (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const validation = safeValidate(userSyncSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { streak, lastActiveDate, savedWords, completedScene, completedScenes, lastPositions: lastPositionsRaw } = validation.data as any;

    let rewardTotal = 0;
    const existingScenes = new Set(getUserCompletedScenes(user.id).map((s) => s.scene_id));

    let singleAccuracy = 100;
    let singleWpm = 0;
    let singleSceneId: string | null = null;
    if (completedScene && completedScene.sceneId) {
      singleSceneId = String(completedScene.sceneId).trim().slice(0, 120);
      singleAccuracy = Math.max(0, Math.min(100, Math.floor(Number(completedScene.accuracy) || 0)));
      singleWpm = Math.max(0, Math.min(300, Math.floor(Number(completedScene.wpm) || 0)));
      if (singleSceneId) {
        const isNew = !existingScenes.has(singleSceneId);
        recordUserCompletedScene(user.id, singleSceneId, singleAccuracy, singleWpm);
        if (isNew) {
          rewardTotal += xpRewardForScene(singleAccuracy, singleWpm);
          existingScenes.add(singleSceneId);
        }
      }
    }

    if (Array.isArray(completedScenes) && completedScenes.length > 0) {
      for (const rawId of completedScenes.slice(0, 50)) {
        const cleanId = String(rawId || '').trim().slice(0, 120);
        if (cleanId && !existingScenes.has(cleanId)) {
          recordUserCompletedScene(user.id, cleanId, 100, 0);
          existingScenes.add(cleanId);
          rewardTotal += 10;
        }
        if (rewardTotal >= MAX_REWARD_PER_SYNC) break;
      }
    }
    rewardTotal = Math.max(0, Math.min(MAX_REWARD_PER_SYNC, rewardTotal));
    const newXp = Math.max(0, Math.min(XP_MAX, user.xp + rewardTotal));
    const newLevel = levelForXp(newXp);
    const parsedStreak = Number(streak);
    const newStreak = streak !== undefined && Number.isFinite(parsedStreak)
      ? Math.max(1, Math.min(3650, Math.floor(parsedStreak)))
      : user.streak;
    const cleanDate = typeof lastActiveDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(lastActiveDate)
      ? lastActiveDate
      : new Date().toISOString().split('T')[0];

    updateUserStats(user.id, {
      xp: newXp,
      streak: newStreak,
      level: newLevel,
      last_active_date: cleanDate,
      last_positions: sanitizeLastPositions(lastPositionsRaw),
    });

    if (Array.isArray(savedWords)) {
      savedWords.forEach((item: any) => {
        if (item && item.word) {
          saveUserWord(user.id, item.word, item.translation, item.sceneTitle);
        }
      });
    }

    invalidateAdminStatsCache();

    const updatedUser = findUserById(user.id)!;
    const allCompleted = getUserCompletedScenes(user.id);
    const completedSceneIds = Array.from(new Set(allCompleted.map((s) => s.scene_id)));

    let lastPositions: Record<string, number> = {};
    try {
      if (updatedUser.last_positions) {
        lastPositions = JSON.parse(updatedUser.last_positions);
      }
    } catch {}

    res.json({
      success: true,
      user: sanitizeUser(updatedUser),
      savedWords: getUserSavedWords(user.id),
      completedScenes: allCompleted,
      completedSceneIds,
      lastPositions,
    });
  } catch (err: any) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Sinxronlashda xatolik yuz berdi' });
  }
};

// 5. Save / Remove Word
const wordsHandler = (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const validation = safeValidate(userWordsSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: validation.error });
    return;
  }
  const { action, word, translation, sceneTitle } = validation.data as any;

  if (action === 'delete') {
    deleteUserWord(user.id, word);
  } else {
    saveUserWord(user.id, word, translation, sceneTitle);
  }

  invalidateAdminStatsCache();
  res.json({ success: true, savedWords: getUserSavedWords(user.id) });
};

// 6. Global Leaderboard
const leaderboardHandler = (_req: Request, res: Response) => {
  const topUsers = getGlobalLeaderboard(20);
  res.json({ leaderboard: topUsers });
};

export const userRoutes = Router();

userRoutes.post('/api/user/sync', requireAuth, requireCsrf, syncHandler);
userRoutes.post('/api/user/words', requireAuth, requireCsrf, wordsHandler);
userRoutes.get('/api/leaderboard', leaderboardHandler);
