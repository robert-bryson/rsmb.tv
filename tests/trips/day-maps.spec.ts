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
    const screenshot = await map.locator('canvas').screenshot({
        style: '.site-header, .maplibregl-control-container, .maplibregl-popup { visibility: hidden !important; }',
    });
    const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let amber = 0;
    let blue = 0;
    const bounds = [info.width, info.height, 0, 0];
    let stopPixels = 0;
    let blackRoute = 0;
    let bluePoint: { x: number; y: number } | undefined;
    let nearestBlue = Infinity;
    const isBluePixel = (index: number) => index >= 0 && index + 2 < data.length
        && Math.abs(data[index] - 56) < 12 && Math.abs(data[index + 1] - 189) < 12 && Math.abs(data[index + 2] - 248) < 12;
    for (let index = 0; index < data.length; index += info.channels) {
        const isAmber = Math.abs(data[index] - 251) < 12 && Math.abs(data[index + 1] - 191) < 12 && Math.abs(data[index + 2] - 36) < 12;
        const isBlue = isBluePixel(index);
        if (isAmber) amber++;
        if (isBlue) blue++;
        // Aim inside the stroke. Antialiased edge pixels can fall outside its hit area after rounding.
        if (isBlue && [index - info.channels, index + info.channels,
            index - info.width * info.channels, index + info.width * info.channels].every(isBluePixel)) {
            const pixel = index / info.channels;
            const x = pixel % info.width;
            const y = Math.floor(pixel / info.width);
            const distance = (x - info.width / 2) ** 2 + (y - info.height / 2) ** 2;
            if (distance < nearestBlue) {
                nearestBlue = distance;
                bluePoint = { x: x / info.width, y: y / info.height };
            }
        }
        if (data[index] > 245 && data[index + 1] > 245 && data[index + 2] > 245) stopPixels++;
        if (Math.max(data[index], data[index + 1], data[index + 2]) < 65) blackRoute++;
        if (isAmber || isBlue) {
            const pixel = index / info.channels;
            const x = pixel % info.width;
            const y = Math.floor(pixel / info.width);
            bounds[0] = Math.min(bounds[0], x);
            bounds[1] = Math.min(bounds[1], y);
            bounds[2] = Math.max(bounds[2], x);
            bounds[3] = Math.max(bounds[3], y);
        }
    }
    return { amber, blue, bounds, stopPixels, bluePoint, blackRoute };
}

test.beforeEach(async ({ page }) => fixedAssets(page));

test('loading and suspending day maps does not add horizontal scrolling', async ({ page, isMobile }) => {
    if (!isMobile) await page.setViewportSize({ width: 1748, height: 1000 });
    await page.goto('/trips/daily-test');
    const maps = page.locator('[data-trip-map]');
    await expect(maps).toHaveCount(3);
    // User input ends navigation's scroll restoration before programmatic scrolling.
    await page.keyboard.press('ArrowDown');

    // Paint each interactive map, then revisit maps that have been suspended.
    // Firefox can retain the pre-transform bounds only after a map is painted.
    for (const index of [0, 1, 2, 0, 2]) {
        const map = maps.nth(index);
        await map.scrollIntoViewIfNeeded();
        await expect(map.locator('canvas')).toBeVisible();
        await expect.poll(async () => {
            const pixels = await routePixels(map);
            return pixels.amber + pixels.blue;
        }).toBeGreaterThan(10);

        const layout = await page.evaluate(() => {
            window.scrollTo(10000, window.scrollY);
            const scrollX = window.scrollX;
            window.scrollTo(0, window.scrollY);
            return {
                pageWidth: document.documentElement.clientWidth,
                scrollWidth: document.documentElement.scrollWidth,
                scrollX,
            };
        });
        expect(layout.scrollWidth, `after painting map ${index + 1}`).toBe(layout.pageWidth);
        expect(layout.scrollX).toBe(0);
    }
});

async function settledRoutePixels(map: Locator) {
    let previous = '';
    let pixels: Awaited<ReturnType<typeof routePixels>>;
    await expect.poll(async () => {
        pixels = await routePixels(map);
        const current = JSON.stringify(pixels);
        const stable = current === previous;
        previous = current;
        return stable;
    }).toBe(true);
    return pixels!;
}

