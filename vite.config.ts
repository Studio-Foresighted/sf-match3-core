import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 8081,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
