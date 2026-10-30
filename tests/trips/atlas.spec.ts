import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { tripAtlasColor } from '../../src/features/trips/atlas/tripAtlasView';

const atlas = '/projects/motorcycle-trips/map';
const geometry = {
    type: 'FeatureCollection', features: [{
        type: 'Feature', id: 0, properties: { trackId: 'morning' },
        geometry: { type: 'MultiLineString', coordinates: [[[-122, 47], [-123, 46], [-124, 45]], [[-124.2, 45.1], [-124.3, 45.3]]] },
    }],
};

test.beforeEach(async ({ page }) => {
    const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#777' } }).png().toBuffer();
    await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: tile }));
    await page.route('**/test-trip/**', route => route.request().url().endsWith('.geojson')
        ? route.fulfill({ json: geometry })
        : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="100%" height="100%" fill="#405b6b"/></svg>' }));
});

async function openList(page: Page) {
    const toggle = page.locator('#atlas-panel-toggle');
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
}

async function paintedRoute(page: Page, id?: string) {
    const canvas = page.locator('[data-testid="trip-atlas-map"] canvas');
    const screenshot = await canvas.screenshot({ style: 'header, aside, .maplibregl-control-container { visibility: hidden !important; }' });
    const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const hex = id ? tripAtlasColor(id).slice(1) : '';
    const color = id ? [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16)) : undefined;
    let count = 0;
    let point = { x: 0, y: 0 };
    let nearest = Infinity;
    const bounds = [info.width, info.height, 0, 0];
    for (let index = 0; index < data.length; index += info.channels) {
        const matches = color ? color.every((channel, offset) => Math.abs(data[index + offset] - channel) < 12)
            : Math.max(data[index], data[index + 1], data[index + 2]) - Math.min(data[index], data[index + 1], data[index + 2]) > 60;
        if (!matches) continue;
        const pixel = index / info.channels;
        const x = pixel % info.width;
        const y = Math.floor(pixel / info.width);
        count++;
        bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
        bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
        const distance = (x - info.width / 2) ** 2 + (y - info.height / 2) ** 2;
        if (distance < nearest) { nearest = distance; point = { x, y }; }
    }
    return { count, point, bounds };
}

test('project entry opens a playable map with published routes and accessible card selection', async ({ page }) => {
    await page.goto('/projects/motorcycle-trips');
    await expect(page).toHaveURL(new RegExp(`${atlas}$`));
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    await openList(page);
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(2);
    await expect(page.getByText('Unfinished draft must stay private')).toHaveCount(0);
    const button = page.getByRole('button', { name: 'Show route: Daily map test trip' });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/\?trip=daily-test$/);
    await expect.poll(async () => (await paintedRoute(page, 'daily-test')).count).toBeGreaterThan(30);
    await page.getByRole('button', { name: 'Show all trips' }).click();
    await expect(page).toHaveURL(new RegExp(`${atlas}$`));
    await expect(page.getByRole('button', { name: /^Show route:/, pressed: true })).toHaveCount(0);
});

