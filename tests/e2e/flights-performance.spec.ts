import { devices, expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

test.use({ ...devices['Pixel 7'], serviceWorkers: 'block' });
test.skip(process.env.FLIGHTS_PERFORMANCE !== '1', 'Run explicitly against a production preview with FLIGHTS_PERFORMANCE=1.');
test.skip(({ browserName }) => browserName !== 'chromium', 'CPU and network throttling require Chromium CDP.');

test('flight animation toggles meet the mobile interaction budget', async ({ page, context, browser }, testInfo) => {
    test.setTimeout(90_000);
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    await session.send('Network.emulateNetworkConditions', {
        offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8,
    });
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/projects/flights/map?stats=0');
    await expect(page.locator('.flight-map-label').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Loading globe...', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('application')).toHaveAttribute('aria-label', /showing [1-9]\d* flights/, { timeout: 60_000 });
    const flightCount = Number((await page.getByRole('application').getAttribute('aria-label'))?.match(/showing (\d+) flights/)?.[1]);
    expect(flightCount).toBeGreaterThan(0);

    // Use actual trusted clicks. End after two animation frames, so measurement
    // includes React's update, the globe's queued layer work, and a painted frame.
    const samples: { action: string; durationMs: number }[] = [];
    for (let index = 0; index < 6; index++) {
        const action = index % 2 === 0 ? 'Pause flight animations' : 'Play flight animations';
        await page.evaluate(() => {
            const measured = window as typeof window & { flightTogglePaint?: Promise<number> };
            measured.flightTogglePaint = new Promise(resolve => {
                document.addEventListener('click', event => {
                    const start = event.timeStamp;
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)));
                }, { capture: true, once: true });
            });
        });
        await page.getByRole('button', { name: action, exact: true }).tap();
        const durationMs = await page.evaluate(() => (window as typeof window & { flightTogglePaint: Promise<number> }).flightTogglePaint);
        samples.push({ action, durationMs });
        await expect(page.getByRole('button', { name: index % 2 === 0 ? 'Play flight animations' : 'Pause flight animations', exact: true })).toBeVisible();
    }
    const report = {
        browser: browser.version(), device: 'Pixel 7', cpuSlowdown: 4,
        latencyMs: 150, downloadMbps: 1.6, uploadMbps: 0.75,
        // The baseline exceeded 900 ms. This ceiling catches that regression
        // while retaining headroom over optimized samples at 4x CPU slowdown.
        flightCount, samples, budgetMs: 600,
        renderScale: await page.locator('.flights-globe canvas').evaluate(canvas => (canvas as HTMLCanvasElement).width / canvas.clientWidth),
        maxDurationMs: Math.max(...samples.map(sample => sample.durationMs)),
    };
    await testInfo.attach('flight-animation-performance', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
    if (process.env.FLIGHTS_PERFORMANCE_REPORT) {
        await fs.writeFile(process.env.FLIGHTS_PERFORMANCE_REPORT, `${JSON.stringify(report, null, 2)}\n`);
    }
    expect(report.maxDurationMs, JSON.stringify(samples)).toBeLessThanOrEqual(report.budgetMs);
});