test('hovering a route highlights its bottom label and shows the matching day popup', async ({ page, isMobile }) => {
    if (!isMobile) await page.setViewportSize({ width: 1280, height: 1100 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/trips/daily-test');
    const overview = page.locator('[data-trip-map]').first();
    await overview.scrollIntoViewIfNeeded();
    const canvas = overview.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect.poll(async () => (await routePixels(overview)).blue).toBeGreaterThan(10);
    const initial = await settledRoutePixels(overview);
    if (!isMobile) {
        const point = initial.bluePoint!;
        const box = (await canvas.boundingBox())!;
        await page.mouse.move(box.x + point.x * box.width, box.y + point.y * box.height);
        const homebound = overview.getByRole('button', { name: '2. Homebound' });
        await expect(homebound).toHaveAttribute('data-highlighted', 'true');
        await expect(homebound).toHaveAttribute('aria-pressed', 'false');
        await expect(homebound).toHaveCSS('background-color', 'rgb(56, 189, 248)');
        await expect(overview.getByRole('tooltip')).toHaveText('Homebound');
        await expect(canvas).toHaveCSS('cursor', 'pointer');
        await page.mouse.move(0, 0);
        await expect(overview.getByRole('tooltip')).toHaveCount(0);
        await expect(homebound).not.toHaveAttribute('data-highlighted', 'true');
    }
    const coastbound = overview.getByRole('button', { name: '1. Coastbound' });
    await coastbound.focus();
    const popup = overview.getByRole('tooltip');
    await expect(popup).toHaveText('Coastbound');
    await expect(coastbound).toHaveAttribute('data-highlighted', 'true');
    await expect(coastbound).toHaveAttribute('aria-pressed', 'false');
    await expect(coastbound).toHaveAttribute('aria-describedby', (await popup.getAttribute('id'))!);
    if (!isMobile) {
        await coastbound.hover();
        await page.mouse.move(0, 0);
        await expect(popup).toHaveText('Coastbound');
        const point = initial.bluePoint!;
        const box = (await canvas.boundingBox())!;
        await page.mouse.move(box.x + point.x * box.width, box.y + point.y * box.height);
        await expect(popup).toHaveText('Homebound');
        await page.mouse.move(0, 0);
        await expect(popup).toHaveText('Coastbound');
    }
    await coastbound.press('Escape');
    await expect(popup).toHaveCount(0);
    await expect(coastbound).not.toHaveAttribute('aria-describedby');
    await expect(coastbound).toBeFocused();
    await coastbound.blur();
    await expect(popup).toHaveCount(0);
});

test('route clicks use the same day extent as bottom buttons and toggle back to the overview', async ({ page, isMobile }) => {
    if (!isMobile) await page.setViewportSize({ width: 1280, height: 1100 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/trips/daily-test');
    const overview = page.locator('[data-trip-map]').first();
    await overview.scrollIntoViewIfNeeded();
    const canvas = overview.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect.poll(async () => (await routePixels(overview)).blue).toBeGreaterThan(10);
    const originalBounds = (await settledRoutePixels(overview)).bounds;
    const homebound = overview.getByRole('button', { name: '2. Homebound' });
    const clickTrack = async () => {
        const point = (await settledRoutePixels(overview)).bluePoint!;
        const box = (await canvas.boundingBox())!;
        const x = box.x + point.x * box.width;
        const y = box.y + point.y * box.height;
        if (isMobile) await page.touchscreen.tap(x, y);
        else {
            await page.mouse.move(x, y);
            await expect(homebound).toHaveAttribute('data-highlighted', 'true');
            await page.mouse.click(x, y);
        }
        await page.mouse.move(0, 0);
    };
    await clickTrack();
    await expect(homebound).toHaveAttribute('aria-pressed', 'true');
    const trackBounds = (await settledRoutePixels(overview)).bounds;
    expect(trackBounds).not.toEqual(originalBounds);
    await page.getByRole('heading', { name: 'First day', exact: true }).click();
    await expect(homebound).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await routePixels(overview)).bounds).toEqual(originalBounds);
    await homebound.click();
    await page.mouse.move(0, 0);
    await expect(homebound).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await routePixels(overview)).bounds).toEqual(trackBounds);
    await clickTrack();
    await expect(homebound).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await routePixels(overview)).bounds).toEqual(originalBounds);
});

