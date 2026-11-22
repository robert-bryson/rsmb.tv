import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import rehypeShiki from '@shikijs/rehype'
import remarkFrontmatter from 'remark-frontmatter'
import { remarkTripChapters } from './scripts/remark-trip-chapters.ts'
import tailwindcss from '@tailwindcss/vite'
import { tripContentPlugin } from './scripts/trip-content-plugin.ts'
import { globeWebglPlugin } from './scripts/globe-webgl-plugin.ts'
import { publicAssetsPlugin } from './scripts/public-assets-plugin.ts'
import { siteSearchPlugin } from './scripts/site-search-plugin.ts'
import { skiConditionsDevPlugin } from './scripts/ski-conditions-dev-plugin.ts'
import { skiAssetsRoot } from './scripts/ski-asset-files.ts'
import { skiAssetsPlugin } from './scripts/ski-assets-plugin.ts'
import { skiVisitorDataPlugin } from './scripts/ski-visitor-data-plugin.ts'
import packageMetadata from './package.json' with { type: 'json' }

const buildDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export default defineConfig(({ mode, command }) => {
  const localEnv = loadEnv(mode, process.cwd(), '');
  const cartoKey = [process.env.VITE_CARTO_API_KEY, process.env.CARTO_API_KEY, localEnv.VITE_CARTO_API_KEY, localEnv.CARTO_API_KEY]
    .map(value => value?.trim()).find(Boolean) ?? '';
  const skiConditionsMode = command === 'serve' && mode !== 'test'
    ? process.env.VITE_SKI_CONDITIONS_LOCAL ?? localEnv.VITE_SKI_CONDITIONS_LOCAL ?? '1'
    : '0';
  if (command === 'build' && mode !== 'trip-test' && mode !== 'test' && !cartoKey) {
    throw new Error('Set CARTO_API_KEY (a browser-restricted CARTO Basemaps key) before building the site.');
  }
  return ({
  base: '/',
  define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
    __BUILD_VERSION__: JSON.stringify(packageMetadata.version),
    __BUILD_REVISION__: JSON.stringify(process.env.AWS_COMMIT_ID || process.env.GITHUB_SHA || 'local'),
    'import.meta.env.VITE_CARTO_API_KEY': JSON.stringify(cartoKey),
    'import.meta.env.VITE_SKI_CONDITIONS_LOCAL': JSON.stringify(skiConditionsMode),
  },
  plugins: [
    mdx({
      remarkPlugins: [remarkFrontmatter, remarkTripChapters],
      rehypePlugins: [[rehypeShiki, { theme: 'github-dark-default' }]],
    }),
    react(),
    globeWebglPlugin(),
    tripContentPlugin(),
    siteSearchPlugin(),
    publicAssetsPlugin(),
    skiAssetsPlugin({
      root: skiAssetsRoot(process.env.SKI_ASSETS_ROOT ?? localEnv.SKI_ASSETS_ROOT),
      releaseUrl: process.env.SKI_ASSETS_BASE_URL ?? localEnv.SKI_ASSETS_BASE_URL,
      includeInBuild: command === 'build' && mode !== 'trip-test' && mode !== 'test',
    }),
    skiVisitorDataPlugin(),
    skiConditionsDevPlugin(skiConditionsMode),
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
