// MIGRATION: server/index.ts dagi Auth endpoint'lari (371-637 qatorlar:
// register, login, session, logout, /api/auth/me) shu faylga ko'chirildi.
// Qadam: index.ts da eski app.post('/api/auth/...') qatorlarini o'chirib,
//   import { authRoutes } from './routes/auth.routes';
//   app.use('/api/auth', authRoutes);
// bilan ulash. (registerLimiter, checkAuthRateLimit, requireCsrf, apiLimiter
//   middleware'lari index.ts tartibida saqlanadi yoki shu routerga qo'shiladi.)

import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import {
  hashPassword,
  comparePassword,
  generateToken,
  requireAuth,
  type AuthenticatedRequest,
} from '../auth';
import {
  findUserByEmail,
  findUserByUsername,
  findUserById,
  createUser,
  updateUserAuthMeta,
  getUserSavedWords,
  getUserCompletedScenes,
} from '../db';
import { safeValidate, registerSchema, loginSchema } from '../../src/utils/validation';
import {
  registerLimiter,
  checkAuthRateLimit,
  apiLimiter,
  recordAuthFailure,
  resetAuthFailure,
  getClientIp,
  generateCaptchaChallenge,
  verifyCaptchaSolution,
} from '../rateLimiter';
import { requireCsrf } from '../middleware/csrf';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 kun — JWT 7d muddatiga mos
};

const AVATAR_COLORS = ['#A3E635', '#FF5B37', '#38BDF8', '#F59E0B', '#EC4899', '#8B5CF6', '#10B981'];

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

function sanitizeUser(user: any) {
  const { password_hash, ...safe } = user;
  return safe;
}

const authSessionSchema = z.object({
  email: z.string().trim().toLowerCase().max(255).optional(),
  username: z.string().trim().min(1).max(30).optional(),
  fullName: z.string().trim().max(60).optional(),
  avatarColor: z.string().trim().max(20).optional(),
  authProvider: z.enum(['google', 'email']).optional().default('email'),
  uuid: z.string().trim().max(100).optional(),
  supabaseAccessToken: z.string().min(1).max(5000).optional(),
}).passthrough();

// 1. Register
const registerHandler = async (req: Request, res: Response) => {
  try {
    const validation = safeValidate(registerSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { username: cleanUsername, email: cleanEmail, password, fullName: cleanName } = validation.data;

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
      auth_provider: 'email',
    });

    const token = generateToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(201).json({
      message: 'Muvaffaqiyatli ro‘yxatdan o‘tdingiz!',
      user: sanitizeUser(user),
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
  }
};

// 2. Login
const loginHandler = async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const identifier = (req.body?.identifier || '').toString().toLowerCase().trim();
  const ipKey = `auth:ip:${ip}`;
  const userKey = `auth:user:${identifier}`;

  try {
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
        await new Promise((r) => setTimeout(r, maxDelay));
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
        await new Promise((r) => setTimeout(r, maxDelay));
      }
      res.status(401).json({
        error: 'Bunday foydalanuvchi topilmadi yoki parol noto‘g‘ri',
        requiresCaptcha: maxFail >= 3,
        retryAfter,
      });
      return;
    }

    await resetAuthFailure(ipKey);
    await resetAuthFailure(userKey);

    const token = generateToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);

    res.json({
      message: 'Xush kelibsiz!',
      user: sanitizeUser(user),
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
  }
};

// 2.3. Establish / Sync session from authenticated client (HttpOnly cookie)
const sessionHandler = async (req: Request, res: Response) => {
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
      const verified = await verifySupabaseIdentity(supabaseAccessToken);
      const identityMatches = Boolean(
        verified &&
          ((uuid && verified.id === String(uuid)) || (cleanEmail && verified.email === cleanEmail)),
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
};

// 2.5. Logout
const logoutHandler = (_req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.json({ success: true, message: 'Muvaffaqiyatli tizimdan chiqildi' });
};

// 3. Current User Profile
const meHandler = (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const savedWords = getUserSavedWordsSafe(user.id);
  const completedScenes = getUserCompletedScenesSafe(user.id);
  const completedSceneIds = Array.from(new Set(completedScenes.map((s) => s.scene_id)));

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
    lastPositions,
  });
};

// getUserSavedWords / getUserCompletedScenes larni signaturasiga mos chaqirish uchun yordamchi
// (importlari fayl boshiga ko'chirildi — tozalik uchun)
function getUserSavedWordsSafe(userId: number) {
  return getUserSavedWords(userId);
}
function getUserCompletedScenesSafe(userId: number) {
  return getUserCompletedScenes(userId);
}

export const authRoutes = Router();

authRoutes.post('/register', registerLimiter, requireCsrf, registerHandler);
authRoutes.post('/login', checkAuthRateLimit, requireCsrf, loginHandler);
authRoutes.post('/session', apiLimiter, requireCsrf, sessionHandler);
authRoutes.post('/logout', requireCsrf, logoutHandler);
authRoutes.get('/me', requireAuth, meHandler);
