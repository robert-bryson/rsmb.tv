import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import { makeAirport, makeFlight } from '../../src/test/helpers/flights';

test('globe readiness does not update camera state before mount', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', message => {
        if (message.type() === 'error' && message.text().includes("hasn't mounted yet")) errors.push(message.text());
    });
    await page.goto('/projects/flights/map?paths=0&stats=0');
    await expect(page.locator('.flights-globe canvas')).toBeVisible();
    await expect(page.getByText('Loading globe...', { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('a Pacific route focuses the camera across the date line', async ({ page }) => {
    const flights = JSON.parse(fs.readFileSync('public/data/flights/flights.geojson', 'utf8'));
    const features = flights.features.filter(({ properties }: { properties: { origin_code: string; destination_code: string } }) =>
        [properties.origin_code, properties.destination_code].sort().join('-') === 'ICN-YVR');
    expect(features.length).toBeGreaterThan(0);
    await page.route('**/data/flights/flights.geojson', route => route.fulfill({ json: { type: 'FeatureCollection', features } }));
    await page.goto('/projects/flights/map?paths=0');
    await page.getByRole('button', { name: /Select route (ICN to YVR|YVR to ICN)/ }).first().click();
    await expect.poll(() => Number(new URL(page.url()).searchParams.get('lng'))).toBeCloseTo(-178.3665, 2);
});

test('keyboard shortcuts update filters, help, color modes, and optional layers', async ({ page }) => {
    await page.route('**/data/flights/allAirports.geojson', route => route.fulfill({ json: { type: 'FeatureCollection', features: [] } }));
    await page.route('**/data/flights/usStates.geojson', route => route.fulfill({ json: { type: 'FeatureCollection', features: [] } }));
    await page.goto('/projects/flights/map?paths=0&stats=0');
    await expect(page.getByRole('button', { name: 'Toggle filters' })).toBeVisible();
    await page.keyboard.press('f');
    const filters = page.getByRole('dialog', { name: 'Filters' });
    await expect(filters).toBeVisible();
    const search = filters.getByPlaceholder('Search by code or name...');
    await search.fill('s');
    await search.press('h');
    await search.press('2');
    await expect(page.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).searchParams.get('color')).toBe(null);
    await page.getByRole('button', { name: 'Toggle filters' }).click();

    await page.keyboard.press('h');
    await expect(page.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    for (const [key, mode] of [['2', 'year'], ['3', 'frequency'], ['4', 'airline'], ['1', null]]) {
        await page.keyboard.press(key!);
        await expect.poll(() => new URL(page.url()).searchParams.get('color')).toBe(mode);
    }
    for (const [key, parameter] of [['Shift+A', 'allAirports'], ['Shift+U', 'usStates']]) {
        await page.keyboard.press(key!);
        await expect.poll(() => new URL(page.url()).searchParams.get(parameter!)).toBe('1');
        await page.keyboard.press(key!);
        await expect.poll(() => new URL(page.url()).searchParams.get(parameter!)).toBe(null);
    }
});

test('a failed globe texture can be retried without losing filters or the camera', async ({ page }) => {
    let fail = true;
    await page.route('**/basemaps/earth-night.webp', route => fail ? route.abort('failed') : route.continue());
    await page.goto('/projects/flights/map?paths=0&stats=0&year=2024&lat=10&lng=20&alt=1');
    await expect(page.getByRole('alert')).toContainText('Failed to load globe textures');
    fail = false;
    await page.getByRole('button', { name: 'Retry loading globe textures' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('Loading globe...', { exact: true })).toHaveCount(0);
    await expect(page.locator('.flights-globe canvas')).toBeVisible();
    await expect(page).toHaveURL(/year=2024&lat=10&lng=20&alt=1/);
    await page.locator('.flights-globe canvas').hover();
    await page.mouse.wheel(0, 300);
    await expect.poll(() => Number(new URL(page.url()).searchParams.get('alt'))).toBeGreaterThan(1);
});

test('failed clipboard APIs offer manual copying without reporting success', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true, value: { writeText: async () => { throw new Error('Clipboard denied'); } },
        });
        document.execCommand = () => false;
    });
    await page.goto('/projects/flights/map?paths=0&stats=0&year=2024');
    let manualUrl = '';
    page.once('dialog', async dialog => {
        manualUrl = dialog.defaultValue();
        await dialog.dismiss();
    });
    const share = page.getByRole('button', { name: 'Copy current view URL to clipboard' });
    await share.click();
    expect(new URL(manualUrl).searchParams.get('year')).toBe('2024');
    await expect(share).toHaveAttribute('title', 'Copy URL to share');
});

