import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page, type Response } from '@playwright/test';
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import locations from '../../projects/ski-status/data/locations.json' with { type: 'json' };
import resortBases from '../../projects/ski-status/data/resort-bases.json' with { type: 'json' };
import { SKI_TERRAIN_ROUTE, skiTerrainArchivePath, verifyRenderedSkiTerrain, verifySkiTerrainResponse } from '../../scripts/release-ski-terrain.ts';
import { readSkiMapCamera } from '../../src/features/ski-status/skiMapArea.ts';

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

async function captureNextMap(page: Page) {
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
}

async function captureMap(page: Page, { today = false, state = 'ready' }: { today?: boolean; state?: 'ready' | 'degraded' } = {}) {
    await page.goto('/projects');
    await captureNextMap(page);
    await page.getByRole('link', { name: 'Open map: ski-status', exact: true }).click();
    if (!today) await page.getByRole('button', { name: 'All resorts', exact: true }).click();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', state, { timeout: 10_000 });
    const renderer = await page.evaluateHandle(() => (window as ReviewWindow).skiStatusMap!);
    await expect.poll(() => renderer.evaluate(map => map.loaded() && !map.isMoving())).toBe(true);
    return renderer;
}

async function inDialog(page: Page, name: 'Filters' | 'Layers' | 'Columns', act: (dialog: Locator) => Promise<unknown>) {
    await page.getByRole('button', { name, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: name === 'Layers' ? 'Map layers' : name, exact: true });
    await act(dialog);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
}

function setFilter(page: Page, name: string, value: string | { label: string }) {
    return inDialog(page, 'Filters', dialog => dialog.getByLabel(name, { exact: true }).selectOption(value));
}

function setPass(page: Page, name: string, checked = true) {
    return inDialog(page, 'Filters', dialog => dialog.getByRole('checkbox', { name, exact: true }).setChecked(checked));
}

function setColor(page: Page, value: string) {
    return inDialog(page, 'Layers', dialog => dialog.getByLabel('Color by', { exact: true }).selectOption(value));
}

function setLayer(page: Page, name: string, checked: boolean) {
    return inDialog(page, 'Layers', dialog => dialog.getByRole('checkbox', { name, exact: true }).setChecked(checked));
}

const results = (page: Page) => page.getByRole('region', { name: 'Ski area list', exact: true });
const comparison = (page: Page) => page.getByRole('region', { name: 'Ski area comparison table', exact: true });
const resort = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const result = (page: Page, name: string) => results(page).getByRole('button', { name, exact: true });
const searchArea = (page: Page) => page.getByRole('button', { name: 'Search this area', exact: true });
const selectView = (page: Page, name: 'Map' | 'Results' | 'Compare') => page.getByRole('button', { name, exact: true }).click();
const mapCamera = (page: Page) => readSkiMapCamera(new URL(page.url()).searchParams.get('camera'));
const terrainPoint = (id: string) => locations.locations.find(location => location.id === id)!.coordinates as [number, number];
const resortPoint = (id: string) => (resortBases.bases[id as keyof typeof resortBases.bases]?.coordinates ?? terrainPoint(id)) as [number, number];

test('combines top-bar passes while retaining the selected product and search', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepare(page);
    await page.goto(`${path}?view=table&q=snowbird&product=ikon-base&skiDate=2026-12-31&status=all`);
    const search = page.getByRole('searchbox', { name: 'Search areas' });
    const heading = page.getByRole('heading', { name: 'ski-status', exact: true });
    const passes = page.getByRole('group', { name: 'Pass filters' });
    const ikon = passes.getByRole('button', { name: 'Ikon', exact: true });
    const epic = passes.getByRole('button', { name: 'Epic', exact: true });
    const clear = page.getByRole('button', { name: 'Clear search', exact: true });
    await expect(ikon).toHaveAttribute('aria-pressed', 'true');
    await expect(comparison(page).getByRole('button', { name: 'Snowbird', exact: true })).toBeVisible();
    for (const label of ['Ikon', 'Epic', 'Indy', 'Mountain Collective']) {
        await expect(passes.getByRole('button', { name: label, exact: true }).locator('img')).toBeVisible();
    }
    const headingRectangle = (await heading.boundingBox())!;
    const searchRectangle = (await search.boundingBox())!;
    expect(headingRectangle.y + headingRectangle.height / 2).toBeCloseTo(searchRectangle.y + searchRectangle.height / 2);
    expect((await ikon.boundingBox())!.x).toBeGreaterThan(searchRectangle.x + searchRectangle.width);

    await epic.click();
    await expect(page).toHaveURL(/pass=ikon&pass=epic/);
    await expect(page).toHaveURL(/product=ikon-base&skiDate=2026-12-31/);
    await expect(ikon).toHaveAttribute('aria-pressed', 'true');
    await expect(epic).toHaveAttribute('aria-pressed', 'true');
    await expect(comparison(page).getByRole('button', { name: 'Snowbird', exact: true })).toBeVisible();
    await inDialog(page, 'Filters', async dialog => {
        await expect(dialog.getByRole('checkbox', { name: 'Ikon', exact: true })).toBeChecked();
        await expect(dialog.getByRole('checkbox', { name: 'Epic', exact: true })).toBeChecked();
        const product = dialog.getByLabel('Pass product', { exact: true });
        await expect(product).toHaveValue('ikon-base');
        await expect(product).toHaveAccessibleDescription('Product and ski date apply to Ikon.');
    });
    await search.fill('vail mountain');
    await search.press('Enter');
    await expect(page).toHaveURL(/q=vail\+mountain/);
    await expect(comparison(page).getByRole('button', { name: 'Vail Mountain', exact: true })).toBeVisible();
    await clear.click();
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('');
    await expect(clear).toHaveCount(0);
    await expect(page).not.toHaveURL(/q=/);
    await expect(page).toHaveURL(/pass=ikon&pass=epic/);
    await ikon.click();
    await expect(page).toHaveURL(/pass=epic/);
    await expect(page).not.toHaveURL(/pass=ikon|product=|skiDate=/);
    await epic.click();
    await expect(page).not.toHaveURL(/pass=/);

    await page.setViewportSize({ width: 320, height: 780 });
    const narrowHeading = (await heading.boundingBox())!;
    const narrowSearch = (await search.boundingBox())!;
    expect(narrowHeading.y).toBeLessThan(narrowSearch.y + narrowSearch.height);
    await expect(page.getByRole('button', { name: 'Share current view' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('shows a selectable share link when the browser cannot copy it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page);
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'share', { value: undefined });
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Clipboard denied')) } });
    });
    await page.goto(`${path}?status=all&view=results&pass=ikon&pass=indy`);
    await page.getByRole('searchbox', { name: 'Search areas' }).fill('whaleback');
    const share = page.getByRole('button', { name: 'Share current view', exact: true });
    await share.click();
    const dialog = page.getByRole('dialog', { name: 'Share current view', exact: true });
    const link = dialog.getByRole('textbox', { name: 'Copy this link' });
    await expect(link).toBeFocused();
    const params = new URL(await link.inputValue()).searchParams;
    expect(Object.fromEntries(params)).toMatchObject({ view: 'results', q: 'whaleback' });
    expect(params.getAll('pass')).toEqual(['ikon', 'indy']);
    await link.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(share).toBeFocused();
});

test('opens map source credits and data downloads from the attribution button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepare(page, {
        ...baseStyle,
        sources: { basemap: {
            type: 'geojson', data: { type: 'FeatureCollection', features: [] },
            attribution: '<a href="https://carto.com/attribution/">CARTO</a>',
        } },
        layers: [...baseStyle.layers, { id: 'basemap', type: 'circle', source: 'basemap' }],
    });
    await page.goto(`${path}?status=all&area=whaleback&q=whaleback`);
    const map = page.getByTestId('ski-status-map');
    await expect(map).toHaveAttribute('data-map-state', 'ready');
    const details = resort(page, 'Whaleback Mountain');
    const attribution = map.getByLabel('Map sources and data', { exact: true });
    const catalog = map.getByRole('link', { name: 'Catalog points', exact: true });
    await expect(attribution).toBeVisible();
    await expect(catalog).toBeHidden();
    await expect(page.getByText('Map sources and data', { exact: true })).toHaveCount(0);
    await attribution.press('Enter');
    const credits = { MapLibre: 'https://maplibre.org/', CARTO: 'https://carto.com/attribution/', ...locations.attribution, ODbL: locations.license };
    for (const [label, url] of Object.entries(credits)) {
        const link = map.getByRole('link', { name: label, exact: true });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', url);
    }
    for (const [label, filename] of [
        ['Catalog points', 'ski-status-locations.json'],
        ['Base points', 'ski-status-resort-bases.json'],
        ['Terrain data', 'ski-status-resort-terrain.pmtiles'],
    ]) {
        const link = map.getByRole('link', { name: label, exact: true });
        const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
        expect(download.suggestedFilename()).toBe(filename);
        expect(await download.failure()).toBeNull();
    }
    await catalog.press('Escape');
    await expect(catalog).toBeHidden();
    await expect(attribution).toBeFocused();
    await expect(details).toBeVisible();

    await attribution.press('Space');
    await expect(catalog).toBeVisible();
    const canvas = await map.locator('.maplibregl-canvas').boundingBox();
    expect(canvas).not.toBeNull();
    const { x, y } = canvas!;
    await page.mouse.move(x + 115, y + 180);
    await page.mouse.down();
    await page.mouse.move(x + 200, y + 180, { steps: 8 });
    await page.mouse.up();
    await expect(attribution.locator('..')).toHaveJSProperty('open', false);
    await expect(catalog).toBeHidden();
});

