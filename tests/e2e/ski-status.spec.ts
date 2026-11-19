import { expect, test, type Page } from '@playwright/test';
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import locations from '../../projects/ski-status/data/locations.json' with { type: 'json' };

const path = '/projects/ski-status/map';
const styleUrl = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json*';
const baseStyle: StyleSpecification = {
    version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#171b24' } }],
};

type ReviewWindow = Window & {
    skiStatusMap?: MapLibreMap;
};

async function prepare(page: Page, style: StyleSpecification | null = baseStyle) {
    await page.route('https://**/*', route => route.abort());
    if (style) await page.route(styleUrl, route => {
        expect(new URL(route.request().url()).searchParams.get('key')).toBe('browser-test-key');
        return route.fulfill({ json: style, headers: { 'access-control-allow-origin': '*' } });
    });
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
    const altaDetails = page.getByRole('region', { name: 'Alta Ski Area', exact: true });
    await expect(altaDetails).toBeVisible();
    expect(await altaDetails.evaluate(details => {
        const panel = details.parentElement!;
        panel.scrollTop = panel.scrollHeight;
        return panel.scrollTop;
    })).toBeGreaterThan(0);
    await expect.poll(() => renderer.evaluate(map => map.loaded() && !map.isMoving())).toBe(true);
    const point = locations.locations.find(location => location.id === 'snowbird')!.coordinates as [number, number];
    const position = await renderer.evaluate((map, coordinates) => map.project(coordinates), point);
    await page.locator('.maplibregl-canvas').click({ position: { x: position.x, y: position.y } });
    const snowbirdDetails = page.getByRole('region', { name: 'Snowbird', exact: true });
    await expect(snowbirdDetails).toBeVisible({ timeout: 3_000 });
    expect(await snowbirdDetails.evaluate(details => details.parentElement!.scrollTop)).toBe(0);
    await expect(page.getByRole('button', { name: 'Snowbird', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await renderer.dispose();
});

test('draws one point per resort and changes its color without moving the camera', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    const start = await renderer.evaluate(map => {
        const source = map.getSource<GeoJSONSource>('ski-areas')!.serialize();
        if (typeof source.data === 'string' || source.data.type !== 'FeatureCollection') throw new Error('Missing resort points');
        return { count: source.data.features.length, clustered: Boolean(source.cluster), center: map.getCenter().toArray(), zoom: map.getZoom() };
    });
    expect(start.count).toBe(locations.locations.length);
    expect(start.clustered).toBe(false);
    await page.getByLabel('Color by', { exact: true }).selectOption('pass');
    await expect(page.getByRole('list', { name: 'Resort dot legend' })).toContainText('Multiple passes');
    await expect.poll(() => renderer.evaluate(map => {
        const data = map.getSource<GeoJSONSource>('ski-areas')!.serialize().data;
        return typeof data === 'object' && data.type === 'FeatureCollection'
            ? new Set(data.features.map(feature => feature.properties?.color)).size : 0;
    })).toBeGreaterThan(1);
    expect(await renderer.evaluate(map => ({ center: map.getCenter().toArray(), zoom: map.getZoom() })))
        .toEqual({ center: start.center, zoom: start.zoom });
    await renderer.dispose();
});

test('switches between all desktop layouts and keeps the camera, filters, sort, and selection', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const renderer = await captureMap(page);
    const views = page.getByRole('group', { name: 'Results view' });
    const mapView = views.getByRole('button', { name: 'Map', exact: true });
    const splitView = views.getByRole('button', { name: 'Split', exact: true });
    const tableView = views.getByRole('button', { name: 'Table', exact: true });
    const map = page.getByRole('region', { name: 'Map of ski areas' });
    const table = page.getByRole('region', { name: 'Ski area statistics' });
    const selection = page.getByRole('button', { name: 'Alta Ski Area', exact: true });
    await expect(splitView).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Region', { exact: true }).selectOption('UT');
    await page.getByRole('button', { name: 'Vertical', exact: true }).click();
    await selection.click();
    await expect.poll(() => renderer.evaluate(map => map.loaded() && !map.isMoving())).toBe(true);
    const splitMapWidth = (await map.boundingBox())!.width;
    const splitTableWidth = (await table.boundingBox())!.width;
    const camera = await renderer.evaluate(map => {
        map.jumpTo({ center: [-111.72, 40.7], zoom: 9.5 });
        return { center: map.getCenter().toArray(), zoom: map.getZoom() };
    });

    await mapView.click();
    await expect(mapView).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await map.boundingBox())?.width ?? 0).toBeGreaterThan(splitMapWidth + 150);
    const compactList = page.getByRole('region', { name: 'Ski area list' });
    await expect(compactList.getByRole('columnheader')).toHaveCount(2);
    await expect(compactList.getByRole('columnheader', { name: 'Vertical' })).toHaveAttribute('aria-sort', 'descending');
    await expect(selection).toHaveAttribute('aria-pressed', 'true');

    await tableView.click();
    await expect(tableView).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await table.boundingBox())?.width ?? 0).toBeGreaterThan(splitTableWidth + 150);
    await expect(map).toBeVisible();
    const comparison = page.getByRole('region', { name: 'Ski area comparison table' });
    await expect(comparison.getByRole('columnheader', { name: 'Vertical' })).toHaveAttribute('aria-sort', 'descending');

    await splitView.press('Enter');
    await expect(splitView).toHaveAttribute('aria-pressed', 'true');
    expect((await map.boundingBox())!.width).toBeCloseTo(splitMapWidth, 0);
    await expect(page.getByLabel('Region', { exact: true })).toHaveValue('UT');
    expect(await renderer.evaluate(map => ({ center: map.getCenter().toArray(), zoom: map.getZoom() }))).toEqual(camera);
    expect(await renderer.evaluate(map => map.getContainer() === document.querySelector('[data-testid="ski-status-map"]'))).toBe(true);
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject({ area: 'alta', region: 'UT', sort: 'verticalFt:desc', view: 'split' });
    await page.goBack();
    await expect(tableView).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('link', { name: 'Alta Ski Area details' }).click();
    await page.getByRole('button', { name: 'Close details' }).click();
    await expect(selection).toBeFocused();
    await renderer.dispose();
});

