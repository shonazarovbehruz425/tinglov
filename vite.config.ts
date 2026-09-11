import { defineConfig } from 'vite';

/*
 * Xavfsizlik sarlavhalari — CSP ning YAGONA KANONIK manbasi:
 * shared/securityHeaders.ts (CSP_POLICY). Quyidagi qator shu fayldagi massiv
 * join('; ') + ';' natijasi bilan BYTE-for-BYTE bir xil bo'lishi shart
 * (index.html <meta> CSP ham shu qiymatda).
 *
 * Skript direktivasi hardening: inline ruxsat ('unsafe-inline') OLIB
 * TASHLANDI — inline script bloklari (dark-mode init + framebuster) public/js/boot.js ga ko'chirildi va
 * index.html <head> ichida sinxron ulanadi.
 *
 * style-src 'unsafe-inline' SAQLANADI (qarang: shared/securityHeaders.ts
 * izohi): pre-paint anti-clickjacking <style>, src/ komponentlarining
 * innerHTML orqali generatsiya qiladigan style="…" attribute'lari va Vite
 * dev'dagi JS-orqali <style> CSS inject qilish usuli shuni talab qiladi.
 *
 * Vite DEV rejimi (HMR) — nima uchun qattiq script-src dev'ni BUZMAYDI:
 *   - Vite dev'da /@vite/client va /src/main.ts kabi barcha skriptlar
 *     'self'dan yuklanuvchi EXTERNAL modullar (bu loyiha vanilla TS —
 *     inline "preamble" inject qilmaydigan react-refresh/legacy plugin'lari
 *     yo'q, shuning uchun inline skript ehtiyoji yo'q).
 *   - HMR WebSocket (ws://<dev-origin>) connect-src 'self' bilan qoplanadi.
 *   - Prod CSP qattiq holicha SAQLANADI — dev/prod uchun ajratish shart
 *     emas. AGAR kelajakda inline <script> inject qiluvchi plagin qo'shilsa
 *     (masalan @vitejs/plugin-react preamble), DEV uchun alohida yumshoq
 *     CSP qo'llansin (isProduction sharti bilan), PROD esa qattiq qolsin.
 */
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' data: https://fonts.gstatic.com https://unpkg.com; img-src 'self' data: https: blob: https://*.r2.dev https://*.r2.cloudflarestorage.com; media-src 'self' blob: data: https://cdn.jsdelivr.net https://storage.googleapis.com https://*.r2.dev https://*.r2.cloudflarestorage.com https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net https://storage.googleapis.com https://*.r2.dev https://*.r2.cloudflarestorage.com https://unpkg.com https://fonts.googleapis.com https:; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';",
};

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    server: {
      headers: SECURITY_HEADERS,
    },
    preview: {
      headers: SECURITY_HEADERS,
    },
    esbuild: {
      // Build-time stripping of console statements and debugger in production
      drop: isProduction ? ['console', 'debugger'] : [],
      legalComments: 'none',
    },
    build: {
      minify: 'esbuild',
      sourcemap: false, // Prevent exposing source code and internals in production
      rollupOptions: {
        output: {
          // Split heavyweight vendor libraries into cached parallel chunks so
          // the main bundle stays lean and browser caching stays effective.
          manualChunks: {
            supabase: ['@supabase/supabase-js'],
            validation: ['zod'],
            sanitizer: ['dompurify'],
          },
        },
      },
    },
  };
});

