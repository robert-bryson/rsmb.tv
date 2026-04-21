import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/',
  plugins: [
    mdx({
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
    }),
    react(),
    tailwindcss(),
  ],
  assetsInclude: ['**/*.glb'],
  build: {
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three'
          if (id.includes('node_modules/three-globe/') || id.includes('node_modules/react-globe.gl/')) return 'three-globe'
          if (id.includes('node_modules/maplibre-gl/')) return 'maplibre-gl'
          if (id.includes('/src/features/temperatures/components/TemperatureMap') ||
              id.includes('/src/features/temperatures/hooks/useTemperatureData')) {
            return 'temperatures-map-feature'
          }
          if (id.includes('/src/features/temperatures/components/RecordFreshnessMap')) {
            return 'temperatures-freshness-map'
          }
          if (id.includes('/src/features/temperatures/components/ClimateTrends') ||
              id.includes('/src/features/temperatures/components/RecordAgeChart') ||
              id.includes('/src/features/temperatures/components/RecordsBrokenTimeSeries') ||
              id.includes('/src/features/temperatures/components/HighLowRatioChart') ||
              id.includes('/src/features/temperatures/hooks/useClimateTrends')) {
            return 'temperatures-trends-feature'
          }
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
