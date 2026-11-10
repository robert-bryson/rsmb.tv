import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import rehypeShiki from '@shikijs/rehype'
import remarkFrontmatter from 'remark-frontmatter'
import tailwindcss from '@tailwindcss/vite'
import { tripContentPlugin } from './scripts/trip-content-plugin.ts'
import { globeWebglPlugin } from './scripts/globe-webgl-plugin.ts'

const buildDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export default defineConfig(({ mode, command }) => {
  const localEnv = loadEnv(mode, process.cwd(), '');
  const cartoKey = [process.env.VITE_CARTO_API_KEY, process.env.CARTO_API_KEY, localEnv.VITE_CARTO_API_KEY, localEnv.CARTO_API_KEY]
    .map(value => value?.trim()).find(Boolean) ?? '';
  if (command === 'build' && mode !== 'trip-test' && mode !== 'test' && !cartoKey) {
    throw new Error('Set CARTO_API_KEY (a browser-restricted CARTO Basemaps key) before building the site.');
  }
  return ({
  base: '/',
  define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
    __BUILD_REVISION__: JSON.stringify(process.env.AWS_COMMIT_ID || process.env.GITHUB_SHA || 'local'),
    'import.meta.env.VITE_CARTO_API_KEY': JSON.stringify(cartoKey),
  },
  plugins: [
    mdx({
      remarkPlugins: [remarkFrontmatter],
      rehypePlugins: [[rehypeShiki, { theme: 'github-dark-default' }]],
    }),
    react(),
    globeWebglPlugin(),
    tripContentPlugin(),
    tailwindcss(),
  ],
  assetsInclude: ['**/*.glb'],
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  css: {
    devSourcemap: true,
    transformer: 'lightningcss',
  },
  server: {
    watch: {
      ignored: ['**/coverage/**', '**/test-results/**', '**/test-results-trips/**', '**/playwright-report/**'],
    },
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
  });
})