const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==', 'base64');

test('loads terrain only when enabled and zoomed in, with CARTO underneath', async ({ page }) => {
    await prepare(page);
    let terrainRequests = 0;
    await page.route('https://tiles.mapterhorn.com/**', route => {
        terrainRequests++;
        return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'image/png', body: tile });
    });
    const renderer = await captureMap(page);
    await page.getByRole('checkbox', { name: 'Terrain relief' }).check();
    await expect.poll(() => renderer.evaluate(map => map.getLayer('ski-terrain-relief')?.type)).toBe('hillshade');
    expect(terrainRequests).toBe(0);
    await renderer.evaluate(map => { map.jumpTo({ center: [-111.635515, 40.573361], zoom: 10 }); });
    await expect.poll(() => terrainRequests).toBeGreaterThan(0);
    expect(await renderer.evaluate(map => Boolean(map.getLayer('background')))).toBe(true);
    await page.getByRole('checkbox', { name: 'Terrain relief' }).uncheck();
    await expect.poll(() => renderer.evaluate(map => Boolean(map.getSource('ski-terrain-dem')))).toBe(false);
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
            body: tile,
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

test('opens each phone layout with the same results when the basemap fails', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 680 });
    await prepare(page, null);
    await page.goto('/projects/ski-status?pass=indy&q=whaleback');
    await expect(page).toHaveURL(`${path}?pass=indy&q=whaleback`);
    await expect(page.getByText(`1 of ${locations.locations.length} ski areas`)).toBeVisible();
    const views = page.getByRole('group', { name: 'Results view' });
    const mapView = views.getByRole('button', { name: 'Map', exact: true });
    const tableView = views.getByRole('button', { name: 'Table', exact: true });
    const splitView = views.getByRole('button', { name: 'Split', exact: true });
    await expect(tableView).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('ski-status-map')).toHaveCount(0);
    const filterToggle = page.getByRole('button', { name: 'Filters', exact: true });
    await filterToggle.click();
    await expect(page.getByLabel('Pass', { exact: true })).toHaveValue('indy');
    await filterToggle.click();
    const row = page.getByRole('button', { name: 'Whaleback Mountain', exact: true });
    await row.press('Enter');
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await mapView.click();
    await expect(row).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Whaleback Mountain', exact: true })).toBeVisible();
    const map = page.getByTestId('ski-status-map');
    await expect(map).toHaveAttribute('data-map-state', 'degraded', { timeout: 20_000 });
    const renderer = await map.elementHandle();
    const table = page.getByRole('region', { name: 'Ski area comparison table' });
    await splitView.click();
    await expect(map).toBeVisible();
    await expect(table).toBeVisible();
    expect((await map.boundingBox())!.y).toBeGreaterThan((await table.boundingBox())!.y);
    await tableView.click();
    await expect(map).toBeHidden();
    expect(await renderer!.evaluate(element => element.isConnected)).toBe(true);
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Close details' }).press('Enter');
    await expect(row).toBeFocused({ timeout: 2_000 });
    await expect(row).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    expect(await table.evaluate(region => region.scrollWidth)).toBeGreaterThan(320);
    await row.press('Enter');
    await mapView.click();
    await page.getByRole('button', { name: 'Close details' }).press('Enter');
    await expect(mapView).toBeFocused();
    await renderer!.dispose();
});
