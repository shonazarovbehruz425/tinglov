// server/index.ts dagi Admin endpoint'lari shu faylga ko'chirildi. Route'lar
// to'liq yo'l bilan berilgan — index.ts da PREFIXSIZ ulanadi: app.use(adminRoutes);
// (/api/admin/* va public /api/admin/config + /api/scenes shu yerda — index.ts
//  da dublikat nusxa qoldirilmaydi.)
// ADMIN_PATH / CLOUDFLARE_R2_URL va boot-time admin credential guard ham shu
// faylda YAGONA manba — index.ts (static SPA inject + startup log) bu
// eksportlarni import qiladi.
// Middleware tartibi kanonik index.ts bilan AYNAN bir xil:
//   login → adminLoginLimiter, requireCsrf; qolgan admin route'lari → requireAdminAuth, requireCsrf

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  generateAdminToken,
  requireAdminAuth,
  type AdminRequest,
  safeEqual,
  compareAdminPassword,
} from '../auth';
import {
  getAllAdminScenes,
  getAdminStats,
  getAllUsers,
  deleteUserById,
  updateUserStatsAdmin,
  createAdminScene,
  deleteAdminScene,
  batchUpsertAdminScenes,
  invalidateAdminStatsCache,
} from '../db';
import { safeValidate } from '../../src/utils/validation';
import { createRateLimiter } from '../rateLimiter';
import { requireCsrf } from '../middleware/csrf';

function normalizeRoutePath(rawPath: string | undefined): string {
  if (!rawPath) return '/admin';
  let p = rawPath.trim();
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '');
  return p;
}

export const ADMIN_PATH = normalizeRoutePath(process.env.ADMIN_PATH || process.env.VITE_ADMIN_PATH || '/admin');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
export const CLOUDFLARE_R2_URL = (process.env.CLOUDFLARE_R2_URL || process.env.VITE_CLOUDFLARE_R2_URL || '').trim().replace(/\/+$/, '');

// Boot-time admin credential validation (no hardcoded fallbacks)
// Bu fayl import qilinganida (server boot) bajariladi — index.ts patterni bilan aynan bir xil.
if (!ADMIN_PASSWORD && !ADMIN_PASSWORD_HASH) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_PASSWORD yoki ADMIN_PASSWORD_HASH sozlanmagan');
  }
  console.warn('⚠️ ADMIN_PASSWORD yoki ADMIN_PASSWORD_HASH sozlanmagan — admin login development mode’da o‘chirilgan (fail-closed).');
}

const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// A. Public endpoint to check active admin path and R2 streaming config
const configHandler = (_req: Request, res: Response) => {
  res.json({
    adminPath: ADMIN_PATH,
    cloudflareR2Url: CLOUDFLARE_R2_URL,
  });
};

// B. Public endpoint to get all admin-created lessons for players
const scenesPublicHandler = (_req: Request, res: Response) => {
  try {
    const scenes = getAllAdminScenes();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({ scenes });
  } catch (err: any) {
    res.status(500).json({ error: 'Darslarni yuklashda xatolik yuz berdi' });
  }
};

// C. Admin Login
const adminLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: 'admin-login',
  message: 'Admin kirish urinishlari soni me‘yordan oshdi. Iltimos, 15 daqiqadan so‘ng qayta urinib ko‘ring.',
});

const adminLoginHandler = async (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: 'Login va parol kiritilishi shart' });
    return;
  }

  const trimmedUser = String(username).trim().slice(0, 100);
  const trimmedPass = String(password).trim().slice(0, 200);

  const userOk = safeEqual(trimmedUser, ADMIN_USERNAME);
  const passOk = await compareAdminPassword(trimmedPass, ADMIN_PASSWORD, ADMIN_PASSWORD_HASH);

  if (!userOk || !passOk) {
    res.status(401).json({ error: 'Noto‘g‘ri admin login yoki parol' });
    return;
  }

  const token = generateAdminToken(ADMIN_USERNAME);
  res.cookie('admin_token', token, ADMIN_COOKIE_OPTIONS);

  res.json({
    success: true,
    admin: { username: ADMIN_USERNAME, role: 'admin' },
    adminPath: ADMIN_PATH,
  });
};

// D. Admin Logout
const adminLogoutHandler = (_req: Request, res: Response) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.json({ success: true, message: 'Admin tizimidan muvaffaqiyatli chiqildi' });
};

// E. Check Admin Session
const adminCheckHandler = (req: AdminRequest, res: Response) => {
  res.json({
    authenticated: true,
    admin: req.admin,
    adminPath: ADMIN_PATH,
  });
};

