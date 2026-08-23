/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so built asset URLs work on GitHub Pages project sites
  // (served under /<repo>/) as well as at a domain root.
  base: './',
  plugins: [react()],
  test: { globals: true, environment: 'jsdom', setupFiles: ['./tests/setup.ts'] },
});
