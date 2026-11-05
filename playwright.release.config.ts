import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/release',
    outputDir: './test-results/release-validation',
    fullyParallel: true,
    workers: 2,
    timeout: 30_000,
    reporter: process.env.CI ? 'github' : 'list',
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
