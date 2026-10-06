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
    rollupOptions: {
      output: {
        // 자주 바뀌지 않는 라이브러리를 별도 청크로 분리 → 앱 코드만 바뀐 배포에서도 브라우저 캐시 재사용
        manualChunks: {
          react: ['react', 'react-dom'],
          socket: ['socket.io-client'],
        },
      },
    },
  }
});
