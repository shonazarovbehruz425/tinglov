import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    esbuild: {
      // Build-time stripping of console statements and debugger in production
      drop: isProduction ? ['console', 'debugger'] : [],
      legalComments: 'none',
    },
    build: {
      minify: 'esbuild',
      sourcemap: false, // Prevent exposing source code and internals in production
    },
  };
});
