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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Security Headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "frame-src 'self' https://www.youtube-nocookie.com;");
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
app.post('/api/auth/register', requireCsrf, async (req, res) => {
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
app.post('/api/auth/login', requireCsrf, async (req, res) => {
  try {
    const validation = safeValidate(loginSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { identifier: cleanId, password } = validation.data;
    const user = cleanId.includes('@') ? findUserByEmail(cleanId) : findUserByUsername(cleanId);

    if (!user) {
      res.status(401).json({ error: 'Bunday foydalanuvchi topilmadi yoki parol noto‘g‘ri' });
      return;
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Bunday foydalanuvchi topilmadi yoki parol noto‘g‘ri' });
      return;
    }

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
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Tinglov Web Service server ishga tushdi: http://localhost:${PORT}`);
});