test('shows the union of selected passes in the map, results, and Compare', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepare(page);
    const renderer = await captureMap(page);
    await setFilter(page, 'Region', 'UT');
    const passes = page.getByRole('group', { name: 'Pass filters' });
    await passes.getByRole('button', { name: 'Ikon', exact: true }).press('Space');
    await passes.getByRole('button', { name: 'Epic', exact: true }).press('Enter');
    await passes.getByRole('button', { name: 'Mountain Collective', exact: true }).click();
    await expect(result(page, 'Alta Ski Area')).toBeVisible();
    await expect(result(page, 'Park City Mountain')).toBeVisible();
    await expect(result(page, 'Beaver Mountain')).toHaveCount(0);
    await expect.poll(() => renderer.evaluate(async map => {
        const data = await map.getSource<GeoJSONSource>('ski-areas')?.getData();
        return data?.type === 'FeatureCollection' ? data.features.map(feature => feature.id) : [];
    })).toEqual(expect.arrayContaining(['alta', 'park-city-mountain']));

    await selectView(page, 'Compare');
    await page.reload();
    await expect(comparison(page).getByRole('button', { name: 'Alta Ski Area', exact: true })).toHaveCount(1);
    await expect(comparison(page).getByRole('button', { name: 'Park City Mountain', exact: true })).toBeVisible();
    await setPass(page, 'Epic', false);
    await expect(comparison(page).getByRole('button', { name: 'Park City Mountain', exact: true })).toHaveCount(0);
    await expect(comparison(page).getByRole('button', { name: 'Alta Ski Area', exact: true })).toBeVisible();
    await page.goBack();
    await expect(passes.getByRole('button', { name: 'Epic', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(comparison(page).getByRole('button', { name: 'Park City Mountain', exact: true })).toBeVisible();
    await renderer.dispose();
});

test('keeps map controls within the phone viewport and gives the landscape map room', async ({ page }) => {
    const sizes = [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 640, height: 360 }];
    await page.setViewportSize(sizes[0]);
    await prepare(page);
    await page.goto(`${path}?status=all&region=country%3AUS`);
    const map = page.getByTestId('ski-status-map');
    await expect(map).toHaveAttribute('data-map-state', 'ready');
    await page.getByRole('searchbox', { name: 'Search areas' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Ikon', exact: true })).toBeFocused();

    for (const size of sizes) {
        await page.setViewportSize(size);
        const status = (await page.getByRole('button', { name: 'All resorts', exact: true }).boundingBox())!;
        const view = (await page.getByRole('button', { name: 'Map', exact: true }).boundingBox())!;
        expect(status.x + status.width <= view.x || status.y + status.height <= view.y).toBe(true);
        expect((await map.boundingBox())!.height).toBeGreaterThan(160);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
        for (const name of ['Filters', 'Share current view', 'Search this area', 'Fit results', 'Layers']) {
            const button = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
            expect(button.height).toBeGreaterThanOrEqual(44);
            expect(button.x + button.width).toBeLessThanOrEqual(size.width);
        }
    }
});

test('filters by pass and local date, keeps column choices, and exports the comparison', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepare(page);
    await page.goto(`${path}?view=table&q=snowbird&product=ikon-base&skiDate=2026-12-26`);
    const table = page.getByRole('region', { name: 'Ski area comparison table' });
    await expect(page.getByText('No ski areas match these filters.')).toBeVisible();
    await inDialog(page, 'Filters', dialog => dialog.getByLabel('Ski date (local)', { exact: true }).fill('2026-12-31'));
    await expect(table.getByRole('button', { name: 'Snowbird', exact: true })).toBeVisible();
    await table.getByRole('button', { name: 'Snowbird', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Pass product terms' })).toContainText('5 days');
    await inDialog(page, 'Columns', dialog => dialog.getByRole('checkbox', { name: 'Show Mapped lifts column', exact: true }).uncheck());
    await expect(table.getByRole('columnheader', { name: 'Mapped lifts', exact: true })).toHaveCount(0);
    await page.reload();
    await expect(table.getByRole('columnheader', { name: 'Mapped lifts', exact: true })).toHaveCount(0);

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Export CSV' }).click(),
    ]);
    const csv = await readFile(await download.path(), 'utf8');
    expect(csv).toContain('Snowbird');
    expect(csv).toContain('OpenSkiData');
    expect(csv).not.toContain('Mapped lifts');
    expect(csv).not.toContain('Alta Ski Area');
});

test('finds current ski operations, shows reported terrain by name, and expires the daily reports', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepare(page);
    await page.clock.setFixedTime(new Date('2026-11-20T18:00:00Z'));
    await page.goto(`${path}?view=table&status=open`);
    const table = page.getByRole('region', { name: 'Ski area comparison table' });
    await expect(table.locator('tbody tr')).toHaveCount(5);
    await expect(table.getByRole('row', { name: /Mt\. Norquay/ }).getByRole('cell', { name: '2 / 80' })).toBeVisible();
    const lakeLouise = table.getByRole('row', { name: /Lake Louise/ });
    await expect(lakeLouise.getByRole('cell', { name: '4 / Unknown' })).toBeVisible();
    await lakeLouise.getByRole('button', { name: 'Lake Louise Ski Resort', exact: true }).click();
    await page.getByText('Reported lifts and trails (6)', { exact: true }).click();
    const terrain = page.getByRole('table', { name: 'Reported lift and trail status' });
    await expect(terrain.getByRole('row', { name: 'Grizzly Gondola Lift Open' })).toBeVisible();
    await expect(terrain.getByRole('row', { name: 'Deer Run Trail Open' })).toBeVisible();

    await setFilter(page, 'Operating status', 'closed');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table.getByRole('button', { name: 'Telluride Ski Resort', exact: true })).toBeVisible();

    await page.clock.setFixedTime(new Date('2026-11-21T08:00:00Z'));
    await page.reload();
    await expect(page.getByText('No ski areas match these filters.')).toBeVisible();
    await expect(page.getByText(`0 of ${locations.locations.length} areas have current reports`)).toBeVisible();
});

test('uses a fresh daily feed for named terrain and shows when the resort measured temperature', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepare(page);
    const generatedAt = '2026-11-20T17:45:00Z';
    const measuredAt = '2026-11-20T11:20:44-06:00';
    const body = JSON.stringify({ version: 1, generatedAt, reports: [{
        areaId: 'lake-louise', status: 'limited', retrievedAt: generatedAt, reportedOn: '2026-11-20',
        validThrough: '2026-11-20T23:59:59.999-06:00',
        source: { name: 'Lake Louise Ski Resort', url: 'https://www.skilouise.com/snow-conditions/', exportable: false },
        lifts: { open: 4, total: 13 }, trails: { open: 6, total: 171 },
        temperature: { valueC: -11, location: 'Paradise-Top', measuredAt },
        terrain: { items: [
            { id: 'lift:1', name: 'Summit Chair', kind: 'lift', status: 'closed' },
            { id: 'trail:1', name: 'Wiwaxy', kind: 'trail', status: 'open' },
        ] },
    }] });
    const file = `reports-${createHash('sha256').update(body).digest('hex')}.json`;
    await page.route('https://data.rsmb.tv/ski-status/**', route => {
        const headers = { 'access-control-allow-origin': '*' };
        if (route.request().url().endsWith(file)) return route.fulfill({ body, headers });
        return route.fulfill({ json: { version: 1, updatedAt: generatedAt, catalogRevision: 'a'.repeat(64), reports: file }, headers });
    });
    await page.clock.setFixedTime(new Date('2026-11-20T18:00:00Z'));
    await page.goto(`${path}?view=table&status=open&q=lake%20louise`);
    const table = page.getByRole('region', { name: 'Ski area comparison table' });
    await expect(table.getByRole('cell', { name: '6 / 171', exact: true })).toBeVisible();
    await table.getByRole('button', { name: 'Lake Louise Ski Resort', exact: true }).click();
    const details = page.getByRole('region', { name: 'Conditions summary' });
    const observation = details.getByText('Measured temperature', { exact: false });
    await expect(observation).toContainText('Paradise-Top');
    await expect(observation.locator('time')).toHaveAttribute('datetime', measuredAt);
    await details.getByText('Reported lifts and trails (2)', { exact: true }).click();
    const terrain = details.getByRole('table', { name: 'Reported lift and trail status' });
    await expect(terrain.locator('tbody tr').first()).toContainText('Wiwaxy');
});

