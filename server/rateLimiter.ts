import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import Redis from 'ioredis';

// Secret key for HMAC CAPTCHA signing
const CAPTCHA_SECRET = process.env.CAPTCHA_SECRET || crypto.randomBytes(32).toString('hex');

// Max entries for bounded in-memory fallback to prevent memory exhaustion attacks
const MAX_STORE_ENTRIES = 10000;

interface RateRecord {
  count: number;
  resetTime: number;
}

interface AuthAttemptRecord {
  failures: number;
  lastFailureTime: number;
  lockedUntil: number;
}

// --------------------------------------------------------------------------
// 1. Redis Connection Setup (with automatic fallback on error / disconnect)
// --------------------------------------------------------------------------
const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

let redisClient: Redis | null = null;
let isRedisConnected = false;

if (REDIS_URL || REDIS_HOST) {
  try {
    redisClient = REDIS_URL
      ? new Redis(REDIS_URL, {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 5000,
          lazyConnect: true,
        })
      : new Redis({
          host: REDIS_HOST,
          port: REDIS_PORT,
          password: REDIS_PASSWORD,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 5000,
          lazyConnect: true,
        });

    redisClient.on('connect', () => {
      isRedisConnected = true;
      console.log('✅ [RateLimiter] Connected to Redis for distributed rate limiting & persistence.');
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      console.warn('⚠️ [RateLimiter] Redis connection warning (falling back to bounded in-memory store):', err.message);
    });

    redisClient.connect().catch((err) => {
      isRedisConnected = false;
      console.warn('⚠️ [RateLimiter] Could not connect to Redis, fallback to bounded memory store:', err.message);
    });
  } catch (err: any) {
    console.warn('⚠️ [RateLimiter] Redis initialization failed, fallback to bounded memory store:', err.message);
  }
} else {
  console.log('ℹ️ [RateLimiter] REDIS_URL not configured. Running with high-capacity bounded in-memory rate limiter.');
}

// --------------------------------------------------------------------------
// 2. High-Capacity Bounded In-Memory Store (Fallback with LRU/FIFO eviction)
// --------------------------------------------------------------------------
const memoryIpStore = new Map<string, RateRecord>();
const memoryAuthStore = new Map<string, AuthAttemptRecord>();

function cleanMemoryStore<T extends { resetTime?: number; lockedUntil?: number }>(
  store: Map<string, T>,
  maxEntries: number
): void {
  const now = Date.now();
  // 1. Evict expired entries
  for (const [key, val] of store.entries()) {
    if (val.resetTime && val.resetTime <= now) {
      store.delete(key);
    } else if (val.lockedUntil && val.lockedUntil <= now) {
      store.delete(key);
    }
  }

  // 2. If capacity still exceeded, evict oldest 20% to prevent memory exhaustion
  if (store.size > maxEntries) {
    const excess = store.size - Math.floor(maxEntries * 0.8);
    let removed = 0;
    for (const key of store.keys()) {
      store.delete(key);
      removed++;
      if (removed >= excess) break;
    }
  }
}

// Periodic cleanup every 5 minutes
setInterval(() => {
  cleanMemoryStore(memoryIpStore, MAX_STORE_ENTRIES);
  cleanMemoryStore(memoryAuthStore, MAX_STORE_ENTRIES);
}, 5 * 60 * 1000).unref();

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
 * Increment rate limit count atomically in Redis or bounded memory store
 */
async function incrementRateLimit(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
  if (isRedisConnected && redisClient) {
    try {
      const redisKey = `tinglov:rl:${key}`;
      const multi = redisClient.multi();
      multi.incr(redisKey);
      multi.pttl(redisKey);
      const results = await multi.exec();

      if (results && results[0] && results[1]) {
        const count = Number(results[0][1]) || 1;
        let pttl = Number(results[1][1]);
        if (pttl === -1 || pttl === -2) {
          await redisClient.pexpire(redisKey, windowMs);
          pttl = windowMs;
        }
        return { count, resetTime: Date.now() + Math.max(1, pttl) };
      }
    } catch {
      // Fall through to memory store if Redis operation fails
    }
  }

  // Bounded Memory Fallback
  cleanMemoryStore(memoryIpStore, MAX_STORE_ENTRIES);
  const now = Date.now();
  let record = memoryIpStore.get(key);
  if (!record || record.resetTime <= now) {
    record = { count: 1, resetTime: now + windowMs };
    memoryIpStore.set(key, record);
  } else {
    record.count++;
  }
  return record;
}

