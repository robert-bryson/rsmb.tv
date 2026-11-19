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

async function captureMap(page: Page, { phone = false, state = 'ready' }: { phone?: boolean; state?: 'ready' | 'degraded' } = {}) {
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
    if (phone) await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', state);
    const renderer = await page.evaluateHandle(() => (window as ReviewWindow).skiStatusMap!);
    await expect.poll(() => renderer.evaluate(map => map.loaded() && !map.isMoving())).toBe(true);
    return renderer;
}

test('fits worldwide resorts on a phone and shows Ikon badges for a selected country', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await prepare(page);
    const renderer = await captureMap(page, { phone: true });
    await expect.poll(() => renderer.evaluate(map => {
        const points = map.queryRenderedFeatures({ layers: ['ski-area-points'] });
        return [...new Set(points.map(feature => feature.properties.areaId))].length;
    })).toBe(locations.locations.length);

    const filters = page.getByRole('button', { name: 'Filters', exact: true });
    await filters.click();
    await page.getByLabel('Region', { exact: true }).selectOption({ label: 'New Zealand' });
    await page.getByLabel('Pass', { exact: true }).selectOption('ikon');
    await filters.click();
    await page.getByLabel('Color by', { exact: true }).selectOption('pass');
    await expect.poll(() => renderer.evaluate(map => {
        if (!map.getLayer('ski-status-pass-badges')) return [];
        const points = map.queryRenderedFeatures({ layers: ['ski-status-pass-badges'] });
        return [...new Set(points.map(feature => feature.properties.areaId))].sort();
    })).toEqual(['coronet-peak', 'mt-hutt', 'the-remarkables']);

    await page.getByRole('button', { name: 'Table', exact: true }).click();
    const table = page.getByRole('region', { name: 'Ski area comparison table' });
    await expect(table.locator('tbody tr')).toHaveCount(3);
    await table.getByRole('button', { name: 'Mt Hutt', exact: true }).click();
    await expect(page.getByText('Methven, New Zealand', { exact: true })).toBeVisible();
    await renderer.dispose();
});

test('keeps listed Ikon destinations visible until the included-access filter is selected', async ({ page }) => {
    await prepare(page);
    await page.goto(`${path}?view=table&region=country%3AAT&area=kappl`);
    const details = page.getByRole('region', { name: 'Kappl', exact: true });
    await expect(details.getByRole('link', { name: 'Ikon (lift access unconfirmed)', exact: true })).toBeVisible();
    const table = page.getByRole('region', { name: 'Ski area comparison table' });
    await expect(table.getByRole('button', { name: 'See', exact: true })).toBeVisible();

    await page.getByLabel('Pass', { exact: true }).selectOption('ikon');
    await expect(details).toHaveCount(0);
    await expect(table.getByRole('button', { name: 'See', exact: true })).toHaveCount(0);
    await expect(table.getByRole('button', { name: 'Ischgl / Samnaun', exact: true })).toBeVisible();
});

test('shows separate Epic badges and table rows for the Hakuba Valley resorts', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    await page.getByLabel('Region', { exact: true }).selectOption({ label: 'Japan' });
    await page.getByLabel('Pass', { exact: true }).selectOption('epic');
    await page.getByRole('searchbox', { name: 'Search areas' }).fill('Hakuba Valley');
    await page.getByLabel('Color by', { exact: true }).selectOption('pass');

    await expect.poll(() => renderer.evaluate(map => {
        if (!map.getLayer('ski-status-pass-badges')) return 0;
        const features = map.queryRenderedFeatures({ layers: ['ski-status-pass-badges'] });
        return new Set(features.filter(feature => feature.properties.passBadge === 'epic')
            .map(feature => feature.properties.areaId)).size;
    })).toBe(10);
    const table = page.getByRole('region', { name: 'Ski area comparison table' });
    await expect(table.locator('tbody tr')).toHaveCount(10);
    await table.getByRole('button', { name: 'Hakuba Happo-One', exact: true }).click();
    const details = page.getByRole('region', { name: 'Hakuba Happo-One', exact: true });
    await expect(details.getByRole('link', { name: 'Epic', exact: true })).toHaveAttribute('href',
        'https://www.epicpass.com/regions/japan/hakuba-valley.aspx');
    await renderer.dispose();
});