test('shows historical season evidence and filters a typical season by month', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepare(page);
    await page.goto(`${path}?view=table&q=killington&seasonMonth=11`);
    const table = page.getByRole('region', { name: 'Ski area comparison table' });
    const killington = table.getByRole('button', { name: 'Killington Resort', exact: true });
    await expect(table.getByRole('cell', { name: 'Nov 12', exact: true })).toBeVisible();
    await killington.click();
    const seasons = page.getByRole('region', { name: 'Season dates' });
    await expect(seasons).toContainText('Median of 5 seasons through 2025/26');
    await seasons.getByText('Opening and closing history', { exact: true }).click();
    await expect(seasons.getByRole('row', { name: /2025\/26/ })).toContainText('2026-05-25');

    await setFilter(page, 'Typical season in', '8');
    await expect(page.getByText('No ski areas match these filters.')).toBeVisible();
    await expect(page).toHaveURL(/seasonMonth=8/);
});

test('labels past terrain counts and removes an elapsed opening date', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepare(page);
    await page.clock.setFixedTime(new Date('2026-12-06T07:00:00Z'));
    await page.goto(`${path}?view=table&q=telluride`);
    const table = page.getByRole('region', { name: 'Ski area comparison table' });
    await expect(table.getByRole('cell', { name: '0 / 149 (stale)', exact: true })).toBeVisible();
    await expect(table.getByText('2026-12-05', { exact: true })).toHaveCount(0);
    await table.getByRole('button', { name: 'Telluride Ski Resort', exact: true }).click();
    const seasons = page.getByRole('region', { name: 'Season dates' });
    await expect(seasons.getByText('Apr 4', { exact: true })).toHaveAttribute('datetime', '2027-04-04');
    await expect(seasons.locator('time[datetime="2026-12-05"]')).toHaveCount(0);
});

test('opens the Sunshine gondola base and shows sourced season dates, snow, and resort links', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await prepare(page);
    await page.clock.setFixedTime(new Date('2026-11-20T18:00:00Z'));
    const renderer = await captureMap(page);
    await page.getByRole('searchbox', { name: 'Search areas' }).fill('banff sunshine');
    await result(page, 'Banff Sunshine Village').click();
    const details = resort(page, 'Banff Sunshine Village');
    await expect.poll(() => mapCamera(page)?.center).toEqual([-115.763609, 51.114965]);
    await expect.poll(() => details.locator('.ski-resort-icon').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(details.getByRole('link', { name: 'Google Maps', exact: true })).toHaveAttribute('href', /51\.114965%2C-115\.763609/);
    await expect(details.getByRole('link', { name: 'Wikipedia', exact: true })).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Banff_Sunshine');
    const season = details.getByRole('region', { name: 'Season dates' });
    await expect(season.getByText('284.6 in', { exact: true })).toBeVisible();
    await expect(season.getByText('Nov 7', { exact: true })).toHaveAttribute('datetime', '2026-11-07');
    await expect(season.getByText('May 24', { exact: true })).toHaveAttribute('datetime', '2027-05-24');
    await expect(season.getByText('Scheduled', { exact: true })).toBeVisible();
    const snow = season.getByRole('table', { name: 'Typical monthly snow' });
    await expect(snow.getByRole('row', { name: /November/ })).toContainText('53.9 in');
    await expect(snow.getByRole('row', { name: /February/ })).toContainText('55.1 in');

    await details.getByRole('button', { name: 'Show runs and lifts', exact: true }).click();
    await expect.poll(() => mapCamera(page)).toMatchObject({ center: terrainPoint('banff-sunshine'), zoom: 13 });
    await renderer.dispose();
});

test('applies the Indy Add-On home area across reloads and clears it when the product changes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepare(page);
    await page.goto(`${path}?view=table&product=indy-base-addon&skiDate=2026-12-18`);
    const table = page.getByRole('region', { name: 'Ski area comparison table' });
    const berkshire = table.getByRole('button', { name: 'Berkshire East Ski Resort', exact: true });
    const catamount = table.getByRole('button', { name: 'Catamount Mountain Resort', exact: true });
    const terms = page.getByRole('region', { name: 'Pass product terms' });
    await catamount.click();
    await expect(terms).toContainText('Select your home ski area');
    await setFilter(page, 'Home ski area', 'berkshire-east-ski-resort');
    await expect(berkshire).toHaveCount(0);
    await expect(terms).toContainText('Included access');
    await page.reload();
    await expect(berkshire).toHaveCount(0);
    await expect(terms).toContainText('Included access');
    await inDialog(page, 'Filters', async dialog => {
        await dialog.getByLabel('Pass product', { exact: true }).selectOption('indy-plus');
        await expect(dialog.getByLabel('Home ski area', { exact: true })).toHaveCount(0);
    });
    await expect(page).not.toHaveURL(/homeArea=/);
});

test('ages a verified report without resetting the camera when local-date results stay the same', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const generatedAt = '2026-12-25T06:55:00Z';
    const body = JSON.stringify({ version: 1, generatedAt, reports: [{
        areaId: 'snowbird', status: 'limited', retrievedAt: generatedAt, reportedAt: generatedAt,
        source: { name: 'Test operator', url: 'https://example.test/conditions', license: 'https://example.test/license', exportable: true },
    }] });
    const file = `reports-${createHash('sha256').update(body).digest('hex')}.json`;
    await page.route('https://data.rsmb.tv/ski-status/**', route => {
        const name = new URL(route.request().url()).pathname.split('/').at(-1);
        const headers = { 'access-control-allow-origin': '*' };
        if (name === file) return route.fulfill({ body, headers, contentType: 'application/json' });
        return route.fulfill({ json: { version: 1, updatedAt: generatedAt, catalogRevision: 'a'.repeat(64), reports: file }, headers });
    });
    await page.clock.install({ time: new Date('2026-12-25T06:59:15Z') });
    const renderer = await captureMap(page);
    const query = page.getByRole('searchbox', { name: 'Search areas' });
    await query.fill('Snowbird');
    await query.press('Enter');
    await setFilter(page, 'Pass product', 'ikon-base');
    await setColor(page, 'operatingStatus');
    await expect(result(page, 'Snowbird')).toContainText('Limited today');
    const color = () => renderer.evaluate(async map => {
        const data = await map.getSource<GeoJSONSource>('ski-areas')?.getData();
        return data?.type === 'FeatureCollection' && data.features.find(feature => feature.id === 'snowbird')?.properties?.color;
    });
    await expect.poll(color).toBe('#f0c478');
    await expect.poll(() => renderer.evaluate(map => !map.isMoving())).toBe(true);
    const camera = await renderer.evaluate(map => {
        map.jumpTo({ center: [-110, 42], zoom: 6 });
        return { center: map.getCenter().toArray(), zoom: map.getZoom() };
    });

    await page.clock.fastForward(60_001);
    await expect(result(page, 'Snowbird')).toContainText('Stale report');
    await expect.poll(color).toBe('#abb9c6');
    expect(await renderer.evaluate(map => ({ center: map.getCenter().toArray(), zoom: map.getZoom() }))).toEqual(camera);
    await renderer.dispose();
});

