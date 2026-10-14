/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fightFiles } from './scripts/fight-files';

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const USER_AGENT = 'osrs-gear (github.com/bisonabudget/osrs-gear)';

// Tells browsers to load scripts only from the site itself, and to reach only the places the site
// needs, so a script slipped into the page some other way won't run. Added to the built site only,
// as the dev server runs scripts of its own.
const securityPolicy = (api: string): Plugin => ({
  name: 'security-policy',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) => {
      // The theme script in index.html runs before the page draws, so it is allowed by its hash.
      const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
      const policy = [
        "default-src 'self'",
        `script-src 'self' ${inline.join(' ')}`,
        "style-src 'self' 'unsafe-inline'",
        // The build puts the smallest font files inside the stylesheet.
        "font-src 'self' data:",
        // Pictures and prices only come from the site and its Worker, never straight from the Wiki.
        "img-src 'self' data:",
        `connect-src 'self' ${api}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ].join('; ');
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
    },
  },
});

// Opens the connection to the Worker while the page is still loading, so the prices arrive sooner.
const preconnect = (api: string): Plugin => ({
  name: 'preconnect',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'link', attrs: { rel: 'preconnect', href: api, crossorigin: true }, injectTo: 'head' }],
});

// Writes sw.js, which keeps the site on visitors' devices, with this release's file list at the
// top. The list changes with every release, so browsers install the new copy.
const offline = (): Plugin => ({
  name: 'offline',
  apply: 'build',
  enforce: 'post',
  generateBundle(_, bundle) {
    const files = Object.keys(bundle).filter((f) => f.startsWith('assets/')).sort();
    this.emitFile({
      type: 'asset',
      fileName: 'sw.js',
      source: `const FILES = ${JSON.stringify(files)};\n\n${readFileSync(path('./src/sw.js'), 'utf8')}`,
    });
  },
});

// The search worker's 'virtual:fights', which loads one fight's engine monster. The built site
// downloads it from its own small file; the dev server has them all in the module.
const fightLoader = (): Plugin => {
  let build = false;
  return {
    name: 'fight-loader',
    configResolved: (config) => { build = config.command === 'build'; },
    resolveId: (id) => (id === 'virtual:fights' ? '\0virtual:fights' : undefined),
    load: (id) => {
      if (id !== '\0virtual:fights') return undefined;
      const fights = fightFiles();
      if (!build) {
        const bodies = Object.fromEntries([...fights].map(([key, f]) => [key, f.body]));
        return `const bodies = ${JSON.stringify(bodies)};
export const loadFight = async (key) => {
  if (!(key in bodies)) throw new Error('Unknown monster ' + key);
  return JSON.parse(bodies[key]);
};`;
      }
      const files = Object.fromEntries([...fights].map(([key, f]) => [key, f.file]));
      return `const files = ${JSON.stringify(files)};
export const loadFight = async (key) => {
  if (!(key in files)) throw new Error('Unknown monster ' + key);
  const reply = await fetch(new URL(files[key], import.meta.url));
  if (!reply.ok) throw new Error('Monster ' + key + ': ' + reply.status);
  return reply.json();
};`;
    },
  };
};

// Writes the files fightLoader downloads, next to the worker in assets/.
const fightData = (): Plugin => ({
  name: 'fight-data',
  apply: 'build',
  generateBundle() {
    for (const { file, body } of fightFiles().values()) this.emitFile({ type: 'asset', fileName: `assets/${file}`, source: body });
  },
});

const apiOrigin = (mode: string) => new URL(loadEnv(mode, process.cwd(), 'VITE_').VITE_API ?? 'https://api.bisonabudget.com').origin;

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), fightLoader(), fightData(), securityPolicy(apiOrigin(mode)), preconnect(apiOrigin(mode)), offline()],
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
  worker: { format: 'es', plugins: () => [fightLoader()] },
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
