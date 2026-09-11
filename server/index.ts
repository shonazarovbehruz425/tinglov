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
  updateUserAuthMeta,
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
  deleteAdminScene,
  invalidateAdminStatsCache
} from './db';
import crypto, { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  hashPassword,
  comparePassword,
  generateToken,
  requireAuth,
  AuthenticatedRequest,
  generateAdminToken,
  requireAdminAuth,
  AdminRequest,
  safeEqual,
  compareAdminPassword
} from './auth';
import { safeValidate, registerSchema, loginSchema } from '../src/utils/validation';
import {
  apiLimiter,
  registerLimiter,
  createRateLimiter,
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

// Request ID for tracing (returned in 404/500 + X-Request-Id header)
app.use((req, res, next) => {
  const requestId = randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// CORS allowlist from ALLOWED_ORIGINS (comma-separated), credentials enabled.
// origin:true (reflect any origin) + credentials is unsafe — only listed origins allowed.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // same-origin / curl / mobile
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));

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

  // Authorization Bearer header is immune to browser CSRF attacks
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
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
  secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days — aligned with JWT 7d expiry
};

const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days — aligned with admin JWT 7d expiry
};

// --------------------------------------------------------------------------
// Server-side Zod schemas (anti-cheat / injection guards)
// --------------------------------------------------------------------------
const accuracySchema = z.coerce.number().int().min(0).max(100);
const wpmSchema = z.coerce.number().int().min(0).max(300);
const wordSchema = z.string().trim().min(1).max(100);
const translationSchema = z.string().trim().max(500).optional().default('');
const sceneTitleSchema = z.string().trim().max(200).optional().default('');
const sceneIdSchema = z.string().trim().min(1).max(120);
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

const authSessionSchema = z.object({
  email: z.string().trim().toLowerCase().max(255).optional(),
  username: z.string().trim().min(1).max(30).optional(),
  fullName: z.string().trim().max(60).optional(),
  avatarColor: z.string().trim().max(20).optional(),
  authProvider: z.enum(['google', 'email']).optional().default('email'),
  uuid: z.string().trim().max(100).optional(),
  supabaseAccessToken: z.string().min(1).max(5000).optional(),
}).passthrough();

const userWordsSchema = z.object({
  action: z.enum(['save', 'delete']).optional().default('save'),
  word: wordSchema,
  translation: translationSchema,
  sceneTitle: sceneTitleSchema,
}).passthrough();

const adminSceneSchema = z.object({
  title: z.string().trim().min(2).max(100),
  category: z.string().trim().min(1).max(50),
  difficulty: z.string().trim().min(1).max(20),
  video_url: httpsUrlSchema,
  poster_url: optionalHttpsUrlSchema,
  dialogues: z.array(dialogueSchema).min(1).max(50),
}).passthrough();

// XP anti-cheat: client xp is NEVER trusted — fixed server-side reward per new scene, clamped
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

const AVATAR_COLORS = ['#A3E635', '#FF5B37', '#38BDF8', '#F59E0B', '#EC4899', '#8B5CF6', '#10B981'];

// Supabase identity verification: proves the caller actually owns a Supabase
// account before a session token may be issued for an existing backend user.
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

async function verifySupabaseIdentity(accessToken: unknown): Promise<{ id: string; email: string } | null> {
  const token = typeof accessToken === 'string' ? accessToken.trim() : '';
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data?.id) {
      return { id: String(data.id), email: String(data.email || '').toLowerCase() };
    }
    return null;
  } catch {
    return null;
  }
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

    // Set secure HttpOnly cookie (cookie-only auth — token never exposed in body)
    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(201).json({
      message: 'Muvaffaqiyatli ro‘yxatdan o‘tdingiz!',
      user: sanitizeUser(user)
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
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
      const retryAfter = Math.max(ipFail.retryAfterSec, userFail.retryAfterSec);
      const isLocked = ipFail.isLocked || userFail.isLocked;
      if (isLocked) {
        res.setHeader('Retry-After', retryAfter);
        res.status(429).json({
          error: 'Juda ko‘p muvaffaqiyatsiz urinish. Iltimos, birozdan so‘ng qayta urinib ko‘ring.',
          requiresCaptcha: true,
          retryAfter,
        });
        return;
      }
      const maxDelay = Math.max(ipFail.delayMs, userFail.delayMs);
      if (maxDelay > 0 && maxDelay <= 8000) {
        // Non-blocking delay (setTimeout — event loop bloklanmaydi, faqat javob kechiktiriladi)
        await new Promise(r => setTimeout(r, maxDelay));
      }
      res.status(401).json({
        error: 'Bunday foydalanuvchi topilmadi yoki parol noto‘g‘ri',
        requiresCaptcha: maxFail >= 3,
        retryAfter,
      });
      return;
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      const ipFail = await recordAuthFailure(ipKey);
      const userFail = await recordAuthFailure(userKey);
      const maxFail = Math.max(ipFail.failures, userFail.failures);
      const retryAfter = Math.max(ipFail.retryAfterSec, userFail.retryAfterSec);
      const isLocked = ipFail.isLocked || userFail.isLocked;
      if (isLocked) {
        res.setHeader('Retry-After', retryAfter);
        res.status(429).json({
          error: 'Juda ko‘p muvaffaqiyatsiz urinish. Iltimos, birozdan so‘ng qayta urinib ko‘ring.',
          requiresCaptcha: true,
          retryAfter,
        });
        return;
      }
      const maxDelay = Math.max(ipFail.delayMs, userFail.delayMs);
      if (maxDelay > 0 && maxDelay <= 8000) {
        // Non-blocking delay (setTimeout — event loop bloklanmaydi, faqat javob kechiktiriladi)
        await new Promise(r => setTimeout(r, maxDelay));
      }
      res.status(401).json({
        error: 'Bunday foydalanuvchi topilmadi yoki parol noto‘g‘ri',
        requiresCaptcha: maxFail >= 3,
        retryAfter,
      });
      return;
    }

    // Reset failure tracking on successful authentication
    await resetAuthFailure(ipKey);
    await resetAuthFailure(userKey);

    const token = generateToken(user);

    // Set secure HttpOnly cookie (cookie-only auth — token never exposed in body)
    res.cookie('token', token, COOKIE_OPTIONS);

    res.json({
      message: 'Xush kelibsiz!',
      user: sanitizeUser(user)
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
  }
});