test('opens on the phone globe with current reports, clusters, and a usable resort panel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page);
    await page.clock.setFixedTime(new Date('2026-11-20T18:00:00Z'));
    const renderer = await captureMap(page, { today: true });
    expect(await renderer.evaluate(map => map.getProjection().type)).toBe('globe');
    await expect(page.getByText('5 reporting skiing today', { exact: true })).toBeVisible();
    await expect(page.getByText(`6 of ${locations.locations.length} areas have current reports`)).toBeVisible();
    await expect(results(page)).toBeHidden();
    await expect.poll(() => renderer.evaluate(map => map.queryRenderedFeatures({ layers: ['ski-area-cluster-counts'] })
        .map(feature => feature.properties.skiingCount).some(count => count > 1))).toBe(true);
    const skipMap = page.getByRole('link', { name: 'Skip to map', exact: true });
    await skipMap.focus();
    await skipMap.press('Enter');
    await expect(page.getByRole('region', { name: 'Map of ski areas', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(searchArea(page)).toBeFocused();
    await selectView(page, 'Results');
    const lakeLouise = result(page, 'Lake Louise Ski Resort');
    await expect(lakeLouise).toContainText('Limited today');
    await expect(lakeLouise).toContainText('4 lifts open');
    await lakeLouise.press('Enter');
    const details = resort(page, 'Lake Louise Ski Resort');
    await expect(details).toBeFocused();
    await expect(details.getByRole('link', { name: 'Official conditions', exact: true })).toBeVisible();
    await details.getByRole('button', { name: 'Close details' }).press('Enter');
    await expect(lakeLouise).toBeFocused();
    await renderer.dispose();
});

test('opens resort terrain and its local difficulty key from phone details', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page);
    await page.goto(`${path}?view=results&status=all&q=lake%20louise&skiTerrain=0`);
    await result(page, 'Lake Louise Ski Resort').click();
    const range = page.waitForResponse(response => skiTerrainArchivePath.test(new URL(response.url()).pathname) && response.status() === 206);
    await resort(page, 'Lake Louise Ski Resort').getByRole('button', { name: 'Show runs and lifts' }).click();
    expect((await range).headers()['content-range']).toMatch(/^bytes \d+-\d+\/\d+$/);
    await expect(resort(page, 'Lake Louise Ski Resort')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Resort details', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/details=0/);
    await expect.poll(() => mapCamera(page)?.zoom).toBeGreaterThanOrEqual(13);
    await inDialog(page, 'Layers', async dialog => {
        await expect(dialog.getByRole('region', { name: 'Mapped runs and lifts' })).toBeVisible();
        await expect(dialog.getByText('Green and blue convention', { exact: true })).toBeVisible();
    });
    await page.reload();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    await expect(page.getByRole('button', { name: 'Resort details', exact: true })).toBeVisible();
    await expect.poll(() => mapCamera(page)?.zoom).toBeGreaterThanOrEqual(13);
});

test('fits filtered Ikon resorts in New Zealand from the phone globe', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await prepare(page);
    const renderer = await captureMap(page);
    await inDialog(page, 'Filters', async dialog => {
        await dialog.getByLabel('Region', { exact: true }).selectOption({ label: 'New Zealand' });
        await dialog.getByRole('checkbox', { name: 'Ikon', exact: true }).check();
    });
    await setColor(page, 'pass');
    const membership = () => renderer.evaluate(async map => {
        const data = await map.getSource<GeoJSONSource>('ski-areas')?.getData();
        return data?.type === 'FeatureCollection' ? data.features.map(point => point.id).sort() : [];
    });
    await expect.poll(membership).toEqual(['coronet-peak', 'mt-hutt', 'the-remarkables']);
    await expect.poll(() => renderer.evaluate(map => map.getCenter().lng)).toBeGreaterThan(150);
    await selectView(page, 'Compare');
    await expect(comparison(page).locator('tbody tr')).toHaveCount(3);
    await comparison(page).getByRole('button', { name: 'Mt Hutt', exact: true }).click();
    await expect(resort(page, 'Mt Hutt').getByText('Methven, New Zealand', { exact: true })).toBeVisible();
    await renderer.dispose();
});

test('searches only the facing side of the globe across the antimeridian', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const renderer = await captureMap(page);
    const sourceIds = () => renderer.evaluate(async map => {
        const data = await map.getSource<GeoJSONSource>('ski-areas')?.getData();
        return data?.type === 'FeatureCollection' ? data.features.map(feature => feature.id) : [];
    });
    await renderer.evaluate(map => { map.jumpTo({ center: [179, -43.49], zoom: 0.75 }); });
    await searchArea(page).click();
    await expect.poll(sourceIds).toContain('mt-hutt');
    expect(await sourceIds()).not.toContain('alta');
    const alta = resortPoint('alta');
    expect(await renderer.evaluate((map, coordinates) => {
        const { x, y } = map.project(coordinates);
        const { clientWidth, clientHeight } = map.getContainer();
        return x >= 0 && x <= clientWidth && y >= 0 && y <= clientHeight;
    }, alta)).toBe(true);
    await renderer.dispose();
});

test('keeps listed Ikon destinations visible until the included-access filter is selected', async ({ page }) => {
    await prepare(page);
    await page.goto(`${path}?view=table&region=country%3AAT&area=kappl`);
    const details = page.getByRole('region', { name: 'Kappl', exact: true });
    await expect(details.getByRole('link', { name: 'Ikon (lift access unconfirmed)', exact: true })).toBeVisible();
    const table = page.getByRole('region', { name: 'Ski area comparison table' });
    await expect(table.getByRole('button', { name: 'See', exact: true })).toBeVisible();

    await setPass(page, 'Ikon');
    await expect(details).toBeVisible();
    await expect(table.getByRole('button', { name: 'See', exact: true })).toHaveCount(0);
    await expect(table.getByRole('button', { name: 'Ischgl / Samnaun', exact: true })).toBeVisible();
});

test('filters skiing types in the results and the map source', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const renderer = await captureMap(page);
    const mapIds = () => renderer.evaluate(async map => {
        const data = await map.getSource<GeoJSONSource>('ski-areas')?.getData();
        return data?.type === 'FeatureCollection' ? data.features.map(feature => feature.id).sort() : [];
    });
    await setFilter(page, 'Skiing type', 'indoor');
    await expect(page).toHaveURL(/skiing=indoor/);
    await expect(results(page).locator('li')).toHaveCount(2);
    await expect(result(page, 'Big SNOW American Dream')).toBeVisible();
    await expect.poll(mapIds).toEqual(['big-snow-american-dream', 'stoke-mountain']);
    await inDialog(page, 'Filters', async dialog => {
        await dialog.getByLabel('Skiing type', { exact: true }).selectOption('specialty');
        await dialog.getByRole('checkbox', { name: 'Indy discounts', exact: true }).check();
    });
    await expect(result(page, 'North Cascade Heli')).toBeVisible();
    await expect.poll(mapIds).toEqual(['north-cascade-heli']);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page).not.toHaveURL(/skiing=/);
    await expect.poll(async () => (await mapIds()).length).toBe(locations.locations.length);
    await renderer.dispose();
});

