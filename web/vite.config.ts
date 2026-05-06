import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const gatewayTarget = process.env.VITE_GATEWAY_PROXY_TARGET
  || process.env.ZHUSHOU_GATEWAY_PROXY_TARGET
  || 'http://127.0.0.1:18789';
const gatewayWsTarget = gatewayTarget.replace(/^http/, 'ws');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: gatewayTarget,
        changeOrigin: true,
      },
      '/health': {
        target: gatewayTarget,
        changeOrigin: true,
      },
      '/healthz': {
        target: gatewayTarget,
        changeOrigin: true,
      },
      '/readyz': {
        target: gatewayTarget,
        changeOrigin: true,
      },
      '/ws': {
        target: gatewayWsTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@mantine/core', '@mantine/hooks', '@tabler/icons-react'],
          charts: ['recharts'],
        },
      },
    },
  },
});
