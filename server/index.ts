import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
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
  getGlobalLeaderboard
} from './db';
import crypto from 'node:crypto';
import { hashPassword, comparePassword, generateToken, requireAuth, AuthenticatedRequest } from './auth';
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

dotenv.config();

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
    "img-src 'self' data: https: blob:; " +
    "media-src 'self' blob: data: https://cdn.jsdelivr.net https://storage.googleapis.com https:; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net https://storage.googleapis.com https://unpkg.com https://fonts.googleapis.com; " +
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
      avatar_color: randomColor
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
    const { email, username, fullName, avatarColor } = req.body;
    if (!email && !username) {
      res.status(400).json({ error: 'Foydalanuvchi ma’lumotlari yetarli emas' });
      return;
    }

    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanUsername = (username || (cleanEmail ? cleanEmail.split('@')[0] : 'foydalanuvchi')).trim();

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
// Static SPA Serving (Render.com Web Service & Production)
// --------------------------------------------------------------------------
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
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
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Tinglov Web Service server ishga tushdi: http://localhost:${PORT}`);
});