test('loads and removes a skiing-type chip in the phone comparison', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await prepare(page);
    await page.goto(`${path}?view=table&skiing=cross-country&region=BC`);
    const table = comparison(page);
    await expect(table.getByRole('button', { name: 'Manning Park Nordic Centre', exact: true })).toBeVisible();
    await expect(table.getByRole('button', { name: 'Manning Park', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Remove Cross-country only', exact: true }).click();
    await expect(table.getByRole('button', { name: 'Manning Park', exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/skiing=/);
});

test('keeps separate Epic points and resort cards for Hakuba Valley resorts', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    await setFilter(page, 'Region', { label: 'Japan' });
    await setPass(page, 'Epic');
    await page.getByRole('searchbox', { name: 'Search areas' }).fill('Hakuba Valley');
    await setColor(page, 'pass');
    await expect.poll(() => renderer.evaluate(async map => {
        const data = await map.getSource<GeoJSONSource>('ski-areas')!.getData();
        return data.type === 'FeatureCollection' ? data.features.filter(point => point.properties?.passBadge === 'epic').length : 0;
    })).toBe(10);
    await expect(results(page).locator('li')).toHaveCount(10);
    await result(page, 'Hakuba Happo-One').click();
    await expect(resort(page, 'Hakuba Happo-One').getByRole('link', { name: 'Epic', exact: true })).toHaveAttribute('href',
        'https://www.epicpass.com/regions/japan/hakuba-valley.aspx');
    await renderer.dispose();
});

test('filters worldwide Indy memberships and discounts on the map and in results', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    await setFilter(page, 'Region', { label: 'Finland' });
    await setPass(page, 'Indy');
    await setColor(page, 'pass');
    await expect(results(page).locator('li')).toHaveCount(3);
    await expect.poll(() => renderer.evaluate(async map => {
        const data = await map.getSource<GeoJSONSource>('ski-areas')!.getData();
        return data.type === 'FeatureCollection' ? data.features.filter(point => point.properties?.passBadge === 'indy').map(point => point.id).sort() : [];
    })).toEqual(['levi-ski-resort', 'pyha-ski-resort', 'ruka-ski-resort']);
    await setFilter(page, 'Region', '');
    await inDialog(page, 'Filters', async dialog => {
        await dialog.getByRole('checkbox', { name: 'Indy', exact: true }).uncheck();
        await dialog.getByRole('checkbox', { name: 'Indy discounts', exact: true }).check();
    });
    await expect(results(page).locator('li')).toHaveCount(5);
    await inDialog(page, 'Layers', dialog => expect(dialog.getByRole('list', { name: 'Resort map key' })).toHaveText('Indy discount'));
    await expect.poll(() => renderer.evaluate(async map => {
        const data = await map.getSource<GeoJSONSource>('ski-areas')!.getData();
        return data.type === 'FeatureCollection' ? data.features.find(feature => feature.id === 'whiteface')?.properties?.color : undefined;
    })).toBe('#fb923c');
    await result(page, 'North Cascade Heli').click();
    const details = resort(page, 'North Cascade Heli');
    await expect(details.getByText('Heli-skiing', { exact: true })).toBeVisible();
    await expect(details.getByRole('link', { name: 'Indy (discount only)', exact: true }))
        .toHaveAttribute('href', 'https://www.indyskipass.com/our-resorts/north-cascade-heli');
    await renderer.dispose();
});

test('shows a single shared destination for either country', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    await page.getByRole('searchbox', { name: 'Search areas' }).fill('Portes du Soleil');
    await setPass(page, 'Indy');
    for (const country of ['France', 'Switzerland']) {
        await setFilter(page, 'Region', { label: country });
        await expect(results(page).locator('li')).toHaveCount(1);
        await expect(result(page, 'Portes du Soleil')).toContainText('France / Switzerland');
        await expect.poll(() => renderer.evaluate(async map => {
            const data = await map.getSource<GeoJSONSource>('ski-areas')?.getData();
            return data?.type === 'FeatureCollection' ? data.features.map(feature => feature.id) : [];
        })).toEqual(['portes-du-soleil']);
    }
    await renderer.dispose();
});

test('changes results only when someone searches the new area and restores each view from history', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const renderer = await captureMap(page);
    await renderer.evaluate(map => { map.jumpTo({ center: [-111.64, 40.6], zoom: 10 }); });
    await searchArea(page).click();
    await expect(result(page, 'Alta Ski Area')).toBeVisible();
    await expect(result(page, 'Snowbird')).toBeVisible();
    await expect(result(page, 'Whaleback Mountain')).toHaveCount(0);
    const utah = new URL(page.url()).searchParams.get('mapArea');
    expect(utah).toBeTruthy();

    const vail = resortPoint('vail-mountain');
    await renderer.evaluate((map, center) => { map.panTo(center, { duration: 0 }); }, vail);
    await expect.poll(() => mapCamera(page)?.center[0]).toBeCloseTo(vail[0], 3);
    await expect(result(page, 'Alta Ski Area')).toBeVisible();
    await expect(result(page, 'Vail Mountain')).toHaveCount(0);
    await searchArea(page).click();
    await expect(result(page, 'Vail Mountain')).toBeVisible();
    await expect(result(page, 'Alta Ski Area')).toHaveCount(0);
    const colorado = new URL(page.url()).searchParams.get('mapArea');
    expect(colorado).not.toBe(utah);
    await page.getByRole('button', { name: 'Fit results', exact: true }).click();
    expect(new URL(page.url()).searchParams.get('mapArea')).toBe(colorado);
    await renderer.evaluate(map => { map.jumpTo({ center: [-105, 39], zoom: 8 }); });
    await expect.poll(() => mapCamera(page)?.center).toEqual([-105, 39]);
    await page.goBack();
    await expect(result(page, 'Snowbird')).toBeVisible();
    await expect.poll(() => renderer.evaluate(map => map.getCenter().lng)).toBeCloseTo(vail[0], 3);
    await page.goForward();
    await expect(result(page, 'Vail Mountain')).toBeVisible();
    await expect.poll(() => renderer.evaluate(map => map.getCenter().lng)).toBeCloseTo(-105, 3);
    await renderer.dispose();
});

test('shares the visible map without changing the searched area', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined }); });
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const renderer = await captureMap(page);
    await renderer.evaluate(map => { map.jumpTo({ center: [-111.64, 40.6], zoom: 10 }); });
    await searchArea(page).click();
    await expect(result(page, 'Alta Ski Area')).toBeVisible();
    const area = new URL(page.url()).searchParams.get('mapArea');
    const vail = resortPoint('vail-mountain');
    await renderer.evaluate((map, center) => { map.jumpTo({ center, zoom: 10, bearing: -12, pitch: 20 }); }, vail);
    await expect.poll(() => mapCamera(page)).toMatchObject({ zoom: 10, bearing: -12, pitch: 20 });
    await expect(result(page, 'Alta Ski Area')).toBeVisible();
    await page.getByRole('button', { name: 'Share current view', exact: true }).click();
    await expect(page.getByText('Link copied', { exact: true })).toBeAttached();
    const sharedUrl = new URL(await page.evaluate(() => navigator.clipboard.readText()));
    expect(sharedUrl.searchParams.get('view')).toBe('map');
    expect(sharedUrl.searchParams.get('mapArea')).toBe(area);
    expect(readSkiMapCamera(sharedUrl.searchParams.get('camera'))).toEqual(mapCamera(page));

    const phone = await page.context().newPage();
    try {
        await phone.setViewportSize({ width: 390, height: 844 });
        await prepare(phone);
        await phone.goto(sharedUrl.href);
        await expect(phone.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
        await selectView(phone, 'Results');
        await expect(result(phone, 'Alta Ski Area')).toBeVisible();
        await selectView(phone, 'Map');
        await searchArea(phone).click();
        await selectView(phone, 'Results');
        await expect(result(phone, 'Vail Mountain')).toBeVisible();
        await expect(result(phone, 'Alta Ski Area')).toHaveCount(0);
    } finally {
        await phone.close();
        await renderer.dispose();
    }
});

test('shares the committed geography across devices and keeps it when filtering in Compare', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const renderer = await captureMap(page);
    await setPass(page, 'Mountain Collective');
    await renderer.evaluate(map => { map.jumpTo({ center: [-111.63, 40.6], zoom: 10 }); });
    await searchArea(page).click();
    await expect(result(page, 'Alta Ski Area')).toBeVisible();
    await selectView(page, 'Compare');
    await expect(page.getByTestId('ski-status-map')).toBeHidden();
    const names = await comparison(page).locator('tbody th button').allTextContents();
    await page.setViewportSize({ width: 320, height: 780 });
    await page.reload();
    await expect(comparison(page).locator('tbody th button')).toHaveText(names);
    await expect(page.getByTestId('ski-status-map')).toHaveCount(0);
    await page.getByRole('group', { name: 'Pass filters' }).getByRole('button', { name: 'Mountain Collective', exact: true }).click();
    await expect(comparison(page).getByRole('button', { name: 'Brighton Resort', exact: true })).toBeVisible();
    await expect(comparison(page).getByRole('button', { name: 'Whaleback Mountain', exact: true })).toHaveCount(0);
    await renderer.dispose();
});

test('keeps legacy in-view links usable and commits their first map area', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await prepare(page);
    await page.goto(`${path}?view=table&inView=1&q=whaleback`);
    await expect(page.getByText('Open Map to set the area for this link.')).toBeVisible();
    await expect(comparison(page).getByRole('button', { name: 'Whaleback Mountain', exact: true })).toBeVisible();
    await expect(page.getByTestId('ski-status-map')).toHaveCount(0);
    await selectView(page, 'Map');
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    await expect(page).toHaveURL(/mapArea=/);
    await expect(page).not.toHaveURL(/inView=/);
    await expect(page.getByRole('button', { name: 'Remove Searched map area' })).toBeVisible();
    await expect(page.getByText('1 ski area', { exact: true })).toBeVisible();
});

test('fits changes made in the phone table after the real map viewport returns', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await prepare(page);
    const renderer = await captureMap(page);
    await selectView(page, 'Compare');
    await expect(page.getByTestId('ski-status-map')).toBeHidden();
    await renderer.evaluate(map => { map.resize(); });
    await setFilter(page, 'Region', 'BC');
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    const edges = ['mount-washington-alpine-resort', 'fernie-alpine-resort'].map(resortPoint);
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
    expect(await renderer.evaluate(map => map.getProjection().type)).toBe('globe');
    await setFilter(page, 'Region', 'WA');
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
        await setFilter(page, 'Region', 'UT');
        await page.getByRole('button', { name: 'Alta Ski Area', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Alta Ski Area', exact: true })).toBeVisible();
    } finally {
        release();
    }
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    const alta = resortPoint('alta');
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
    const coordinates = resortPoint('whaleback');
    return renderer.evaluate((map, point) => {
        const { x, y } = map.project(point);
        return { x, y };
    }, coordinates);
}

test('recenters a result after tapping its selected marker and panning away', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const renderer = await captureMap(page);
    const position = await findWhaleback(page, renderer);
    const canvas = page.getByTestId('ski-status-map').locator('canvas');
    const details = resort(page, 'Whaleback Mountain');
    await canvas.click({ position });
    await expect(details).toBeVisible();
    await canvas.click({ position });
    await renderer.evaluate(map => { map.jumpTo({ center: [-71.5, 43.9], zoom: 9 }); });
    await expect.poll(() => mapCamera(page)?.center).toEqual([-71.5, 43.9]);
    await details.getByRole('button', { name: 'Close details' }).click();
    await result(page, 'Whaleback Mountain').click();
    const [longitude] = resortPoint('whaleback');
    await expect.poll(() => renderer.evaluate(map => map.getCenter().lng)).toBeCloseTo(longitude, 4);
    await renderer.dispose();
});

