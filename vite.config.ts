import { defineConfig } from 'vite';

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
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

