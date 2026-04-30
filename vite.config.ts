import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import rehypeShiki from '@shikijs/rehype'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/',
  plugins: [
    mdx({
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
      rehypePlugins: [[rehypeShiki, { theme: 'github-dark-default' }]],
    }),
    react(),
    tailwindcss(),
  ],
  assetsInclude: ['**/*.glb'],
  build: {
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three'
          if (id.includes('node_modules/three-globe/') || id.includes('node_modules/react-globe.gl/')) return 'three-globe'
          if (id.includes('node_modules/maplibre-gl/')) return 'maplibre-gl'
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,tsx}'],
  },
})