test('bottom day controls match track colors, emphasize on hover, and restore the overview after clicking away', async ({ page, isMobile }) => {
    // Keep the canvas and its bottom controls visible together during mouse-hover captures.
    if (!isMobile) await page.setViewportSize({ width: 1280, height: 1100 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/trips/daily-test');
    const overview = page.locator('[data-trip-map]').first();
    await overview.scrollIntoViewIfNeeded();
    const canvas = overview.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect.poll(async () => (await routePixels(overview)).amber).toBeGreaterThan(10);
    await expect.poll(async () => (await routePixels(overview)).blue).toBeGreaterThan(10);
    const originalBounds = (await settledRoutePixels(overview)).bounds;
    expect((await routePixels(overview)).stopPixels).toBe(0);
    expect(originalBounds[2]).toBeGreaterThan(originalBounds[0]);
    await canvas.evaluate(element => { element.dataset.retained = 'yes'; });
    const coastbound = overview.getByRole('button', { name: '1. Coastbound' });
    const daysBox = await overview.getByRole('group', { name: 'Map days' }).boundingBox();
    const canvasBox = await canvas.boundingBox();
    expect(daysBox!.y).toBeGreaterThanOrEqual(canvasBox!.y + canvasBox!.height);
    await expect(overview.getByRole('button', { name: 'All days' })).toHaveCount(0);
    await expect(overview.getByRole('button', { name: /Shared camp/ })).toHaveCount(0);
    await expect(coastbound).toHaveCSS('text-decoration-line', 'underline');
    await expect(coastbound).toHaveCSS('text-decoration-color', 'rgb(251, 191, 36)');
    if (!isMobile) {
        await coastbound.hover();
        await expect(coastbound).toHaveCSS('background-color', 'rgb(251, 191, 36)');
        await expect(coastbound).toHaveAttribute('aria-pressed', 'false');
        await expect.poll(async () => (await routePixels(overview)).blue).toBe(0);
        await page.mouse.move(0, 0);
        await expect.poll(async () => (await routePixels(overview)).blue).toBeGreaterThan(10);
    }
    await coastbound.focus();
    await page.keyboard.press('Enter');
    await expect(coastbound).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas).toHaveAttribute('data-retained', 'yes');
    await expect(overview.getByRole('button', { name: /^3\. Home/ })).toHaveCount(0);
    await expect.poll(async () => (await routePixels(overview)).blue).toBe(0);
    await expect.poll(async () => (await routePixels(overview)).amber).toBeGreaterThan(10);
    await expect(overview.getByRole('button', { name: 'Stops', exact: true })).toHaveCount(0);
    await expect(overview.getByRole('button', { name: /Shared camp/ })).toHaveCount(0);
    await expect(coastbound).toBeVisible();
    await page.getByRole('heading', { name: 'First day', exact: true }).click();
    await expect(coastbound).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await routePixels(overview)).blue).toBeGreaterThan(10);
    await expect.poll(async () => (await routePixels(overview)).bounds).toEqual(originalBounds);
    expect((await routePixels(overview)).stopPixels).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => innerWidth));
});

test('Escape clears a day selection while keeping the map and day controls', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/trips/daily-test');
    const overview = page.locator('[data-trip-map]').first();
    const day = overview.getByRole('button', { name: '2. Homebound' });
    await day.click();
    await expect(day).toHaveAttribute('aria-pressed', 'true');
    await day.press('Escape');
    await expect(day).toHaveAttribute('aria-pressed', 'false');
    await expect(overview.locator('canvas')).toBeVisible();
    await expect.poll(async () => (await routePixels(overview)).amber).toBeGreaterThan(10);
    await expect.poll(async () => (await routePixels(overview)).blue).toBeGreaterThan(10);
});

for (const timing of ['before', 'after'] as const) {
    test(`Escape resets the selected day ${timing} its focused preview becomes interactive`, async ({ page }) => {
        let releaseMap!: () => void;
        const mapModule = new Promise<void>(resolve => { releaseMap = resolve; });
        await page.route(/\/assets\/TripRouteMap-[^/]+\.js$/, async route => {
            await mapModule;
            await route.continue();
        });
        try {
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.goto('/trips/daily-test');
            const overview = page.locator('[data-trip-map]').first();
            const day = overview.getByRole('button', { name: '2. Homebound' });
            await day.click();
            await expect(day).toHaveAttribute('aria-pressed', 'true');
            await day.focus();
            await expect(day).toBeFocused();
            if (timing === 'before') {
                await page.keyboard.press('Escape');
                await expect(day).toHaveAttribute('aria-pressed', 'false');
                await expect(day).not.toHaveAttribute('data-highlighted', 'true');
            }
            releaseMap();
            await expect(overview.locator('canvas')).toBeVisible();
            // Use the actual keyboard target; locator.press would refocus a replacement button.
            if (timing === 'after') await page.keyboard.press('Escape');
            await expect(day).toHaveAttribute('aria-pressed', 'false');
            await expect(day).toBeFocused();
            await expect(day).not.toHaveAttribute('data-highlighted', 'true');
            await expect(overview.getByRole('tooltip')).toHaveCount(0);
            await expect.poll(async () => (await routePixels(overview)).amber).toBeGreaterThan(10);
            await expect.poll(async () => (await routePixels(overview)).blue).toBeGreaterThan(10);
        } finally {
            releaseMap();
        }
    });
}

