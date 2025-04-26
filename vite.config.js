import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['three', 'cannon-es', 'nipplejs'],
          'game': ['/src/js/main.js']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@assets': resolve(__dirname, 'assets')
    }
  }
}); 