// F. Admin Dashboard Stats
const adminStatsHandler = (_req: AdminRequest, res: Response) => {
  try {
    const dbStats = getAdminStats();
    const mem = process.memoryUsage();
    res.json({
      success: true,
      stats: dbStats,
      system: {
        adminPath: ADMIN_PATH,
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryRssMb: Math.round(mem.rss / 1024 / 1024),
        memoryHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        redisConfigured: Boolean(process.env.REDIS_URL),
        csrfProtection: true,
        hstsProtection: true,
        healthEndpoint: '/health',
        keepAliveActive: true,
        renderExternalUrl: process.env.RENDER_EXTERNAL_URL || null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Statistikani yuklashda xatolik yuz berdi' });
  }
};

// G. List Users
const adminUsersHandler = (req: AdminRequest, res: Response) => {
  try {
    const searchQuery = typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : undefined;
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const users = getAllUsers(searchQuery, limit, offset);
    res.json({ success: true, users, count: users.length, limit, offset });
  } catch (err: any) {
    res.status(500).json({ error: 'Foydalanuvchilarni yuklashda xatolik yuz berdi' });
  }
};

// H. Delete User
const adminDeleteUserHandler = (req: AdminRequest, res: Response) => {
  try {
    const userId = Number(req.params.id);
    if (!userId || isNaN(userId)) {
      res.status(400).json({ error: 'Yaroqsiz foydalanuvchi ID' });
      return;
    }
    const success = deleteUserById(userId);
    if (!success) {
      res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
      return;
    }
    invalidateAdminStatsCache();
    res.json({ success: true, message: 'Foydalanuvchi muvaffaqiyatli o‘chirildi' });
  } catch (err: any) {
    res.status(500).json({ error: 'Foydalanuvchini o‘chirishda xatolik yuz berdi' });
  }
};

// I. Update User Stats
const adminUpdateUserHandler = (req: AdminRequest, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const schema = z.object({
      xp: z.coerce.number().int().min(0).max(1000000).optional(),
      streak: z.coerce.number().int().min(1).max(3650).optional(),
      level: z.coerce.number().int().min(1).max(100).optional(),
    }).passthrough();
    const validation = safeValidate(schema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { xp, streak, level } = validation.data as any;
    updateUserStatsAdmin(userId, {
      xp: xp !== undefined ? Number(xp) : undefined,
      streak: streak !== undefined ? Number(streak) : undefined,
      level: level !== undefined ? Number(level) : undefined,
    });
    invalidateAdminStatsCache();
    res.json({ success: true, message: 'Foydalanuvchi ma‘lumotlari yangilandi' });
  } catch (err: any) {
    res.status(500).json({ error: 'Foydalanuvchini yangilashda xatolik yuz berdi' });
  }
};

// J. Manage Admin Scenes
const videoUrlSchema = z.string().trim().min(1, 'Video havolasi kiritilishi shart').max(2000).refine((u) => {
  return u.startsWith('https://') || u.startsWith('http://localhost') || u.startsWith('r2:');
}, {
  message: 'Video havolasi https://, r2: yoki http://localhost bo‘lishi shart',
});

const optionalHttpsUrlSchema = z.string().trim().max(2000).optional().default('').refine((u) => {
  return !u || u.startsWith('https://') || u.startsWith('http://localhost') || u.startsWith('r2:');
}, {
  message: 'Poster havolasi https URL yoki r2: bo‘lishi shart',
});

const dialogueItemSchema = z.object({
  id: z.string().optional(),
  character: z.string().trim().max(100).optional().default('Qahramon'),
  characterAvatar: z.string().optional().default('🎬'),
  startTime: z.coerce.number().min(0).optional().default(0),
  endTime: z.coerce.number().min(0).optional().default(5),
  text: z.string().trim().max(1000).optional().default(''),
  textEn: z.string().trim().max(1000).optional().default(''),
  translation: z.string().trim().max(1000).optional().default(''),
  textUz: z.string().trim().max(1000).optional().default(''),
  uzbekTranslation: z.string().trim().max(1000).optional().default(''),
}).passthrough().transform((d) => {
  const text = (d.text || d.textEn || '').trim();
  const translation = (d.translation || d.uzbekTranslation || d.textUz || '').trim();
  const start = Number(d.startTime) || 0;
  const end = Number(d.endTime) || (start + 3);
  return {
    id: d.id || `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    character: d.character || 'Qahramon',
    characterAvatar: d.characterAvatar || '🎬',
    startTime: start,
    endTime: end > start ? end : start + 3,
    text: text || '...',
    cleanText: text.replace(/[^\w\s]/g, '').toLowerCase().trim(),
    translation,
    uzbekTranslation: translation,
    textEn: text || '...',
    textUz: translation,
  };
});

const adminSceneSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, 'Dars sarlavhasi kiritilishi shart').max(200),
  category: z.string().trim().min(1, 'Kategoriya tanlanishi shart').max(50),
  difficulty: z.string().trim().min(1, 'Qiyinchilik darajasi tanlanishi shart').max(50),
  accent: z.string().optional().default('American'),
  video_url: videoUrlSchema,
  poster_url: optionalHttpsUrlSchema,
  dialogues: z.array(dialogueItemSchema).optional().default([]),
}).passthrough().transform((s) => {
  let dialogues = s.dialogues || [];
  if (dialogues.length === 0) {
    dialogues = [
      {
        id: 'line_1',
        character: 'Qahramon',
        characterAvatar: '🎬',
        startTime: 0,
        endTime: 4.5,
        text: 'Welcome to this lesson, listen carefully!',
        cleanText: 'welcome to this lesson listen carefully',
        translation: 'Ushbu darsga xush kelibsiz, diqqat bilan tinglang!',
        uzbekTranslation: 'Ushbu darsga xush kelibsiz, diqqat bilan tinglang!',
        textEn: 'Welcome to this lesson, listen carefully!',
        textUz: 'Ushbu darsga xush kelibsiz, diqqat bilan tinglang!',
      },
      {
        id: 'line_2',
        character: 'Qahramon',
        characterAvatar: '🎬',
        startTime: 4.6,
        endTime: 9.5,
        text: 'Pay attention to the dialogues and pronunciation.',
        cleanText: 'pay attention to the dialogues and pronunciation',
        translation: 'Dialoglar va talaffuzga diqqat qiling.',
        uzbekTranslation: 'Dialoglar va talaffuzga diqqat qiling.',
        textEn: 'Pay attention to the dialogues and pronunciation.',
        textUz: 'Dialoglar va talaffuzga diqqat qiling.',
      },
      {
        id: 'line_3',
        character: 'Qahramon',
        characterAvatar: '🎬',
        startTime: 9.6,
        endTime: 15.0,
        text: 'Practice typing each sentence to learn faster.',
        cleanText: 'practice typing each sentence to learn faster',
        translation: 'Tezroq o\'rganish uchun har bir gapni yozib mashq qiling.',
        uzbekTranslation: 'Tezroq o\'rganish uchun har bir gapni yozib mashq qiling.',
        textEn: 'Practice typing each sentence to learn faster.',
        textUz: 'Tezroq o\'rganish uchun har bir gapni yozib mashq qiling.',
      },
      {
        id: 'line_4',
        character: 'Qahramon',
        characterAvatar: '🎬',
        startTime: 15.1,
        endTime: 20.0,
        text: 'Great effort, keep practicing every single day!',
        cleanText: 'great effort keep practicing every single day',
        translation: 'Ajoyib harakat, har kuni shug\'ullanishda davom eting!',
        uzbekTranslation: 'Ajoyib harakat, har kuni shug\'ullanishda davom eting!',
        textEn: 'Great effort, keep practicing every single day!',
        textUz: 'Ajoyib harakat, har kuni shug\'ullanishda davom eting!',
      },
    ];
  }
  return {
    ...s,
    accent: (s.accent === 'British' ? 'British' : 'American') as 'American' | 'British',
    dialogues,
  };
});

const adminScenesListHandler = (_req: AdminRequest, res: Response) => {
  try {
    const scenes = getAllAdminScenes();
    res.json({ success: true, scenes });
  } catch (err: any) {
    res.status(500).json({ error: 'Darslarni yuklashda xatolik yuz berdi' });
  }
};

const adminScenesCreateHandler = (req: AdminRequest, res: Response) => {
  try {
    let rawBody: any = req.body || {};
    let dialogues = rawBody.dialogues;
    if (typeof dialogues === 'string') {
      try {
        dialogues = JSON.parse(dialogues);
      } catch {
        res.status(400).json({ error: 'Dialoglar formati noto‘g‘ri (JSON parse xatosi)' });
        return;
      }
    }
    const validation = safeValidate(adminSceneSchema, { ...rawBody, dialogues });
    if (!validation.success) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { title, category, difficulty, accent, video_url, poster_url, dialogues: cleanDialogues } = validation.data as any;

    const explicitId = (typeof req.params?.id === 'string' && req.params.id.trim())
      ? req.params.id.trim()
      : (typeof rawBody.id === 'string' && rawBody.id.trim() ? rawBody.id.trim() : null);
    const sceneId = explicitId
      ? explicitId.slice(0, 100)
      : `admin_scene_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const dialoguesJson = JSON.stringify(cleanDialogues);

    const created = createAdminScene({
      id: sceneId,
      title,
      category,
      difficulty,
      accent: accent || 'American',
      video_url,
      poster_url: poster_url || '',
      dialogues_json: dialoguesJson,
    });

    invalidateAdminStatsCache();
    res.json({ success: true, scene: created });
  } catch (err: any) {
    console.error('Admin create/update scene error:', err);
    res.status(500).json({ error: 'Darsni saqlashda xatolik yuz berdi' });
  }
};

const adminScenesDeleteHandler = (req: AdminRequest, res: Response) => {
  try {
    const sceneId = String(req.params.id || '').slice(0, 200);
    const deleted = deleteAdminScene(sceneId);
    if (!deleted) {
      res.status(404).json({ error: 'Dars topilmadi' });
      return;
    }
    invalidateAdminStatsCache();
    res.json({ success: true, message: 'Dars muvaffaqiyatli o‘chirildi' });
  } catch (err: any) {
    res.status(500).json({ error: 'Darsni o‘chirishda xatolik yuz berdi' });
  }
};

const adminScenesSyncHandler = (req: AdminRequest, res: Response) => {
  try {
    const rawScenes = req.body?.scenes || req.body;
    if (!Array.isArray(rawScenes)) {
      res.status(400).json({ error: 'Darslar ro‘yxati (massiv) kiritilishi shart' });
      return;
    }
    const count = batchUpsertAdminScenes(rawScenes);
    res.json({ success: true, count, message: `${count} ta dars muvaffaqiyatli sinxronlandi` });
  } catch (err: any) {
    console.error('Admin sync scenes error:', err);
    res.status(500).json({ error: 'Darslarni sinxronlashda xatolik yuz berdi' });
  }
};

const adminScenesExportHandler = (_req: AdminRequest, res: Response) => {
  try {
    const scenes = getAllAdminScenes();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tinglov-scenes-backup.json"');
    res.send(JSON.stringify(scenes, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: 'Zaxirani eksport qilishda xatolik yuz berdi' });
  }
};

const adminScenesImportHandler = (req: AdminRequest, res: Response) => {
  try {
    const rawScenes = req.body?.scenes || req.body;
    if (!Array.isArray(rawScenes)) {
      res.status(400).json({ error: 'Import qilinadigan fayl noto‘g‘ri formatda (massiv kutilgan)' });
      return;
    }
    const count = batchUpsertAdminScenes(rawScenes);
    res.json({ success: true, count, message: `${count} ta dars muvaffaqiyatli import qilindi` });
  } catch (err: any) {
    console.error('Admin import scenes error:', err);
    res.status(500).json({ error: 'Darslarni import qilishda xatolik yuz berdi' });
  }
};

export const adminRoutes = Router();

adminRoutes.get('/api/admin/config', configHandler);
adminRoutes.get('/api/scenes', scenesPublicHandler);
adminRoutes.post('/api/admin/login', adminLoginLimiter, requireCsrf, adminLoginHandler);
adminRoutes.post('/api/admin/logout', requireCsrf, adminLogoutHandler);
adminRoutes.get('/api/admin/check', requireAdminAuth, requireCsrf, adminCheckHandler);
adminRoutes.get('/api/admin/stats', requireAdminAuth, requireCsrf, adminStatsHandler);
adminRoutes.get('/api/admin/users', requireAdminAuth, requireCsrf, adminUsersHandler);
adminRoutes.delete('/api/admin/users/:id', requireAdminAuth, requireCsrf, adminDeleteUserHandler);
adminRoutes.post('/api/admin/users/:id/update', requireAdminAuth, requireCsrf, adminUpdateUserHandler);
adminRoutes.get('/api/admin/scenes', requireAdminAuth, requireCsrf, adminScenesListHandler);
adminRoutes.post('/api/admin/scenes', requireAdminAuth, requireCsrf, adminScenesCreateHandler);
adminRoutes.put('/api/admin/scenes/:id', requireAdminAuth, requireCsrf, adminScenesCreateHandler);
adminRoutes.delete('/api/admin/scenes/:id', requireAdminAuth, requireCsrf, adminScenesDeleteHandler);
adminRoutes.post('/api/admin/scenes/sync', requireAdminAuth, requireCsrf, adminScenesSyncHandler);
adminRoutes.get('/api/admin/scenes/export', requireAdminAuth, requireCsrf, adminScenesExportHandler);
adminRoutes.post('/api/admin/scenes/import', requireAdminAuth, requireCsrf, adminScenesImportHandler);

