import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  /* Backend phục vụ bản build tại /staff, nên asset phải có tiền tố này. */
  base: '/staff/',
  server: {
    port: 5173,
    /* Mặc định Vite chỉ nghe trên IPv6 loopback (::1). Máy khác trong cùng
       Wi-Fi, hoặc trình duyệt phân giải localhost ra 127.0.0.1, sẽ không gọi
       được. host: true khiến Vite nghe trên 0.0.0.0 nên mở bằng localhost,
       127.0.0.1 hay IP LAN đều được. Backend (cổng 3000) vốn đã nghe
       0.0.0.0 nên chỉ cần sửa phía web. */
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
