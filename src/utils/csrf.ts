/**
 * CSRF Protection utility module for Tinglov
 * Provides secure token management, verification, and SameSite cookie synchronization.
 */

import { CSRF_STORAGE_KEY } from '../services/storageKeys';

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';

/**
 * Generates a cryptographically secure random hexadecimal token
 */
function generateRandomToken(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(24);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  console.warn('[CSRF] SECURITY: crypto.getRandomValues unavailable; using weak Math.random fallback token');
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Reads a cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

/**
 * Sets a secure cookie on the document with SameSite=Strict
 */
export function setSecureCookie(name: string, value: string, days: number = 1): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict${isSecure ? '; Secure' : ''}`;
}

/**
 * Retrieves the current valid CSRF token, synchronizing between cookie and sessionStorage
 */
export function getCsrfToken(): string {
  // 1. Try to read from XSRF-TOKEN cookie
  const cookieToken = getCookie(CSRF_COOKIE_NAME);
  if (cookieToken && cookieToken.length >= 16) {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem(CSRF_STORAGE_KEY, cookieToken);
      }
    } catch {}
    return cookieToken;
  }

  // 2. Try to read from sessionStorage
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = sessionStorage.getItem(CSRF_STORAGE_KEY);
      if (stored && stored.length >= 16) {
        setSecureCookie(CSRF_COOKIE_NAME, stored);
        return stored;
      }
    }
  } catch {}

  // 3. Generate a new secure token and synchronize
  const newToken = generateRandomToken();
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem(CSRF_STORAGE_KEY, newToken);
    }
  } catch {}
  setSecureCookie(CSRF_COOKIE_NAME, newToken);

  return newToken;
}

/**
 * Validates a submitted CSRF token against the current session/cookie token
 */
export function validateCsrfToken(submittedToken: unknown): boolean {
  if (!submittedToken || typeof submittedToken !== 'string') {
    return false;
  }
  const cleanSubmitted = submittedToken.trim();
  if (cleanSubmitted.length < 16) {
    return false;
  }
  const currentToken = getCsrfToken();
  return cleanSubmitted === currentToken;
}

/**
 * Returns HTTP headers containing the active CSRF token for fetch requests
 */
export function getCsrfHeaders(): Record<string, string> {
  return {
    'X-CSRF-Token': getCsrfToken(),
  };
}

/**
 * Asynchronously fetches a fresh CSRF token from the backend /api/csrf-token endpoint if available
 */
export async function syncCsrfWithBackend(): Promise<string> {
  try {
    const res = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.csrfToken) {
        setSecureCookie(CSRF_COOKIE_NAME, data.csrfToken);
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.setItem(CSRF_STORAGE_KEY, data.csrfToken);
          }
        } catch {}
        return data.csrfToken;
      }
    }
  } catch {
    // Fall back to client-generated token if backend is unreachable
  }
  return getCsrfToken();
}
