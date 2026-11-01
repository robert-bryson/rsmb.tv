import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { atlas, mockAtlasAssets } from './atlasTestHelpers';

const geometry = {
    type: 'FeatureCollection', features: [
        { type: 'Feature', properties: { trackId: 'return' }, geometry: { type: 'LineString', coordinates: [[-122.2, 46.3], [-121.5, 46.1]] } },
        { type: 'Feature', properties: { trackId: 'morning' }, geometry: { type: 'LineString', coordinates: [[-123, 46], [-122.8, 46.3]] } },
        { type: 'Feature', properties: { trackId: 'afternoon' }, geometry: { type: 'LineString', coordinates: [[-122.8, 46.3], [-122.2, 46.3]] } },
    ],
};

// The shared camera centers the day break. Its halo extends beyond the ordinary route casing.
async function dayBreakHaloPixels(page: Page) {
    const canvas = page.locator('[data-testid="trip-atlas-map"] canvas');
    const bounds = (await canvas.boundingBox())!;
    const { data, info } = await sharp(await canvas.screenshot({ style: '.atlas-trip-endpoint { visibility: hidden !important; }' })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const scale = info.width / bounds.width;
    let count = 0;
    for (let y = Math.round(info.height / 2 - 6 * scale); y <= Math.round(info.height / 2 - 5 * scale); y++) {
        for (let x = Math.round(info.width / 2 - scale); x <= Math.round(info.width / 2 + scale); x++) {
            const offset = (y * info.width + x) * info.channels;
            if (Math.max(data[offset], data[offset + 1], data[offset + 2]) < 35) count++;
        }
    }
    return count;
}

test('day-break dots appear for a selected trip with day data and disappear for other selections or the overview', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockAtlasAssets(page);
    await page.route('**/test-trip/*.geojson', route => route.fulfill({ json: geometry }));
    const camera = 'panel=collapsed&camera=-122.2,46.3,7,0,0';
    await page.goto(`${atlas}?${camera}&trip=daily-test`);
    await expect(page.getByText('2/2 routes')).toBeAttached();
    await expect.poll(() => dayBreakHaloPixels(page)).toBeGreaterThan(0);
    await page.goto(`${atlas}?${camera}&trip=coastal-test`);
    await expect(page.getByText('2/2 routes')).toBeAttached();
    await expect.poll(() => dayBreakHaloPixels(page)).toBe(0);
    await page.goto(`${atlas}?${camera}`);
    await expect(page.getByText('2/2 routes')).toBeAttached();
    await expect.poll(() => dayBreakHaloPixels(page)).toBe(0);
});

test('selected route endpoints follow authored recording order, follow zoom, and clear with selection', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockAtlasAssets(page);
    await page.route('**/test-trip/*.geojson', route => route.fulfill({ json: geometry }));
    const camera = 'panel=collapsed&camera=-122.2,46.3,7,0,0';
    await page.goto(`${atlas}?${camera}&trip=daily-test`);
    const start = page.getByRole('img', { name: 'Trip start', exact: true });
    const end = page.getByRole('img', { name: 'Trip end', exact: true });
    await expect(start).toBeVisible();
    await expect(end).toBeVisible();
    const map = (await page.getByTestId('atlas-map-viewport').boundingBox())!;
    const a = (await start.boundingBox())!;
    const b = (await end.boundingBox())!;
    const world = 512 * 2 ** 7;
    expect(a.x + a.width / 2).toBeCloseTo(map.x + map.width / 2 - 0.8 * world / 360, 0);
    expect(b.x + b.width / 2).toBeCloseTo(map.x + map.width / 2 + 0.7 * world / 360, 0);
    await expect(start).toHaveCSS('color', 'rgb(167, 139, 250)');
    await expect(end).toHaveCSS('color', 'rgb(167, 139, 250)');
    for (const marker of [start, end]) expect(await marker.evaluate(element => {
        const box = element.getBoundingClientRect();
        return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.tagName;
    })).toBe('CANVAS');
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('camera')?.split(',')[2]).toBe('8');
    const moved = (await end.boundingBox())!;
    expect(moved.x + moved.width / 2).toBeCloseTo(map.x + map.width / 2 + 0.7 * world * 2 / 360, 0);
    await page.getByRole('button', { name: 'Zoom to all trips', exact: true }).click();
    await expect(start).toHaveCount(0);
    await expect(end).toHaveCount(0);
});

test('round trips keep both endpoint icons visible beside their shared anchor without labels', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockAtlasAssets(page);
    const loop = structuredClone(geometry);
    loop.features.find(feature => feature.properties.trackId === 'morning')!.geometry.coordinates[0] = [-122.2, 46.3];
    loop.features.find(feature => feature.properties.trackId === 'return')!.geometry.coordinates[1] = [-122.2, 46.3];
    await page.route('**/test-trip/*.geojson', route => route.fulfill({ json: loop }));
    await page.goto(`${atlas}?panel=collapsed&camera=-122.2,46.3,7,0,0&trip=daily-test`);
    const start = page.getByRole('img', { name: 'Trip start', exact: true });
    const end = page.getByRole('img', { name: 'Trip end', exact: true });
    await expect(start).toBeVisible();
    await expect(end).toBeVisible();
    const a = (await start.boundingBox())!;
    const b = (await end.boundingBox())!;
    expect(a.x + a.width / 2).toBeCloseTo(b.x + b.width / 2, 1);
    expect(a.y + a.height / 2).toBeCloseTo(b.y + b.height / 2, 1);
    await expect(start).toHaveText('');
    await expect(end).toHaveText('');
    const { data, info } = await sharp(await page.screenshot({ clip: {
        x: a.x, y: a.y, width: a.width, height: a.height,
    } })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixel = (px: number, py: number) => {
        const x = Math.floor(px * info.width / 80);
        const y = Math.floor(py * info.height / 42);
        const offset = (y * info.width + x) * info.channels;
        return [...data.subarray(offset, offset + 3)];
    };
    // Both black pin bodies and their route-colored play/stop symbols remain visible.
    for (const [x, y] of [[10, 10], [48, 10]]) expect(Math.max(...pixel(x, y))).toBeLessThan(10);
    for (const [x, y] of [[21, 19], [59, 19]]) expect(pixel(x, y).every((channel, i) => Math.abs(channel - [167, 139, 250][i]) < 15)).toBe(true);
});
