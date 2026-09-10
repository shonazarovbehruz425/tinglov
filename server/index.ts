import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';

import {
  findUserByEmail,
  findUserByUsername,
  findUserById,
  createUser,
  updateUserStats,
  saveUserWord,
  deleteUserWord,
  getUserSavedWords,
  recordUserCompletedScene,
  getUserCompletedScenes,
  getGlobalLeaderboard,
  getAllUsers,
  deleteUserById,
  updateUserStatsAdmin,
  getAdminStats,
  getAllAdminScenes,
  createAdminScene,
  deleteAdminScene
} from './db';
import crypto from 'node:crypto';
import {
  hashPassword,
  comparePassword,
  generateToken,
  requireAuth,
  AuthenticatedRequest,
  generateAdminToken,
  requireAdminAuth,
  extractAdminToken,
  AdminRequest
} from './auth';
import { safeValidate, registerSchema, loginSchema } from '../src/utils/validation';
import {
  apiLimiter,
  registerLimiter,
  checkAuthRateLimit,
  recordAuthFailure,
  resetAuthFailure,
  getClientIp,
  generateCaptchaChallenge,
  verifyCaptchaSolution
} from './rateLimiter';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Security Headers (HSTS, Anti-Clickjacking, XSS Protection & Content Security Policy)
app.use((_req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; " +
    "font-src 'self' data: https://fonts.gstatic.com https://unpkg.com; " +
    "img-src 'self' data: https: blob: https://*.r2.dev https://*.r2.cloudflarestorage.com; " +
    "media-src 'self' blob: data: https://cdn.jsdelivr.net https://storage.googleapis.com https://*.r2.dev https://*.r2.cloudflarestorage.com https:; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net https://storage.googleapis.com https://*.r2.dev https://*.r2.cloudflarestorage.com https://unpkg.com https://fonts.googleapis.com https:; " +
    "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com; " +
    "frame-ancestors 'none'; " +
    "object-src 'none'; " +
    "base-uri 'self';"
  );
  next();
});

// CSRF Configuration & SameSite Cookies
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'x-csrf-token';

function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Issue CSRF cookie automatically on requests if missing
app.use((req, res, next) => {
  let csrfToken = req.cookies?.[CSRF_COOKIE_NAME];
  if (!csrfToken) {
    csrfToken = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false, // Accessible by client JS to include in X-CSRF-Token header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  next();
});

// --------------------------------------------------------------------------
// UptimeRobot & Health Check Endpoints (Zero-overhead, rate-limit exempt)
// --------------------------------------------------------------------------
const healthCheckHandler = (_req: express.Request, res: express.Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Render-KeepAlive', 'active');

  res.status(200).json({
    status: 'ok',
    service: 'tinglov',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    renderExternalUrl: process.env.RENDER_EXTERNAL_URL || null,
    message: 'Tinglov server is awake and healthy'
  });
};

// Mount before rate limiter so UptimeRobot / uptime monitors never get 429 Too Many Requests
app.get('/health', healthCheckHandler);
app.head('/health', healthCheckHandler);
app.get('/ping', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send('pong');
});
app.head('/ping', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).end();
});

// Also support /api/health and /api/ping
app.get('/api/health', healthCheckHandler);
app.head('/api/health', healthCheckHandler);
app.get('/api/ping', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send('pong');
});
app.head('/api/ping', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).end();
});

// Apply rate limiting to all /api endpoints (120 requests/minute per IP)
app.use('/api', apiLimiter);

// Endpoint to retrieve or refresh current CSRF token
app.get('/api/csrf-token', (req, res) => {
  let token = req.cookies?.[CSRF_COOKIE_NAME];
  if (!token) {
    token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  res.json({ csrfToken: token });
});

// Endpoint to generate a new CAPTCHA security challenge
app.get('/api/captcha/new', (_req, res) => {
  const challenge = generateCaptchaChallenge();
  res.json(challenge);
});

// CSRF Verification Middleware for state-changing HTTP requests
const requireCsrf = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] || req.headers['x-xsrf-token'] || req.body?._csrf;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({
      error: 'CSRF token xatosi yoki yaroqsiz. Sahifani yangilab qayta urinib ko‘ring.'
    });
    return;
  }

  next();
};

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