test('filters worldwide Indy memberships and discounts on the map and table', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    const region = page.getByLabel('Region', { exact: true });
    const pass = page.getByLabel('Pass', { exact: true });
    const table = page.getByRole('region', { name: 'Ski area comparison table' });

    await region.selectOption({ label: 'Finland' });
    await pass.selectOption('indy');
    await page.getByLabel('Color by', { exact: true }).selectOption('pass');
    await expect(table.locator('tbody tr')).toHaveCount(3);
    await expect.poll(() => renderer.evaluate(map => {
        const layer = 'ski-status-pass-badges';
        if (!map.getLayer(layer)) return [];
        return [...new Set(map.queryRenderedFeatures({ layers: [layer] })
            .filter(feature => feature.properties.passBadge === 'indy')
            .map(feature => feature.properties.areaId))].sort();
    })).toEqual(['levi-ski-resort', 'pyha-ski-resort', 'ruka-ski-resort']);

    await region.selectOption('');
    await pass.selectOption({ label: 'Indy discounts' });
    await expect(table.locator('tbody tr')).toHaveCount(5);
    await expect(page.getByRole('list', { name: 'Resort dot legend' })).toHaveText('Indy discount');
    await expect.poll(() => renderer.evaluate(async map => {
        const data = await map.getSource<GeoJSONSource>('ski-areas')?.getData();
        return data?.type === 'FeatureCollection'
            ? data.features.find(feature => feature.properties?.areaId === 'whiteface')?.properties
            : undefined;
    })).toEqual({ areaId: 'whiteface', color: '#fb923c' });
    await table.getByRole('button', { name: 'North Cascade Heli', exact: true }).click();
    const details = page.getByRole('region', { name: 'North Cascade Heli', exact: true });
    await expect(details.getByText('Heli-skiing', { exact: true })).toBeVisible();
    await expect(details.getByRole('link', { name: 'Indy (discount only)', exact: true }))
        .toHaveAttribute('href', 'https://www.indyskipass.com/our-resorts/north-cascade-heli');
    await expect.poll(() => renderer.evaluate(map => {
        const source = map.getSource<GeoJSONSource>('ski-areas');
        return source?.getData().then(data => data.type === 'FeatureCollection' ? data.features.length : 0);
    })).toBe(5);
    await renderer.dispose();
});

test('shows a single shared destination on the map and table for either country', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    const table = page.getByRole('region', { name: 'Ski area comparison table' });
    const region = page.getByLabel('Region', { exact: true });
    await page.getByRole('searchbox', { name: 'Search areas' }).fill('Portes du Soleil');
    await page.getByLabel('Pass', { exact: true }).selectOption('indy');
    for (const country of ['France', 'Switzerland']) {
        await region.selectOption({ label: country });
        await expect(table.locator('tbody tr')).toHaveCount(1);
        await expect(table.getByRole('cell', { name: 'France / Switzerland', exact: true })).toBeVisible();
        await expect.poll(() => renderer.evaluate(async map => {
            const data = await map.getSource<GeoJSONSource>('ski-areas')?.getData();
            return data?.type === 'FeatureCollection' ? data.features.map(feature => feature.id) : [];
        })).toEqual(['portes-du-soleil']);
    }
    await renderer.dispose();
});