test('camera URL synchronization survives filter changes and keyboard reset', async ({ page }) => {
    await page.goto('/projects/flights/map?paths=0&stats=0&lat=10&lng=20&alt=1');
    const canvas = page.locator('.flights-globe canvas');
    await expect(canvas).toBeVisible();
    await expect(page.getByText('Loading globe...', { exact: true })).toHaveCount(0);
    const bounds = (await canvas.boundingBox())!;
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    await page.mouse.move(center.x, center.y);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => Number(new URL(page.url()).searchParams.get('alt'))).toBeGreaterThan(1);

    await page.getByRole('button', { name: 'Toggle filters' }).click();
    const filters = page.getByRole('dialog', { name: 'Filters' });
    await filters.getByRole('button', { name: '2024', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/year=2024/);
    const beforeDrag = new URL(page.url()).searchParams.get('lng');
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 100, center.y + 50, { steps: 10 });
    await page.mouse.up();
    await expect.poll(() => new URL(page.url()).searchParams.get('lng')).not.toBe(beforeDrag);

    await page.keyboard.press('s');
    await expect(page.getByTestId('stats-panel-content')).toHaveAttribute('data-state', 'open');
    await page.keyboard.press('r');
    await expect.poll(() => new URL(page.url()).searchParams.has('lat')).toBe(false);
    await expect.poll(() => new URL(page.url()).searchParams.has('alt')).toBe(false);
});

for (const delayedAsset of ['none', 'flights', 'textures'] as const) {
    test(`returning from an empty filtered year fits its airports again (delayed: ${delayedAsset})`, async ({ page }) => {
        const flight = makeFlight();
        const features = [flight, makeFlight({ id: 2, date: '1/1/2025', airline: 'Other' })]
            .map(properties => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: [] } }));
        const airports = [
            { properties: makeAirport('SEA'), coordinates: [flight.origin_lon, flight.origin_lat] },
            { properties: makeAirport('LAX', { region: 'US-CA', regionName: 'California' }), coordinates: [flight.destination_lon, flight.destination_lat] },
        ].map(({ properties, coordinates }) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates } }));
        let releaseInitialAsset!: () => void;
        const initialAsset = new Promise<void>(resolve => { releaseInitialAsset = resolve; });
        await page.route('**/data/flights/flights.geojson', async route => {
            if (delayedAsset === 'flights') await initialAsset;
            await route.fulfill({ json: { type: 'FeatureCollection', features } });
        });
        await page.route('**/data/flights/visitedAirports.geojson', route => route.fulfill({ json: { type: 'FeatureCollection', features: airports } }));
        if (delayedAsset === 'textures') {
            await page.route('**/basemaps/*.webp', async route => {
                await initialAsset;
                await route.continue();
            });
        }
        await page.clock.install();
        try {
            await page.goto('/projects/flights/map?paths=0&stats=0&year=2024&airline=Test', { waitUntil: 'domcontentloaded' });
            // Navigation can finish before the lazy page and its assets load.
            await expect(page.locator('.flights-globe canvas')).toBeVisible();
            if (delayedAsset === 'flights') {
                await expect(page.getByText('Loading globe...', { exact: true })).toHaveCount(0);
                await expect(page.getByText('Loading flights...', { exact: true })).toBeVisible();
            } else if (delayedAsset === 'textures') {
                await expect(page.getByRole('application')).toHaveAttribute('aria-label', /showing 1 flights/);
                await expect(page.getByText('Loading globe...', { exact: true })).toBeVisible();
                // Allow the year fit to run before the renderer reports readiness.
                await page.clock.runFor(100);
            }
        } finally {
            releaseInitialAsset();
        }
        const camera = () => {
            const params = new URL(page.url()).searchParams;
            return ['lat', 'lng', 'alt'].map(key => params.get(key));
        };
        await expect(page.getByRole('application')).toHaveAttribute('aria-label', /showing 1 flights/);
        await expect(page.getByText('Loading globe...', { exact: true })).toHaveCount(0);
        const fitted = ['40.695', '-120.36', '0.57'];
        await expect.poll(camera).toEqual(fitted);
        const labels = page.locator('.flights-globe .flight-map-label');
        const labelPositions = () => labels.evaluateAll(elements => Object.fromEntries(elements.map(element => {
            const { x, y } = element.getBoundingClientRect();
            return [element.textContent, [Math.round(x), Math.round(y)]];
        })));
        // Two seconds covers the camera tween and the initial globe animation.
        const finishCameraAnimation = async () => {
            // Flush pending renderer updates before skipping tween time.
            await page.clock.runFor(32);
            await page.clock.fastForward(2000);
            // The renderer projects labels before it updates the camera tween.
            await page.clock.runFor(64);
        };
        // Labels attach after the renderer starts its initial globe animation.
        // Texture preloading and the camera URL can finish before that point.
        await expect(labels).toHaveCount(2);
        await finishCameraAnimation();
        const fittedLabels = await labelPositions();
        const reset = page.getByRole('button', { name: 'Reset globe view to default position' });
        await reset.click();
        await expect.poll(camera).toEqual([null, null, null]);
        await finishCameraAnimation();
        await expect.poll(labelPositions).not.toEqual(fittedLabels);
        const selectYear = async (year: number) => {
            await page.getByRole('button', { name: 'Toggle filters' }).click();
            await page.getByRole('dialog', { name: 'Filters' }).getByRole('button', { name: String(year), exact: true }).click();
            await page.getByRole('button', { name: 'Toggle filters' }).click();
        };
        await selectYear(2025);
        await expect(page.getByRole('application')).toHaveAttribute('aria-label', /showing 0 flights/);
        await expect(labels).toHaveCount(0);
        await reset.click();
        await expect.poll(camera).toEqual([null, null, null]);
        await finishCameraAnimation();
        await selectYear(2024);
        await expect.poll(camera).toEqual(fitted);
        await expect(labels).toHaveCount(2);
        await finishCameraAnimation();
        await expect.poll(labelPositions).toEqual(fittedLabels);
    });
}

