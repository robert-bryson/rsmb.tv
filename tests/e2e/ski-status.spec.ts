import { expect, test, type Page } from '@playwright/test';
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import locations from '../../projects/ski-status/data/pilot-locations.json' with { type: 'json' };

const path = '/projects/ski-status/map';
const styleUrl = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json*';
const baseStyle: StyleSpecification = {
    version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#171b24' } }],
};

type ReviewWindow = Window & {
    skiStatusMap?: MapLibreMap;
    resolveClusterZoom?: (zoom: number) => void;
};

async function prepare(page: Page, style: StyleSpecification | null = baseStyle) {
    await page.route('https://**/*', route => route.abort());
    if (style) await page.route(styleUrl, route => route.fulfill({ json: style, headers: { 'access-control-allow-origin': '*' } }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function captureMap(page: Page) {
    await page.goto('/projects');
    // Capture the renderer by its public method. Restore the method after one call.
    await page.evaluate(async () => {
        const mapModule = '/src/maps/maplibre.ts';
        const { Map } = await import(mapModule) as typeof import('maplibre-gl');
        const original = Map.prototype.addSource;
        Map.prototype.addSource = function (id, source) {
            if (id === 'ski-areas') {
                Map.prototype.addSource = original;
                (window as ReviewWindow).skiStatusMap = this;
            }
            return original.call(this, id, source);
        };
    });
    await page.getByRole('link', { name: 'Open map: ski-status', exact: true }).click();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    const renderer = await page.evaluateHandle(() => (window as ReviewWindow).skiStatusMap!);
    await expect.poll(() => renderer.evaluate(map => map.loaded() && !map.isMoving())).toBe(true);
    return renderer;
}

test('selects the closest ski area where two markers overlap', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    await page.getByLabel('Region', { exact: true }).selectOption('UT');
    await page.getByRole('button', { name: 'Alta Ski Area', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Alta Ski Area' })).toBeVisible();
    await expect.poll(() => renderer.evaluate(map => map.loaded() && !map.isMoving())).toBe(true);
    const point = locations.locations.find(location => location.id === 'snowbird')!.coordinates as [number, number];
    const position = await renderer.evaluate((map, coordinates) => map.project(coordinates), point);
    await page.locator('.maplibregl-canvas').click({ position: { x: position.x, y: position.y } });
    await expect(page.getByRole('heading', { name: 'Snowbird', exact: true })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('button', { name: 'Snowbird', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await renderer.dispose();
});

test('ignores a cluster zoom that completes after table selection', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    const position = await renderer.evaluate(map => {
        const source = map.getSource<GeoJSONSource>('ski-areas')!;
        source.getClusterExpansionZoom = () => new Promise(resolve => { (window as ReviewWindow).resolveClusterZoom = resolve; });
        const feature = map.queryRenderedFeatures({ layers: ['ski-area-clusters'] })[0];
        if (feature?.geometry.type !== 'Point') throw new Error('No ski-area cluster is visible');
        return map.project(feature.geometry.coordinates as [number, number]);
    });
    await page.locator('.maplibregl-canvas').click({ position: { x: position.x, y: position.y } });
    await expect.poll(() => page.evaluate(() => Boolean((window as ReviewWindow).resolveClusterZoom))).toBe(true);
    await page.getByRole('button', { name: 'Alta Ski Area', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Alta Ski Area' })).toBeVisible();
    await expect.poll(() => renderer.evaluate(map => map.getZoom())).toBeGreaterThanOrEqual(9);
    const selectedView = await renderer.evaluate(map => ({ zoom: map.getZoom(), center: map.getCenter().toArray() }));
    await page.evaluate(async () => {
        (window as ReviewWindow).resolveClusterZoom!(4);
        await new Promise(resolve => requestAnimationFrame(resolve));
    });
    expect(await renderer.evaluate(map => ({ zoom: map.getZoom(), center: map.getCenter().toArray() }))).toEqual(selectedView);
    await renderer.dispose();
});

test('reports loading until the basemap tiles finish', async ({ page }) => {
    await prepare(page, {
        version: 8,
        sources: { fixture: { type: 'raster', tiles: ['https://basemaps.cartocdn.com/review/{z}/{x}/{y}.png'], tileSize: 256 } },
        layers: [{ id: 'fixture', type: 'raster', source: 'fixture' }],
    });
    let release = () => {};
    const waiting = new Promise<void>(resolve => { release = resolve; });
    let requested = 0;
    await page.route('https://basemaps.cartocdn.com/review/**', async route => {
        requested++;
        await waiting;
        await route.fulfill({
            headers: { 'access-control-allow-origin': '*' }, contentType: 'image/png',
            body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==', 'base64'),
        });
    });
    try {
        await page.goto(path);
        await expect.poll(() => requested).toBeGreaterThan(0);
        await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'loading', { timeout: 2_000 });
    } finally {
        release();
    }
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
});

test('keeps filters on mobile after basemap failure and returns focus when details close', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 680 });
    await prepare(page, null);
    await page.goto('/projects/ski-status?pass=indy');
    await expect(page).toHaveURL(`${path}?pass=indy`);
    await expect(page.getByText('1 of 25 ski areas')).toBeVisible();
    const row = page.getByRole('button', { name: 'Whaleback Mountain', exact: true });
    await row.press('Enter');
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'degraded', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Pass', { exact: true })).toHaveValue('indy');
    await page.getByRole('button', { name: 'Close details' }).press('Enter');
    await expect(row).toBeFocused({ timeout: 2_000 });
    await expect(row).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    const table = page.getByRole('region', { name: 'Ski area comparison table' });
    expect(await table.evaluate(region => region.scrollWidth)).toBeGreaterThan(320);
});