test('in-view results follow pan and zoom and support filters and sorting', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const renderer = await captureMap(page);
    const inView = page.getByRole('checkbox', { name: 'In map view', exact: true });
    const table = page.getByRole('region', { name: 'Ski area comparison table' });
    const row = (name: string) => table.getByRole('button', { name, exact: true });
    const camera = await renderer.evaluate(map => {
        map.jumpTo({ center: [-111.64, 40.6], zoom: 10 });
        return { center: map.getCenter().toArray(), zoom: map.getZoom() };
    });
    await expect(row('Whaleback Mountain')).toHaveCount(1);
    await inView.check();
    await expect(page).toHaveURL(/inView=1/);
    await expect(row('Alta Ski Area')).toBeVisible();
    await expect(row('Snowbird')).toBeVisible();
    await expect(row('Whaleback Mountain')).toHaveCount(0);

    await table.getByRole('button', { name: 'Vertical', exact: true }).click();
    await expect(table.getByRole('columnheader', { name: 'Vertical', exact: true })).toHaveAttribute('aria-sort', 'descending');
    const names = (await table.locator('tbody th button').allTextContents()).map(name => name.trim());
    expect(names.indexOf('Snowbird')).toBeLessThan(names.indexOf('Alta Ski Area'));

    const search = page.getByRole('searchbox', { name: 'Search areas' });
    await search.fill('snowbird');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(row('Snowbird')).toBeVisible();
    await search.fill('');
    await page.getByLabel('Pass', { exact: true }).selectOption('epic');
    await expect(row('Alta Ski Area')).toHaveCount(0);
    await row('Park City Mountain').click();
    await expect(page.getByRole('heading', { name: 'Park City Mountain', exact: true })).toBeVisible();
    expect(await renderer.evaluate(map => ({ center: map.getCenter().toArray(), zoom: map.getZoom() }))).toEqual(camera);

    const vail = locations.locations.find(location => location.id === 'vail-mountain')!.coordinates as [number, number];
    await renderer.evaluate((map, center) => { map.panTo(center, { duration: 0 }); }, vail);
    await expect(row('Vail Mountain')).toBeVisible();
    await expect(row('Beaver Creek Resort')).toBeVisible();
    await expect(row('Park City Mountain')).toHaveCount(0);
    await expect(page.getByText('Selected area is outside the map view.')).toBeVisible();
    const views = page.getByRole('group', { name: 'Results view' });
    await views.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(row('Beaver Creek Resort')).toHaveCount(0);
    await views.getByRole('button', { name: 'Split', exact: true }).click();
    await expect(row('Beaver Creek Resort')).toBeVisible();
    await renderer.evaluate(map => { map.setZoom(13); });
    await expect(row('Beaver Creek Resort')).toHaveCount(0);
    await expect(row('Vail Mountain')).toBeVisible();

    await renderer.evaluate(map => { map.panTo([-150, 28], { duration: 0 }); });
    await expect(page.getByText('No matching ski areas in this map view.')).toBeVisible();
    await page.getByRole('button', { name: 'Fit all results', exact: true }).click();
    await expect(row('Vail Mountain')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(inView).not.toBeChecked();
    await expect(row('Whaleback Mountain')).toHaveCount(1);
    await expect(table.getByRole('columnheader', { name: 'Vertical', exact: true })).toHaveAttribute('aria-sort', 'descending');
    await renderer.dispose();
});

test('uses the last visible map area when filters change in the phone table', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await prepare(page);
    const renderer = await captureMap(page, { phone: true });
    const inView = page.getByRole('checkbox', { name: 'In map view', exact: true });
    await inView.check();
    const filters = page.getByRole('button', { name: 'Filters', exact: true });
    await filters.click();
    await page.getByLabel('Pass', { exact: true }).selectOption('mountain-collective');
    await filters.click();
    await renderer.evaluate(map => { map.jumpTo({ center: [-111.63, 40.6], zoom: 10 }); });
    await expect(page.getByText(`2 of ${locations.locations.length} ski areas`)).toBeVisible();

    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(page.getByTestId('ski-status-map')).toBeHidden();
    await expect(inView).toBeChecked();
    const table = page.getByRole('region', { name: 'Ski area comparison table' });
    await expect(table.getByRole('button', { name: 'Alta Ski Area', exact: true })).toBeVisible();
    const brighton = table.getByRole('button', { name: 'Brighton Resort', exact: true });
    await expect(brighton).toHaveCount(0);
    await filters.click();
    await page.getByLabel('Pass', { exact: true }).selectOption('');
    await expect(brighton).toBeVisible();
    await expect(table.getByRole('button', { name: 'Whaleback Mountain', exact: true })).toHaveCount(0);
    await renderer.dispose();
});