// 2.3. Establish / Sync session from authenticated client (issues HttpOnly cookie)
// SECURITY: if the backend account already exists, the caller must prove
// ownership of the matching Supabase identity (valid access token whose
// uuid/email matches) before a session token is issued for that account.
// Unverified requests may only CREATE a brand-new account.
app.post('/api/auth/session', apiLimiter, requireCsrf, async (req, res) => {
  try {
    const validation = safeValidate(authSessionSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { email, username, fullName, avatarColor, authProvider, uuid, supabaseAccessToken } = validation.data as any;
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

    if (user) {
      // Existing account: verify the claimed Supabase identity first
      const verified = await verifySupabaseIdentity(supabaseAccessToken);
      const identityMatches = Boolean(
        verified &&
        (
          (uuid && verified.id === String(uuid)) ||
          (cleanEmail && verified.email === cleanEmail)
        )
      );
      if (!identityMatches) {
        res.status(401).json({ error: 'Sessiyani tiklash uchun identifikatsiya talab qilinadi. Iltimos, qaytadan tizimga kiring.' });
        return;
      }

      updateUserAuthMeta(user.id, {
        auth_provider: provider,
        uuid: (uuid as string) || verified!.id,
        email: cleanEmail || undefined,
      });
      user = findUserById(user.id) || user;
    } else {
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
  const completedSceneIds = Array.from(new Set(completedScenes.map(s => s.scene_id)));

  let lastPositions: Record<string, number> = {};
  try {
    if (user.last_positions) {
      lastPositions = JSON.parse(user.last_positions);
    }
  } catch {}

  res.json({
    user: sanitizeUser(user),
    savedWords,
    completedScenes,
    completedSceneIds,
    lastPositions
  });
});

// 4. Sync Progress
app.post('/api/user/sync', requireAuth, requireCsrf, (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const validation = safeValidate(userSyncSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { streak, lastActiveDate, savedWords, completedScene, completedScenes, lastPositions: lastPositionsRaw } = validation.data as any;

    // ANTI-CHEAT: client xp/level ignored — XP only from server-side scene rewards, clamped
    let rewardTotal = 0;
    const existingScenes = new Set(getUserCompletedScenes(user.id).map(s => s.scene_id));

    // Single completed scene: validate + record (upsert), reward only if first completion
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

    // Record bulk completed scene IDs if passed (e.g. on client merge) — +10 XP each, capped
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
    // Streak is client-authoritative (lower accepted on inactivity), clamped 1..3650
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
      last_positions: sanitizeLastPositions(lastPositionsRaw)
    });

    // Save words if passed (already Zod-validated: word<=100, translation<=500)
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
    const completedSceneIds = Array.from(new Set(allCompleted.map(s => s.scene_id)));

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
      lastPositions
    });
  } catch (err: any) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Sinxronlashda xatolik yuz berdi' });
  }
});

// 5. Save / Remove Word
app.post('/api/user/words', requireAuth, requireCsrf, (req: AuthenticatedRequest, res) => {
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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
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

// C. Admin Login (rate-limited to slow down brute-force attempts)
const adminLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: 'admin-login',
  message: 'Admin kirish urinishlari soni me‘yordan oshdi. Iltimos, 15 daqiqadan so‘ng qayta urinib ko‘ring.'
});

app.post('/api/admin/login', adminLoginLimiter, requireCsrf, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: 'Login va parol kiritilishi shart' });
    return;
  }

  const trimmedUser = String(username).trim().slice(0, 100);
  const trimmedPass = String(password).trim().slice(0, 200);

  // Timing-safe username check + bcrypt (or timing-safe) password check
  const userOk = safeEqual(trimmedUser, ADMIN_USERNAME);
  const passOk = await compareAdminPassword(trimmedPass, ADMIN_PASSWORD, ADMIN_PASSWORD_HASH);

  if (!userOk || !passOk) {
    res.status(401).json({ error: 'Noto‘g‘ri admin login yoki parol' });
    return;
  }

  const token = generateAdminToken(ADMIN_USERNAME);
  res.cookie('admin_token', token, ADMIN_COOKIE_OPTIONS);

  // Cookie-only auth — token never exposed in response body
  res.json({
    success: true,
    admin: { username: ADMIN_USERNAME, role: 'admin' },
    adminPath: ADMIN_PATH
  });
});