test('flight statistics opens by default and an explicit closed link stays closed', async ({ page }) => {
    await page.goto('/projects/flights/map?paths=0');
    const panel = page.getByTestId('stats-panel-content');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await page.getByRole('button', { name: 'Hide stats panel' }).click();
    await expect(panel).toHaveAttribute('data-state', 'closed');
    await page.reload();
    await expect(panel).toHaveAttribute('data-state', 'closed');
    await page.getByRole('button', { name: 'Show stats panel' }).click();
    await expect(panel).toHaveAttribute('data-state', 'open');
});

for (const width of [320, 390, 768, 1280]) {
    test(`filters and layers stay accessible without overlap at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 720 });
        await page.goto('/projects/flights/map?paths=0&stats=0');
        const filtersToggle = page.getByRole('button', { name: 'Toggle filters' });
        const layersToggle = page.getByRole('button', { name: 'Toggle layer options' });
        await filtersToggle.click();
        const filters = page.getByRole('dialog', { name: 'Filters' });
        await expect(filters).toBeVisible();
        const filterBounds = (await filters.boundingBox())!;
        const layersBounds = (await layersToggle.boundingBox())!;
        const intersects = filterBounds.x < layersBounds.x + layersBounds.width
            && filterBounds.x + filterBounds.width > layersBounds.x
            && filterBounds.y < layersBounds.y + layersBounds.height
            && filterBounds.y + filterBounds.height > layersBounds.y;
        expect(intersects, 'Layers button must not cover the Filters dialog').toBe(false);

        await layersToggle.click();
        await expect(layersToggle).toHaveAttribute('aria-expanded', 'true');
        await expect(filters).toHaveCount(0);
        await expect(filtersToggle).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByText('US States', { exact: true })).toBeVisible();
        const layerBounds = (await page.getByRole('region', { name: 'Map layers' }).boundingBox())!;
        expect(layerBounds.x).toBeGreaterThanOrEqual(0);
        expect(layerBounds.x + layerBounds.width).toBeLessThanOrEqual(width);
        expect(layerBounds.y).toBeGreaterThanOrEqual(layersBounds.y + layersBounds.height);
        expect(layerBounds.y + layerBounds.height).toBeLessThanOrEqual(720);
        await filtersToggle.click();
        await expect(layersToggle).toHaveAttribute('aria-expanded', 'false');
        await expect(filters).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
}