test('keeps the phone table usable when an in-view link opens before the map', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await prepare(page);
    await page.goto(`${path}?view=table&inView=1&q=whaleback`);
    await expect(page.getByRole('checkbox', { name: 'In map view', exact: true })).toBeChecked();
    await expect(page.getByText('Open Map to set the area.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Whaleback Mountain', exact: true })).toBeVisible();
    await expect(page.getByTestId('ski-status-map')).toHaveCount(0);
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    await expect(page.getByText('Waiting for a map view.')).toHaveCount(0);
    await expect(page.getByText(`1 of ${locations.locations.length} ski areas`)).toBeVisible();
});

test('fits changes made in the phone table after the real map viewport returns', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await prepare(page);
    const renderer = await captureMap(page, { phone: true });
    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(page.getByTestId('ski-status-map')).toBeHidden();
    await renderer.evaluate(map => { map.resize(); });
    const filters = page.getByRole('button', { name: 'Filters', exact: true });
    await filters.click();
    await page.getByLabel('Region', { exact: true }).selectOption('BC');
    await filters.click();
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    const edges = ['mount-washington-alpine-resort', 'fernie-alpine-resort'].map(id =>
        locations.locations.find(location => location.id === id)!.coordinates as [number, number]);
    await expect.poll(() => renderer.evaluate((map, points) => {
        const { clientWidth } = map.getContainer();
        return Math.min(...points.flatMap(point => {
            const { x } = map.project(point);
            return [x, clientWidth - x];
        }));
    }, edges)).toBeGreaterThan(35);
    await renderer.dispose();
});

test('centers the resort selected while the background style is being retried', async ({ page }) => {
    await prepare(page, null);
    const renderer = await captureMap(page, { state: 'degraded' });
    await page.getByLabel('Region', { exact: true }).selectOption('WA');
    let release = () => {};
    const waiting = new Promise<void>(resolve => { release = resolve; });
    let requested = false;
    await page.route(styleUrl, async route => {
        requested = true;
        await waiting;
        await route.fulfill({ json: baseStyle, headers: { 'access-control-allow-origin': '*' } });
    });
    try {
        await page.getByRole('button', { name: 'Retry background' }).click();
        await expect.poll(() => requested).toBe(true);
        await page.getByLabel('Region', { exact: true }).selectOption('UT');
        await page.getByRole('button', { name: 'Alta Ski Area', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Alta Ski Area', exact: true })).toBeVisible();
    } finally {
        release();
    }
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    const alta = locations.locations.find(location => location.id === 'alta')!.coordinates;
    await expect.poll(() => renderer.evaluate(map => map.getCenter().lng)).toBeCloseTo(alta[0], 3);
    await expect.poll(() => renderer.evaluate(map => map.getZoom())).toBeGreaterThanOrEqual(9);
    await renderer.dispose();
});

async function findWhaleback(page: Page, renderer: Awaited<ReturnType<typeof captureMap>>) {
    const search = page.getByRole('searchbox', { name: 'Search areas' });
    await search.fill('whaleback');
    await search.press('Enter');
    await expect.poll(() => renderer.evaluate(map => {
        if (!map.loaded() || map.isMoving()) return false;
        return map.queryRenderedFeatures({ layers: ['ski-area-points'] })
            .some(feature => feature.properties.areaId === 'whaleback');
    })).toBe(true);
    const coordinates = locations.locations.find(location => location.id === 'whaleback')!.coordinates as [number, number];
    return renderer.evaluate((map, point) => {
        const { x, y } = map.project(point);
        return { x, y };
    }, coordinates);
}

test('previews a resort on hover and clears the selection on a blank map click', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const renderer = await captureMap(page);
    await page.getByLabel('Color by', { exact: true }).selectOption('pass');
    const position = await findWhaleback(page, renderer);
    await expect.poll(() => renderer.evaluate(map => map.getLayer('ski-status-pass-badges')
        && map.queryRenderedFeatures({ layers: ['ski-status-pass-badges'] }).some(feature => feature.properties.areaId === 'whaleback'))).toBe(true);
    const canvas = page.getByTestId('ski-status-map').locator('canvas');
    const background = { x: 24, y: (await canvas.boundingBox())!.height / 2 };
    const details = page.getByRole('region', { name: 'Whaleback Mountain', exact: true });
    const popup = page.getByRole('region', { name: 'Whaleback Mountain map popup', exact: true });
    const tooltip = page.getByRole('tooltip');

    await canvas.hover({ position });
    await expect(tooltip).toContainText('Whaleback Mountain');
    await expect(tooltip).toContainText('Enfield, NH');
    await expect(details).toHaveCount(0);
    await expect(popup).toHaveCount(0);
    await canvas.hover({ position: background });
    await expect(tooltip).toHaveCount(0);

    const iconEdge = { x: position.x + 9, y: position.y };
    await canvas.hover({ position: iconEdge });
    await expect(tooltip).toContainText('Whaleback Mountain');
    await canvas.click({ position: iconEdge });
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('86 ac');
    await expect(details).toBeVisible();
    await expect(tooltip).toHaveCount(0);
    await popup.getByRole('link', { name: 'View resort details' }).click();
    await expect(page).toHaveURL(/#ski-area-details$/);
    await renderer.evaluate(map => { map.panBy([40, 20], { duration: 0 }); });
    await expect(popup).toBeVisible();
    await expect.poll(() => renderer.evaluate(map => !map.isMoving())).toBe(true);
    const camera = await renderer.evaluate(map => ({ center: map.getCenter().toArray(), zoom: map.getZoom() }));

    await canvas.click({ position: background });
    await expect(popup).toHaveCount(0);
    await expect(details).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Whaleback Mountain', exact: true })).toHaveAttribute('aria-pressed', 'false');
    expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ q: 'whaleback', color: 'pass' });
    expect(await renderer.evaluate(map => ({ center: map.getCenter().toArray(), zoom: map.getZoom() }))).toEqual(camera);

    await page.goBack();
    await expect(popup).toBeVisible();
    await popup.getByRole('button', { name: 'Close resort popup' }).press('Escape');
    await expect(popup).toHaveCount(0);
    await expect(canvas).toBeFocused();
    await renderer.dispose();
});