test('previews a resort on hover and opens one docked details panel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const renderer = await captureMap(page);
    await setColor(page, 'pass');
    const position = await findWhaleback(page, renderer);
    await expect.poll(() => renderer.evaluate(map => map.getLayer('ski-status-pass-badges')
        && map.queryRenderedFeatures({ layers: ['ski-status-pass-badges'] }).some(feature => feature.properties.areaId === 'whaleback'))).toBe(true);
    const canvas = page.getByTestId('ski-status-map').locator('canvas');
    const background = { x: 24, y: (await canvas.boundingBox())!.height / 2 };
    const details = resort(page, 'Whaleback Mountain');
    await canvas.hover({ position });
    await expect(page.getByRole('tooltip')).toContainText('Enfield, NH');
    await expect(details).toHaveCount(0);
    await canvas.hover({ position: background });
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await canvas.click({ position });
    await expect(details).toBeFocused();
    await expect(details.getByText('86 ac', { exact: true })).toBeVisible();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await renderer.evaluate(map => { map.panBy([40, 20], { duration: 0 }); });
    await expect(details).toBeVisible();
    const camera = await renderer.evaluate(map => ({ center: map.getCenter().toArray(), zoom: map.getZoom() }));
    await canvas.click({ position: background });
    await expect(details).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has('area')).toBe(false);
    expect(await renderer.evaluate(map => ({ center: map.getCenter().toArray(), zoom: map.getZoom() }))).toEqual(camera);
    await page.goBack();
    await expect(details).toBeVisible();
    await canvas.press('Escape');
    await expect(details).toHaveCount(0);
    await expect(canvas).toBeFocused();
    await renderer.dispose();
});

test.describe('ski-status on touch screens', () => {
    test.use({ hasTouch: true, viewport: { width: 360, height: 740 } });

    test('keeps a tapped resort details control outside the map attribution', async ({ page }) => {
        await prepare(page);
        const renderer = await captureMap(page);
        const position = await findWhaleback(page, renderer);
        const canvas = page.getByTestId('ski-status-map').locator('canvas');
        const details = resort(page, 'Whaleback Mountain');
        await canvas.tap({ position });
        await expect(details).toBeVisible();
        await expect(page).toHaveURL(/area=whaleback/);
        const mapBounds = (await canvas.boundingBox())!;
        const headingBounds = (await details.getByRole('heading', { name: 'Whaleback Mountain' }).boundingBox())!;
        expect(headingBounds.y).toBeGreaterThanOrEqual(mapBounds.y + mapBounds.height);
        const attribution = page.getByLabel('Map sources and data', { exact: true });
        await attribution.tap();
        const panel = page.locator('.ski-map-attribution-panel');
        await expect(panel.getByRole('link', { name: 'Terrain data', exact: true })).toBeVisible();
        const panelBounds = (await panel.boundingBox())!;
        expect(panelBounds.x).toBeGreaterThanOrEqual(mapBounds.x);
        expect(panelBounds.y).toBeGreaterThanOrEqual(mapBounds.y);
        expect(panelBounds.x + panelBounds.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width);
        expect(panelBounds.y + panelBounds.height).toBeLessThan(headingBounds.y);
        await attribution.tap();
        await expect(panel).toBeHidden();
        await details.getByRole('button', { name: 'Close details' }).tap();
        await expect(details).toHaveCount(0);
        await expect(page).not.toHaveURL(/area=whaleback/);
        await expect(canvas).toBeFocused();
        await renderer.dispose();
    });
});

test('selects the closest ski area where two markers overlap', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    await setFilter(page, 'Region', 'UT');
    await page.getByRole('button', { name: 'Alta Ski Area', exact: true }).click();
    const altaDetails = page.getByRole('region', { name: 'Alta Ski Area', exact: true });
    await expect(altaDetails).toBeVisible();
    expect(await altaDetails.evaluate(details => {
        const panel = details.parentElement!;
        panel.scrollTop = panel.scrollHeight;
        return panel.scrollTop;
    })).toBeGreaterThan(0);
    await expect.poll(() => renderer.evaluate(map => map.loaded() && !map.isMoving())).toBe(true);
    await renderer.evaluate(map => { map.jumpTo({ zoom: 7 }); });
    const point = resortPoint('snowbird');
    const position = await renderer.evaluate((map, coordinates) => map.project(coordinates), point);
    await page.locator('.maplibregl-canvas').click({ position: { x: position.x, y: position.y } });
    const snowbirdDetails = page.getByRole('region', { name: 'Snowbird', exact: true });
    await expect(snowbirdDetails).toBeVisible({ timeout: 3_000 });
    expect(await snowbirdDetails.evaluate(details => details.parentElement!.scrollTop)).toBe(0);
    await expect(page).toHaveURL(/area=snowbird/);
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
    expect(start.clustered).toBe(true);
    await setColor(page, 'pass');
    await inDialog(page, 'Layers', dialog => expect(dialog.getByRole('list', { name: 'Resort map key' })).toContainText('Multiple passes'));
    await expect.poll(() => renderer.evaluate(map => {
        const data = map.getSource<GeoJSONSource>('ski-areas')!.serialize().data;
        return typeof data === 'object' && data.type === 'FeatureCollection'
            ? new Set(data.features.map(feature => feature.properties?.color)).size : 0;
    })).toBeGreaterThan(1);
    expect(await renderer.evaluate(map => ({ center: map.getCenter().toArray(), zoom: map.getZoom() })))
        .toEqual({ center: start.center, zoom: start.zoom });
    await renderer.dispose();
});

test('groups resorts on the globe and shows individual pass badges from continent zoom', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    await setColor(page, 'pass');
    await inDialog(page, 'Layers', async dialog => {
        const legend = dialog.getByRole('list', { name: 'Resort map key' });
        await expect(legend.locator('img')).toHaveCount(4);
        await expect.poll(() => legend.locator('img').evaluateAll(images => images.every(image =>
            image instanceof HTMLImageElement && image.naturalWidth >= 32 && new URL(image.src).origin === location.origin))).toBe(true);
    });
    await expect.poll(() => renderer.evaluate(map => map.hasImage('ski-status-pass-badge-ikon-plus'))).toBe(true);
    const counts = () => renderer.evaluate(map => ({
        clusters: map.queryRenderedFeatures({ layers: ['ski-area-clusters', 'ski-area-cluster-counts'] }).length,
        badges: new Set(map.queryRenderedFeatures({ layers: ['ski-status-pass-badges'] }).map(feature => feature.properties.areaId)).size,
    }));
    await renderer.evaluate(map => { map.jumpTo({ center: [-100, 44], zoom: 1.5 }); });
    await expect.poll(async () => (await counts()).clusters).toBeGreaterThan(0);
    await renderer.evaluate(map => { map.jumpTo({ zoom: 3 }); });
    await expect.poll(async () => {
        const { clusters, badges } = await counts();
        return clusters === 0 && badges > 10;
    }).toBe(true);
    await page.getByRole('searchbox', { name: 'Search areas' }).fill('Alta Ski Area');
    await result(page, 'Alta Ski Area').click();
    await expect(resort(page, 'Alta Ski Area').getByRole('link', { name: 'Ikon', exact: true }).locator('img')).toBeVisible();
    await setPass(page, 'Mountain Collective');
    await expect.poll(() => renderer.evaluate(map => map.queryRenderedFeatures({ layers: ['ski-status-selected-pass-badge'] })
        .some(feature => feature.properties.areaId === 'alta' && feature.properties.passBadge === 'mountain-collective-plus'))).toBe(true);
    await setColor(page, 'default');
    await expect.poll(() => renderer.evaluate(map => map.queryRenderedFeatures({ layers: ['ski-status-selected-pass-badge'] }).length)).toBe(0);
    await renderer.dispose();
});

