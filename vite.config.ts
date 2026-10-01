import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import rehypeShiki from '@shikijs/rehype'
import remarkFrontmatter from 'remark-frontmatter'
import tailwindcss from '@tailwindcss/vite'
import { tripContentPlugin } from './scripts/trip-content-plugin.ts'

const buildDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export default defineConfig(({ mode }) => ({
  base: '/',
  define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  plugins: [
    mdx({
      remarkPlugins: [remarkFrontmatter],
      rehypePlugins: [[rehypeShiki, { theme: 'github-dark-default' }]],
    }),
    react(),
    tripContentPlugin(),
    tailwindcss(),
  ],
  assetsInclude: ['**/*.glb'],
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  build: {
    copyPublicDir: mode !== 'trip-test',
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 1400,

  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,tsx}'],
  },
}))