test('shared selection and report returns restore the card scroll and camera', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${atlas}?trip=coastal-test`);
    const card = page.locator('[data-trip-id="coastal-test"]');
    await expect(card.getByRole('button', { name: /^Show route:/ })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    const reportLink = card.getByRole('link', { name: /Read trip report/ });
    await reportLink.scrollIntoViewIfNeeded();
    const before = await paintedRoute(page, 'coastal-test');
    const scroll = await page.locator('#atlas-trip-list').evaluate(element => element.scrollTop);
    await reportLink.click();
    await expect(page).toHaveURL(/\/trips\/coastal-test$/);
    await expect(page.getByRole('link', { name: /Back to map/ })).toHaveCount(2);
    await page.goBack();
    await expect(page).toHaveURL(/\?trip=coastal-test$/);
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    await expect.poll(() => page.locator('#atlas-trip-list').evaluate(element => element.scrollTop)).toBeCloseTo(scroll, 0);
    const after = await paintedRoute(page, 'coastal-test');
    after.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(5));
    await page.locator('[data-trip-id="coastal-test"]').getByRole('link', { name: /Read trip report/ }).click();
    await page.getByRole('link', { name: /Back to map/ }).first().click();
    await expect(page).toHaveURL(/\?trip=coastal-test$/);
    await expect(page.locator('[data-trip-id="coastal-test"]').getByRole('button', { name: /^Show route:/ })).toHaveAttribute('aria-pressed', 'true');
});

test('clicking empty map space deselects the route without moving the camera', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/test-trip/route.geojson', route => route.fulfill({ json: {
        type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-110, 40], [-111, 41]] },
    } }));
    await page.goto(`${atlas}?trip=daily-test`);
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    await expect.poll(async () => (await paintedRoute(page, 'daily-test')).count).toBeGreaterThan(30);
    const before = await paintedRoute(page);
    const canvas = page.locator('[data-testid="trip-atlas-map"] canvas');
    await canvas.click({ position: { x: page.viewportSize()!.width - 24, y: 240 } });
    await expect(page).toHaveURL(new RegExp(`${atlas}$`));
    await expect(page.getByRole('button', { name: /^Show route:/, pressed: true })).toHaveCount(0);
    await expect(page.locator('[data-testid="trip-atlas-map"]')).toHaveAttribute('data-selected-trip', '');
    const after = await paintedRoute(page);
    after.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(6));
});

test('overlapping routes offer a choice instead of selecting only the top line', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Pointer hit testing uses the desktop canvas; phones have equivalent card buttons.');
    await page.goto(`${atlas}?trip=daily-test`);
    await expect.poll(async () => (await paintedRoute(page, 'daily-test')).count).toBeGreaterThan(30);
    await page.locator('#atlas-panel-toggle').click();
    const { point } = await paintedRoute(page, 'daily-test');
    await page.locator('[data-testid="trip-atlas-map"] canvas').click({ position: point });
    const choices = page.getByRole('group', { name: 'Trips sharing this road' });
    await expect(choices).toBeVisible();
    await choices.getByRole('button', { name: 'Coastal test trip' }).click();
    await expect(page).toHaveURL(/\?trip=coastal-test$/);
    await expect(page.locator('[data-trip-id="coastal-test"]').getByText('Selected', { exact: true })).toBeVisible();
});

test('one failed route keeps report links and retries without reloading successful geometry', async ({ page }) => {
    let attempts = 0;
    let successfulRequests = 0;
    await page.route('**/test-trip/route.geojson', route => { successfulRequests++; return route.fulfill({ json: geometry }); });
    await page.route('**/test-trip/daily-route.geojson', route => ++attempts === 1
        ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.fulfill({ json: geometry }));
    await page.goto(atlas);
    await openList(page);
    await expect(page.getByText('Route unavailable.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: /Read trip report/ })).toHaveCount(2);
    await page.getByRole('button', { name: 'Retry route', exact: true }).click();
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Show route: Daily map test trip' }).click();
    await page.getByRole('button', { name: 'Show all trips' }).click();
    expect(attempts).toBe(2);
    expect(successfulRequests).toBe(1);
});

test('a late route response does not replace a newer trip selection', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/test-trip/daily-route.geojson', async route => { await held; await route.fulfill({ json: geometry }); });
    try {
        await page.goto(atlas);
        await openList(page);
        await page.getByRole('button', { name: 'Show route: Coastal test trip' }).click();
        await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
        const before = await paintedRoute(page, 'coastal-test');
        release();
        await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
        await expect(page).toHaveURL(/\?trip=coastal-test$/);
        const after = await paintedRoute(page, 'coastal-test');
        after.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(5));
    } finally { release(); }
});

test('renderer initialization failure retains usable cards and report navigation', async ({ page }) => {
    await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
            if (String(args[0]).includes('webgl')) return null;
            return original.apply(this, args);
        } as typeof original;
    });
    await page.goto(atlas);
    await openList(page);
    await expect(page.getByText('The interactive map is unavailable.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry map' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Read trip report/ })).toHaveCount(2);
    await page.getByRole('link', { name: /Read trip report/ }).first().click();
    await expect(page).toHaveURL(/\/trips\//);
});

test('a lost WebGL context retries without losing the selected trip or report links', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${atlas}?trip=coastal-test`);
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    await page.locator('[data-testid="trip-atlas-map"] canvas').evaluate((canvas: HTMLCanvasElement) => {
        const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
        if (!extension) throw new Error('WebGL context loss simulation is unavailable.');
        extension.loseContext();
    });
    await expect(page.getByText('The interactive map is unavailable.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: /Read trip report/ })).toHaveCount(2);
    await page.getByRole('button', { name: 'Retry map' }).click();
    await expect(page.getByRole('button', { name: 'Retry map' })).toHaveCount(0);
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    await expect(page).toHaveURL(/\?trip=coastal-test$/);
});

test('a failed renderer module leaves the trip list outside its error fallback', async ({ page }) => {
    await page.route(/\/assets\/TripAtlasMap-[^/]+\.js$/, route => route.abort());
    await page.goto(atlas);
    await openList(page);
    await expect(page.getByText('The map could not load.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload map' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Read trip report/ })).toHaveCount(2);
});

test('narrow screens keep panel controls, attribution, and invalid-selection feedback usable', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(`${atlas}?trip=unknown`);
    await expect(page.getByText('That trip is not available', { exact: false })).toBeVisible();
    await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible();
    const attribution = await page.locator('.maplibregl-ctrl-attrib').boundingBox();
    const panel = await page.getByRole('complementary', { name: 'Trip reports' }).boundingBox();
    expect(attribution!.y).toBeGreaterThanOrEqual(panel!.y + panel!.height);
    await page.locator('#atlas-panel-toggle').click();
    await expect(page.getByRole('button', { name: /^Show route:/ })).toHaveCount(0);
    await page.locator('#atlas-panel-toggle').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: /^Show route:/ })).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
