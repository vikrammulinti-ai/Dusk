import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The browser calls /api/*; Vite forwards it to the backend. This avoids CORS
// (the Fastify server has no CORS plugin). In Docker set API_PROXY_TARGET=http://backend:4000
const target = process.env.API_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/api': { target, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') } }
  }
});
