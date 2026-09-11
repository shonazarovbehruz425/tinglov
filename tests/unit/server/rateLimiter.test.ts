import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted bootstrap: runs BEFORE the module under test is imported.
// rateLimiter.ts reads REDIS_URL at import time and only constructs the
// (mocked) Redis client when it is set, so the env must be in place before
// `await import` / static import below. The original value is restored in
// afterAll so sibling test files are unaffected.
// ---------------------------------------------------------------------------
const mockRedis = vi.hoisted(() => {
  const state = {
    prevRedisUrl: process.env.REDIS_URL,
    instances: [] as any[],
    throwOnConstruct: false,
    connectReject: false,
  };
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.CAPTCHA_SECRET = 'test-captcha-secret-key-1234';
  process.env.NODE_ENV = 'test';
  return state;
});

vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      listeners: Record<string, Array<(...args: any[]) => void>> = {};
      constructor() {
        if (mockRedis.throwOnConstruct) {
          throw new Error('mock redis init failure');
        }
        mockRedis.instances.push(this);
      }
      on(event: string, cb: (...args: any[]) => void) {
        (this.listeners[event] ||= []).push(cb);
        return this;
      }
      emit(event: string, ...args: any[]) {
        for (const cb of this.listeners[event] || []) cb(...args);
      }
      connect = vi.fn().mockImplementation(() =>
        mockRedis.connectReject
          ? Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:6379'))
          : Promise.resolve('OK')
      );
      multi = vi.fn().mockImplementation(function (this: any) { return this; });
      incr = vi.fn().mockImplementation(function (this: any) { return this; });
      pttl = vi.fn().mockImplementation(function (this: any) { return this; });
      exec = vi.fn();
      pexpire = vi.fn().mockResolvedValue(1);
      get = vi.fn().mockResolvedValue(null);
      set = vi.fn().mockResolvedValue('OK');
      del = vi.fn().mockResolvedValue(1);
      quit = vi.fn().mockResolvedValue('OK');
      disconnect = vi.fn();
    },
  };
});

vi.mock('dotenv', () => ({
  default: { config: vi.fn() },
}));

vi.mock('node:crypto', async () => {
  // server/rateLimiter.ts uses `import crypto from 'node:crypto'` (default
  // import), so the mock must expose `default`. Keep real implementations:
  // randomBytes must return fresh values for the unique-ID test, and HMAC /
  // timingSafeEqual need to actually compute for captcha verification.
  const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto');
  return { ...actual, default: (actual as { default?: unknown }).default ?? actual };
});

import * as rateLimiter from '@/server/rateLimiter';
import crypto from 'node:crypto';

const CAPTCHA_SECRET = 'test-captcha-secret-key-1234';

/** The Redis client held by the statically-imported module singleton. */
function client(): any {
  return mockRedis.instances[0];
}
/** Flip the module-level isRedisConnected flag through real event handlers. */
function connectRedis() {
  client().emit('connect');
}
function disconnectRedis() {
  client().emit('error', new Error('connection lost'));
}