const AVATAR_COLORS = ['#A3E635', '#FF5B37', '#38BDF8', '#F59E0B', '#EC4899', '#8B5CF6', '#10B981'];

function sanitizeUser(user: any) {
  const { password_hash, ...safe } = user;
  return safe;
}

// --------------------------------------------------------------------------
// Auth Endpoints
// --------------------------------------------------------------------------

// 1. Register
app.post('/api/auth/register', registerLimiter, requireCsrf, async (req, res) => {
  try {
    const validation = safeValidate(registerSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { username: cleanUsername, email: cleanEmail, password, fullName: cleanName } = validation.data;

    // Check uniqueness
    if (findUserByEmail(cleanEmail)) {
      res.status(400).json({ error: 'Ushbu email bilan allaqachon ro‘yxatdan o‘tilgan' });
      return;
    }

    if (findUserByUsername(cleanUsername)) {
      res.status(400).json({ error: 'Ushbu login band, boshqasini tanlang' });
      return;
    }

    const password_hash = await hashPassword(password);
    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const user = createUser({
      username: cleanUsername,
      email: cleanEmail,
      password_hash,
      full_name: cleanName,
      avatar_color: randomColor,
      auth_provider: 'email'
    });

    const token = generateToken(user);

    // Set secure HttpOnly cookie
    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(201).json({
      message: 'Muvaffaqiyatli ro‘yxatdan o‘tdingiz!',
      token,
      user: sanitizeUser(user)
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
  }
});

// 1b. Session Sync (Sync authenticated users from Supabase or client to backend SQLite)
app.post('/api/auth/session', async (req, res) => {
  try {
    const { email, username, fullName, avatarColor, xp, streak, level } = req.body || {};
    if (!email && !username) {
      res.status(400).json({ error: 'Email yoki username talab qilinadi' });
      return;
    }

    const cleanEmail = (email || `${username}@user.tinglov`).trim().toLowerCase();
    const cleanUser = (username || email.split('@')[0]).trim().toLowerCase();
    const cleanName = (fullName || cleanUser).trim();
    const cleanColor = avatarColor || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    let user = findUserByEmail(cleanEmail) || findUserByUsername(cleanUser);

    if (!user) {
      user = createUser({
        username: cleanUser,
        email: cleanEmail,
        password_hash: 'supabase_auth_managed',
        full_name: cleanName,
        avatar_color: cleanColor
      });
    } else {
      updateUserStats(user.id, {
        full_name: cleanName || user.full_name,
        avatar_color: cleanColor || user.avatar_color,
        xp: typeof xp === 'number' ? xp : user.xp,
        streak: typeof streak === 'number' ? streak : user.streak,
        level: typeof level === 'number' ? level : user.level,
        last_active_date: new Date().toISOString().split('T')[0]
      });
      user = findUserById(user.id)!;
    }

    const token = generateToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err: any) {
    console.error('Session sync error:', err);
    res.status(500).json({ error: 'Foydalanuvchi seansini saqlashda xatolik yuz berdi' });
  }
});

// 2. Login
app.post('/api/auth/login', checkAuthRateLimit, requireCsrf, async (req, res) => {
  const ip = getClientIp(req);
  const identifier = (req.body?.identifier || '').toString().toLowerCase().trim();
  const ipKey = `auth:ip:${ip}`;
  const userKey = `auth:user:${identifier}`;

  try {
    // If CAPTCHA challenge is required due to failed attempts
    if ((req as any).requiresCaptcha) {
      const { captchaToken, captchaAnswer } = req.body;
      if (!captchaToken || captchaAnswer === undefined || !verifyCaptchaSolution(captchaToken, captchaAnswer)) {
        res.status(400).json({
          error: 'Xavfsizlik kodi (CAPTCHA) noto‘g‘ri yoki kiritilmadi. Iltimos, qaytadan yeching.',
          requiresCaptcha: true,
        });
        return;
      }
    }

    const validation = safeValidate(loginSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { identifier: cleanId, password } = validation.data;
    const user = cleanId.includes('@') ? findUserByEmail(cleanId) : findUserByUsername(cleanId);

    if (!user) {
      const ipFail = await recordAuthFailure(ipKey);
      const userFail = await recordAuthFailure(userKey);
      const maxFail = Math.max(ipFail.failures, userFail.failures);
      const maxDelay = Math.max(ipFail.delayMs, userFail.delayMs);
      if (maxDelay > 0 && maxDelay <= 8000) {
        await new Promise(r => setTimeout(r, maxDelay));
      }
      res.status(401).json({
        error: 'Bunday foydalanuvchi topilmadi yoki parol noto‘g‘ri',
        requiresCaptcha: maxFail >= 3,
        retryAfter: Math.max(ipFail.retryAfterSec, userFail.retryAfterSec),
      });
      return;
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      const ipFail = await recordAuthFailure(ipKey);
      const userFail = await recordAuthFailure(userKey);
      const maxFail = Math.max(ipFail.failures, userFail.failures);
      const maxDelay = Math.max(ipFail.delayMs, userFail.delayMs);
      if (maxDelay > 0 && maxDelay <= 8000) {
        await new Promise(r => setTimeout(r, maxDelay));
      }
      res.status(401).json({
        error: 'Bunday foydalanuvchi topilmadi yoki parol noto‘g‘ri',
        requiresCaptcha: maxFail >= 3,
        retryAfter: Math.max(ipFail.retryAfterSec, userFail.retryAfterSec),
      });
      return;
    }

    // Reset failure tracking on successful authentication
    await resetAuthFailure(ipKey);
    await resetAuthFailure(userKey);

    const token = generateToken(user);

    // Set secure HttpOnly cookie
    res.cookie('token', token, COOKIE_OPTIONS);

    res.json({
      message: 'Xush kelibsiz!',
      token,
      user: sanitizeUser(user)
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
  }
});

// 2.3. Establish / Sync session from authenticated client (issues HttpOnly cookie)
app.post('/api/auth/session', requireCsrf, async (req, res) => {
  try {
    const { email, username, fullName, avatarColor, authProvider, uuid } = req.body;
    if (!email && !username) {
      res.status(400).json({ error: 'Foydalanuvchi ma’lumotlari yetarli emas' });
      return;
    }

    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanUsername = (username || (cleanEmail ? cleanEmail.split('@')[0] : 'foydalanuvchi')).trim();
    const provider: 'google' | 'email' = authProvider === 'google' ? 'google' : 'email';

    let user = cleanEmail ? findUserByEmail(cleanEmail) : null;
    if (!user && cleanUsername) {
      user = findUserByUsername(cleanUsername);
    }

    if (!user) {
      const dummyPasswordHash = await hashPassword(crypto.randomBytes(16).toString('hex'));
      user = createUser({
        username: cleanUsername,
        email: cleanEmail || `${cleanUsername}@tinglov.uz`,
        password_hash: dummyPasswordHash,
        full_name: fullName || cleanUsername,
        avatar_color: avatarColor || AVATAR_COLORS[0],
        auth_provider: provider,
        uuid: uuid || null,
      });
    } else {
      // Update existing user with latest auth_provider and uuid
      try {
        db.prepare(`
          UPDATE users 
          SET auth_provider = ?, 
              uuid = COALESCE(?, uuid),
              email = CASE WHEN email LIKE '%@user.tinglov' OR email LIKE '%@tinglov.uz' THEN COALESCE(NULLIF(?, ''), email) ELSE email END
          WHERE id = ?
        `).run(provider, uuid || null, cleanEmail, user.id);
        user = findUserById(user.id) || user;
      } catch {}
    }

    const token = generateToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);

    res.json({
      success: true,
      message: 'Sessiya muvaffaqiyatli saqlandi (HttpOnly cookie)',
      user: sanitizeUser(user),
    });
  } catch (err: any) {
    console.error('Session sync error:', err);
    res.status(500).json({ error: 'Sessiyani saqlashda xatolik yuz berdi' });
  }
});

// 2.5. Logout (Clear HttpOnly cookie with SameSite: strict)
app.post('/api/auth/logout', requireCsrf, (_req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.json({ success: true, message: 'Muvaffaqiyatli tizimdan chiqildi' });
});

// 3. Current User Profile (/api/auth/me)
app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const savedWords = getUserSavedWords(user.id);
  const completedScenes = getUserCompletedScenes(user.id);

  res.json({
    user: sanitizeUser(user),
    savedWords,
    completedScenes
  });
});

// 4. Sync Progress
app.post('/api/user/sync', requireAuth, requireCsrf, (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { xp, streak, level, lastActiveDate, savedWords, completedScene } = req.body;

    const newXp = Math.max(user.xp, Number(xp) || 0);
    const newStreak = Math.max(user.streak, Number(streak) || 1);
    const newLevel = Math.max(user.level, Number(level) || 1);

    updateUserStats(user.id, {
      xp: newXp,
      streak: newStreak,
      level: newLevel,
      last_active_date: lastActiveDate || new Date().toISOString().split('T')[0]
    });

    // Save words if passed
    if (Array.isArray(savedWords)) {
      savedWords.forEach((item: any) => {
        if (item.word) {
          saveUserWord(user.id, item.word, item.translation, item.sceneTitle);
        }
      });
    }

    // Record completed scene if passed
    if (completedScene && completedScene.sceneId) {
      recordUserCompletedScene(
        user.id,
        completedScene.sceneId,
        Number(completedScene.accuracy) || 100,
        Number(completedScene.wpm) || 0
      );
    }

    const updatedUser = findUserById(user.id)!;
    res.json({
      success: true,
      user: sanitizeUser(updatedUser),
      savedWords: getUserSavedWords(user.id),
      completedScenes: getUserCompletedScenes(user.id)
    });
  } catch (err: any) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Sinxronlashda xatolik yuz berdi' });
  }
});

// 5. Save / Remove Word
app.post('/api/user/words', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { action, word, translation, sceneTitle } = req.body;

  if (!word) {
    res.status(400).json({ error: 'So‘z ko‘rsatilmadi' });
    return;
  }

  if (action === 'delete') {
    deleteUserWord(user.id, word);
  } else {
    saveUserWord(user.id, word, translation, sceneTitle);
  }

  res.json({ success: true, savedWords: getUserSavedWords(user.id) });
});

