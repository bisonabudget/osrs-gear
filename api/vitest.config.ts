import { defineConfig } from 'vitest/config';

// Keeps the site's vite.config.ts from being picked up.
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