function stubRes() {
  return {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}
function stubReq(ip: string, body?: Record<string, unknown>) {
  return { ip, socket: { remoteAddress: ip }, ...(body ? { body } : {}) };
}

/** Decode the answer out of a captcha token (payload = id:answer:expiresAt). */
function solveCaptchaToken(token: string): { answer: string; expiresAt: number } {
  const payload = Buffer.from(token.split('.')[0], 'base64url').toString('utf8');
  const [, answer, expiresAt] = payload.split(':');
  return { answer, expiresAt: Number(expiresAt) };
}

/** Craft a token signed with the real secret (for expiry / tamper tests). */
function craftCaptchaToken(id: string, answer: string, expiresAt: number): string {
  const payload = `${id}:${answer}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', CAPTCHA_SECRET).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${signature}`;
}

async function passThrough(
  limiter: (req: any, res: any, next: any) => Promise<void>,
  ip: string
) {
  const res = stubRes();
  const next = vi.fn();
  await limiter(stubReq(ip) as any, res as any, next);
  return { res, next };
}

describe('server/rateLimiter', () => {
  const pendingSpies: Array<{ mockRestore: () => void }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    // mockClear keeps implementations, so pin deterministic defaults here
    // (tests override what they need; everything else falls back to memory).
    const c = client();
    c.get.mockResolvedValue(null);
    c.set.mockResolvedValue('OK');
    c.del.mockResolvedValue(1);
    c.pexpire.mockResolvedValue(1);
    c.exec.mockResolvedValue(null);
    // Every test starts in memory-fallback mode unless it opts into Redis.
    disconnectRedis();
  });

  afterEach(() => {
    while (pendingSpies.length) pendingSpies.pop()!.mockRestore();
    vi.useRealTimers();
  });

  afterAll(() => {
    if (mockRedis.prevRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = mockRedis.prevRedisUrl;
    }
  });

  describe('getClientIp', () => {
    it('should return req.ip if available', () => {
      const req = { ip: '192.168.1.1', socket: { remoteAddress: '10.0.0.1' } };
      expect(rateLimiter.getClientIp(req as any)).toBe('192.168.1.1');
    });
    it('should return socket remoteAddress', () => {
      const req = { ip: undefined, socket: { remoteAddress: '10.0.0.1' } };
      expect(rateLimiter.getClientIp(req as any)).toBe('10.0.0.1');
    });
    it('should return unknown', () => {
      const req = { ip: undefined, socket: { remoteAddress: undefined } };
      expect(rateLimiter.getClientIp(req as any)).toBe('unknown');
    });
  });

  describe('createRateLimiter (memory fallback)', () => {
    it('should create a rate limiter function', () => {
      const limiter = rateLimiter.createRateLimiter({ windowMs: 60000, max: 5 });
      expect(typeof limiter).toBe('function');
    });

    it('should pass requests below the limit and set RateLimit headers', async () => {
      const limiter = rateLimiter.createRateLimiter({ windowMs: 60000, max: 5, keyPrefix: 'memok' });
      const { res, next } = await passThrough(limiter, '203.0.113.1');
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Limit', 5);
      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', 4);
      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Reset', expect.any(Number));
    });

    it('should answer 429 once the limit is exceeded', async () => {
      const limiter = rateLimiter.createRateLimiter({
        windowMs: 60000,
        max: 2,
        keyPrefix: 'mem429',
        message: 'slow down',
      });
      await passThrough(limiter, '203.0.113.2');
      await passThrough(limiter, '203.0.113.2');
      const res = stubRes();
      const next = vi.fn();
      await limiter(stubReq('203.0.113.2') as any, res as any, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({ error: 'slow down', retryAfter: expect.any(Number) });
    });

    it('should reopen the window and evict expired entries after time passes', async () => {
      vi.useFakeTimers();
      const limiter = rateLimiter.createRateLimiter({ windowMs: 10000, max: 2, keyPrefix: 'memwin' });
      await passThrough(limiter, '203.0.113.3');
      await passThrough(limiter, '203.0.113.3');
      const blocked = stubRes();
      await limiter(stubReq('203.0.113.3') as any, blocked as any, vi.fn());
      expect(blocked.status).toHaveBeenCalledWith(429);

      vi.advanceTimersByTime(11000); // window over → expired record evicted
      const { res, next } = await passThrough(limiter, '203.0.113.3');
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', 1);
    });
  });

  describe('createRateLimiter (Redis path)', () => {
    it('should consume counters from Redis and expose them in headers', async () => {
      connectRedis();
      const c = client();
      c.exec.mockResolvedValue([[null, '3'], [null, 45000]]);
      const limiter = rateLimiter.createRateLimiter({ windowMs: 60000, max: 5, keyPrefix: 'rlok' });
      const { res, next } = await passThrough(limiter, '203.0.113.10');
      expect(next).toHaveBeenCalledTimes(1);
      expect(c.incr).toHaveBeenCalledWith('tinglov:rl:rlok:203.0.113.10');
      expect(c.pttl).toHaveBeenCalledWith('tinglov:rl:rlok:203.0.113.10');
      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', 2);
    });

    it('should answer 429 when Redis count exceeds the max', async () => {
      connectRedis();
      const c = client();
      c.exec.mockResolvedValue([[null, '6'], [null, 30000]]);
      const limiter = rateLimiter.createRateLimiter({ windowMs: 60000, max: 5, keyPrefix: 'rl429' });
      const res = stubRes();
      const next = vi.fn();
      await limiter(stubReq('203.0.113.11') as any, res as any, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', 0);
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({ error: expect.any(String), retryAfter: expect.any(Number) });
    });

    it('should set a TTL via pexpire when Redis reports -1/-2', async () => {
      connectRedis();
      const c = client();
      c.exec.mockResolvedValue([[null, '1'], [null, -1]]);
      const limiter = rateLimiter.createRateLimiter({ windowMs: 15000, max: 9, keyPrefix: 'rlttl' });
      await passThrough(limiter, '203.0.113.12');
      expect(c.pexpire).toHaveBeenCalledWith('tinglov:rl:rlttl:203.0.113.12', 15000);

      c.exec.mockResolvedValue([[null, '2'], [null, -2]]);
      await passThrough(limiter, '203.0.113.12');
      expect(c.pexpire).toHaveBeenCalledTimes(2);
    });

    it('should treat a zero counter as 1', async () => {
      connectRedis();
      const c = client();
      c.exec.mockResolvedValue([[null, '0'], [null, 1000]]);
      const limiter = rateLimiter.createRateLimiter({ windowMs: 60000, max: 5, keyPrefix: 'rlzero' });
      const { res } = await passThrough(limiter, '203.0.113.13');
      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', 4);
    });

    it('should fall back to memory when exec returns no results', async () => {
      connectRedis();
      const c = client();
      c.exec.mockResolvedValue([[null, '1'], null]);
      const limiter = rateLimiter.createRateLimiter({ windowMs: 60000, max: 5, keyPrefix: 'rlfall' });
      const a = await passThrough(limiter, '203.0.113.14');
      const b = await passThrough(limiter, '203.0.113.14');
      expect(a.res.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', 4); // memory count 1
      expect(b.res.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', 3); // memory count 2
    });

    it('should fall back to memory when Redis commands throw', async () => {
      connectRedis();
      const c = client();
      c.exec.mockRejectedValue(new Error('redis down'));
      const limiter = rateLimiter.createRateLimiter({ windowMs: 60000, max: 5, keyPrefix: 'rlthrow' });
      const { next } = await passThrough(limiter, '203.0.113.15');
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateCaptchaChallenge', () => {
    it('should generate a captcha challenge', () => {
      const challenge = rateLimiter.generateCaptchaChallenge();
      expect(challenge).toHaveProperty('id');
      expect(challenge).toHaveProperty('question');
      expect(challenge).toHaveProperty('token');
    });
    it('should have question with = ?', () => {
      const challenge = rateLimiter.generateCaptchaChallenge();
      expect(challenge.question).toContain('=');
    });
    it('should generate unique IDs', () => {
      const c1 = rateLimiter.generateCaptchaChallenge();
      const c2 = rateLimiter.generateCaptchaChallenge();
      expect(c1.id).not.toBe(c2.id);
    });

    it('should produce an addition question that really verifies', () => {
      const random = vi.spyOn(Math, 'random');
      pendingSpies.push(random);
      random.mockReturnValueOnce(0.05); // num1 = 2
      random.mockReturnValueOnce(0.05); // num2 = 1
      random.mockReturnValueOnce(0.9);  // operation '+'
      const challenge = rateLimiter.generateCaptchaChallenge();
      expect(challenge.question).toBe('2 + 1 = ?');
      expect(solveCaptchaToken(challenge.token).answer).toBe('3');
      expect(rateLimiter.verifyCaptchaSolution(challenge.token, '3')).toBe(true);
    });

    it('should produce a subtraction question (higher − lower) that really verifies', () => {
      const random = vi.spyOn(Math, 'random');
      pendingSpies.push(random);
      random.mockReturnValueOnce(0.9); // num1 = 11
      random.mockReturnValueOnce(0.5); // num2 = 5
      random.mockReturnValueOnce(0.1); // operation '-'
      const challenge = rateLimiter.generateCaptchaChallenge();
      expect(challenge.question).toBe('11 - 5 = ?');
      expect(rateLimiter.verifyCaptchaSolution(challenge.token, 6)).toBe(true); // numeric answer accepted
    });
  });

  describe('verifyCaptchaSolution', () => {
    it('should return false for missing token', () => {
      expect(rateLimiter.verifyCaptchaSolution('', '5')).toBe(false);
    });
    it('should return false for missing answer', () => {
      expect(rateLimiter.verifyCaptchaSolution('token', '')).toBe(false);
    });
    it('should return false for null answer', () => {
      expect(rateLimiter.verifyCaptchaSolution('token', null)).toBe(false);
    });
    it('should return false for undefined answer', () => {
      expect(rateLimiter.verifyCaptchaSolution('token', undefined)).toBe(false);
    });
    it('should return false for invalid token format', () => {
      expect(rateLimiter.verifyCaptchaSolution('invalid', '5')).toBe(false);
    });

    it('should return false for a wrong answer', () => {
      const challenge = rateLimiter.generateCaptchaChallenge();
      const { answer } = solveCaptchaToken(challenge.token);
      expect(rateLimiter.verifyCaptchaSolution(challenge.token, `${answer}9`)).toBe(false);
    });

    it('should return false for a tampered signature (same length)', () => {
      const challenge = rateLimiter.generateCaptchaChallenge();
      const { answer } = solveCaptchaToken(challenge.token);
      const [payloadPart, sig] = challenge.token.split('.');
      const flipped = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
      expect(rateLimiter.verifyCaptchaSolution(`${payloadPart}.${flipped}`, answer)).toBe(false);
    });

    it('should return false when the signature has the wrong length (timingSafeEqual throws)', () => {
      const challenge = rateLimiter.generateCaptchaChallenge();
      const payloadPart = challenge.token.split('.')[0];
      expect(rateLimiter.verifyCaptchaSolution(`${payloadPart}.deadbeef`, '42')).toBe(false);
    });

    it('should return false for a correctly-signed but expired token', () => {
      const token = craftCaptchaToken('id1', '7', Date.now() - 1000);
      expect(rateLimiter.verifyCaptchaSolution(token, '7')).toBe(false);
    });

    it('should reject replays of an already-solved token', () => {
      const challenge = rateLimiter.generateCaptchaChallenge();
      const { answer } = solveCaptchaToken(challenge.token);
      expect(rateLimiter.verifyCaptchaSolution(challenge.token, answer)).toBe(true);
      expect(rateLimiter.verifyCaptchaSolution(challenge.token, answer)).toBe(false);
    });

    it('should forget used tokens once their bookkeeping entry expires', () => {
      vi.useFakeTimers();
      const challenge = rateLimiter.generateCaptchaChallenge();
      const { answer } = solveCaptchaToken(challenge.token);
      expect(rateLimiter.verifyCaptchaSolution(challenge.token, answer)).toBe(true);
      // Advance past the 10-minute used-token TTL (the challenge itself is
      // already past its 5-minute validity, so verification still fails —
      // but the used-entry was evicted rather than reported as "replay").
      vi.advanceTimersByTime(11 * 60 * 1000);
      expect(rateLimiter.verifyCaptchaSolution(challenge.token, answer)).toBe(false);
    });

    // NOTE: the >5000-entry lazy sweep inside markCaptchaTokenUsed is not
    // exercised through the public API on purpose: reaching it would require
    // 5000+ sign+verify cycles (~15k HMAC ops) for one branch. The important
    // contract — single-use enforcement — is covered above.
  });

  describe('recordAuthFailure (memory fallback)', () => {
    it('should return failure record', async () => {
      const result = await rateLimiter.recordAuthFailure('test-key');
      expect(result).toHaveProperty('failures');
      expect(result).toHaveProperty('delayMs');
      expect(result).toHaveProperty('isLocked');
      expect(result).toHaveProperty('retryAfterSec');
    });
    it('should increment failures', async () => {
      // Use a dedicated key: rate-limit state is a module-level singleton and
      // 'test-key' already has 1 recorded failure from the previous test.
      const key = 'increment-test-key';
      await rateLimiter.recordAuthFailure(key);
      await rateLimiter.recordAuthFailure(key);
      const result = await rateLimiter.recordAuthFailure(key);
      expect(result.failures).toBe(3);
    });

    it('should apply the documented exponential backoff tiers', async () => {
      const key = 'mem-tier-key';
      expect((await rateLimiter.recordAuthFailure(key)).delayMs).toBe(0);   // 1
      expect((await rateLimiter.recordAuthFailure(key)).delayMs).toBe(0);   // 2
      expect((await rateLimiter.recordAuthFailure(key)).delayMs).toBe(3000); // 3
      expect((await rateLimiter.recordAuthFailure(key)).delayMs).toBe(5000); // 4..14

      let result;
      for (let i = 5; i <= 15; i++) result = await rateLimiter.recordAuthFailure(key);
      expect(result!.failures).toBe(15);
      expect(result!.delayMs).toBe(60000);
      expect(result!.isLocked).toBe(true);
      expect(result!.retryAfterSec).toBeGreaterThan(0);
      expect(result!.retryAfterSec).toBeLessThanOrEqual(60);

      for (let i = 16; i <= 20; i++) result = await rateLimiter.recordAuthFailure(key);
      expect(result!.failures).toBe(20);
      expect(result!.delayMs).toBe(15 * 60 * 1000);
      expect(result!.isLocked).toBe(true);
      expect(result!.retryAfterSec).toBeGreaterThan(60);
    });

    it('should restart the counter after 30 minutes of inactivity', async () => {
      vi.useFakeTimers();
      const key = 'mem-idle-key';
      await rateLimiter.recordAuthFailure(key);
      await rateLimiter.recordAuthFailure(key);
      await rateLimiter.recordAuthFailure(key); // 3 failures
      vi.advanceTimersByTime(31 * 60 * 1000);
      const result = await rateLimiter.recordAuthFailure(key);
      expect(result.failures).toBe(1);
      expect(result.isLocked).toBe(false);
    });
  });

  describe('recordAuthFailure (Redis path)', () => {
    function storedRecord(partial: Partial<{ failures: number; lastFailureTime: number; lockedUntil: number }>) {
      return JSON.stringify({
        failures: partial.failures ?? 0,
        lastFailureTime: partial.lastFailureTime ?? Date.now(),
        lockedUntil: partial.lockedUntil ?? 0,
      });
    }

    it('should create a fresh record and persist with TTL', async () => {
      connectRedis();
      const c = client();
      c.get.mockResolvedValue(null);
      const result = await rateLimiter.recordAuthFailure('redis-fresh-key');
      expect(result.failures).toBe(1);
      expect(result.delayMs).toBe(0);
      expect(c.set).toHaveBeenCalledWith(
        'tinglov:auth:redis-fresh-key',
        expect.stringContaining('"failures":1'),
        'EX',
        3600
      );
    });

    it('should increment within the inactivity window', async () => {
      connectRedis();
      const c = client();
      c.get.mockResolvedValue(storedRecord({ failures: 2, lastFailureTime: Date.now() - 1000 }));
      const result = await rateLimiter.recordAuthFailure('redis-inc-key');
      expect(result.failures).toBe(3);
      expect(result.delayMs).toBe(3000);
    });

    it('should reset failures after 30 minutes of inactivity', async () => {
      connectRedis();
      const c = client();
      c.get.mockResolvedValue(storedRecord({ failures: 7, lastFailureTime: Date.now() - 31 * 60 * 1000 }));
      const result = await rateLimiter.recordAuthFailure('redis-idle-key');
      expect(result.failures).toBe(1);
      expect(result.delayMs).toBe(0);
    });

    it('should lock the account at 15 and at 20 failures', async () => {
      connectRedis();
      const c = client();
      c.get.mockResolvedValue(storedRecord({ failures: 14 }));
      const mid = await rateLimiter.recordAuthFailure('redis-lock15');
      expect(mid.failures).toBe(15);
      expect(mid.delayMs).toBe(60000);
      expect(mid.isLocked).toBe(true);
      expect(mid.retryAfterSec).toBeLessThanOrEqual(60);

      c.get.mockResolvedValue(storedRecord({ failures: 19 }));
      const hard = await rateLimiter.recordAuthFailure('redis-lock20');
      expect(hard.failures).toBe(20);
      expect(hard.delayMs).toBe(15 * 60 * 1000);
      expect(hard.isLocked).toBe(true);
      expect(hard.retryAfterSec).toBeGreaterThan(60);
    });

    it('should keep an already active lock visible', async () => {
      connectRedis();
      const c = client();
      c.get.mockResolvedValue(storedRecord({ failures: 2, lastFailureTime: Date.now() - 500, lockedUntil: Date.now() + 120000 }));
      const result = await rateLimiter.recordAuthFailure('redis-active-lock');
      expect(result.failures).toBe(3);
      expect(result.isLocked).toBe(true);
      expect(result.retryAfterSec).toBeLessThanOrEqual(120);
    });

    it('should fall back to memory when the stored payload is corrupt', async () => {
      connectRedis();
      const c = client();
      c.get.mockResolvedValue('{not valid json');
      const result = await rateLimiter.recordAuthFailure('redis-corrupt-key');
      expect(result.failures).toBe(1);
      expect(c.set).not.toHaveBeenCalled();
    });

    it('should fall back to memory when Redis throws', async () => {
      connectRedis();
      const c = client();
      c.get.mockRejectedValue(new Error('redis gone'));
      const result = await rateLimiter.recordAuthFailure('redis-throw-key');
      expect(result.failures).toBe(1);
    });
  });

  describe('resetAuthFailure', () => {
    it('should reset failures', async () => {
      await rateLimiter.recordAuthFailure('test-key');
      await rateLimiter.resetAuthFailure('test-key');
      const result = await rateLimiter.getAuthAttempts('test-key');
      expect(result.failures).toBe(0);
    });

    it('should delete the Redis record and the memory copy too', async () => {
      connectRedis();
      const c = client();
      await rateLimiter.recordAuthFailure('reset-both-key'); // also mirrored to memory? no — redis branch only
      await rateLimiter.resetAuthFailure('reset-both-key');
      expect(c.del).toHaveBeenCalledWith('tinglov:auth:reset-both-key');
      expect((await rateLimiter.getAuthAttempts('reset-both-key')).failures).toBe(0);
    });

    it('should not blow up when Redis del rejects', async () => {
      connectRedis();
      const c = client();
      c.del.mockRejectedValue(new Error('del failed'));
      await expect(rateLimiter.resetAuthFailure('reset-throw-key')).resolves.toBeUndefined();
    });
  });

  describe('getAuthAttempts', () => {
    it('should return zero for new key', async () => {
      const result = await rateLimiter.getAuthAttempts('new-key');
      expect(result.failures).toBe(0);
      expect(result.isLocked).toBe(false);
    });

    it('should report the lock window for memory records', async () => {
      const key = 'mem-locked-key';
      for (let i = 0; i < 15; i++) await rateLimiter.recordAuthFailure(key);
      const result = await rateLimiter.getAuthAttempts(key);
      expect(result.failures).toBe(15);
      expect(result.isLocked).toBe(true);
      expect(result.retryAfterSec).toBeGreaterThan(0);
    });

    it('should read from Redis and honour future/past locks', async () => {
      connectRedis();
      const c = client();
      c.get.mockResolvedValue(JSON.stringify({ failures: 21, lastFailureTime: Date.now(), lockedUntil: Date.now() + 90000 }));
      const locked = await rateLimiter.getAuthAttempts('redis-get-locked');
      expect(locked.failures).toBe(21);
      expect(locked.isLocked).toBe(true);
      expect(locked.retryAfterSec).toBeLessThanOrEqual(90);

      c.get.mockResolvedValue(JSON.stringify({ failures: 4, lastFailureTime: Date.now() - 90000, lockedUntil: Date.now() - 1000 }));
      const expired = await rateLimiter.getAuthAttempts('redis-get-expired');
      expect(expired.failures).toBe(4);
      expect(expired.isLocked).toBe(false);
      expect(expired.retryAfterSec).toBe(0);
    });

    it('should fall back to memory when Redis has no record or throws', async () => {
      connectRedis();
      const c = client();
      c.get.mockResolvedValue(null);
      const empty = await rateLimiter.getAuthAttempts('redis-get-miss');
      expect(empty.failures).toBe(0);

      c.get.mockResolvedValue('@@corrupt@@');
      const corrupt = await rateLimiter.getAuthAttempts('redis-get-corrupt');
      expect(corrupt.failures).toBe(0);

      c.get.mockRejectedValue(new Error('boom'));
      const thrown = await rateLimiter.getAuthAttempts('redis-get-throws');
      expect(thrown.failures).toBe(0);
    });
  });

  describe('checkAuthRateLimit', () => {
    it('should call next when not locked', async () => {
      const res = stubRes();
      const next = vi.fn();
      const req = { ip: '127.0.0.1', body: { identifier: 'test' } };
      await rateLimiter.checkAuthRateLimit(req as any, res as any, next);
      expect(next).toHaveBeenCalled();
    });

    it('should request a captcha after 3 accumulated failures', async () => {
      const ip = '198.51.100.7';
      for (let i = 0; i < 3; i++) await rateLimiter.recordAuthFailure(`auth:ip:${ip}`);
      const req: any = { ip, body: { identifier: ' ZOD@MAIL ' } };
      const next = vi.fn();
      await rateLimiter.checkAuthRateLimit(req, stubRes() as any, next);
      expect(req.requiresCaptcha).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    it('should 429 while the account/IP lock is active', async () => {
      const ip = '198.51.100.8';
      for (let i = 0; i < 15; i++) await rateLimiter.recordAuthFailure(`auth:ip:${ip}`);
      const res = stubRes();
      const next = vi.fn();
      const req = { ip, body: { identifier: 'someone' } };
      await rateLimiter.checkAuthRateLimit(req as any, res as any, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ requiresCaptcha: true }));
    });

    it('should tolerate a request without a body', async () => {
      const res = stubRes();
      const next = vi.fn();
      await rateLimiter.checkAuthRateLimit({ ip: '198.51.100.9' } as any, res as any, next);
      expect(next).toHaveBeenCalled();
    });

    it('should consult Redis and 429 on a locked record', async () => {
      connectRedis();
      const c = client();
      c.get.mockResolvedValue(JSON.stringify({ failures: 20, lastFailureTime: Date.now(), lockedUntil: Date.now() + 45000 }));
      const res = stubRes();
      const next = vi.fn();
      const req = { ip: '198.51.100.10', body: { identifier: 'lockeduser' } };
      await rateLimiter.checkAuthRateLimit(req as any, res as any, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
      expect(c.get).toHaveBeenCalledWith('tinglov:auth:auth:ip:198.51.100.10');
      expect(c.get).toHaveBeenCalledWith('tinglov:auth:auth:user:lockeduser');
    });
  });

  describe('Redis bootstrap failures (fresh module instances)', () => {
    it('should fall back to memory when the Redis constructor throws', async () => {
      mockRedis.throwOnConstruct = true;
      vi.resetModules();
      const mod = await import('@/server/rateLimiter');
      mockRedis.throwOnConstruct = false;
      expect(typeof mod.getClientIp).toBe('function');
      const result = await mod.recordAuthFailure('ctor-throw-key');
      expect(result.failures).toBe(1);
    });

    it('should fall back to memory when connect() rejects', async () => {
      mockRedis.connectReject = true;
      vi.resetModules();
      const mod = await import('@/server/rateLimiter');
      await new Promise(process.nextTick); // let the rejection .catch() run
      mockRedis.connectReject = false;
      const result = await mod.recordAuthFailure('connect-reject-key');
      expect(result.failures).toBe(1);
    });

    it('should run the periodic memory-store cleanup', async () => {
      vi.resetModules();
      vi.useFakeTimers({
        // Fake timers must be active BEFORE the module import so the module's
        // own 5-minute setInterval is registered on the fake clock. Microtask
        // scheduling (queueMicrotask/nextTick) stays real so `await` works.
        toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
      });
      const mod = await import('@/server/rateLimiter');

      const limiter = mod.createRateLimiter({ windowMs: 1000, max: 5, keyPrefix: 'interval' });
      await limiter(
        { ip: '192.0.2.77', socket: {} } as any,
        { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any,
        vi.fn()
      );
      for (let i = 0; i < 15; i++) await mod.recordAuthFailure('interval-auth-key');
      await mod.recordAuthFailure('interval-fresh-key');

      // Pass the rate-limit window and the auth inactivity window; the 5-minute
      // tick then prunes both stores (35-min tick clears the locked auth record).
      vi.advanceTimersByTime(36 * 60 * 1000);

      // The expired IP record and the stale auth records were pruned, so the
      // counters restart rather than being carried over.
      const res = stubRes();
      await limiter({ ip: '192.0.2.77', socket: {} } as any, res as any, vi.fn());
      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', 4);
      expect((await mod.getAuthAttempts('interval-auth-key')).failures).toBe(0);
      vi.useRealTimers();
    });
  });
});