// 6. Global Leaderboard
app.get('/api/leaderboard', (_req, res) => {
  const topUsers = getGlobalLeaderboard(20);
  res.json({ leaderboard: topUsers });
});

// --------------------------------------------------------------------------
// Admin Panel Configuration & Endpoints
// --------------------------------------------------------------------------

function normalizeRoutePath(rawPath: string | undefined): string {
  if (!rawPath) return '/admin';
  let p = rawPath.trim();
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '');
  return p;
}

const ADMIN_PATH = normalizeRoutePath(process.env.ADMIN_PATH || process.env.VITE_ADMIN_PATH || '/admin');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'tinglov_admin_2026';
const CLOUDFLARE_R2_URL = (process.env.CLOUDFLARE_R2_URL || process.env.VITE_CLOUDFLARE_R2_URL || '').trim().replace(/\/+$/, '');

// A. Public endpoint to check active admin path and R2 streaming config
app.get('/api/admin/config', (_req, res) => {
  res.json({
    adminPath: ADMIN_PATH,
    cloudflareR2Url: CLOUDFLARE_R2_URL
  });
});

// B. Public endpoint to get all admin-created lessons for players
app.get('/api/scenes', (_req, res) => {
  try {
    const scenes = getAllAdminScenes();
    res.json({ scenes });
  } catch (err: any) {
    res.status(500).json({ error: 'Darslarni yuklashda xatolik yuz berdi' });
  }
});