test.describe('ski-status on touch screens', () => {
    test.use({ hasTouch: true, viewport: { width: 320, height: 680 } });

    test('opens a selected popup on tap and dismisses it with a tap away or its close button', async ({ page }) => {
        await prepare(page);
        const renderer = await captureMap(page, { phone: true });
        await page.getByLabel('Color by', { exact: true }).selectOption('pass');
        const position = await findWhaleback(page, renderer);
        const canvas = page.getByTestId('ski-status-map').locator('canvas');
        const popup = page.getByRole('region', { name: 'Whaleback Mountain map popup', exact: true });
        await canvas.tap({ position });
        await expect(popup).toBeVisible();
        const title = popup.getByText('Whaleback Mountain', { exact: true });
        await expect.poll(() => title.evaluate(node => {
            const panel = node.closest('.maplibregl-popup-content')!.getBoundingClientRect();
            const map = node.closest('[data-testid="ski-status-map"]')!.getBoundingClientRect();
            const bounds = node.getBoundingClientRect();
            const target = document.elementFromPoint(bounds.left + 2, bounds.top + bounds.height / 2);
            return panel.top >= map.top && panel.bottom <= map.bottom && node.contains(target);
        })).toBe(true);
        await expect(page.getByRole('tooltip')).toHaveCount(0);
        await expect(page).toHaveURL(/area=whaleback/);
        await title.tap();
        await expect(popup).toBeVisible();

        await canvas.tap({ position: { x: 20, y: (await canvas.boundingBox())!.height / 2 } });
        await expect(popup).toHaveCount(0);
        await expect(page).not.toHaveURL(/area=whaleback/);

        await canvas.tap({ position });
        await popup.getByRole('button', { name: 'Close resort popup' }).tap();
        await expect(popup).toHaveCount(0);
        await expect(page).not.toHaveURL(/area=whaleback/);
        await renderer.dispose();
    });
});

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

