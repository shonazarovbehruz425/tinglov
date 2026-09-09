import express from 'express';
import cors from 'cors';
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
import { hashPassword, comparePassword, generateToken, requireAuth, AuthenticatedRequest } from './auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const AVATAR_COLORS = ['#A3E635', '#FF5B37', '#38BDF8', '#F59E0B', '#EC4899', '#8B5CF6', '#10B981'];

function sanitizeUser(user: any) {
  const { password_hash, ...safe } = user;
  return safe;
}

// --------------------------------------------------------------------------
// Auth Endpoints
// --------------------------------------------------------------------------

// 1. Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'Barcha maydonlarni to‘ldiring' });
      return;
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(fullName || cleanUsername).trim();

    if (cleanUsername.length < 3) {
      res.status(400).json({ error: 'Login kamida 3 ta belgidan iborat bo‘lishi kerak' });
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      res.status(400).json({ error: 'Login faqat harf, son va pastki chiziqdan iborat bo‘lishi mumkin' });
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      res.status(400).json({ error: 'Email manzili noto‘g‘ri formatda' });
      return;
    }

    if (String(password).length < 6) {
      res.status(400).json({ error: 'Parol kamida 6 ta belgidan iborat bo‘lishi kerak' });
      return;
    }

    // Check uniqueness
    if (findUserByEmail(cleanEmail)) {
      res.status(400).json({ error: 'Ushbu email bilan allaqachon ro‘yxatdan o‘tilgan' });
      return;
    }

    if (findUserByUsername(cleanUsername)) {
      res.status(400).json({ error: 'Ushbu login band, boshqasini tanlang' });
      return;
    }

    const password_hash = await hashPassword(String(password));
    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const user = createUser({
      username: cleanUsername,
      email: cleanEmail,
      password_hash,
      full_name: cleanName,
      avatar_color: randomColor
    });

    const token = generateToken(user);

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
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      res.status(400).json({ error: 'Login/Email va parolni kiriting' });
      return;
    }

    const cleanId = String(identifier).trim().toLowerCase();
    const user = cleanId.includes('@') ? findUserByEmail(cleanId) : findUserByUsername(cleanId);

    if (!user) {
      res.status(401).json({ error: 'Bunday foydalanuvchi topilmadi yoki parol noto‘g‘ri' });
      return;
    }

    const isMatch = await comparePassword(String(password), user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Bunday foydalanuvchi topilmadi yoki parol noto‘g‘ri' });
      return;
    }

    const token = generateToken(user);

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
app.post('/api/user/sync', requireAuth, (req: AuthenticatedRequest, res) => {
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