// C. Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: 'Login va parol kiritilishi shart' });
    return;
  }

  const trimmedUser = String(username).trim();
  const trimmedPass = String(password).trim();

  if (trimmedUser !== ADMIN_USERNAME || trimmedPass !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Noto‘g‘ri admin login yoki parol' });
    return;
  }

  const token = generateAdminToken(ADMIN_USERNAME);
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  res.json({
    success: true,
    token,
    admin: { username: ADMIN_USERNAME, role: 'admin' },
    adminPath: ADMIN_PATH
  });
});

// D. Admin Logout
app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ success: true, message: 'Admin tizimidan muvaffaqiyatli chiqildi' });
});

// E. Check Admin Session
app.get('/api/admin/check', requireAdminAuth, (req: AdminRequest, res) => {
  const token = extractAdminToken(req);
  res.json({
    authenticated: true,
    admin: req.admin,
    adminPath: ADMIN_PATH,
    token: token || undefined
  });
});

// F. Admin Dashboard Stats
app.get('/api/admin/stats', requireAdminAuth, (_req: AdminRequest, res) => {
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
        renderExternalUrl: process.env.RENDER_EXTERNAL_URL || null
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Statistikani yuklashda xatolik yuz berdi' });
  }
});

// G. List Users (Search & Filter)
app.get('/api/admin/users', requireAdminAuth, (req: AdminRequest, res) => {
  try {
    const searchQuery = typeof req.query.search === 'string' ? req.query.search : undefined;
    const users = getAllUsers(searchQuery);
    res.json({ success: true, users, count: users.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Foydalanuvchilarni yuklashda xatolik yuz berdi' });
  }
});

// H. Delete User
app.delete('/api/admin/users/:id', requireAdminAuth, (req: AdminRequest, res) => {
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
    res.json({ success: true, message: 'Foydalanuvchi muvaffaqiyatli o‘chirildi' });
  } catch (err: any) {
    res.status(500).json({ error: 'Foydalanuvchini o‘chirishda xatolik yuz berdi' });
  }
});

// I. Update User Stats (XP, Streak, Level)
app.post('/api/admin/users/:id/update', requireAdminAuth, (req: AdminRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const { xp, streak, level } = req.body;
    updateUserStatsAdmin(userId, {
      xp: xp !== undefined ? Number(xp) : undefined,
      streak: streak !== undefined ? Number(streak) : undefined,
      level: level !== undefined ? Number(level) : undefined
    });
    res.json({ success: true, message: 'Foydalanuvchi ma‘lumotlari yangilandi' });
  } catch (err: any) {
    res.status(500).json({ error: 'Foydalanuvchini yangilashda xatolik yuz berdi' });
  }
});