test('shows larger pass icons at overview zoom and one badge per multi-pass resort', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    const colors = page.getByLabel('Color by', { exact: true });
    await colors.selectOption('pass');
    const legend = page.getByRole('list', { name: 'Resort dot legend' });
    const icons = legend.locator('img');
    await expect(icons).toHaveCount(4);
    await expect.poll(() => icons.evaluateAll(images => images.every(image =>
        image instanceof HTMLImageElement && image.naturalWidth >= 32 && new URL(image.src).origin === location.origin))).toBe(true);
    await expect(legend.getByText('+', { exact: true })).toBeVisible();

    const passLayers = ['ski-status-pass-badges', 'ski-status-selected-pass-badge'];
    await expect.poll(() => renderer.evaluate(map => map.hasImage('ski-status-pass-badge-ikon-plus'))).toBe(true);
    expect(await renderer.evaluate(map => {
        const image = map.getImage('ski-status-pass-badge-ikon-plus');
        return image.data.width / image.pixelRatio;
    })).toBe(26);
    const alta = locations.locations.find(location => location.id === 'alta')!.coordinates as [number, number];
    await renderer.evaluate((map, center) => { map.jumpTo({ center, zoom: 3 }); }, alta);
    const cottonwood = ['alta', 'snowbird'];
    const renderedBadges = () => renderer.evaluate((map, { layers, ids }) =>
        map.queryRenderedFeatures({ layers }).filter(feature => ids.includes(feature.properties.areaId))
            .map(feature => ({ layer: feature.layer.id, area: feature.properties.areaId, badge: feature.properties.passBadge }))
            .sort((first, second) => first.area.localeCompare(second.area)), { layers: passLayers, ids: cottonwood });
    await expect.poll(renderedBadges).toEqual(cottonwood.map(area => ({ layer: 'ski-status-pass-badges', area, badge: 'ikon-plus' })));

    await renderer.evaluate((map, center) => { map.jumpTo({ center, zoom: 8 }); }, alta);
    await page.getByRole('button', { name: 'Alta Ski Area', exact: true }).click();
    const details = page.getByRole('region', { name: 'Alta Ski Area', exact: true });
    await expect(details.getByRole('link', { name: 'Ikon', exact: true }).locator('img')).toBeVisible();
    await expect(details.getByRole('link', { name: 'Mountain Collective', exact: true }).locator('img')).toBeVisible();
    await page.getByLabel('Pass', { exact: true }).selectOption('mountain-collective');
    await expect.poll(renderedBadges).toEqual([
        { layer: 'ski-status-selected-pass-badge', area: 'alta', badge: 'mountain-collective-plus' },
        { layer: 'ski-status-pass-badges', area: 'snowbird', badge: 'mountain-collective-plus' },
    ]);
    await colors.selectOption('default');
    await expect.poll(renderedBadges).toEqual([]);
    await renderer.dispose();
});

test('keeps a fallback dot if a pass image fails and restores other badges after a background retry', async ({ page }) => {
    await prepare(page, null);
    await page.route(/\/pass-icons\/indy\.png\?no-inline$/, route => route.abort());
    const renderer = await captureMap(page, { state: 'degraded' });
    await page.getByLabel('Color by', { exact: true }).selectOption('pass');
    const anotherPassBadge = () => renderer.evaluate(map => map.hasImage('ski-status-pass-badge-ikon-plus'));
    await expect.poll(anotherPassBadge).toBe(true);
    expect(await renderer.evaluate(map => map.hasImage('ski-status-pass-badge-indy'))).toBe(false);
    await page.getByRole('button', { name: 'Whaleback Mountain', exact: true }).click();
    await expect.poll(() => renderer.evaluate(map => map.queryRenderedFeatures({ layers: ['ski-area-points'] })
        .some(feature => feature.properties.areaId === 'whaleback'))).toBe(true);

    await page.route(styleUrl, route => route.fulfill({ json: baseStyle, headers: { 'access-control-allow-origin': '*' } }));
    await page.getByRole('button', { name: 'Retry background', exact: true }).click();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    await expect.poll(anotherPassBadge).toBe(true);
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
    const popup = page.getByRole('region', { name: 'Alta Ski Area map popup', exact: true });
    await expect(popup).toBeVisible();
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
    await expect(popup).toHaveCount(0);
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
    await expect(page.getByRole('region', { name: 'Whaleback Mountain map popup', exact: true })).toBeVisible();
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
