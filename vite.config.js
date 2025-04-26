export default {
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    // Improve chunking strategy for better loading
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'cannon': ['cannon-es'],
          'vendor': ['nipplejs']
        }
      }
    }
  }
} 