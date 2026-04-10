import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
      '/auth':      { target: 'http://localhost:3000', changeOrigin: true },
      '/api':       { target: 'http://localhost:3000', changeOrigin: true },
      '/env.js':    { target: 'http://localhost:3000', changeOrigin: true },
    }
  },
  build: {
    outDir: '../src/public/dist',
    emptyOutDir: true,
  }
});
