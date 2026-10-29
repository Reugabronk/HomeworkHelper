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
    // De app is één bundel (~220 kB gzip, vooral de AI-SDK en JSZip); dat is prima.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
