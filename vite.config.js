import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: {
          three: ['three'],
          cannon: ['cannon-es'],
          nipplejs: ['nipplejs']
        }
      }
    },
    assetsInlineLimit: 0,
    copyPublicDir: true
  },
  server: {
    port: 5173,
    open: true
  },
  publicDir: 'assets',
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.fbx', '**/*.png', '**/*.jpg', '**/*.jpeg'],
  optimizeDeps: {
    exclude: ['cannon-es']
  }
}); 