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
const httpsUrlSchema = z.string().trim().min(1).max(2000).url().refine((u) => u.startsWith('https://'), {
  message: 'Video havolasi https URL bo‘lishi shart',
});
const optionalHttpsUrlSchema = z.string().trim().max(2000).optional().default('').refine((u) => !u || u.startsWith('https://') || u.startsWith('http://localhost'), {
  message: 'Poster havolasi https URL bo‘lishi shart',
});
const dialogueSchema = z.object({
  character: z.string().trim().min(1).max(50),
  textEn: z.string().trim().min(1).max(500),
  textUz: z.string().trim().min(1).max(500),
}).passthrough();
const adminSceneSchema = z.object({
  title: z.string().trim().min(2).max(100),
  category: z.string().trim().min(1).max(50),
  difficulty: z.string().trim().min(1).max(20),
  video_url: httpsUrlSchema,
  poster_url: optionalHttpsUrlSchema,
  dialogues: z.array(dialogueSchema).min(1).max(50),
}).passthrough();

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
    const { title, category, difficulty, video_url, poster_url, dialogues: cleanDialogues } = validation.data as any;

    const sceneId = randomUUID();
    const dialoguesJson = JSON.stringify(cleanDialogues);

    const created = createAdminScene({
      id: sceneId,
      title,
      category,
      difficulty,
      video_url,
      poster_url: poster_url || '',
      dialogues_json: dialoguesJson,
    });

    invalidateAdminStatsCache();
    res.json({ success: true, scene: created });
  } catch (err: any) {
    console.error('Admin create scene error:', err);
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
adminRoutes.delete('/api/admin/scenes/:id', requireAdminAuth, requireCsrf, adminScenesDeleteHandler);
