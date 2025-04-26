import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          'cannon-es': ['cannon-es'],
          nipplejs: ['nipplejs']
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.glb')) {
            return 'models/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    copyPublicDir: true
  },
  server: {
    port: 5173,
    open: true
  },
  publicDir: 'public',
  resolve: {
    alias: {
      '@assets': resolve(__dirname, 'assets')
    }
  }
}); 