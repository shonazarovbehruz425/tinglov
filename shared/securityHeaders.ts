/**
 * shared/securityHeaders.ts
 * ---------------------------------------------------------------------------
 * Yagona manba (single source of truth) uchun HTTP xavfsizlik sarlavhalari
 * va Content-Security-Policy (CSP) qiymati.
 *
 * - Bu fayldagi qiymatlar server middleware (server/middleware/securityHeaders.ts)
 *   tomonidan ishlatiladi.
 * - KANONIK manba — SHU FAYL. Uchta iste'molchi BYTE-for-BYTE shu qiymatni
 *   qo'llaydi: (1) server CSP header (bu fayl orqali), (2) index.html
 *   <meta http-equiv="Content-Security-Policy">, (3) vite.config.ts
 *   SECURITY_HEADERS (dev/preview). Bularning biri o'zgartirilsa, uchtalari
 *   ham shu darhol moslanadi.
 *
 * - CSP hardening (skript direktivasi): 'unsafe-inline' OLIB TASHLANDI. Barcha
 *   inline script bloklari (dark-mode init + anti-clickjacking framebuster)
 *   mazmuni saqlanib public/js/boot.js ga ko'chirildi va index.html <head>
 *   ichida SINXRON ulanadi. Dastur bundle'lari va CDN skriptlari (unpkg,
 *   jsdelivr) external — brauzerda inline scriptga ehtiyoj qolmadi.
 *
 * - CSP style-src: 'unsafe-inline' SAQLANADI (hujjatlashtirilgan qaror):
 *   1) index.html dagi pre-paint <style id="antiClickjack"> body-hidden
 *      anti-FOUC/clickjacking mexanizmi inline <style> talab qiladi;
 *   2) src/ komponentlari innerHTML orqali son-sanoqsiz style="…" atributi
 *      generatsiya qiladi — style attribute'lar 'unsafe-inline'siz CSP
 *       tomonidan bloklanadi (olib tashlash UI'ni buzadi);
 *   3) Vite dev rejim CSS'ni JS yaratgan <style> teg'lari orqali inject
 *      qiladi (prod build CSS'ni external fayllarga chiqaradi).
 *   Element .style / setProperty API chaqiriqlari CSP tekshiruviga tushmaydi;
 *   tekshiruv faqat markup attribute'lari va <style> bloklariga qo'llanadi.
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
 * To'liq Content-Security-Policy qiymati — KANONIK.
 * Skript direktivasida inline ruxsat yo'q (qarang: fayl boshidagi hardening
 * izohi); style direktivasida esa hujjatlashtirilgan sabablarga ko'ra saqlangan.
 * Uch iste'molchi (server header, index.html meta, vite.config) shu qatorni
 * o'zgartirmasdan ishlatadi.
 */
export const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://unpkg.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
  "font-src 'self' data: https://fonts.gstatic.com https://unpkg.com",
  "img-src 'self' data: https: blob: https://*.r2.dev https://*.r2.cloudflarestorage.com",
  "media-src 'self' blob: data: https://cdn.jsdelivr.net https://storage.googleapis.com https://*.r2.dev https://*.r2.cloudflarestorage.com https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net https://storage.googleapis.com https://*.r2.dev https://*.r2.cloudflarestorage.com https://unpkg.com https://fonts.googleapis.com https:",
  "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
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
