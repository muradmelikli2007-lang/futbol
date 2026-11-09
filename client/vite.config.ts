import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API runs on :3001 and Vite proxies /api to it.
// In production the Node server serves the built files itself, so there is nothing to configure.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1000 },
});
