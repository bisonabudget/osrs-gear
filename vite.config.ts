/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const USER_AGENT = 'osrs-gear (github.com/tristanbowdenfreeman-maker/osrs-gear)';

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  // The engine was written for Next.js, which fills these in.
  define: {
    'process.env.NEXT_PUBLIC_HIT_DIST_SANITY_CHECK': 'undefined',
    'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
  },
  resolve: {
    // The Wiki engine imports its own files as '@/...', and a few Next.js and test modules
    // that are swapped for small local versions here. Outside tests (the engine's own need
    // everything) its item and monster lists are the cut-down ones from scripts/build-data.ts.
    alias: [
      ...(process.env.VITEST ? [] : [
        { find: /^\.\.\/\.\.\/cdn\/json\/equipment\.json$/, replacement: path('./src/data/engine-equipment.json') },
        { find: /^\.\.\/\.\.\/cdn\/json\/monsters\.json$/, replacement: path('./src/data/engine-monsters.json') },
      ]),
      { find: /^@\/state$/, replacement: path('./src/engine/emptyPlayer.ts') },
      { find: /^@\//, replacement: path('./vendor/osrs-dps-calc/src/') },
      { find: /^next\/image$/, replacement: path('./src/shims/next-image.ts') },
      { find: /^axios$/, replacement: path('./src/shims/axios.ts') },
      { find: /^@jest\/globals$/, replacement: 'vitest' },
    ],
  },
  worker: { format: 'es' },
  server: {
    // Browsers can't read the hiscores from another site, so the dev server fetches them.
    proxy: {
      '/hiscores': {
        target: 'https://secure.runescape.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/hiscores/, '/m=hiscore_oldschool/index_lite.json'),
        headers: { 'User-Agent': USER_AGENT },
      },
    },
  },
  test: {
    // One engine test file has empty describe blocks, which Jest allows and Vitest fails.
    passWithNoTests: true,
    include: ['vendor/osrs-dps-calc/src/tests/**/*.test.ts', 'tests/**/*.test.ts'],
  },
}));
