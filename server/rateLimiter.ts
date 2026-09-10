import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

// Secret key for HMAC CAPTCHA signing
const CAPTCHA_SECRET = process.env.CAPTCHA_SECRET || crypto.randomBytes(32).toString('hex');

interface RateRecord {
  count: number;
  resetTime: number;
}

interface AuthAttemptRecord {
  failures: number;
  lastFailureTime: number;
  lockedUntil: number;
}

// In-memory stores with periodic garbage collection
const ipStore = new Map<string, RateRecord>();
const authStore = new Map<string, AuthAttemptRecord>();

// Periodic cleanup every 10 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of ipStore.entries()) {
    if (record.resetTime <= now) {
      ipStore.delete(key);
    }
  }
  for (const [key, record] of authStore.entries()) {
    if (record.lockedUntil <= now && now - record.lastFailureTime > 60 * 60 * 1000) {
      authStore.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

/**
 * Gets real client IP handling proxies/load balancers
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * General Rate Limiter Factory (sliding window)
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
}) {
  const { windowMs, max, message = 'Juda ko‘p so‘rov yuborildi. Iltimos, birozdan keyin qayta urinib ko‘ring.', keyPrefix = 'rl' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    let record = ipStore.get(key);
    if (!record || record.resetTime <= now) {
      record = { count: 1, resetTime: now + windowMs };
      ipStore.set(key, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSec = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetSec);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSec);
      res.status(429).json({
        error: message,
        retryAfter: resetSec,
      });
      return;
    }

    next();
  };
}

/**
 * Global API rate limiter (120 requests per minute per IP)
 */
export const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  keyPrefix: 'api',
  message: 'API so‘rovlar soni me‘yordan oshib ketdi. Iltimos, 1 daqiqadan so‘ng qayta urinib ko‘ring.',
});

/**
 * Registration rate limiter (5 registrations per hour per IP)
 */
export const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyPrefix: 'reg',
  message: 'Ushbu qurilmadan juda ko‘p ro‘yxatdan o‘tish amalga oshirildi. Iltimos, 1 soatdan so‘ng qayta urinib ko‘ring.',
});

/**
 * Record a failed authentication attempt and apply exponential backoff
 */
export function recordAuthFailure(key: string): { failures: number; delayMs: number; isLocked: boolean; retryAfterSec: number } {
  const now = Date.now();
  let record = authStore.get(key);
  if (!record) {
    record = { failures: 1, lastFailureTime: now, lockedUntil: 0 };
  } else {
    // If previous failure was more than 30 minutes ago, reset counter
    if (now - record.lastFailureTime > 30 * 60 * 1000) {
      record.failures = 1;
      record.lockedUntil = 0;
    } else {
      record.failures++;
    }
    record.lastFailureTime = now;
  }

  // Exponential backoff calculation:
  // 1-2 attempts: 0s
  // 3 attempts: 3s
  // 4 attempts: 8s
  // 5 attempts: 60s
  // 6+ attempts: 15 minutes lockout
  let delayMs = 0;
  let isLocked = false;
  let retryAfterSec = 0;

  if (record.failures === 3) {
    delayMs = 3000;
  } else if (record.failures === 4) {
    delayMs = 8000;
  } else if (record.failures === 5) {
    delayMs = 60000;
    record.lockedUntil = now + delayMs;
  } else if (record.failures >= 6) {
    delayMs = 15 * 60 * 1000; // 15 minutes lockout
    record.lockedUntil = now + delayMs;
  }

  if (record.lockedUntil > now) {
    isLocked = true;
    retryAfterSec = Math.ceil((record.lockedUntil - now) / 1000);
  }

  authStore.set(key, record);
  return { failures: record.failures, delayMs, isLocked, retryAfterSec };
}

/**
 * Reset authentication failure counter on successful login
 */
export function resetAuthFailure(key: string): void {
  authStore.delete(key);
}

/**
 * Get current failure count for an IP or identifier
 */
export function getAuthAttempts(key: string): { failures: number; isLocked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const record = authStore.get(key);
  if (!record) {
    return { failures: 0, isLocked: false, retryAfterSec: 0 };
  }
  if (record.lockedUntil > now) {
    return {
      failures: record.failures,
      isLocked: true,
      retryAfterSec: Math.ceil((record.lockedUntil - now) / 1000),
    };
  }
  return { failures: record.failures, isLocked: false, retryAfterSec: 0 };
}

/**
 * Express middleware to check for auth lockout before processing login
 */
export const checkAuthRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const ip = getClientIp(req);
  const identifier = (req.body?.identifier || '').toString().toLowerCase().trim();
  const ipKey = `auth:ip:${ip}`;
  const userKey = `auth:user:${identifier}`;

  const ipStatus = getAuthAttempts(ipKey);
  const userStatus = identifier ? getAuthAttempts(userKey) : { isLocked: false, retryAfterSec: 0, failures: 0 };

  const isLocked = ipStatus.isLocked || userStatus.isLocked;
  const retryAfterSec = Math.max(ipStatus.retryAfterSec, userStatus.retryAfterSec);

  if (isLocked) {
    res.setHeader('Retry-After', retryAfterSec);
    res.status(429).json({
      error: `Xavfsizlik choralari tufayli hisob vaqtincha bloklandi. Iltimos, ${retryAfterSec} soniyadan keyin qayta urinib ko‘ring.`,
      retryAfter: retryAfterSec,
      requiresCaptcha: true,
    });
    return;
  }

  const maxFailures = Math.max(ipStatus.failures, userStatus.failures);
  if (maxFailures >= 3) {
    (req as any).requiresCaptcha = true;
  }

  next();
};

/**
 * CAPTCHA generation & HMAC signature verification
 */
export interface CaptchaChallenge {
  id: string;
  question: string;
  token: string;
}

export function generateCaptchaChallenge(): CaptchaChallenge {
  const num1 = Math.floor(Math.random() * 12) + 3;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const operation = Math.random() > 0.4 ? '+' : '-';
  
  let question = '';
  let answer = 0;
  if (operation === '+') {
    question = `${num1} + ${num2}`;
    answer = num1 + num2;
  } else {
    const higher = Math.max(num1, num2);
    const lower = Math.min(num1, num2);
    question = `${higher} - ${lower}`;
    answer = higher - lower;
  }

  const id = crypto.randomBytes(8).toString('hex');
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity
  const payload = `${id}:${answer}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', CAPTCHA_SECRET).update(payload).digest('hex');
  const token = `${Buffer.from(payload).toString('base64url')}.${signature}`;

  return {
    id,
    question: `${question} = ?`,
    token,
  };
}

export function verifyCaptchaSolution(token: string, userAnswer: string | number): boolean {
  try {
    if (!token || userAnswer === undefined || userAnswer === null) return false;
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return false;

    const payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const expectedSig = crypto.createHmac('sha256', CAPTCHA_SECRET).update(payload).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return false;
    }

    const [, expectedAnswer, expiresAtStr] = payload.split(':');
    const expiresAt = Number(expiresAtStr);
    if (Date.now() > expiresAt) {
      return false; // Expired
    }

    return String(expectedAnswer).trim() === String(userAnswer).trim();
  } catch {
    return false;
  }
}
