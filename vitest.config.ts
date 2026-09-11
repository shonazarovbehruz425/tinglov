import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@/server': resolve(__dirname, 'server'),
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: join(__dirname, 'tests/setup.ts'),
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Ratcheted to 70/70/65 after the Redis/CAPTCHA (server/rateLimiter.ts,
      // now ~92% stmts) and sync/CRUD (storageService.ts, now ~98% stmts) gaps
      // were closed. Measured baseline: stmts 90.5%, lines 91.2%, branches
      // 82.1%, funcs 91.9%. Branches stay at 65 (not 70+) on purpose: they are
      // the most volatile metric when app code gains small new conditionals,
      // and server/auth.ts (~57%) / server/db.ts (~58%) remain the weakest
      // links. Raise line-by-line as those two files get tests.
      thresholds: {
        statements: 70,
        lines: 70,
        functions: 70,
        branches: 65,
      },
    },
  },
});
