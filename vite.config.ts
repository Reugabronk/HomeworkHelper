/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` zorgt dat de site werkt in elke submap, zoals
// https://<gebruiker>.github.io/HomeworkHelper/ op GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
