/**
 * shared/securityHeaders.ts
 * ---------------------------------------------------------------------------
 * Yagona manba (single source of truth) uchun HTTP xavfsizlik sarlavhalari
 * va Content-Security-Policy (CSP) qiymati.
 *
 * - Bu fayldagi qiymatlar server middleware (server/middleware/securityHeaders.ts)
 *   tomonidan ishlatiladi va kelajakda index.html <meta http-equiv="Content-Security-Policy">
 *   bilan bir xil bo'lishi kerak.
 * - index.html meta CSP bilan mos: `frame-ancestors 'none'` va `form-action 'self'`
 *   kiritilgan.
 *
 * Ogohlantirish: Bu fayl HAM server (Node) HAM brauzer (DOM) muhitida ishlaydi,
 * shuning uchun faqat toza string/obyekt eksport qiladi — hech qanday DOM/Node
 * API ishlatilmaydi.
 */

export const HSTS_VALUE = 'max-age=31536000; includeSubDomains; preload';
export const X_CONTENT_TYPE_OPTIONS_VALUE = 'nosniff';
export const X_FRAME_OPTIONS_VALUE = 'DENY';
export const X_XSS_PROTECTION_VALUE = '1; mode=block';
export const REFERRER_POLICY_VALUE = 'strict-origin-when-cross-origin';
export const PERMISSIONS_POLICY_VALUE =
  "camera=(), microphone=(self), geolocation=(), payment=()";

/**
 * To'liq Content-Security-Policy qiymati.
 * `frame-ancestors 'none'` va `form-action 'self'` index.html meta CSP bilan mos.
 */
export const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
  "font-src 'self' data: https://fonts.gstatic.com https://unpkg.com",
  "img-src 'self' data: https: blob: https://*.r2.dev https://*.r2.cloudflarestorage.com",
  "media-src 'self' blob: data: https://cdn.jsdelivr.net https://storage.googleapis.com https://*.r2.dev https://*.r2.cloudflarestorage.com https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net https://storage.googleapis.com https://*.r2.dev https://*.r2.cloudflarestorage.com https://unpkg.com https://fonts.googleapis.com https:",
  "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ') + ';';

export interface SecurityHeaderMap {
  'Strict-Transport-Security': string;
  'X-Content-Type-Options': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
  'Content-Security-Policy': string;
}

/** Barcha xavfsizlik sarlavhalari (Express/Node res.setHeader uchun). */
export const SECURITY_HEADERS: SecurityHeaderMap = {
  'Strict-Transport-Security': HSTS_VALUE,
  'X-Content-Type-Options': X_CONTENT_TYPE_OPTIONS_VALUE,
  'X-Frame-Options': X_FRAME_OPTIONS_VALUE,
  'X-XSS-Protection': X_XSS_PROTECTION_VALUE,
  'Referrer-Policy': REFERRER_POLICY_VALUE,
  'Permissions-Policy': PERMISSIONS_POLICY_VALUE,
  'Content-Security-Policy': CSP_POLICY,
};

/** Sarlavhalar nusxasini qaytaradi (keymap sifatida). */
export function getSecurityHeaders(): SecurityHeaderMap {
  return { ...SECURITY_HEADERS };
}
