import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
    testDir: './tests/trips', outputDir: './test-results-trips', fullyParallel: true,
    reporter: 'list',
    use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4175', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile-chromium', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
        ...(process.env.PLAYWRIGHT_FIREFOX === '1' ? [{
            name: 'firefox',
            use: {
                ...devices['Desktop Firefox'],
                deviceScaleFactor: 2,
                launchOptions: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE
                    ? { executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE }
                    : undefined,
            },
        }] : []),
        ...(process.env.PLAYWRIGHT_WEBKIT === '1' ? [{ name: 'webkit', use: { ...devices['iPhone 13'] } }] : []),
    ],
});
