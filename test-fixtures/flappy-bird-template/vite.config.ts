import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const fixtureRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  root: fixtureRoot,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