for (const input of ['click', 'keyboard', 'touch'] as const) {
    for (const motion of ['no-preference', 'reduce'] as const) {
        test(`inline maps retain the full black route while fitting and resetting to their own day (${input}, ${motion})`, async ({ page, isMobile }) => {
            test.skip(input === 'touch' && !isMobile, 'Touch input requires a phone project.');
            await page.emulateMedia({ reducedMotion: motion });
            await page.goto('/trips/daily-test');
            const day = page.locator('[data-trip-map]').nth(2);
            await expect(day).toBeVisible();
            await page.keyboard.press('ArrowDown');
            await day.scrollIntoViewIfNeeded();
            await expect(day.getByRole('region', { name: 'Map of Homebound.' })).toBeVisible();
            await expect(day.getByText('Homebound', { exact: true })).toHaveCount(0);
            await expect(day.getByRole('button', { name: /Harbor/ })).toHaveCount(0);
            await expect(day.getByRole('button', { name: /Shared camp/ })).toBeVisible();
            const stops = day.getByRole('region').getByRole('button', { name: 'Stops', exact: true });
            const toggleStops = async () => {
                if (input === 'keyboard') await stops.press('Enter');
                else if (input === 'touch') await stops.tap();
                else await stops.click();
            };
            await expect(stops).toHaveAttribute('aria-pressed', 'true');
            await expect.poll(async () => (await routePixels(day)).stopPixels).toBeGreaterThan(10);
            await expect.poll(async () => (await routePixels(day)).blue).toBeGreaterThan(10);
            await expect.poll(async () => (await routePixels(day)).amber).toBe(0);
            await expect.poll(async () => (await routePixels(day)).blackRoute).toBeGreaterThan(100);
            const originalBounds = (await settledRoutePixels(day)).bounds;
            await expect(day.getByRole('button', { name: 'Show whole day' })).toBeHidden();
            await toggleStops();
            await expect(stops).toHaveAttribute('aria-pressed', 'false');
            await expect.poll(async () => (await routePixels(day)).stopPixels).toBe(0);
            await expect(day.getByRole('button', { name: /Shared camp/ })).toHaveCount(0);
            await expect(day.getByRole('button', { name: 'Show whole day' })).toBeHidden();
            await toggleStops();
            await expect(stops).toHaveAttribute('aria-pressed', 'true');
            await expect.poll(async () => (await routePixels(day)).stopPixels).toBeGreaterThan(10);
            await expect.poll(async () => (await routePixels(day)).bounds).toEqual(originalBounds);
            await day.getByRole('button', { name: 'Zoom in', exact: true }).click();
            await expect(day.getByRole('button', { name: 'Show whole day' })).toBeVisible();
            await day.getByRole('button', { name: 'Show whole day' }).click();
            await expect(day.getByRole('region', { name: 'Map of Homebound.', exact: true })).toBeVisible();
            await expect.poll(async () => (await routePixels(day)).amber).toBe(0);
            await expect.poll(async () => (await routePixels(day)).blackRoute).toBeGreaterThan(100);
            await expect.poll(async () => (await routePixels(day)).bounds).toEqual(originalBounds);
            await expect(day.getByRole('button', { name: 'Show whole day' })).toBeHidden();
        });
    }
}

test('distant overview maps release their canvas and restore the selected day without stops', async ({ page }) => {
    await page.goto('/trips/daily-test');
    const overview = page.locator('[data-trip-map]').first();
    await overview.scrollIntoViewIfNeeded();
    const selected = overview.getByRole('button', { name: '2. Homebound' });
    await selected.click();
    await selected.blur();
    await page.getByRole('contentinfo').evaluate(element => { element.style.marginTop = '3000px'; });
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
    await expect(overview.locator('canvas')).toHaveCount(0);
    await overview.scrollIntoViewIfNeeded();
    await expect(overview.locator('canvas')).toHaveCount(1);
    await expect(overview.getByRole('button', { name: '2. Homebound' })).toHaveAttribute('aria-pressed', 'true');
    await expect(overview.getByRole('button', { name: 'Stops', exact: true })).toHaveCount(0);
    expect((await routePixels(overview)).stopPixels).toBe(0);
});