/**
 * General Rate Limiter Factory (sliding window with Redis support)
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
}) {
  const {
    windowMs,
    max,
    message = 'Juda ko‘p so‘rov yuborildi. Iltimos, birozdan keyin qayta urinib ko‘ring.',
    keyPrefix = 'rl'
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    const record = await incrementRateLimit(key, windowMs);
    const remaining = Math.max(0, max - record.count);
    const resetSec = Math.max(1, Math.ceil((record.resetTime - now) / 1000));

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
 * Record a failed authentication attempt and apply exponential backoff (Redis + Memory fallback)
 */
export async function recordAuthFailure(key: string): Promise<{
  failures: number;
  delayMs: number;
  isLocked: boolean;
  retryAfterSec: number;
}> {
  const now = Date.now();

  // Try Redis first
  if (isRedisConnected && redisClient) {
    try {
      const redisKey = `tinglov:auth:${key}`;
      const raw = await redisClient.get(redisKey);
      let record: AuthAttemptRecord = raw
        ? JSON.parse(raw)
        : { failures: 0, lastFailureTime: now, lockedUntil: 0 };

      if (now - record.lastFailureTime > 30 * 60 * 1000) {
        record.failures = 1;
        record.lockedUntil = 0;
      } else {
        record.failures++;
      }
      record.lastFailureTime = now;

      let delayMs = 0;
      if (record.failures === 3) delayMs = 3000;
      else if (record.failures >= 4 && record.failures < 15) delayMs = 5000;
      else if (record.failures >= 15 && record.failures < 20) {
        delayMs = 60000;
        record.lockedUntil = now + delayMs;
      } else if (record.failures >= 20) {
        delayMs = 15 * 60 * 1000;
        record.lockedUntil = now + delayMs;
      }

      let isLocked = false;
      let retryAfterSec = 0;
      if (record.lockedUntil > now) {
        isLocked = true;
        retryAfterSec = Math.ceil((record.lockedUntil - now) / 1000);
      }

      await redisClient.set(redisKey, JSON.stringify(record), 'EX', 3600);
      return { failures: record.failures, delayMs, isLocked, retryAfterSec };
    } catch {
      // Fall through to memory store on error
    }
  }

  // Bounded Memory Fallback
  cleanMemoryStore(memoryAuthStore, MAX_STORE_ENTRIES);
  let record = memoryAuthStore.get(key);
  if (!record) {
    record = { failures: 1, lastFailureTime: now, lockedUntil: 0 };
  } else {
    if (now - record.lastFailureTime > 30 * 60 * 1000) {
      record.failures = 1;
      record.lockedUntil = 0;
    } else {
      record.failures++;
    }
    record.lastFailureTime = now;
  }

  let delayMs = 0;
  let isLocked = false;
  let retryAfterSec = 0;

  if (record.failures === 3) {
    delayMs = 3000;
  } else if (record.failures >= 4 && record.failures < 15) {
    delayMs = 5000;
  } else if (record.failures >= 15 && record.failures < 20) {
    delayMs = 60000;
    record.lockedUntil = now + delayMs;
  } else if (record.failures >= 20) {
    delayMs = 15 * 60 * 1000;
    record.lockedUntil = now + delayMs;
  }

  if (record.lockedUntil > now) {
    isLocked = true;
    retryAfterSec = Math.ceil((record.lockedUntil - now) / 1000);
  }

  memoryAuthStore.set(key, record);
  return { failures: record.failures, delayMs, isLocked, retryAfterSec };
}

/**
 * Reset authentication failure counter on successful login
 */
export async function resetAuthFailure(key: string): Promise<void> {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.del(`tinglov:auth:${key}`);
    } catch {}
  }
  memoryAuthStore.delete(key);
}

/**
 * Get current failure count for an IP or identifier
 */
export async function getAuthAttempts(key: string): Promise<{
  failures: number;
  isLocked: boolean;
  retryAfterSec: number;
}> {
  const now = Date.now();

  if (isRedisConnected && redisClient) {
    try {
      const raw = await redisClient.get(`tinglov:auth:${key}`);
      if (raw) {
        const record: AuthAttemptRecord = JSON.parse(raw);
        if (record.lockedUntil > now) {
          return {
            failures: record.failures,
            isLocked: true,
            retryAfterSec: Math.ceil((record.lockedUntil - now) / 1000),
          };
        }
        return { failures: record.failures, isLocked: false, retryAfterSec: 0 };
      }
    } catch {}
  }

  const record = memoryAuthStore.get(key);
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
export const checkAuthRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  const ip = getClientIp(req);
  const identifier = (req.body?.identifier || '').toString().toLowerCase().trim();
  const ipKey = `auth:ip:${ip}`;
  const userKey = `auth:user:${identifier}`;

  const ipStatus = await getAuthAttempts(ipKey);
  const userStatus = identifier ? await getAuthAttempts(userKey) : { isLocked: false, retryAfterSec: 0, failures: 0 };

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