// D. Admin Logout
app.post('/api/admin/logout', requireCsrf, (_req, res) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ success: true, message: 'Admin tizimidan muvaffaqiyatli chiqildi' });
});

// E. Check Admin Session (cookie-only — token never exposed in body)
app.get('/api/admin/check', requireAdminAuth, requireCsrf, (req: AdminRequest, res) => {
  res.json({
    authenticated: true,
    admin: req.admin,
    adminPath: ADMIN_PATH
  });
});

// F. Admin Dashboard Stats
app.get('/api/admin/stats', requireAdminAuth, requireCsrf, (_req: AdminRequest, res) => {
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

// G. List Users (Search & Filter, paginated LIMIT 50 + OFFSET)
app.get('/api/admin/users', requireAdminAuth, requireCsrf, (req: AdminRequest, res) => {
  try {
    const searchQuery = typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : undefined;
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const users = getAllUsers(searchQuery, limit, offset);
    res.json({ success: true, users, count: users.length, limit, offset });
  } catch (err: any) {
    res.status(500).json({ error: 'Foydalanuvchilarni yuklashda xatolik yuz berdi' });
  }
});

// H. Delete User
app.delete('/api/admin/users/:id', requireAdminAuth, requireCsrf, (req: AdminRequest, res) => {
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
});

// I. Update User Stats (XP, Streak, Level)
app.post('/api/admin/users/:id/update', requireAdminAuth, requireCsrf, (req: AdminRequest, res) => {
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
      level: level !== undefined ? Number(level) : undefined
    });
    invalidateAdminStatsCache();
    res.json({ success: true, message: 'Foydalanuvchi ma‘lumotlari yangilandi' });
  } catch (err: any) {
    res.status(500).json({ error: 'Foydalanuvchini yangilashda xatolik yuz berdi' });
  }
});

// J. Manage Admin Scenes
app.get('/api/admin/scenes', requireAdminAuth, requireCsrf, (_req: AdminRequest, res) => {
  try {
    const scenes = getAllAdminScenes();
    res.json({ success: true, scenes });
  } catch (err: any) {
    res.status(500).json({ error: 'Darslarni yuklashda xatolik yuz berdi' });
  }
});

app.post('/api/admin/scenes', requireAdminAuth, requireCsrf, (req: AdminRequest, res) => {
  try {
    // Client id is ignored — server generates randomUUID() to prevent ID collision/forgery
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

    // Server-generated scene ID (client cannot choose/forgery-proof)
    const sceneId = randomUUID();
    const dialoguesJson = JSON.stringify(cleanDialogues);

    const created = createAdminScene({
      id: sceneId,
      title,
      category,
      difficulty,
      video_url,
      poster_url: poster_url || '',
      dialogues_json: dialoguesJson
    });

    invalidateAdminStatsCache();
    res.json({ success: true, scene: created });
  } catch (err: any) {
    console.error('Admin create scene error:', err);
    res.status(500).json({ error: 'Darsni saqlashda xatolik yuz berdi' });
  }
});

app.delete('/api/admin/scenes/:id', requireAdminAuth, requireCsrf, (req: AdminRequest, res) => {
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
});

// --------------------------------------------------------------------------
// Global 404 (JSON) + Central Error Handler (with requestId tracing)
// --------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    error: 'So‘ralgan manzil topilmadi',
    path: req.path,
    requestId: (req as any).requestId || res.getHeader('X-Request-Id'),
  });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[${(req as any).requestId || '-'}] Unhandled error:`, err?.message || err);
  const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({
    error: status === 500 ? 'Serverda ichki xatolik yuz berdi' : (err?.message || 'So‘rovni bajarishda xatolik'),
    requestId: (req as any).requestId || res.getHeader('X-Request-Id'),
  });
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
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
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

// --------------------------------------------------------------------------
// Boot-time admin credential validation (no hardcoded fallbacks)
// --------------------------------------------------------------------------
if (!ADMIN_PASSWORD && !ADMIN_PASSWORD_HASH) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_PASSWORD yoki ADMIN_PASSWORD_HASH sozlanmagan');
  }
  console.warn('⚠️ ADMIN_PASSWORD yoki ADMIN_PASSWORD_HASH sozlanmagan — admin login development mode’da o‘chirilgan (fail-closed).');
}

app.listen(PORT, () => {
  console.log(`🚀 Tinglov Web Service server ishga tushdi: http://localhost:${PORT}`);
  console.log(`🔒 Admin panel faol marshrut: ${ADMIN_PATH}`);
  console.log(`🩺 Health check monitoring URL: http://localhost:${PORT}/health (yoki /ping)`);
  startKeepAliveHeartbeat();
});


