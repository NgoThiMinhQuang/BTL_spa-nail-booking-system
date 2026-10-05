import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  /* Backend phục vụ bản build tại /admin, nên asset phải có tiều tố này. */
  base: '/admin/',
  server: {
    /* Cổng riêng so với app nhân viên (5173) để mở song song hai cửa sổ
       mà không dùng chung localStorage — tránh bị nhảy sang bên kia. */
    port: 5174,
    strictPort: true,
    /* Xem giải thích ở Admin-web/vite.config.ts: host: true để nghe cả IPv4
       và IP LAN, không chỉ ::1. */
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
