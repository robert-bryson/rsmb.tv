import { expect, test, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';

const routeData = {
    type: 'FeatureCollection', features: [
        { type: 'Feature', properties: { trackId: 'morning' }, geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46.7]] } },
        { type: 'Feature', properties: { trackId: 'afternoon' }, geometry: { type: 'LineString', coordinates: [[-123, 46.7], [-124, 45]] } },
        { type: 'Feature', properties: { trackId: 'return' }, geometry: { type: 'LineString', coordinates: [[-124, 45], [-122.3, 45.7], [-122, 47]] } },
    ],
};

async function fixedAssets(page: Page) {
    const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#999' } }).png().toBuffer();
    await page.route(/https:\/\/tile\.(openstreetmap|opentopomap)\.org\//, route => route.fulfill({ contentType: 'image/png', body: tile }));
    await page.route('https://demotiles.maplibre.org/**', route => route.fulfill({ body: '' }));
    await page.route('**/test-trip/**', route => route.request().url().endsWith('.geojson')
        ? route.fulfill({ json: routeData })
        : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="100%" height="100%" fill="#405b6b"/></svg>' }));
}

async function routePixels(map: Locator) {
    const { data, info } = await sharp(await map.locator('canvas').screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let amber = 0;
    let blue = 0;
    for (let index = 0; index < data.length; index += info.channels) {
        if (Math.abs(data[index] - 251) < 12 && Math.abs(data[index + 1] - 191) < 12 && Math.abs(data[index + 2] - 36) < 12) amber++;
        if (Math.abs(data[index] - 56) < 12 && Math.abs(data[index + 1] - 189) < 12 && Math.abs(data[index + 2] - 248) < 12) blue++;
    }
    return { amber, blue };
}

test.beforeEach(async ({ page }) => fixedAssets(page));

test('day selection keeps the map and renders distinct daily track colors', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/trips/daily-test');
    const overview = page.locator('[data-trip-map]').first();
    await overview.scrollIntoViewIfNeeded();
    const canvas = overview.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect.poll(async () => (await routePixels(overview)).amber).toBeGreaterThan(10);
    await expect.poll(async () => (await routePixels(overview)).blue).toBeGreaterThan(10);
    await canvas.evaluate(element => { element.dataset.retained = 'yes'; });
    const coastbound = overview.getByRole('button', { name: '1. Coastbound' });
    await coastbound.focus();
    await page.keyboard.press('Enter');
    await expect(coastbound).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas).toHaveAttribute('data-retained', 'yes');
    await expect(overview.getByRole('button', { name: /^3\. Home/ })).toHaveCount(0);
    await expect.poll(async () => (await routePixels(overview)).blue).toBe(0);
    await expect.poll(async () => (await routePixels(overview)).amber).toBeGreaterThan(10);
    await overview.getByRole('checkbox', { name: 'Show stops' }).uncheck();
    await expect(overview.getByRole('button', { name: /Shared camp/ })).toHaveCount(0);
    await overview.getByRole('button', { name: 'All days' }).click();
    await expect.poll(async () => (await routePixels(overview)).blue).toBeGreaterThan(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => innerWidth));
});

test('inline maps show their own day, scoped stops, and matching route color', async ({ page }) => {
    await page.goto('/trips/daily-test');
    const day = page.locator('[data-trip-map]').nth(2);
    await day.scrollIntoViewIfNeeded();
    await expect(day.getByRole('region', { name: 'Map of Homebound (reconstructed).' })).toBeVisible();
    await expect(day.getByRole('button', { name: /Harbor/ })).toHaveCount(0);
    await expect(day.getByRole('button', { name: /Shared camp/ })).toBeVisible();
    await expect.poll(async () => (await routePixels(day)).blue).toBeGreaterThan(10);
    await expect.poll(async () => (await routePixels(day)).amber).toBe(0);
    await day.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await day.getByRole('button', { name: 'Show whole day' }).click();
    await expect(day.getByRole('region', { name: 'Map of Homebound (reconstructed).', exact: true })).toBeVisible();
    await expect.poll(async () => (await routePixels(day)).amber).toBe(0);
});

test('distant maps release their canvas and restore the selected day and stop preference', async ({ page }) => {
    await page.goto('/trips/daily-test');
    const overview = page.locator('[data-trip-map]').first();
    await overview.scrollIntoViewIfNeeded();
    const selected = overview.getByRole('button', { name: '2. Homebound (reconstructed)' });
    await selected.click();
    await overview.getByRole('checkbox', { name: 'Show stops' }).uncheck();
    await overview.getByRole('checkbox', { name: 'Show stops' }).blur();
    await page.getByRole('contentinfo').evaluate(element => { element.style.marginTop = '3000px'; });
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
    await expect(overview.locator('canvas')).toHaveCount(0);
    await overview.scrollIntoViewIfNeeded();
    await expect(overview.locator('canvas')).toHaveCount(1);
    await expect(overview.getByRole('button', { name: '2. Homebound (reconstructed)' })).toHaveAttribute('aria-pressed', 'true');
    await expect(overview.getByRole('checkbox', { name: 'Show stops' })).not.toBeChecked();
});
