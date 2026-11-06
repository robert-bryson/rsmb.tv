import { expect, test } from '@playwright/test';

test('flight data loads while the globe module is still downloading', async ({ page }) => {
    let releaseModule!: () => void;
    const moduleReady = new Promise<void>(resolve => { releaseModule = resolve; });
    let moduleRequested = false;
    const dataRequests: string[] = [];
    await page.route(/\/(?:assets\/FlightsMap-[^/]+\.js|src\/features\/flights\/components\/FlightsMap\.tsx)(?:\?|$)/, async route => {
        moduleRequested = true;
        await moduleReady;
        await route.continue();
    });
    page.on('request', request => {
        const filename = new URL(request.url()).pathname.split('/').at(-1)!;
        if (['flights.geojson', 'visitedAirports.geojson'].includes(filename)) dataRequests.push(filename);
    });
    try {
        await page.goto('/projects/flights/map', { waitUntil: 'domcontentloaded' });
        await expect.poll(() => moduleRequested).toBe(true);
        await expect.poll(() => [...dataRequests].sort()).toEqual(['flights.geojson', 'visitedAirports.geojson']);
    } finally {
        releaseModule();
    }
    await expect(page.getByRole('application')).toHaveAttribute('aria-label', /showing [1-9]\d* flights/, { timeout: 15_000 });
    await expect(page.locator('.flights-globe canvas')).toBeVisible();
    expect([...dataRequests].sort(), 'The map must reuse its prefetched data').toEqual(['flights.geojson', 'visitedAirports.geojson']);
});
