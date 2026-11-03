import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const port = 4176;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
    ...base,
    testMatch: 'temperature-map.spec.ts',
    use: { ...base.use, baseURL },
    webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER === '1' ? undefined : {
        env: { VITE_CARTO_API_KEY: 'browser-test-key', CARTO_API_KEY: '' },
        command: `npx vite build --mode trip-test --outDir dist/temperature-browser && npx vite preview --outDir dist/temperature-browser --host 127.0.0.1 --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
    },
});