// J. Manage Admin Scenes
app.get('/api/admin/scenes', requireAdminAuth, (_req: AdminRequest, res) => {
  try {
    const scenes = getAllAdminScenes();
    res.json({ success: true, scenes });
  } catch (err: any) {
    res.status(500).json({ error: 'Darslarni yuklashda xatolik yuz berdi' });
  }
});

app.post('/api/admin/scenes', requireAdminAuth, (req: AdminRequest, res) => {
  try {
    const { id, title, category, difficulty, video_url, poster_url, dialogues } = req.body;
    if (!title || !category || !difficulty || !video_url) {
      res.status(400).json({ error: 'Sarlavha, kategoriya, qiyinchilik va video havolasi talab qilinadi' });
      return;
    }

    const sceneId = id || `custom_admin_${Date.now()}`;
    const dialoguesJson = typeof dialogues === 'string' ? dialogues : JSON.stringify(dialogues || []);

    const created = createAdminScene({
      id: sceneId,
      title,
      category,
      difficulty,
      video_url,
      poster_url: poster_url || '',
      dialogues_json: dialoguesJson
    });

    res.json({ success: true, scene: created });
  } catch (err: any) {
    console.error('Admin create scene error:', err);
    res.status(500).json({ error: 'Darsni saqlashda xatolik yuz berdi' });
  }
});

