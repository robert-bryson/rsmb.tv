import { defineConfig, devices } from '@playwright/test';

function parsePort(value: string | undefined): number {
    if (value !== undefined && !/^\d+$/.test(value)) {
        throw new Error(`Invalid PLAYWRIGHT_PORT: ${value}`);
    }
    const port = Number(value ?? '4174');
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid PLAYWRIGHT_PORT: ${value}`);
    }
    return port;
}

const port = parsePort(process.env.PLAYWRIGHT_PORT);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === '1';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL,
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: skipWebServer ? undefined : {
        command: `npm run build-flights && npx vite --host 127.0.0.1 --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});