test('keeps a fallback dot if a pass image fails and restores other badges after a background retry', async ({ page }) => {
    await prepare(page, null);
    await page.route(/\/pass-icons\/indy\.png\?no-inline$/, route => route.abort());
    const renderer = await captureMap(page, { state: 'degraded' });
    await setColor(page, 'pass');
    const anotherPassBadge = () => renderer.evaluate(map => map.hasImage('ski-status-pass-badge-ikon-plus'));
    await expect.poll(anotherPassBadge).toBe(true);
    expect(await renderer.evaluate(map => map.hasImage('ski-status-pass-badge-indy'))).toBe(false);
    await page.getByRole('searchbox', { name: 'Search areas' }).fill('whaleback');
    await result(page, 'Whaleback Mountain').click();
    await expect.poll(() => renderer.evaluate(map => map.queryRenderedFeatures({ layers: ['ski-area-points'] })
        .some(feature => feature.properties.areaId === 'whaleback'))).toBe(true);

    await page.route(styleUrl, route => route.fulfill({ json: baseStyle, headers: { 'access-control-allow-origin': '*' } }));
    await page.getByRole('button', { name: 'Retry background', exact: true }).click();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    expect(await renderer.evaluate(map => map.getProjection().type)).toBe('globe');
    await expect.poll(anotherPassBadge).toBe(true);
    await renderer.dispose();
});

test('opens a full-width comparison and preserves the map, sort, filters, and selection across views', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const renderer = await captureMap(page);
    const map = page.getByRole('region', { name: 'Map of ski areas' });
    await setFilter(page, 'Region', 'UT');
    await results(page).getByRole('combobox', { name: 'Sort results' }).selectOption('verticalFt');
    await result(page, 'Alta Ski Area').click();
    await expect(resort(page, 'Alta Ski Area')).toBeVisible();
    const camera = await renderer.evaluate(map => {
        map.jumpTo({ center: [-111.72, 40.7], zoom: 9.5 });
        return { center: map.getCenter().toArray(), zoom: map.getZoom() };
    });
    await selectView(page, 'Compare');
    await expect(map).toBeHidden();
    await expect(comparison(page).getByRole('columnheader', { name: 'Vertical', exact: true })).toHaveAttribute('aria-sort', 'descending');
    await expect(resort(page, 'Alta Ski Area')).toBeVisible();
    await selectView(page, 'Map');
    await expect(map).toBeVisible();
    expect(await renderer.evaluate(map => ({ center: map.getCenter().toArray(), zoom: map.getZoom() }))).toEqual(camera);
    expect(await renderer.evaluate(map => map.getContainer() === document.querySelector('[data-testid="ski-status-map"]'))).toBe(true);
    expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject({ area: 'alta', region: 'UT', sort: 'verticalFt:desc', view: 'map' });
    await renderer.evaluate(map => { map.jumpTo({ center: [-106, 40], zoom: 8 }); });
    await expect.poll(() => mapCamera(page)?.zoom).toBe(8);
    await page.goBack();
    await expect(map).toBeHidden();
    await selectView(page, 'Map');
    await expect.poll(() => renderer.evaluate(map => ({ center: map.getCenter().toArray(), zoom: map.getZoom() }))).toEqual(camera);
    await selectView(page, 'Compare');
    await resort(page, 'Alta Ski Area').getByRole('button', { name: 'Close details' }).click();
    await expect.poll(async () => (await comparison(page).boundingBox())?.width ?? 0).toBe(1440);
    await renderer.dispose();
});

test('shows the map metric and status in results and carries sorting into Compare', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    await page.goto(`${path}?view=map&region=UT&sort=acres%3Adesc`);
    const list = results(page);
    await expect(list.getByRole('combobox', { name: 'Sort results' })).toHaveValue('acres');
    await setColor(page, 'summitFt');
    await expect(list.locator('li').first()).toContainText('Park City Mountain');
    await expect(list.locator('li').first()).toContainText('Summit elevation · 10,026 ft');
    await expect(list.locator('li').first()).toContainText('No report');
    await expect(page).toHaveURL(/sort=acres%3Adesc/);
    await page.reload();
    await list.getByRole('combobox', { name: 'Sort results' }).selectOption('summitFt');
    await expect(list.locator('li').first()).toContainText('Alta Ski Area');
    await expect(page).toHaveURL(/sort=summitFt%3Adesc/);
    await selectView(page, 'Compare');
    await expect(comparison(page).getByRole('columnheader', { name: 'Summit', exact: true })).toHaveAttribute('aria-sort', 'descending');
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
    await setLayer(page, 'Terrain relief', true);
    await expect.poll(() => renderer.evaluate(map => map.getLayer('ski-terrain-relief')?.type)).toBe('hillshade');
    expect(terrainRequests).toBe(0);
    await renderer.evaluate(map => { map.jumpTo({ center: [-111.635515, 40.573361], zoom: 10 }); });
    await expect.poll(() => terrainRequests).toBeGreaterThan(0);
    expect(await renderer.evaluate(map => Boolean(map.getLayer('background')))).toBe(true);
    await setLayer(page, 'Terrain relief', false);
    await expect.poll(() => renderer.evaluate(map => Boolean(map.getSource('ski-terrain-dem')))).toBe(false);
    await renderer.dispose();
});

test('clears an old terrain relief error when a fresh source loads', async ({ page }) => {
    await prepare(page);
    let unavailable = true;
    let recoveredTiles = 0;
    await page.route('https://tiles.mapterhorn.com/**', route => {
        const headers = { 'access-control-allow-origin': '*' };
        if (unavailable) return route.fulfill({ status: 503, headers, body: 'Terrain unavailable' });
        recoveredTiles++;
        return route.fulfill({ headers, contentType: 'image/png', body: tile });
    });
    const renderer = await captureMap(page);
    await renderer.evaluate(map => { map.jumpTo({ center: [-111.635515, 40.573361], zoom: 10 }); });
    const error = page.getByText('Terrain relief unavailable.', { exact: true });
    await setLayer(page, 'Terrain relief', true);
    await expect(error).toBeVisible();
    await setLayer(page, 'Terrain relief', false);
    await expect.poll(() => renderer.evaluate(map => Boolean(map.getSource('ski-terrain-dem')))).toBe(false);

    unavailable = false;
    await setLayer(page, 'Terrain relief', true);
    await expect.poll(() => recoveredTiles).toBeGreaterThan(0);
    await expect.poll(() => renderer.evaluate(map => map.isSourceLoaded('ski-terrain-dem'))).toBe(true);
    await expect(error).toBeHidden();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    await renderer.dispose();
});

test('loads and filters resort terrain by zoom and pass using byte ranges', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const requests: string[] = [];
    page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname.endsWith('/resort-terrain.pmtiles') && !url.searchParams.has('import')) requests.push(request.headers().range ?? '');
    });
    const renderer = await captureMap(page);
    await inDialog(page, 'Layers', dialog => expect(dialog.getByRole('checkbox', { name: 'Ski terrain', exact: true })).toBeChecked());
    expect(requests).toEqual([]);

    const layers = ['ski-resort-footprints', 'ski-resort-lifts', 'ski-resort-runs', 'ski-resort-lift-stations'];
    const counts = () => renderer.evaluate((map, ids) => ids.map(id => map.getLayer(id)
        ? map.queryRenderedFeatures({ layers: [id] }).length : 0), layers);
    const rangeResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/resort-terrain.pmtiles')
        && Boolean(response.request().headers().range));
    await renderer.evaluate(map => { map.jumpTo({ center: [-119.896153, 38.943699], zoom: 9 }); });
    const response = await rangeResponse;
    expect(response.status()).toBe(206);
    expect(response.headers()['content-range']).toMatch(/^bytes 0-\d+\/\d+$/);
    await expect.poll(async () => {
        const [footprints, ...details] = await counts();
        return footprints > 0 && details.every(count => count === 0);
    }).toBe(true);
    await renderer.evaluate(map => { map.jumpTo({ zoom: 13.05 }); });
    await expect.poll(async () => (await counts()).every(count => count > 0)).toBe(true);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every(range => /^bytes=\d+-\d+$/.test(range))).toBe(true);

    const liftPosition = await renderer.evaluate(map => {
        const { clientWidth, clientHeight } = map.getContainer();
        const lifts = map.queryRenderedFeatures({ layers: ['ski-resort-lifts'] })
            .filter(feature => feature.properties.name === 'Heavenly Gondola');
        for (const { geometry } of lifts) {
            const paths = geometry.type === 'LineString' ? [geometry.coordinates]
                : geometry.type === 'MultiLineString' ? geometry.coordinates : [];
            for (const points of paths) {
                for (const [index, first] of points.slice(0, -1).entries()) {
                    const second = points[index + 1];
                    const { x, y } = map.project([(first[0] + second[0]) / 2, (first[1] + second[1]) / 2]);
                    if (x >= 100 && x <= clientWidth - 100 && y >= 100 && y <= clientHeight - 100) return { x, y };
                }
            }
        }
    });
    expect(liftPosition).toBeDefined();
    await page.locator('.maplibregl-canvas').hover({ position: liftPosition });
    await expect(page.getByText('Heavenly Gondola · gondola', { exact: true })).toBeVisible();

    await searchArea(page).click();
    await setPass(page, 'Ikon');
    await expect.poll(counts).toEqual([0, 0, 0, 0]);
    await setPass(page, 'Epic');
    await expect.poll(async () => (await counts()).every(count => count > 0)).toBe(true);

    await setLayer(page, 'Ski terrain', false);
    await expect.poll(counts).toEqual([0, 0, 0, 0]);
    await expect(page).toHaveURL(/skiTerrain=0/);
    await setLayer(page, 'Ski terrain', true);
    await expect.poll(async () => (await counts()).every(count => count > 0)).toBe(true);
    await renderer.evaluate(map => { map.jumpTo({ zoom: 8 }); });
    await expect.poll(counts).toEqual([0, 0, 0, 0]);
    await renderer.dispose();
});

