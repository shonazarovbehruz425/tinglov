/**
 * Client-Side Rate Limiter, Exponential Backoff & CAPTCHA Manager
 * Prevents automated brute-force attacks and safeguards login/register forms.
 */

const STORAGE_FAILURES_KEY = 'tinglov_auth_failures';
const STORAGE_COOLDOWN_KEY = 'tinglov_auth_cooldown_until';

export interface CaptchaData {
  id: string;
  question: string;
  token?: string;
  clientAnswer?: number;
}

export interface ClientRateLimitStatus {
  failures: number;
  cooldownRemainingSec: number;
  requiresCaptcha: boolean;
}

/**
 * Gets the current rate limit and backoff status
 */
export function getClientAuthStatus(): ClientRateLimitStatus {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return { failures: 0, cooldownRemainingSec: 0, requiresCaptcha: false };
  }

  const failures = parseInt(sessionStorage.getItem(STORAGE_FAILURES_KEY) || '0', 10);
  const cooldownUntil = parseInt(sessionStorage.getItem(STORAGE_COOLDOWN_KEY) || '0', 10);
  const now = Date.now();

  const cooldownRemainingSec = cooldownUntil > now ? Math.ceil((cooldownUntil - now) / 1000) : 0;

  return {
    failures,
    cooldownRemainingSec,
    requiresCaptcha: failures >= 3,
  };
}

/**
 * Records a failed login attempt and calculates exponential backoff cooldown
 */
export function recordClientAuthFailure(serverRetryAfterSec?: number): ClientRateLimitStatus {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return { failures: 1, cooldownRemainingSec: 0, requiresCaptcha: false };
  }

  const currentFailures = parseInt(sessionStorage.getItem(STORAGE_FAILURES_KEY) || '0', 10) + 1;
  sessionStorage.setItem(STORAGE_FAILURES_KEY, currentFailures.toString());

  // Calculate exponential backoff duration in milliseconds
  let cooldownMs = 0;
  if (serverRetryAfterSec && serverRetryAfterSec > 0) {
    cooldownMs = serverRetryAfterSec * 1000;
  } else if (currentFailures === 3) {
    cooldownMs = 3000; // 3 seconds
  } else if (currentFailures === 4) {
    cooldownMs = 8000; // 8 seconds
  } else if (currentFailures === 5) {
    cooldownMs = 20000; // 20 seconds
  } else if (currentFailures >= 6) {
    cooldownMs = 60000; // 60 seconds
  }

  const now = Date.now();
  const cooldownUntil = now + cooldownMs;
  if (cooldownMs > 0) {
    sessionStorage.setItem(STORAGE_COOLDOWN_KEY, cooldownUntil.toString());
  }

  const cooldownRemainingSec = Math.ceil(cooldownMs / 1000);

  return {
    failures: currentFailures,
    cooldownRemainingSec,
    requiresCaptcha: currentFailures >= 3,
  };
}

/**
 * Resets authentication failure counter on successful login
 */
export function resetClientAuthFailures(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  sessionStorage.removeItem(STORAGE_FAILURES_KEY);
  sessionStorage.removeItem(STORAGE_COOLDOWN_KEY);
}

/**
 * Fetches a CAPTCHA challenge from the server or generates a secure fallback
 */
export async function getCaptchaChallenge(): Promise<CaptchaData> {
  try {
    const res = await fetch('/api/captcha/new');
    if (res.ok) {
      const data = await res.json();
      if (data?.question && data?.token) {
        return {
          id: data.id,
          question: data.question,
          token: data.token,
        };
      }
    }
  } catch {
    // Fall back to client-generated verification challenge if backend is unreachable
  }

  // Client-side fallback challenge
  const num1 = Math.floor(Math.random() * 10) + 2;
  const num2 = Math.floor(Math.random() * 8) + 1;
  const op = Math.random() > 0.5 ? '+' : '-';
  const high = Math.max(num1, num2);
  const low = Math.min(num1, num2);

  const question = op === '+' ? `${num1} + ${num2} = ?` : `${high} - ${low} = ?`;
  const clientAnswer = op === '+' ? num1 + num2 : high - low;

  return {
    id: `c_${Date.now()}`,
    question,
    clientAnswer,
  };
}

/**
 * Verifies a CAPTCHA response
 */
export function verifyCaptchaClient(challenge: CaptchaData, answer: string): boolean {
  if (!challenge || !answer) return false;
  const cleanAnswer = answer.trim();

  // If client-side challenge fallback
  if (challenge.clientAnswer !== undefined) {
    return cleanAnswer === challenge.clientAnswer.toString();
  }

  // Backend token challenges will be fully validated on the server
  return cleanAnswer.length > 0;
}