app.delete('/api/admin/scenes/:id', requireAdminAuth, (req: AdminRequest, res) => {
  try {
    const sceneId = req.params.id;
    const deleted = deleteAdminScene(sceneId);
    if (!deleted) {
      res.status(404).json({ error: 'Dars topilmadi' });
      return;
    }
    res.json({ success: true, message: 'Dars muvaffaqiyatli o‘chirildi' });
  } catch (err: any) {
    res.status(500).json({ error: 'Darsni o‘chirishda xatolik yuz berdi' });
  }
});

// --------------------------------------------------------------------------
// Static SPA Serving (Render.com Web Service & Production)
// --------------------------------------------------------------------------
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    index: false,
    setHeaders: (res) => {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    },
  }));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    const indexHtmlPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      try {
        let html = fs.readFileSync(indexHtmlPath, 'utf8');
        const scriptInjection = `<script>window.__ADMIN_PATH__ = ${JSON.stringify(ADMIN_PATH)}; window.__CLOUDFLARE_R2_URL__ = ${JSON.stringify(CLOUDFLARE_R2_URL)};</script>`;
        if (html.includes('</head>')) {
          html = html.replace('</head>', `${scriptInjection}</head>`);
        } else {
          html = `${scriptInjection}${html}`;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      } catch {
        res.sendFile(indexHtmlPath);
      }
    } else {
      next();
    }
  });
}

// --------------------------------------------------------------------------
// Automatic Self-Ping Keep-Alive Heartbeat for Render.com Free Tier
// --------------------------------------------------------------------------
function startKeepAliveHeartbeat(): void {
  const targetUrl = (
    process.env.RENDER_EXTERNAL_URL ||
    process.env.APP_URL ||
    process.env.KEEP_ALIVE_URL ||
    ''
  ).trim().replace(/\/+$/, '');

  // Render.com free tier sleeps after 15 minutes of inactivity.
  // We send a ping every 12 minutes (720,000 ms) to keep the web service awake.
  const PING_INTERVAL_MS = 12 * 60 * 1000;

  if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
    const healthUrl = `${targetUrl}/health`;
    console.log(`⏱️ Auto Keep-Alive faol: Har 12 daqiqada ${healthUrl} ga so‘rov yuboriladi.`);

    setInterval(async () => {
      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'Tinglov-KeepAlive-Heartbeat/1.0' }
        });
        if (response.ok) {
          console.log(`[KeepAlive] Render uyqudan saqlandi: ${healthUrl} (Status: ${response.status})`);
        }
      } catch (err: any) {
        console.warn(`[KeepAlive] So‘rov yuborishda xatolik: ${err?.message}`);
      }
    }, PING_INTERVAL_MS);
  } else {
    console.log('ℹ️ RENDER_EXTERNAL_URL topilmadi. UptimeRobot orqali https://<sizning-service>.onrender.com/health ga so‘rov yuboring.');
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Tinglov Web Service server ishga tushdi: http://localhost:${PORT}`);
  console.log(`🔒 Admin panel faol marshrut: ${ADMIN_PATH}`);
  console.log(`🩺 Health check monitoring URL: http://localhost:${PORT}/health (yoki /ping)`);
  startKeepAliveHeartbeat();
});