test('validates the hosted check against real Heavenly terrain', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await prepare(page);
    const archive = await readFile(new URL('../../projects/ski-status/data/resort-terrain.pmtiles', import.meta.url));
    const ranges: Response[] = [];
    page.on('response', response => {
        const url = new URL(response.url());
        if (skiTerrainArchivePath.test(url.pathname) && !url.searchParams.has('import')) ranges.push(response);
    });

    await page.goto(SKI_TERRAIN_ROUTE);
    await verifyRenderedSkiTerrain(page, 10_000);
    expect(ranges.length).toBeGreaterThan(1);
    await Promise.all(ranges.map(response => verifySkiTerrainResponse(response, archive)));
});

test('keeps the basemap and resort dots available if the terrain archive fails', async ({ page }) => {
    await prepare(page);
    await page.route('**/resort-terrain.pmtiles', route => route.fulfill({ status: 503, body: 'Unavailable' }));
    const renderer = await captureMap(page);
    await renderer.evaluate(map => { map.jumpTo({ center: [-119.896153, 38.943699], zoom: 12 }); });
    await expect(page.getByText('Ski terrain unavailable.', { exact: true })).toBeVisible();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    expect(await renderer.evaluate(map => map.queryRenderedFeatures({ layers: ['ski-area-points'] })
        .some(feature => feature.properties.areaId === 'heavenly'))).toBe(true);
    await renderer.dispose();
});

test('reopens ski terrain after an archive outage when the overlay is toggled', async ({ page }) => {
    await prepare(page);
    let failArchive = true;
    await page.route('**/resort-terrain.pmtiles', route => failArchive
        ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.continue());
    const renderer = await captureMap(page);
    await renderer.evaluate(map => { map.jumpTo({ center: [-119.896153, 38.943699], zoom: 13 }); });
    const error = page.getByText('Ski terrain unavailable.', { exact: true });
    await expect(error).toBeVisible();

    await setLayer(page, 'Ski terrain', false);
    await expect(error).toBeHidden();
    failArchive = false;
    await setLayer(page, 'Ski terrain', true);
    await expect.poll(() => renderer.evaluate(map => map.queryRenderedFeatures({ layers: ['ski-resort-runs'] }).length)).toBeGreaterThan(0);
    await expect(error).toBeHidden();
    await renderer.dispose();
});

test('retries ski terrain on the fallback map and hides its error at overview zoom', async ({ page }) => {
    await prepare(page, null);
    let failArchive = true;
    await page.route('**/resort-terrain.pmtiles', route => failArchive
        ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.continue());
    const renderer = await captureMap(page, { state: 'degraded' });
    await renderer.evaluate(map => { map.jumpTo({ center: [-119.896153, 38.943699], zoom: 13 }); });
    const retrySkiTerrain = page.getByRole('button', { name: 'Retry ski terrain' });
    const retryBackground = page.getByRole('button', { name: 'Retry background' });
    await expect(retrySkiTerrain).toBeVisible();
    await expect(retryBackground).toBeVisible();

    await renderer.evaluate(map => { map.jumpTo({ zoom: 8 }); });
    await expect(retrySkiTerrain).toBeHidden();
    await expect(retryBackground).toBeVisible();
    await renderer.evaluate(map => { map.jumpTo({ zoom: 13 }); });
    await expect(retrySkiTerrain).toBeVisible();
    failArchive = false;
    await retrySkiTerrain.click();
    await expect(page.locator('.maplibregl-canvas')).toBeFocused();
    await expect.poll(() => renderer.evaluate(map => map.queryRenderedFeatures({ layers: ['ski-resort-runs'] }).length)).toBeGreaterThan(0);
    await expect(retrySkiTerrain).toBeHidden();
    await expect(retryBackground).toBeVisible();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'degraded');
    expect(await renderer.evaluate(map => map.getZoom())).toBe(13);
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

test('offers a map retry when marker data fails and keeps the selected area', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const renderer = await captureMap(page);
    const map = page.getByTestId('ski-status-map');
    await page.getByRole('searchbox', { name: 'Search areas' }).fill('whaleback');
    await page.getByRole('button', { name: 'Whaleback Mountain', exact: true }).click();

    await renderer.evaluate(map => {
        map.fire('error', { sourceId: 'ski-areas', error: new Error('Resort point data unavailable') });
    });
    await expect(map).toHaveAttribute('data-map-state', 'error');
    await expect(page.getByRole('region', { name: 'Whaleback Mountain', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry background' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Retry map' }).press('Enter');
    await expect(map).toHaveAttribute('data-map-state', 'ready');
    await expect(map.locator('.maplibregl-canvas')).toBeFocused();
    await expect(resort(page, 'Whaleback Mountain')).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search areas' })).toHaveValue('whaleback');
    await renderer.dispose();
});

test('retries at the current map position after the terrain shortcut has run', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const renderer = await captureMap(page);
    await findWhaleback(page, renderer);
    await result(page, 'Whaleback Mountain').click();
    await resort(page, 'Whaleback Mountain').getByRole('button', { name: 'Show runs and lifts' }).click();
    await expect.poll(() => mapCamera(page)?.zoom).toBe(13);
    await renderer.evaluate(map => { map.jumpTo({ center: [-71.5, 43.9], zoom: 10 }); });
    await expect.poll(() => mapCamera(page)?.zoom).toBe(10);
    await captureNextMap(page);
    await renderer.evaluate(map => { map.fire('error', { sourceId: 'ski-areas', error: new Error('Resort data unavailable') }); });
    await page.getByRole('button', { name: 'Retry map' }).click();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    const retried = await page.evaluateHandle(() => (window as ReviewWindow).skiStatusMap!);
    await expect.poll(() => retried.evaluate(map => ({ center: map.getCenter().toArray(), zoom: map.getZoom() })))
        .toEqual({ center: [-71.5, 43.9], zoom: 10 });
    await retried.dispose();
    await renderer.dispose();
});

test('keeps phone results and comparisons usable when the basemap fails', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 680 });
    await prepare(page, null);
    await page.goto('/projects/ski-status?pass=indy&q=whaleback');
    await expect(page).toHaveURL(url => url.pathname === path && url.searchParams.get('pass') === 'indy' && url.searchParams.get('q') === 'whaleback');
    await expect(page.getByText('1 ski area', { exact: true })).toBeVisible();
    const map = page.getByTestId('ski-status-map');
    await expect(map).toHaveAttribute('data-map-state', 'degraded', { timeout: 20_000 });
    const renderer = await map.elementHandle();
    await inDialog(page, 'Filters', dialog => expect(dialog.getByRole('checkbox', { name: 'Indy', exact: true })).toBeChecked());
    await selectView(page, 'Results');
    const row = result(page, 'Whaleback Mountain');
    await row.press('Enter');
    await expect(resort(page, 'Whaleback Mountain')).toBeFocused();
    await page.getByRole('button', { name: 'Close details' }).press('Enter');
    await expect(row).toBeFocused();
    await selectView(page, 'Compare');
    await expect(map).toBeHidden();
    await expect(comparison(page).getByRole('button', { name: 'Whaleback Mountain', exact: true })).toBeVisible();
    expect(await renderer!.evaluate(element => element.isConnected)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    expect(await comparison(page).evaluate(region => region.scrollWidth)).toBeGreaterThan(320);
    await renderer!.dispose();
});
