import { expect, test } from '@playwright/test';
import sharp from 'sharp';

for (const path of [
    '/projects/flights/map?paths=0&stats=0&basemap=positron',
    '/projects/temperature-records/map',
    '/projects/temperature-records/trends?tab=map',
]) {
    test(`basemap requests carry the configured key: ${path}`, async ({ page }) => {
        const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#c83232' } }).png().toBuffer();
        let requests = 0;
        const requestedStyles = new Set<string>();
        await page.route('https://basemaps.cartocdn.com/**', route => {
            expect(new URL(route.request().url()).searchParams.get('key')).toBe('browser-test-key');
            requests++;
            requestedStyles.add(new URL(route.request().url()).pathname);
            return route.fulfill({ contentType: 'image/png', body: tile });
        });
        await page.route('https://data.rsmb.tv/**', route => {
            const file = new URL(route.request().url()).pathname;
            if (file.endsWith('climateTrends.json')) return route.fulfill({ json: {
                source: 'test', description: 'test', totalHighs: 1, totalLows: 1,
                byDecade: [{ decade: 2020, label: '2020s', highs: 1, lows: 1, ratio: 1 }],
                byYear: [{ year: 2020, highs: 1, lows: 1 }], rollingRatio: [],
            } });
            if (file.endsWith('recentRecords.json')) return route.fulfill({ json: { asOf: '2026-11-02', dates: [], yesterday: [], last7Days: [] } });
            if (file.endsWith('summary.json')) return route.fulfill({ json: { lastUpdated: '2026-11-02T00:00:00Z', stateRecordCount: 0, countyRecordCount: 0, statesProcessed: 48 } });
            return route.fulfill({ json: { type: 'FeatureCollection', features: [] } });
        });
        await page.goto(path);
        await expect.poll(() => requests).toBeGreaterThan(0);
        await expect(page.getByRole('link', { name: 'CARTO', exact: true })).toBeVisible();
        if (path.includes('/flights/')) {
            const redPixels = async () => {
                const pixels = await sharp(await page.locator('.flights-globe canvas').screenshot()).removeAlpha().raw().toBuffer();
                let count = 0;
                for (let index = 0; index < pixels.length; index += 3) {
                    if (pixels[index] > 50 && pixels[index] > pixels[index + 1] * 1.5 && pixels[index] > pixels[index + 2] * 1.5) count++;
                }
                return count;
            };
            await expect.poll(redPixels).toBeGreaterThan(10_000);
            const firstCount = requests;
            await page.getByRole('button', { name: 'Toggle layer options' }).click();
            await page.getByRole('button', { name: 'Basemap (Light)', exact: true }).click();
            await page.getByRole('button', { name: 'Voyager', exact: true }).click();
            await expect.poll(() => requests).toBeGreaterThan(firstCount);
            await expect(page).toHaveURL(/basemap=voyager/);
            await expect.poll(() => [...requestedStyles].some(style => style.includes('voyager_nolabels'))).toBe(true);
            await page.getByRole('button', { name: 'Night', exact: true }).click();
            await expect(page).not.toHaveURL(/basemap=/);
            await expect(page.getByText('Loading globe...', { exact: true })).toHaveCount(0);
            await expect.poll(redPixels).toBeLessThan(1_000);
        }
    });
}
