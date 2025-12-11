import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import compression from 'vite-plugin-compression'

export default defineConfig({
  base: '/rsmb.tv/',
  plugins: [
    react(),
    tailwindcss(),
    // Gzip compression
    compression({
      algorithm: 'gzip',
      ext: '.gz',
    }),
    // Brotli compression (better compression ratio)
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
  ],
  assetsInclude: ['**/*.glb'],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'three-globe': ['three-globe', 'react-globe.gl'],
        },
      },
    },
  },
})
