import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type JSHandle, type Locator, type Page, type Response, type Route } from '@playwright/test';
import type { GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature, MapSourceDataEvent, StyleSpecification } from 'maplibre-gl';
import sharp from 'sharp';
import packageMetadata from '../../package.json' with { type: 'json' };
import locations from '../../projects/ski-status/data/locations.json' with { type: 'json' };
import resortBases from '../../projects/ski-status/data/resort-bases.json' with { type: 'json' };
import resortPeaks from '../../projects/ski-status/data/resort-peaks.json' with { type: 'json' };
import snowHistory from '../../projects/ski-status/data/snow-history.json' with { type: 'json' };
import { SKI_TERRAIN_ROUTE, skiTerrainArchivePath, verifyRenderedSkiTerrain, verifySkiTerrainResponse } from '../../scripts/release-ski-terrain.ts';
import { hasSkiAsset, readSkiAsset, skiAssetsRoot, skiTerrainAsset } from '../../scripts/ski-asset-files.ts';
import { skiArchiveAssetUrl, skiArchiveIndexUrl, type SkiArchiveAsset } from '../../shared/skiArchive.ts';
import { skiAssetUrl } from '../../shared/skiAssets.ts';
import { passIconUrls } from '../../src/features/ski-status/passIcons.ts';
import { readSkiMapCamera } from '../../src/features/ski-status/skiMapArea.ts';
import { snowDepthTileEndpoint } from '../../src/features/ski-status/skiMapOverlays.ts';
import { highwayShieldLayer, regionalRoadLayer } from '../../src/features/ski-status/skiMapStyle.ts';

const path = '/projects/ski-status/map';
const styleUrl = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json*';
const hasTerrain = hasSkiAsset(skiTerrainAsset);
const hasIcons = hasSkiAsset('runtime/pass-icons/ikon.png');
const trailMapPeakLayer = 'ski-trail-map-peaks';
const nearbyPeakLayer = 'ski-nearby-peaks';
let fixtureIcon: Promise<Buffer> | undefined;
let fixtureTerrain: Promise<Buffer> | undefined;
const baseStyle: StyleSpecification = {
    version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#171b24' } }],
};

type ReviewWindow = Window & {
    skiStatusMap?: MapLibreMap;
};

async function serveFixtureTerrain(route: Route) {
    fixtureTerrain ??= readFile(new URL('../fixtures/ski-status/terrain.pmtiles', import.meta.url));
    const archive = await fixtureTerrain;
    const contentType = 'application/octet-stream';
    const range = route.request().headers().range;
    if (!range) return route.fulfill({ body: archive, contentType });
    const match = /^bytes=(\d+)-(\d+)$/.exec(range);
    if (!match || Number(match[1]) >= archive.length || Number(match[1]) > Number(match[2])) {
        return route.fulfill({ status: 416, headers: { 'content-range': `bytes */${archive.length}` } });
    }
    const start = Number(match[1]);
    const end = Math.min(Number(match[2]), archive.length - 1);
    return route.fulfill({
        status: 206, contentType, body: archive.subarray(start, end + 1),
        headers: { 'content-range': `bytes ${start}-${end}/${archive.length}` },
    });
}

async function prepare(page: Page, style: StyleSpecification | null = baseStyle) {
    await page.route('https://**/*', route => route.abort());
    await page.route(url => url.pathname === skiArchiveIndexUrl, route => route.fulfill({ json: [] }));
    if (!hasTerrain) await page.route(url => url.pathname === skiAssetUrl(skiTerrainAsset), serveFixtureTerrain);
    if (!hasIcons) {
        // Keep the UI tests independent of the NAS in CI.
        await page.route(/\/data\/ski-status\/assets\/runtime\/(?:resort-icons|pass-icons)\//, async route => {
            fixtureIcon ??= sharp({ create: { width: 40, height: 40, channels: 4, background: '#88aacc' } }).png().toBuffer();
            await route.fulfill({ body: await fixtureIcon, contentType: 'image/png' });
        });
    }
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

function addLocationFilter(page: Page, value: string | { label: string }, action: 'Include' | 'Exclude' = 'Include') {
    return inDialog(page, 'Filters', async dialog => {
        await dialog.getByLabel('Choose a location').selectOption(value);
        await dialog.getByRole('button', { name: action, exact: true }).click();
    });
}

function setPass(page: Page, name: string, checked = true) {
    return inDialog(page, 'Filters', dialog => dialog.getByRole('checkbox', { name, exact: true }).setChecked(checked));
}

function setColor(page: Page, value: string) {
    return inDialog(page, 'Layers', dialog => dialog.getByLabel('Map markers', { exact: true }).selectOption(value));
}

function setLayer(page: Page, name: string, checked: boolean) {
    return inDialog(page, 'Layers', dialog => dialog.getByRole('checkbox', { name, exact: true }).setChecked(checked));
}

const results = (page: Page) => page.getByRole('region', { name: 'Ski area list', exact: true });
const comparison = (page: Page) => page.getByRole('region', { name: 'Ski area comparison table', exact: true });
const resort = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const result = (page: Page, name: string) => results(page).getByRole('button', { name, exact: true });
const resultRow = (page: Page, name: string) => result(page, name).locator('..');
const searchArea = (page: Page) => page.getByRole('button', { name: /^(Search this area|Update area)$/ });
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
    const filters = page.getByRole('button', { name: 'Filters', exact: true });
    await filters.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Filters' });
    await expect(dialog.getByRole('checkbox', { name: 'Ikon', exact: true })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Epic', exact: true })).toBeChecked();
    const product = dialog.getByLabel('Pass product', { exact: true });
    await expect(product).toHaveValue('ikon-base');
    await expect(product).toHaveAccessibleDescription('Product and ski date apply to Ikon.');
    await dialog.getByRole('button', { name: 'Show 1 result', exact: true }).press('Enter');
    await expect(filters).toBeFocused();
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
    for (const label of ['Ikon', 'Epic', 'Indy', 'Mountain Collective']) {
        const pass = passes.getByRole('button', { name: label, exact: true });
        await expect(pass).toBeInViewport({ ratio: 1 });
        await expect(pass.locator('img')).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('opens About and the public data overview without losing the comparison', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await prepare(page);
    await page.goto(`${path}?view=table&status=all&q=whaleback`);
    const aboutButton = page.getByRole('button', { name: 'About', exact: true });
    await expect(page.getByRole('link', { name: 'rsmb.tv', exact: true })).toHaveAttribute('href', 'https://rsmb.tv');
    await expect(page.getByRole('link', { name: 'Projects', exact: true })).toHaveCount(0);
    await aboutButton.press('Enter');

    const about = page.getByRole('dialog', { name: 'About ski-status' });
    const aboutTitle = about.getByRole('heading', { name: 'About ski-status' });
    await expect(aboutTitle).toBeFocused();
    await expect(about.getByText('Created by Robert Bryson')).toBeVisible();
    await expect(about.getByRole('link', { name: 'hello@rsmb.tv' })).toHaveAttribute('href', 'mailto:hello@rsmb.tv');
    await expect(about.getByRole('link', { name: 'Visit rsmb.tv' })).toHaveAttribute('href', 'https://rsmb.tv');
    await expect(about.getByText('Version', { exact: true }).locator('..').locator('dd')).toHaveText(packageMetadata.version);
    await expect(about.getByText('Last build date').locator('..').locator('dd')).toHaveText(/^\w+ \d{1,2}, \d{4}$/);
    await about.getByRole('button', { name: 'Open admin panel' }).click();

    const admin = page.getByRole('dialog', { name: 'Data quality and status' });
    await expect(admin.getByRole('heading', { name: 'Data quality and status' })).toBeFocused();
    await expect(admin.getByText(new RegExp(`^${locations.locations.length} ski areas across \\d+ countries\\.$`))).toBeVisible();
    await expect(admin.getByRole('status')).toHaveText('Feed unavailable');
    await expect(admin.getByText('Bundled', { exact: true })).toHaveCount(2);
    await expect(admin.getByRole('listitem').filter({ hasText: 'All six comparison fields' })).toHaveText(/\d+ \/ \d+/);
    expect(await admin.evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(Math.ceil((await admin.boundingBox())!.width));
    const accessibility = await new AxeBuilder({ page }).include('#ski-about').analyze();
    expect(accessibility.violations).toEqual([]);

    await admin.getByRole('button', { name: 'Back to About' }).click();
    await expect(aboutTitle).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(about).toBeHidden();
    await expect(aboutButton).toBeFocused();
    await expect(page).toHaveURL(`${path}?view=table&status=all&q=whaleback`);
    await expect(comparison(page).getByRole('button', { name: 'Whaleback Mountain', exact: true })).toBeVisible();
});

test('reports partial conditions and retains the last verified snapshot through a stale manifest and an outage', async ({ page }) => {
    await prepare(page);
    const generatedAt = '2026-12-25T17:45:00Z';
    const body = JSON.stringify({ version: 1, generatedAt, reports: [{
        areaId: 'whaleback', status: 'limited', retrievedAt: generatedAt, reportedAt: generatedAt,
        source: { name: 'Test operator', url: 'https://example.test/conditions', exportable: false },
    }] });
    const reportsFile = `reports-${createHash('sha256').update(body).digest('hex')}.json`;
    const forecastsFile = `forecasts-${'b'.repeat(64)}.json`;
    let feedAvailable = true;
    let updatedAt = generatedAt;
    await page.route('https://data.rsmb.tv/ski-status/**', route => {
        const headers = { 'access-control-allow-origin': '*' };
        const filename = new URL(route.request().url()).pathname.split('/').at(-1);
        if (!feedAvailable || filename === forecastsFile) return route.fulfill({ status: 503, headers });
        if (filename === reportsFile) return route.fulfill({ body, headers });
        return route.fulfill({ json: {
            version: 1, updatedAt, catalogRevision: 'a'.repeat(64), reports: reportsFile, forecasts: forecastsFile,
        }, headers });
    });
    await page.clock.install({ time: new Date('2026-12-25T18:00:00Z') });
    await page.goto(`${path}?view=table&status=all&q=snowbird`);
    await page.getByRole('button', { name: 'About', exact: true }).click();
    await page.getByRole('button', { name: 'Open admin panel' }).click();

    const admin = page.getByRole('dialog', { name: 'Data quality and status' });
    const reportSnapshot = admin.getByText('Reports snapshot', { exact: true }).locator('..');
    await expect(admin.getByRole('status')).toHaveText('Snapshot unavailable');
    await expect(reportSnapshot.getByText('Published')).toBeVisible();
    await expect(reportSnapshot.locator('time')).toHaveAttribute('datetime', generatedAt);
    await expect(admin.getByText('Forecasts snapshot').locator('..')).toContainText('Bundled');
    const reportCount = admin.getByText('Current operating reports').locator('..').locator('strong');
    await expect(reportCount).toHaveText('1');

    updatedAt = '2026-12-25T17:30:00Z';
    await page.clock.fastForward(300_001);
    await expect(admin.getByRole('status')).toHaveText('Feed unavailable');
    await expect(reportSnapshot.getByText('Last verified')).toBeVisible();
    await expect(reportCount).toHaveText('1');

    updatedAt = generatedAt;
    await page.clock.fastForward(300_001);
    await expect(admin.getByRole('status')).toHaveText('Snapshot unavailable');
    await expect(reportSnapshot.getByText('Published')).toBeVisible();

    feedAvailable = false;
    await page.clock.fastForward(300_001);
    await expect(admin.getByRole('status')).toHaveText('Feed unavailable');
    await expect(reportSnapshot.getByText('Last verified')).toBeVisible();
    await expect(reportCount).toHaveText('1');
});

test('opens the filtered results from the map on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page);
    await page.goto(`${path}?view=map&status=all&q=whaleback`);
    const filters = page.getByRole('button', { name: 'Filters', exact: true });
    await filters.click();
    const dialog = page.getByRole('dialog', { name: 'Filters', exact: true });
    await dialog.getByRole('checkbox', { name: 'Indy', exact: true }).check();
    await dialog.getByRole('button', { name: 'Show 1 result', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/view=results/);
    await expect(page).toHaveURL(/pass=indy/);
    await expect(result(page, 'Whaleback Mountain')).toBeVisible();
    await expect(filters).toBeFocused();
    await results(page).getByRole('combobox', { name: 'Sort results' }).selectOption('liftCount');
    await expect(resultRow(page, 'Whaleback Mountain').locator('dd')).toHaveText('4');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
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
        await expect(link).toHaveAttribute('download', filename);
        if (label === 'Terrain data') {
            await expect(link).toHaveAttribute('href', skiAssetUrl(skiTerrainAsset));
        }
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
    await addLocationFilter(page, 'region:US:UT');
    const passes = page.getByRole('group', { name: 'Pass filters' });
    await passes.getByRole('button', { name: 'Ikon', exact: true }).press('Space');
    await passes.getByRole('button', { name: 'Epic', exact: true }).press('Enter');
    await passes.getByRole('button', { name: 'Mountain Collective', exact: true }).click();
    const alta = resultRow(page, 'Alta Ski Area');
    const parkCity = resultRow(page, 'Park City Mountain');
    await expect(alta.getByText('Ikon', { exact: true })).toBeVisible();
    await expect(alta.getByText('Mountain Collective', { exact: true })).toBeVisible();
    await expect(parkCity.getByText('Epic', { exact: true })).toBeVisible();
    await expect(parkCity.getByText('Ikon', { exact: true })).toHaveCount(0);
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

test('keeps the local map camera when pass filters change', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepare(page);
    const renderer = await captureMap(page);
    const camera = { center: [-111.72, 40.7] as [number, number], zoom: 9.5, bearing: -12, pitch: 20 };
    const liveCamera = () => renderer.evaluate(map => ({
        center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(),
    }));
    const memberships = () => renderer.evaluate(async map => {
        const data = await map.getSource<GeoJSONSource>('ski-areas')?.getData();
        const ids = data?.type === 'FeatureCollection' ? new Set(data.features.map(feature => feature.id)) : new Set();
        return { alta: ids.has('alta'), parkCity: ids.has('park-city-mountain') };
    });
    await renderer.evaluate((map, camera) => { map.jumpTo(camera); }, camera);
    await expect.poll(() => mapCamera(page)).toEqual(camera);
    const start = await liveCamera();
    const passes = page.getByRole('group', { name: 'Pass filters' });
    for (const [pass, alta, parkCity] of [['Ikon', true, false], ['Epic', true, true], ['Ikon', false, true], ['Epic', true, true]] as const) {
        await passes.getByRole('button', { name: pass, exact: true }).click();
        await expect.poll(memberships).toEqual({ alta, parkCity });
        expect(await liveCamera()).toEqual(start);
        await expect.poll(() => mapCamera(page)).toEqual(camera);
    }

    await setPass(page, 'Epic');
    await expect.poll(memberships).toEqual({ alta: false, parkCity: true });
    expect(await liveCamera()).toEqual(start);
    await page.getByRole('button', { name: 'Fit results', exact: true }).click();
    await expect.poll(() => mapCamera(page)?.zoom ?? camera.zoom).toBeLessThan(camera.zoom);
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
    const filters = page.getByRole('button', { name: 'Filters', exact: true });
    await expect(filters).toBeFocused();
    await expect(filters).toHaveAccessibleDescription('1 additional filter active');
    const focusHint = () => filters.evaluate(button => getComputedStyle(button, '::after').content);
    await expect.poll(focusHint).toBe('"Filters"');
    await page.keyboard.press('Escape');
    await expect.poll(focusHint).toBe('none');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Ikon', exact: true })).toBeFocused();

    for (const size of sizes) {
        await page.setViewportSize(size);
        const status = (await page.getByRole('button', { name: 'All resorts', exact: true }).boundingBox())!;
        const view = (await page.getByRole('button', { name: 'Map', exact: true }).boundingBox())!;
        expect(Math.abs(status.y - view.y)).toBeLessThan(4);
        expect(status.x + status.width).toBeLessThanOrEqual(view.x);
        const canvas = (await map.boundingBox())!;
        expect(canvas.height).toBeGreaterThan(size.height - 220);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
        for (const name of ['Filters', 'Share current view', 'Search this area', 'Fit results', 'Layers']) {
            const button = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
            expect(button.height).toBeGreaterThanOrEqual(44);
            expect(button.width).toBeGreaterThanOrEqual(44);
            expect(button.x + button.width).toBeLessThanOrEqual(size.width);
        }
        const fitLabel = page.getByRole('button', { name: 'Fit results', exact: true }).getByText('Fit results');
        await expect(fitLabel).toBeVisible({ visible: size.width > 352 });
        const area = (await page.getByRole('group', { name: 'Map area', exact: true }).boundingBox())!;
        const fit = (await page.getByRole('button', { name: 'Fit results', exact: true }).boundingBox())!;
        expect(area.x - canvas.x).toBeLessThan(20);
        expect(area.x + area.width).toBeLessThan(fit.x);
        for (const name of ['Zoom in', 'Zoom out']) {
            const zoom = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
            expect(zoom.y).toBeGreaterThanOrEqual(canvas.y);
            expect(zoom.y + zoom.height).toBeLessThanOrEqual(canvas.y + canvas.height);
        }
    }
});

test('anchors Map layers to the map and keeps panning, zooming, and keyboard focus usable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    await page.route(`${snowDepthTileEndpoint}**`, route => route.fulfill({
        contentType: 'image/png', body: tile, headers: { 'access-control-allow-origin': '*' },
    }));
    const renderer = await captureMap(page);
    await findWhaleback(page, renderer);
    await result(page, 'Whaleback Mountain').click();
    await expect.poll(() => mapCamera(page)?.zoom).toBeCloseTo(9);

    const mapRegion = page.getByRole('region', { name: 'Map of ski areas' });
    const button = mapRegion.getByRole('button', { name: 'Layers', exact: true });
    const panel = mapRegion.getByRole('dialog', { name: 'Map layers', exact: true });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(panel.getByLabel('Map markers')).toBeFocused();
    await expect(panel).not.toHaveAttribute('aria-modal', 'true');
    const panelBounds = (await panel.boundingBox())!;
    const buttonBounds = (await button.boundingBox())!;
    const mapBounds = (await mapRegion.boundingBox())!;
    expect(panelBounds.y - (buttonBounds.y + buttonBounds.height)).toBeLessThan(12);
    expect(panelBounds.y).toBeGreaterThanOrEqual(buttonBounds.y + buttonBounds.height);
    expect(buttonBounds.x - (panelBounds.x + panelBounds.width)).toBeLessThan(12);
    expect(panelBounds.x).toBeGreaterThan(mapBounds.x + mapBounds.width / 2);

    const camera = mapCamera(page);
    await panel.getByRole('checkbox', { name: 'Snow depth', exact: true }).check();
    await expect.poll(() => renderer.evaluate(map => Boolean(map.getLayer('ski-snow-depth')))).toBe(true);
    await expect(panel.getByRole('region', { name: 'Estimated snow depth (in)' })).toBeVisible();
    expect(mapCamera(page)).toEqual(camera);
    const { violations } = await new AxeBuilder({ page }).include('#ski-map-layers')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(violations).toEqual([]);

    const start = camera!.center;
    await page.mouse.move(mapBounds.x + 60, mapBounds.y + 180);
    await page.mouse.down();
    await page.mouse.move(mapBounds.x + 160, mapBounds.y + 200, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => mapCamera(page)?.center).not.toEqual(start);
    await expect(panel).toBeVisible();
    await mapRegion.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect.poll(() => mapCamera(page)?.zoom).toBeGreaterThan(9);
    await expect(panel).toBeVisible();

    await panel.getByRole('checkbox', { name: 'Snow depth', exact: true }).press('Escape');
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(resort(page, 'Whaleback Mountain')).toBeVisible();
    await button.click();
    const search = page.getByRole('searchbox', { name: 'Search areas' });
    await search.click();
    await expect(panel).toBeHidden();
    await expect(search).toBeFocused();
    await renderer.dispose();
});

test('keeps Map layers scrollable beside zoom on a phone with resort details open', async ({ page }) => {
    const sizes = [{ width: 320, height: 700 }, { width: 640, height: 360 }];
    await page.setViewportSize(sizes[0]);
    await prepare(page);
    await page.goto(`${path}?status=all&view=map&area=whaleback&skiTerrain=0&snowDepth=1`);
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    const mapRegion = page.getByRole('region', { name: 'Map of ski areas' });
    const button = mapRegion.getByRole('button', { name: 'Layers', exact: true });
    const panel = mapRegion.getByRole('dialog', { name: 'Map layers', exact: true });
    for (const size of sizes) {
        await page.setViewportSize(size);
        await button.click();
        await expect(panel).toBeInViewport({ ratio: 1 });
        await expect(panel.getByLabel('Map markers')).toBeInViewport({ ratio: 1 });
        const map = (await mapRegion.boundingBox())!;
        const bounds = (await panel.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(map.x);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(map.x + map.width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(map.y + map.height);
        expect(await panel.evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(Math.ceil(bounds.width));
        for (const name of ['Zoom in', 'Zoom out']) {
            await mapRegion.getByRole('button', { name, exact: true }).click({ trial: true });
        }
        const source = panel.getByRole('link', { name: 'NOAA source', exact: true });
        await source.scrollIntoViewIfNeeded();
        await expect(source).toBeInViewport({ ratio: 1 });
        await panel.getByRole('button', { name: 'Close', exact: true }).click();
        await expect(button).toBeFocused();
        await expect(resort(page, 'Whaleback Mountain')).toBeVisible();
    }
    await button.click();
    await selectView(page, 'Compare');
    await expect(panel).toBeHidden();
    await selectView(page, 'Map');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
});

test('pages through the catalog with the keyboard without loading the map renderer', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await prepare(page);
    const mapRequests: string[] = [];
    page.on('request', request => {
        if (new URL(request.url()).pathname.includes('maplibre')) mapRequests.push(request.url());
    });
    await page.goto(`${path}?view=table`);

    const pages = page.getByRole('navigation', { name: 'Comparison pages' });
    const rows = comparison(page).locator('tbody tr');
    const firstResort = rows.first().getByRole('rowheader').getByRole('button');
    await expect(rows).toHaveCount(50);
    await expect(pages.getByRole('status')).toHaveText(/^1–50 of \d+ areas$/);
    await expect(pages.getByRole('button', { name: 'Previous' })).toBeDisabled();
    const first = await firstResort.innerText();

    const next = pages.getByRole('button', { name: 'Next' });
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(next).toBeFocused();
    await expect(pages.getByRole('status')).toHaveText(/^51–100 of \d+ areas$/);
    await expect(firstResort).not.toHaveText(first);
    await comparison(page).getByRole('button', { name: 'Vertical', exact: true }).click();
    await expect(pages.getByRole('status')).toHaveText(/^1–50 of \d+ areas$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    expect(mapRequests).toEqual([]);
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
    await expect(table.getByRole('columnheader', { name: 'Mapped lifts', exact: true })).toHaveCount(0);
    await inDialog(page, 'Columns', dialog => dialog.getByRole('checkbox', { name: 'Show Mapped lifts column', exact: true }).check());
    await page.reload();
    await expect(table.getByRole('columnheader', { name: 'Mapped lifts', exact: true })).toBeVisible();

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Export CSV' }).click(),
    ]);
    const csv = await readFile(await download.path(), 'utf8');
    expect(csv).toContain('Snowbird');
    expect(csv).toContain('OpenSkiData');
    expect(csv).toContain('Mapped lifts');
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
    await expect(page.getByText(`0 of ${locations.locations.length} areas have current operating reports`)).toBeVisible();
});

test('explains the empty Ski today view when current reports are unavailable', async ({ page }) => {
    await prepare(page);
    await page.clock.setFixedTime(new Date('2026-11-22T18:00:00Z'));
    let finishRequest!: () => void;
    const requestReady = new Promise<void>(resolve => { finishRequest = resolve; });
    await page.route('https://data.rsmb.tv/ski-status/manifest.json', async route => {
        await requestReady;
        await route.fulfill({ status: 403, headers: { 'access-control-allow-origin': '*' } });
    });
    await page.goto(`${path}?view=table&status=today&q=lake+louise`);
    await expect(page.getByText('Checking today’s resort reports…', { exact: true })).toBeVisible();
    finishRequest();
    await expect(page.getByText('No current operating reports are available for this search.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Show all statuses', exact: true }).click();
    await expect(comparison(page).getByRole('button', { name: 'Lake Louise Ski Resort', exact: true })).toBeVisible();
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
    await inDialog(page, 'Columns', async dialog => {
        await dialog.getByRole('checkbox', { name: 'Show Typical opening column', exact: true }).check();
        await dialog.getByRole('checkbox', { name: 'Show Typical season length column', exact: true }).check();
    });
    await expect(table.getByRole('cell', { name: 'Nov 12', exact: true })).toBeVisible();
    await expect(table.getByRole('cell', { name: '197 days', exact: true })).toBeVisible();
    await table.getByRole('button', { name: 'Typical season length', exact: true }).click();
    await expect(table.getByRole('columnheader', { name: 'Typical season length', exact: true })).toHaveAttribute('aria-sort', 'descending');
    await killington.click();
    const seasons = page.getByRole('region', { name: 'Season dates' });
    await expect(seasons).toContainText('Typical season length 197 days');
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

test.describe('snow chart on a phone', () => {
    test.use({ hasTouch: true, viewport: { width: 320, height: 780 } });

    test('plots both snow measures and supports hover, touch, and keyboard month inspection', async ({ page }) => {
        await prepare(page);
        await page.clock.setFixedTime(new Date('2026-11-21T18:00:00Z'));
        await page.goto(`${path}?view=results&status=all&q=aspen+highlands`);
        await result(page, 'Aspen Highlands').click();
        const season = resort(page, 'Aspen Highlands').getByRole('region', { name: 'Season dates' });
        await expect(season.getByText('Dec 12', { exact: true })).toHaveAttribute('datetime', '2026-12-12');
        const month = (name: string) => season.getByRole('radio', { name, exact: true });
        const column = (name: string) => month(name).locator('..');
        const bar = (name: string) => column(name).locator('.ski-snow-bar');
        await expect(bar('November')).toBeVisible();
        await expect(column('November').locator('.ski-snow-depth-point')).toBeVisible();
        await expect(season.locator('.ski-snow-month')).toHaveText(['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']);
        const [novemberBar, decemberBar] = await Promise.all([bar('November').boundingBox(), bar('December').boundingBox()]);
        expect(decemberBar!.x).toBeGreaterThan(novemberBar!.x);
        expect(decemberBar!.height).toBeGreaterThan(novemberBar!.height);
        expect(novemberBar!.height).toBeGreaterThan(novemberBar!.width);
        expect(decemberBar!.y + decemberBar!.height).toBeCloseTo(novemberBar!.y + novemberBar!.height);
        expect((await column('November').boundingBox())!.width).toBeGreaterThanOrEqual(24);

        const readout = season.locator('.ski-snow-readout');
        const monthLabel = readout.locator('.ski-snow-readout-month');
        await expect(monthLabel).toHaveText('November');
        await expect(readout).toContainText('20.1 in');
        await expect(readout).toContainText('3 in');
        await month('November').focus();
        await page.keyboard.press('ArrowRight');
        await expect(month('December')).toBeFocused();
        await expect(month('December')).toBeChecked();
        await expect(monthLabel).toHaveText('December');
        await column('February').hover();
        await expect(monthLabel).toHaveText('February');
        await expect(month('December')).toBeChecked();
        await season.getByRole('heading', { name: 'Monthly snow and season (in)' }).hover();
        await expect(monthLabel).toHaveText('December');
        await column('May').tap();
        await expect(month('May')).toBeChecked();
        await expect(monthLabel).toHaveText('May');
        await expect(readout.getByText('Unavailable', { exact: true })).toHaveCount(3);

        const values = season.getByText('Monthly values', { exact: true });
        await month('May').focus();
        await page.keyboard.press('Tab');
        await expect(values).toBeFocused();
        await values.press('Enter');
        const november = season.getByRole('table', { name: 'Monthly snow and season (in)' }).getByRole('row', { name: /November/ });
        await expect(november.getByRole('cell', { name: '20.1 in', exact: true })).toBeVisible();
        await expect(november.getByRole('cell', { name: '3 in', exact: true })).toBeVisible();
        await season.getByText('Snow sources', { exact: true }).press('Enter');
        const sources = season.getByRole('list', { name: 'Historical snow sources' });
        await expect(sources.getByRole('link', { name: 'Annual snowfall' }))
            .toHaveAttribute('href', snowHistory['aspen-highlands'].snowfall.annualSource.source);
        await expect(sources.getByRole('listitem').filter({ hasText: 'Monthly snowfall totals' })).toContainText('Aspen 1SW, CO weather station');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
        expect(await season.locator('.ski-season-chart').evaluate(chart => chart.scrollWidth <= chart.clientWidth)).toBe(true);
        const { violations } = await new AxeBuilder({ page }).include('.ski-season-chart')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(violations).toEqual([]);
    });
});

test('opens the Hunter ski resort links from its details panel', async ({ page }) => {
    await prepare(page);
    await page.goto(`${path}?area=hunter-mountain&status=all`);
    const links = resort(page, 'Hunter Mountain').getByRole('group', { name: 'Resort links' });
    const maps = links.getByRole('link', { name: 'Google Maps', exact: true });
    await expect(maps).toHaveAttribute('href',
        'https://www.google.com/maps/search/?api=1&query=Hunter+Mountain+Resort%2C+64+Klein+Ave%2C+Hunter%2C+NY+12442');
    await expect(links.getByRole('link', { name: 'Wikipedia', exact: true }))
        .toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Hunter_Mountain_(ski_area)');
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
    await season.getByText('Monthly values', { exact: true }).click();
    const snow = season.getByRole('table', { name: 'Monthly snow and season (in)' });
    await expect(snow.getByRole('row', { name: /November/ })).toContainText('53.9 in');
    const february = snow.getByRole('row', { name: /February/ });
    await expect(february.getByRole('cell', { name: '37.8 in', exact: true })).toBeVisible();
    await expect(february.getByRole('link', { name: '55.1 in', exact: true })).toBeVisible();
    await expect(february.getByRole('cell', { name: 'In season', exact: true })).toBeVisible();
    await expect(season.getByRole('radio', { name: 'February' }).locator('..').locator('.ski-snow-season-track'))
        .toHaveAttribute('data-typical', 'true');

    await details.getByRole('button', { name: 'Show runs and lifts', exact: true }).click();
    await expect.poll(() => mapCamera(page)).toMatchObject({ center: terrainPoint('banff-sunshine'), zoom: 13 });
    await expect(details).toBeVisible();
    await expect(results(page)).toBeHidden();
    await renderer.dispose();
});

test('shows batch visitor records in resort details on a narrow screen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await prepare(page);
    await page.goto(`${path}?view=table&status=all&area=banff-sunshine`);
    const visitor = resort(page, 'Banff Sunshine Village').getByRole('region', { name: 'Visitor information', exact: true });
    await expect(visitor).toContainText('2026/27 season');
    await expect(visitor.locator('summary').filter({ hasText: 'Lift tickets' })).toContainText('CA$49');

    await visitor.getByText('Trail maps', { exact: true }).click();
    await expect(visitor.getByRole('link', { name: 'Goat’s Eye Mountain and the ski-out' })).toHaveAttribute('href', /25_TrailMap_GoatsEye_web\.pdf$/);
    await expect(visitor.getByRole('link', { name: 'Map source' }).first()).toHaveAttribute('href', /skibanff\.com\/the-mountain\/lifts-terrain\/trail-maps$/);
    await visitor.getByText('Lift tickets', { exact: true }).click();
    await expect(visitor.getByText('Adult full-day lift ticket', { exact: true })).toBeVisible();
    await expect(visitor.getByText(/early-season adult full day at the window/)).toBeVisible();
    await expect(visitor.getByRole('link', { name: 'Ticket prices and terms' })).toHaveAttribute('href', /skibanff\.com\/the-mountain\/mountain-report/);

    await visitor.getByText('Bases and parking', { exact: true }).click();
    await expect(visitor.getByRole('link', { name: 'Sunshine Gondola base', exact: true }))
        .toHaveAttribute('href', /51\.114965%2C-115\.763609/);
    await expect(visitor.getByRole('link', { name: 'Creekside Lodge', exact: true })).toBeVisible();
    const parking = visitor.getByRole('region', { name: 'Parking', exact: true });
    await expect(parking.getByText('Free', { exact: true })).toBeVisible();
    await expect(parking).toContainText('A valid Parks Canada pass is required.');

    await visitor.getByText('Webcams', { exact: true }).click();
    await expect(visitor.getByRole('link', { name: 'Village from Wardens Cabin' })).toHaveAttribute('href', 'https://www.skibanff.com/webcams');
    await expect(visitor.getByRole('link', { name: 'Aurora Cam', exact: true })).toHaveAttribute('href', 'https://cameras.skibanff.com/dynamic/10m');
    await expect(visitor.locator('iframe, video, img')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    const { violations } = await new AxeBuilder({ page }).include('.ski-visitor-info')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(violations).toEqual([]);

    await page.goto(`${path}?view=table&status=all&area=pats-peak`);
    const patsPeak = resort(page, 'Pats Peak').getByRole('region', { name: 'Visitor information', exact: true });
    await patsPeak.getByText('Webcams', { exact: true }).click();
    await expect(patsPeak.getByRole('link', { name: 'Pats Peak Live', exact: true }))
        .toHaveAttribute('href', 'https://www.youtube.com/watch?v=KFjl8wPJvyg');
});

test('uses NAS icon previews in results and details and opens archived trail maps', async ({ page }) => {
    await prepare(page);
    const fields = {
        areaId: 'big-moose', checkedOn: '2026-11-21', sha256: 'a'.repeat(64), byteCount: 10,
        source: 'https://img1.wsimg.com/blobby/go/d9686d90-24b3-48b8-a200-b81ae5e14909/BigMooseMap_web%20(1).pdf',
    };
    const trailMap: SkiArchiveAsset = {
        ...fields, kind: 'trail map', edition: 'undated',
        relativePath: 'trail-maps/big-moose/undated/Big Moose (1).pdf',
        coverage: 'Lower lift-served mountain and labeled upper-mountain routes',
    };
    const iconDigest = 'b'.repeat(64);
    const [mapIcon, detailsIcon] = [40, 84].map((size): SkiArchiveAsset => ({
        ...fields, kind: 'icon variant', source: 'https://example.test/big-moose.png', sourceSha256: iconDigest,
        relativePath: `resort-icons/big-moose/${iconDigest}/${size === 40 ? 'map' : 'details'}-${size}.png`,
    }));
    for (const [asset, size] of [[mapIcon, 40], [detailsIcon, 84]] as const) {
        const { pathname } = new URL(skiArchiveAssetUrl(asset), 'http://example.test');
        const body = await sharp({ create: { width: size, height: size, channels: 4, background: '#55a0d0' } }).png().toBuffer();
        await page.route(url => url.pathname === pathname, route => route.fulfill({ body, contentType: 'image/png' }));
    }
    let sendArchive = () => {};
    const waitForArchive = new Promise<void>(resolve => { sendArchive = resolve; });
    let online = true;
    await page.route(url => url.pathname === skiArchiveIndexUrl, async route => {
        await waitForArchive;
        return online ? route.fulfill({ json: [trailMap, mapIcon, detailsIcon] }) : route.fulfill({ status: 503 });
    });

    const renderer = await captureMap(page);
    sendArchive();
    await expect.poll(() => renderer.evaluate(map => {
        if (!map.hasImage('ski-resort-image-big-moose')) return [];
        const { data, width, height } = map.getImage('ski-resort-image-big-moose').data;
        const start = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
        return Array.from(data.slice(start, start + 4));
    })).toEqual([85, 160, 208, 255]);
    await page.getByRole('searchbox', { name: 'Search areas' }).fill('Big Moose');
    const resultIcon = result(page, 'Big Moose').locator('img');
    await expect(resultIcon).toHaveAttribute('src', skiArchiveAssetUrl(mapIcon));
    await expect.poll(() => resultIcon.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(40);
    await resultIcon.click();
    const details = resort(page, 'Big Moose');
    const logo = details.locator('.ski-resort-icon');
    await expect(logo).toHaveAttribute('src', skiArchiveAssetUrl(detailsIcon));
    await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(84);

    const visitor = details.getByRole('region', { name: 'Visitor information', exact: true });
    await visitor.getByText('Trail maps', { exact: true }).click();
    const map = visitor.getByRole('link', { name: trailMap.coverage, exact: true });
    await expect(map).toHaveAttribute('href', skiArchiveAssetUrl(trailMap));
    await expect(visitor.getByText('PDF · Edition undated · NAS copy')).toBeVisible();
    await expect(visitor.getByRole('link', { name: 'Map source' }).first()).toHaveAttribute('href', 'https://skibigmoose.com/trail-map');

    await renderer.dispose();
    const detailsUrl = new URL(skiArchiveAssetUrl(detailsIcon), 'http://example.test');
    await page.route(url => url.pathname === detailsUrl.pathname, route => route.abort());
    await page.reload();
    await expect(logo).toHaveAttribute('src', skiArchiveAssetUrl(mapIcon));
    await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(40);
    const mapUrl = new URL(skiArchiveAssetUrl(mapIcon), 'http://example.test');
    await page.route(url => url.pathname === mapUrl.pathname, route => route.abort());
    await page.reload();
    await expect(logo).toHaveCount(0);

    online = false;
    await page.reload();
    await visitor.getByText('Trail maps', { exact: true }).click();
    await expect(map).toHaveAttribute('href', trailMap.source);
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
    await expect(resultRow(page, 'Snowbird')).toContainText('Limited today');
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
    await expect(resultRow(page, 'Snowbird')).toContainText('Stale report');
    await expect.poll(color).toBe('#abb9c6');
    expect(await renderer.evaluate(map => ({ center: map.getCenter().toArray(), zoom: map.getZoom() }))).toEqual(camera);
    await renderer.dispose();
});

test('opens on the phone globe with individual status markers and a usable resort panel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page);
    await page.clock.setFixedTime(new Date('2026-11-20T18:00:00Z'));
    const renderer = await captureMap(page, { today: true });
    expect(await renderer.evaluate(map => map.getProjection().type)).toBe('globe');
    await expect(page.getByText('5 reporting skiing today', { exact: true })).toBeVisible();
    await expect(page.getByText(`6 of ${locations.locations.length} areas have current operating reports`)).toBeVisible();
    await expect(results(page)).toBeHidden();
    await expect.poll(() => renderer.evaluate(map => map.queryRenderedFeatures({ layers: ['ski-area-status'] })
        .map(feature => feature.properties.areaId))).toContain('lake-louise');
    const skipMap = page.getByRole('link', { name: 'Skip to map', exact: true });
    await skipMap.focus();
    await skipMap.press('Enter');
    await expect(page.getByRole('region', { name: 'Map of ski areas', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(searchArea(page)).toBeFocused();
    await selectView(page, 'Results');
    const lakeLouise = result(page, 'Lake Louise Ski Resort');
    await expect(resultRow(page, 'Lake Louise Ski Resort')).toContainText('Limited today');
    await expect(resultRow(page, 'Lake Louise Ski Resort')).toContainText('4 lifts open');
    await lakeLouise.press('Enter');
    const details = resort(page, 'Lake Louise Ski Resort');
    await expect(details).toBeFocused();
    await expect(details.getByRole('link', { name: 'Official conditions', exact: true })).toBeVisible();
    await details.getByRole('button', { name: 'Close details' }).press('Enter');
    await expect(lakeLouise).toBeFocused();
    await renderer.dispose();
});

test('opens resort terrain while keeping the phone details docked', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page);
    await page.goto(`${path}?view=results&status=all&q=lake%20louise&skiTerrain=0`);
    await result(page, 'Lake Louise Ski Resort').click();
    const range = page.waitForResponse(response => skiTerrainArchivePath.test(new URL(response.url()).pathname) && response.status() === 206);
    const details = resort(page, 'Lake Louise Ski Resort');
    await details.getByRole('button', { name: 'Show runs and lifts' }).press('Enter');
    expect((await range).headers()['content-range']).toMatch(/^bytes \d+-\d+\/\d+$/);
    await expect(details).toBeVisible();
    await expect(page).toHaveURL(url => url.searchParams.get('view') === 'map' && url.searchParams.get('area') === 'lake-louise');
    const map = page.getByRole('region', { name: 'Map of ski areas' });
    await expect(map).toBeVisible();
    await expect(map.locator('canvas.maplibregl-canvas')).toBeFocused();
    await expect.poll(() => mapCamera(page)?.zoom).toBeGreaterThanOrEqual(13);
    await inDialog(page, 'Layers', async dialog => {
        await expect(dialog.getByRole('region', { name: 'Mapped runs and lifts' })).toBeVisible();
        await expect(dialog.getByText('Green and blue convention', { exact: true })).toBeVisible();
    });
    await page.reload();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    await expect(details).toBeVisible();
    await expect.poll(() => mapCamera(page)?.zoom).toBeGreaterThanOrEqual(13);
});

test('fits filtered Ikon resorts in New Zealand from the phone globe', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await prepare(page);
    const renderer = await captureMap(page);
    await addLocationFilter(page, { label: 'New Zealand' });
    await setPass(page, 'Ikon');
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

test('shows confirmed Ikon access at Paznaun ski areas', async ({ page }) => {
    await prepare(page);
    await page.goto(`${path}?view=table&region=country%3AAT&area=kappl`);
    const details = page.getByRole('region', { name: 'Kappl', exact: true });
    await expect(details.getByRole('link', { name: 'Ikon', exact: true })).toBeVisible();
    const table = page.getByRole('region', { name: 'Ski area comparison table' });

    await setPass(page, 'Ikon');
    await expect(details).toBeVisible();
    await expect(table.getByRole('button', { name: 'See', exact: true })).toBeVisible();
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
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await expect(table.getByRole('button', { name: 'Manning Park', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Remove Cross-country only', exact: true }).click();
    await expect(table.getByRole('button', { name: 'Manning Park', exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/skiing=/);
});

test('keeps separate Epic points and resort cards for Hakuba Valley resorts', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    await addLocationFilter(page, { label: 'Japan' });
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
    await addLocationFilter(page, { label: 'Finland' });
    await setPass(page, 'Indy');
    await setColor(page, 'pass');
    await expect(results(page).locator('li')).toHaveCount(3);
    await expect.poll(() => renderer.evaluate(async map => {
        const data = await map.getSource<GeoJSONSource>('ski-areas')!.getData();
        return data.type === 'FeatureCollection' ? data.features.filter(point => point.properties?.passBadge === 'indy').map(point => point.id).sort() : [];
    })).toEqual(['levi-ski-resort', 'pyha-ski-resort', 'ruka-ski-resort']);
    await page.getByRole('button', { name: 'Remove Include Finland', exact: true }).click();
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
        await addLocationFilter(page, { label: country });
        await expect(results(page).locator('li')).toHaveCount(1);
        await expect(resultRow(page, 'Portes du Soleil')).toContainText('France / Switzerland');
        await expect.poll(() => renderer.evaluate(async map => {
            const data = await map.getSource<GeoJSONSource>('ski-areas')?.getData();
            return data?.type === 'FeatureCollection' ? data.features.map(feature => feature.id) : [];
        })).toEqual(['portes-du-soleil']);
        await page.getByRole('button', { name: `Remove Include ${country}`, exact: true }).click();
    }
    await renderer.dispose();
});

test('combines geographic filters and remembers exclusions on a fresh visit', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    await addLocationFilter(page, { label: 'Europe' }, 'Exclude');
    const markerIds = () => renderer.evaluate(async map => {
        const data = await map.getSource<GeoJSONSource>('ski-areas')?.getData();
        return data?.type === 'FeatureCollection' ? data.features.map(feature => feature.id) : [];
    });
    await expect.poll(markerIds).toContain('hakuba-happo-one');
    await expect.poll(markerIds).not.toContain('portes-du-soleil');
    await addLocationFilter(page, { label: 'California' });
    await expect.poll(markerIds).toContain('mammoth-mountain');
    await expect.poll(markerIds).not.toContain('banff-sunshine');
    await addLocationFilter(page, { label: 'Japan' });
    await expect.poll(markerIds).toEqual(expect.arrayContaining(['mammoth-mountain', 'hakuba-happo-one']));
    expect(new URL(page.url()).searchParams.getAll('region')).toEqual(['region:US:CA', 'country:JP']);
    await page.getByRole('button', { name: 'Remove Include California', exact: true }).click();
    await expect.poll(markerIds).not.toContain('mammoth-mountain');
    await expect.poll(markerIds).toContain('hakuba-happo-one');
    await renderer.dispose();

    const europe = `${path}?status=all&view=table&q=portes+du+soleil`;
    await page.goto(`${europe}&area=portes-du-soleil`);
    await expect(page.getByText('No ski areas match these filters.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Exclude Europe', exact: true })).toBeVisible();
    await expect(resort(page, 'Portes du Soleil')).toHaveCount(0);
    await page.goto(`${europe}&excludeRegion=`);
    await expect(comparison(page).getByRole('button', { name: 'Portes du Soleil', exact: true })).toBeVisible();
    await page.goto(europe);
    await inDialog(page, 'Filters', dialog => dialog.getByRole('button', { name: 'Remove Exclude Europe', exact: true }).click());
    await page.goto(europe);
    await expect(comparison(page).getByRole('button', { name: 'Portes du Soleil', exact: true })).toBeVisible();
    await addLocationFilter(page, { label: 'Europe' }, 'Exclude');
    await addLocationFilter(page, { label: 'Europe' });
    await expect(page.getByRole('button', { name: 'Remove Exclude Europe', exact: true })).toHaveCount(0);
    await expect(comparison(page).getByRole('button', { name: 'Portes du Soleil', exact: true })).toBeVisible();
});

test('zooms from results and details to the selected province or country', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const renderer = await captureMap(page);
    const search = page.getByRole('searchbox', { name: 'Search areas' });
    await search.fill('Banff Sunshine');
    await search.press('Enter');
    const row = resultRow(page, 'Banff Sunshine Village');
    await expect(row).toContainText('Banff, AB, Canada');
    const alberta = row.getByRole('button', { name: 'Zoom to Alberta (AB)', exact: true });
    await alberta.press('Enter');
    await expect.poll(() => mapCamera(page)?.center[0]).toBeCloseTo(-115, 0);
    await expect.poll(() => mapCamera(page)?.zoom ?? 0).toBeGreaterThan(4);
    await expect(page).not.toHaveURL(/[?&](area|region|mapArea)=/);
    await expect(result(page, 'Banff Sunshine Village')).toBeVisible();

    await result(page, 'Banff Sunshine Village').click();
    const details = resort(page, 'Banff Sunshine Village');
    await expect(details).toContainText('Banff, AB, Canada');
    await details.getByRole('button', { name: 'Zoom to Canada', exact: true }).click();
    await expect.poll(() => mapCamera(page)?.center[0]).toBeCloseTo(-96.8, 0);
    await expect(details).toBeVisible();
    await expect(page).toHaveURL(/[?&]area=banff-sunshine/);
    await renderer.dispose();
});

test('opens a phone map at the country selected in Compare', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page);
    await page.goto(`${path}?view=table&status=all&q=hakuba+happo&region=country%3AJP`);
    const table = comparison(page);
    await expect(table.getByRole('cell', { name: /Hakuba, Japan|Hakuba, Zoom to Japan/ })).toBeVisible();
    await table.getByRole('button', { name: 'Zoom to Japan', exact: true }).press('Enter');
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    await expect.poll(() => mapCamera(page)?.center[0]).toBeCloseTo(134.75, 0);
    const params = new URL(page.url()).searchParams;
    expect(params.get('view')).toBe('map');
    expect(params.get('region')).toBe('country:JP');
    expect(params.has('area')).toBe(false);
    await expect(page.getByTestId('ski-status-map').locator('canvas')).toBeFocused();
    await inDialog(page, 'Filters', async dialog => {
        const chooser = dialog.getByLabel('Choose a location');
        const exclude = dialog.getByRole('button', { name: 'Exclude', exact: true });
        await expect(chooser).toBeInViewport({ ratio: 1 });
        await chooser.selectOption({ label: 'Europe' });
        await exclude.press('Enter');
        await expect(chooser).toBeFocused();
        const { violations } = await new AxeBuilder({ page }).include('.ski-location-fields')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        expect(violations).toEqual([]);
    });
});

test('changes results only when someone searches the new area and restores each view from history', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const renderer = await captureMap(page);
    await renderer.evaluate(map => { map.jumpTo({ center: [-111.64, 40.6], zoom: 10 }); });
    await expect.poll(() => mapCamera(page)?.center[0]).toBeCloseTo(-111.64, 3);
    const preview = page.getByRole('group', { name: 'Map area' }).locator('.ski-area-search-detail');
    await expect(searchArea(page)).toHaveAccessibleDescription(/^\d+ matches? in view$/);
    const previewCount = Number.parseInt(await preview.innerText(), 10);
    await expect(page.getByText(`${locations.locations.length} ski areas`, { exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.has('mapArea')).toBe(false);
    await searchArea(page).press('Enter');
    const appliedArea = page.getByRole('button', { name: 'Area applied', exact: true });
    await expect(appliedArea).toBeDisabled();
    await expect(appliedArea).toBeFocused();
    await expect(result(page, 'Alta Ski Area')).toBeVisible();
    await expect(result(page, 'Snowbird')).toBeVisible();
    await expect(result(page, 'Whaleback Mountain')).toHaveCount(0);
    await expect(results(page).getByRole('listitem')).toHaveCount(previewCount);
    await expect(appliedArea).toHaveAccessibleDescription(`${previewCount} ${previewCount === 1 ? 'match' : 'matches'}`);
    const utah = new URL(page.url()).searchParams.get('mapArea');
    expect(utah).toBeTruthy();

    const vail = resortPoint('vail-mountain');
    await renderer.evaluate((map, center) => { map.panTo(center, { duration: 0 }); }, vail);
    await expect.poll(() => mapCamera(page)?.center[0]).toBeCloseTo(vail[0], 3);
    await expect(page.getByRole('button', { name: 'Update area', exact: true })).toBeEnabled();
    await expect(searchArea(page)).toHaveAccessibleDescription(/^\d+ matches? in view$/);
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
    const visibleCamera = mapCamera(page);
    await page.getByRole('group', { name: 'Map area' }).getByRole('button', { name: 'Clear map area' }).press('Enter');
    await expect(page).not.toHaveURL(/mapArea=/);
    await expect(searchArea(page)).toBeFocused();
    expect(mapCamera(page)).toEqual(visibleCamera);
    await renderer.dispose();
});

test('previews an empty area and clears the area from phone Results while keeping other filters', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await prepare(page);
    await page.goto(`${path}?view=map&status=all&q=whaleback&pass=indy&camera=-150,0,9,0,0`);
    const area = page.getByRole('group', { name: 'Map area', exact: true });
    const map = page.getByTestId('ski-status-map');
    await expect(map).toHaveAttribute('data-map-state', 'ready');
    await expect(searchArea(page)).toHaveAccessibleDescription('No matches in view');
    await searchArea(page).click();
    await expect(area.getByRole('button', { name: 'Area applied' })).toHaveAccessibleDescription('No matches');
    await expect(area.getByRole('button', { name: 'Clear map area' })).toBeInViewport({ ratio: 1 });
    const actions = (await area.boundingBox())!;
    const fit = (await page.getByRole('button', { name: 'Fit results' }).boundingBox())!;
    expect(actions.x + actions.width).toBeLessThan(fit.x);
    const { violations } = await new AxeBuilder({ page }).include('.ski-map-area')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(violations).toEqual([]);

    await selectView(page, 'Results');
    const resultsPane = page.getByRole('complementary', { name: 'Resort results' });
    await expect(resultsPane).toContainText('No ski areas match your filters in this map area.');
    await resultsPane.getByRole('button', { name: 'Clear map area' }).press('Enter');
    await expect(result(page, 'Whaleback Mountain')).toBeVisible();
    await expect(resultsPane).toBeFocused();
    const params = new URL(page.url()).searchParams;
    expect(params.has('mapArea')).toBe(false);
    expect(params.get('q')).toBe('whaleback');
    expect(params.get('pass')).toBe('indy');
    expect(mapCamera(page)?.center).toEqual([-150, 0]);
});

test('holds the area confirmation through a landscape layout change and updates when the camera moves', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 360 });
    await prepare(page);
    await page.goto(`${path}?status=all&camera=-111.64,40.6,10,0,0&pass=mountain-collective`);
    const map = page.getByTestId('ski-status-map');
    await expect(map).toHaveAttribute('data-map-state', 'ready');
    await expect(searchArea(page)).toHaveAccessibleDescription(/^[1-9]\d* matches? in view$/);
    const preview = page.getByRole('group', { name: 'Map area' }).locator('.ski-area-search-detail');
    const matching = (await preview.innerText()).replace(' in view', '');
    await searchArea(page).press('Enter');
    const applied = page.getByRole('button', { name: 'Area applied', exact: true });
    await expect(applied).toBeFocused();
    await expect(applied).toHaveAccessibleDescription(matching);
    const area = new URL(page.url()).searchParams.get('mapArea');
    expect(area).toBeTruthy();

    await page.setViewportSize({ width: 640, height: 400 });
    await expect(applied).toBeFocused();
    expect(new URL(page.url()).searchParams.get('mapArea')).toBe(area);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Update area', exact: true })).toBeEnabled();
    expect(new URL(page.url()).searchParams.get('mapArea')).toBe(area);
});

test('shares the visible map without changing the searched area', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined }); });
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const renderer = await captureMap(page);
    await addLocationFilter(page, { label: 'Europe' }, 'Exclude');
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
    expect(sharedUrl.searchParams.getAll('excludeRegion')).toEqual(['continent:Europe']);
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
    await expect(page.getByRole('button', { name: 'Remove Map area' })).toBeVisible();
    await expect(page.getByText('1 ski area', { exact: true })).toBeVisible();
});

test('fits changes made in the phone table after the real map viewport returns', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await prepare(page);
    const renderer = await captureMap(page);
    await selectView(page, 'Compare');
    await expect(page.getByTestId('ski-status-map')).toBeHidden();
    await renderer.evaluate(map => { map.resize(); });
    await addLocationFilter(page, 'region:CA:BC');
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
    await addLocationFilter(page, 'region:US:WA');
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
        await page.getByRole('button', { name: 'Remove Include Washington', exact: true }).click();
        await addLocationFilter(page, 'region:US:UT');
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

test('opens runs and lifts from a marker double-click and returns to the previous camera', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const renderer = await captureMap(page);
    const search = page.getByRole('searchbox', { name: 'Search areas' });
    await search.fill('Banff Sunshine');
    await search.press('Enter');
    await expect(result(page, 'Banff Sunshine Village')).toBeVisible();
    await setLayer(page, 'Ski terrain', false);
    const base = resortPoint('banff-sunshine');
    await renderer.evaluate((map, [lng, lat]) => {
        map.jumpTo({ center: [lng + 0.08, lat - 0.02], zoom: 7.75, bearing: -12, pitch: 20 });
    }, base);
    await expect.poll(() => mapCamera(page)).toMatchObject({ zoom: 7.75, bearing: -12, pitch: 20 });
    await expect.poll(() => renderer.evaluate(map => map.loaded() && !map.isMoving())).toBe(true);
    const before = mapCamera(page)!;
    const position = await renderer.evaluate((map, point) => {
        const { x, y } = map.project(point);
        return { x, y };
    }, base);
    const canvas = page.getByTestId('ski-status-map').locator('canvas');
    const previous = page.getByRole('button', { name: 'Previous view', exact: true });
    const details = resort(page, 'Banff Sunshine Village');
    await expect(previous).toHaveCount(0);

    const repeated = await renderer.evaluateHandle(map => {
        const state = { clicked: false };
        const ease = map.easeTo.bind(map);
        // Give the test time to repeat the request while the actual map animation is running.
        map.easeTo = (options, data) => ease(options.zoom === 13 ? { ...options, duration: 700 } : options, data);
        const repeat = () => {
            if (map.getZoom() <= 10 || map.getZoom() >= 13) return;
            const button = Array.from(document.querySelectorAll<HTMLButtonElement>('#ski-area-details button'))
                .find(button => button.textContent === 'Show runs and lifts');
            if (!button) return;
            map.off('move', repeat);
            state.clicked = true;
            button.click();
        };
        map.on('move', repeat);
        return state;
    });
    await canvas.dblclick({ position, delay: 75 });
    await expect.poll(() => mapCamera(page)).toMatchObject({ center: terrainPoint('banff-sunshine'), zoom: 13 });
    expect(await repeated.evaluate(state => state.clicked)).toBe(true);
    await repeated.dispose();
    await expect(details).toBeVisible();
    await expect(page).not.toHaveURL(/skiTerrain=0/);
    await expect(previous).toBeVisible();
    await details.getByRole('button', { name: 'Show runs and lifts' }).click();
    await previous.press('Enter');
    await expect.poll(() => mapCamera(page)).toEqual(before);
    await expect(previous).toHaveCount(0);
    await expect(canvas).toBeFocused();
    await expect(details).toBeVisible();
    await expect(search).toHaveValue('Banff Sunshine');

    const emptyPosition = { x: 24, y: (await canvas.boundingBox())!.height / 2 };
    await canvas.dblclick({ position: emptyPosition });
    await expect.poll(() => mapCamera(page)?.zoom).toBeCloseTo(before.zoom + 1, 1);
    await expect(previous).toHaveCount(0);
    await renderer.dispose();
});

test('accepts both clicks on a narrow map before the resort details dock', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page);
    const renderer = await captureMap(page);
    await findWhaleback(page, renderer);
    const center = resortPoint('whaleback');
    await renderer.evaluate((map, center) => {
        map.jumpTo({ center, zoom: 8 });
        map.panBy([0, -Math.round(map.getContainer().clientHeight * 0.2)], { duration: 0 });
    }, center);
    await expect.poll(() => mapCamera(page)?.zoom).toBeCloseTo(8, 1);
    await expect.poll(() => renderer.evaluate(map => map.loaded() && !map.isMoving())).toBe(true);
    const before = mapCamera(page);
    const position = await renderer.evaluate((map, point) => {
        const { x, y } = map.project(point);
        return { x, y };
    }, center);
    const canvas = page.getByTestId('ski-status-map').locator('canvas');
    expect(position.y).toBeGreaterThan((await canvas.boundingBox())!.height * 0.65);

    await canvas.dblclick({ position, delay: 100 });
    await expect.poll(() => mapCamera(page)).toMatchObject({ center: terrainPoint('whaleback'), zoom: 13 });
    await expect(resort(page, 'Whaleback Mountain')).toBeVisible();
    const previous = page.getByRole('button', { name: 'Previous view', exact: true });
    await expect(previous).toBeInViewport({ ratio: 1 });
    await previous.click();
    await expect.poll(() => mapCamera(page)).toEqual(before);
    await expect(resort(page, 'Whaleback Mountain')).toBeVisible();
    await renderer.dispose();
});

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
    const preview = page.getByRole('group', { name: 'Whaleback Mountain map preview' });
    await canvas.hover({ position });
    await expect(preview).toContainText('Enfield, NH, United States');
    await preview.getByRole('button', { name: 'Zoom to New Hampshire (NH)' }).hover();
    await expect(preview.getByRole('button', { name: 'Zoom to United States' })).toBeVisible();
    await expect(details).toHaveCount(0);
    await canvas.hover({ position: background });
    await expect(preview).toHaveCount(0);
    await canvas.click({ position });
    await expect(details).toBeFocused();
    await expect(details.getByText('86 ac', { exact: true })).toBeVisible();
    await expect(preview).toHaveCount(0);
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
    const currentPoint = await findWhaleback(page, renderer);
    await canvas.hover({ position: currentPoint });
    await preview.getByRole('button', { name: 'Zoom to New Hampshire (NH)', exact: true }).click();
    await expect.poll(() => mapCamera(page)?.center[0]).toBeCloseTo(-71.6, 0);
    await expect.poll(() => mapCamera(page)?.zoom ?? 0).toBeLessThan(8);
    await expect(details).toHaveCount(0);
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
    await addLocationFilter(page, 'region:US:UT');
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

test('draws individual resort icons and changes the marker mode without moving the camera', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    await inDialog(page, 'Layers', async dialog => {
        await expect(dialog.getByRole('option', { name: 'Resort icons', exact: true })).toHaveJSProperty('selected', true);
    });
    await renderer.evaluate(map => { map.jumpTo({ center: [-100, 44], zoom: 1.5 }); });
    const resortIcons = () => renderer.evaluate(map => map.queryRenderedFeatures({ layers: ['ski-area-icons'] })
        .map(feature => feature.properties.areaId));
    await expect.poll(resortIcons).toEqual(expect.arrayContaining(['alta', 'snowbird', 'beaver-mountain']));
    await expect.poll(() => renderer.evaluate(map => map.hasImage('ski-area-mountain') && map.hasImage('ski-resort-image-alta')
        && map.hasImage('ski-resort-image-heavenly'))).toBe(true);
    const start = await renderer.evaluate(map => {
        const source = map.getSource<GeoJSONSource>('ski-areas')!.serialize();
        if (typeof source.data === 'string' || source.data.type !== 'FeatureCollection') throw new Error('Missing resort points');
        return { count: source.data.features.length, clustered: Boolean(source.cluster), center: map.getCenter().toArray(), zoom: map.getZoom() };
    });
    expect(start.count).toBe(locations.locations.length);
    expect(start.clustered).toBe(false);
    await setColor(page, 'pass');
    await expect.poll(resortIcons).toHaveLength(0);
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

test('uses contrasting logo backings and explains missing operating reports on hover', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    const backings = () => renderer.evaluate(map => ['stowe', 'alta'].map(id => {
        const image = map.hasImage(`ski-resort-image-${id}`) && map.getImage(`ski-resort-image-${id}`).data;
        if (!image) return null;
        const offset = (2 * image.width + Math.floor(image.width / 2)) * 4;
        return Array.from(image.data.slice(offset, offset + 4));
    }));
    if (hasIcons) await expect.poll(backings).toEqual([[237, 245, 250, 255], [24, 41, 56, 255]]);

    const center = resortPoint('stowe');
    await renderer.evaluate((map, center) => { map.jumpTo({ center, zoom: 8.6 }); }, center);
    await expect.poll(() => renderer.evaluate(map => map.queryRenderedFeatures({ layers: ['ski-area-icons'] })
        .some(feature => feature.properties.areaId === 'stowe'))).toBe(true);
    const position = await renderer.evaluate((map, center) => map.project(center), center);
    await page.getByTestId('ski-status-map').locator('canvas').hover({ position: { x: position.x, y: position.y } });
    const preview = page.getByRole('group', { name: 'Stowe Mountain Resort map preview' });
    await expect(preview).toContainText('Skiing status unknown');
    await expect(preview.getByText('No verified operating report for today.')).toBeVisible();
    const conditions = preview.getByRole('link', { name: 'Check official conditions' });
    await expect(conditions).toHaveAttribute('href', 'https://www.stowe.com/the-mountain/mountain-conditions/terrain-and-lift-status');
    await conditions.hover();
    await expect(conditions).toBeVisible();
    await renderer.dispose();
});

test('draws overlapping pass badges on the globe and highlights a selected resort', async ({ page }) => {
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
    const badgeIds = () => renderer.evaluate(map => map.queryRenderedFeatures({ layers: ['ski-status-pass-badges'] })
        .map(feature => feature.properties.areaId));
    await renderer.evaluate(map => { map.jumpTo({ center: [-100, 44], zoom: 1.5 }); });
    await expect.poll(badgeIds).toEqual(expect.arrayContaining(['alta', 'snowbird']));
    const separation = await renderer.evaluate((map, [first, second]) => {
        const a = map.project(first);
        const b = map.project(second);
        return Math.hypot(a.x - b.x, a.y - b.y);
    }, [resortPoint('alta'), resortPoint('snowbird')]);
    expect(separation).toBeLessThan(4);
    await renderer.evaluate(map => { map.jumpTo({ zoom: 3 }); });
    await expect.poll(badgeIds).toEqual(expect.arrayContaining(['alta', 'snowbird']));
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

test('selects a small mountain icon on the globe without changing the zoom', async ({ page }) => {
    await prepare(page);
    const renderer = await captureMap(page);
    const id = 'bosques-de-monterreal';
    const center = resortPoint(id);
    await renderer.evaluate((map, center) => { map.jumpTo({ center, zoom: 1.5 }); }, center);
    await expect.poll(() => renderer.evaluate(map => map.loaded() && !map.isMoving())).toBe(true);
    const hits = (offset: number) => renderer.evaluate((map, { center, offset }) => {
        const point = map.project(center);
        return map.queryRenderedFeatures([point.x + offset, point.y], { layers: ['ski-area-icons'] })
            .map(feature => feature.properties.areaId);
    }, { center, offset });
    await expect.poll(() => hits(0)).toContain(id);
    expect(await hits(4)).not.toContain(id);
    const point = await renderer.evaluate((map, center) => map.project(center), center);
    await page.locator('.maplibregl-canvas').click({ position: { x: point.x, y: point.y } });
    await expect(resort(page, 'Bosques de Monterreal')).toBeVisible();
    await expect.poll(() => renderer.evaluate(map => map.queryRenderedFeatures({ layers: ['ski-area-selected-icon'] })
        .map(feature => feature.properties.areaId))).toContain(id);
    expect(await renderer.evaluate(map => map.getZoom())).toBe(1.5);
    await renderer.evaluate(map => { map.jumpTo({ zoom: 9 }); });
    await expect.poll(() => hits(4)).toContain(id);
    await renderer.dispose();
});

test('shows a mountain when a resort icon fails and restores the icons after a background retry', async ({ page }) => {
    await prepare(page, null);
    let failedImage = false;
    let unavailable = true;
    await page.route(/\/runtime\/resort-icons\/[a-f0-9]{64}\/whaleback\.png$/, route => {
        if (!unavailable || route.request().resourceType() !== 'image') return route.fallback();
        failedImage = true;
        return route.abort();
    });
    const renderer = await captureMap(page, { state: 'degraded' });
    await findWhaleback(page, renderer);
    const icons = () => renderer.evaluate(map => ({
        mountain: map.hasImage('ski-area-mountain'),
        available: map.hasImage('ski-resort-image-heavenly'),
        missing: map.hasImage('ski-resort-image-whaleback'),
        whaleback: map.queryRenderedFeatures({ layers: ['ski-area-icons'] }).some(feature => feature.properties.areaId === 'whaleback'),
    }));
    await expect.poll(icons).toEqual({ mountain: true, available: true, missing: false, whaleback: true });
    expect(failedImage).toBe(true);
    unavailable = false;
    await page.route(styleUrl, route => route.fulfill({ json: baseStyle, headers: { 'access-control-allow-origin': '*' } }));
    await page.getByRole('button', { name: 'Retry background', exact: true }).click();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    await expect.poll(icons).toEqual({ mountain: true, available: true, missing: true, whaleback: true });
    await renderer.dispose();
});

test('keeps a fallback dot if a pass image fails and restores the missing badge after a background retry', async ({ page }) => {
    await prepare(page, null);
    let unavailable = true;
    await page.route(url => url.pathname === passIconUrls.indy, route => unavailable ? route.abort() : route.fallback());
    const renderer = await captureMap(page, { state: 'degraded' });
    await setColor(page, 'pass');
    const anotherPassBadge = () => renderer.evaluate(map => map.hasImage('ski-status-pass-badge-ikon-plus'));
    await expect.poll(anotherPassBadge).toBe(true);
    expect(await renderer.evaluate(map => map.hasImage('ski-status-pass-badge-indy'))).toBe(false);
    await page.getByRole('searchbox', { name: 'Search areas' }).fill('whaleback');
    await result(page, 'Whaleback Mountain').click();
    await expect.poll(() => renderer.evaluate(map => map.queryRenderedFeatures({ layers: ['ski-area-points'] })
        .some(feature => feature.properties.areaId === 'whaleback'))).toBe(true);

    unavailable = false;
    await page.route(styleUrl, route => route.fulfill({ json: baseStyle, headers: { 'access-control-allow-origin': '*' } }));
    await page.getByRole('button', { name: 'Retry background', exact: true }).click();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    expect(await renderer.evaluate(map => map.getProjection().type)).toBe('globe');
    await expect.poll(anotherPassBadge).toBe(true);
    await expect.poll(() => renderer.evaluate(map => map.hasImage('ski-status-pass-badge-indy'))).toBe(true);
    await renderer.dispose();
});

test('opens a full-width comparison and preserves the map, sort, filters, and selection across views', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    const renderer = await captureMap(page);
    const map = page.getByRole('region', { name: 'Map of ski areas' });
    await addLocationFilter(page, 'region:US:UT');
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
    expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject({ area: 'alta', region: 'region:US:UT', sort: 'verticalFt:desc', view: 'map' });
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

test('shows the sorted field with the map metric and carries sorting into Compare', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    await page.goto(`${path}?view=map&region=UT&sort=acres%3Adesc`);
    const list = results(page);
    await expect(list.getByRole('combobox', { name: 'Sort results' })).toHaveValue('acres');
    await setColor(page, 'summitFt');
    await expect(page.getByRole('button', { name: 'Layers', exact: true })).toHaveAccessibleDescription('Custom map layers');
    await expect(list.locator('li').first()).toContainText('Park City Mountain');
    await expect(list.locator('li').first().locator('dt')).toHaveText('Skiable area');
    await expect(list.locator('li').first()).toContainText('Summit elevation · 10,026 ft');
    await expect(list.locator('li').first()).toContainText('Skiing status unknown');
    await expect(page).toHaveURL(/sort=acres%3Adesc/);
    await page.reload();
    await list.getByRole('combobox', { name: 'Sort results' }).selectOption('liftCount');
    await expect(list.locator('li').first()).toContainText('Park City Mountain');
    await expect(list.locator('li').first().locator('dd')).toHaveText('42');
    await list.getByRole('combobox', { name: 'Sort results' }).selectOption('summitFt');
    await expect(list.locator('li').first()).toContainText('Alta Ski Area');
    await expect(list.locator('li').first().locator('dd')).toHaveText('11,068 ft');
    await expect(list.getByText(/^Summit elevation ·/)).toHaveCount(0);
    await expect(page).toHaveURL(/sort=summitFt%3Adesc/);
    await selectView(page, 'Compare');
    await expect(comparison(page).getByRole('columnheader', { name: 'Summit', exact: true })).toHaveAttribute('aria-sort', 'descending');
});

const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==', 'base64');

function evaluatedPaint(renderer: JSHandle<MapLibreMap>, layer: string, property: string) {
    return renderer.evaluate((map, { layer, property }) => {
        const paint = map.getLayer(layer)?.paint as {
            get: (key: string) => number | { value: { kind: string; value?: number } } | undefined;
        } | undefined;
        const value = paint?.get(property);
        return typeof value === 'number' ? value : value?.value.kind === 'constant' ? value.value.value : undefined;
    }, { layer, property });
}

test('fades state and province boundaries in at the western North America zoom', async ({ page }) => {
    const tileUrl = 'https://ski-boundaries.test/tiles/';
    const stateLayer = 'boundary_state';
    const countryLayer = 'boundary_country_inner';
    await prepare(page, {
        ...baseStyle,
        sources: { protomaps: { type: 'vector', tiles: [`${tileUrl}{z}/{x}/{y}.mvt`], minzoom: 3, maxzoom: 3 } },
        layers: [
            ...baseStyle.layers,
            { id: stateLayer, type: 'line', source: 'protomaps', 'source-layer': 'boundaries', minzoom: 4,
                filter: ['any',
                    ['all', ['==', ['get', 'kind_detail'], 4], ['>=', ['zoom'], 6]],
                    ['all', ['==', ['get', 'kind'], 'macroregion'], ['<', ['zoom'], 6]],
                ],
            },
            { id: countryLayer, type: 'line', source: 'protomaps', 'source-layer': 'boundaries',
                filter: ['==', ['get', 'kind_detail'], 2], paint: { 'line-opacity': 1 },
            },
        ],
    });
    // Tile 3/1/2 has parallel country, macroregion, region, and county lines.
    const boundaries = Buffer.from('GrYBCgpib3VuZGFyaWVzGgRraW5kGgtraW5kX2RldGFpbCIJCgdjb3VudHJ5IgIoAiINCgttYWNyb3JlZ2lvbiICKAMiCAoGcmVnaW9uIgIoBCII'
        + 'CgZjb3VudHkiAigGKIAgeAISExIEAAABARgCIgkJrBacOwrkDwASExIEAAIBAxgCIgkJrBaUPArkDwASExIEAAQBBRgCIgkJrBaMPQrkDwASExIE'
        + 'AAYBBxgCIgkJrBaEPgrkDwA=', 'base64');
    const headers = { 'access-control-allow-origin': '*' };
    await page.route(`${tileUrl}**`, route => route.fulfill({
        headers, body: new URL(route.request().url()).pathname === '/tiles/3/1/2.mvt' ? boundaries : Buffer.alloc(0),
    }));
    await page.route('https://tiles.mapterhorn.com/**', route => route.fulfill({ headers, contentType: 'image/png', body: tile }));
    await page.route(`${snowDepthTileEndpoint}**`, route => route.fulfill({ headers, contentType: 'image/png', body: tile }));
    const renderer = await captureMap(page);
    const zoomTo = (zoom: number) => renderer.evaluate((map, zoom) => { map.jumpTo({ center: [-115, 43], zoom }); }, zoom);
    const kindsIn = (layer: string) => renderer.evaluate((map, layer) => [...new Set(map.queryRenderedFeatures({ layers: [layer] })
        .map(feature => feature.properties.kind))].sort(), layer);
    const stateOpacity = () => evaluatedPaint(renderer, stateLayer, 'line-opacity');
    await zoomTo(4.5);
    await expect.poll(() => kindsIn(stateLayer)).toEqual(['macroregion', 'region']);
    await expect.poll(() => kindsIn(countryLayer)).toEqual(['country']);
    await setLayer(page, 'Terrain relief', true);
    await setLayer(page, 'Snow depth', true);
    const layerOrder = ['ski-terrain-relief', 'ski-snow-depth', stateLayer, countryLayer, 'ski-area-points'];
    expect(await renderer.evaluate((map, ids) => map.getStyle().layers.map(layer => layer.id)
        .filter(id => ids.includes(id)), layerOrder)).toEqual(layerOrder);

    for (const [zoom, expected] of [[4.5, 0.625], [6, 1], [5, 0.75], [4, 0.5], [3.5, 0.25], [2.75, 0]]) {
        await zoomTo(zoom);
        await expect.poll(stateOpacity).toBeCloseTo(expected, 3);
        expect(await evaluatedPaint(renderer, countryLayer, 'line-opacity')).toBe(1);
    }
    await expect.poll(() => kindsIn(stateLayer)).toEqual([]);
    await zoomTo(6);
    await expect.poll(() => kindsIn(stateLayer)).toEqual(['region']);
    await renderer.dispose();
});

test('fades in only major highways at regional zoom above the snow and relief layers', async ({ page }) => {
    const roadsUrl = 'https://tiles.example.test/roads/';
    await prepare(page, {
        ...baseStyle,
        sources: { protomaps: { type: 'vector', tiles: [`${roadsUrl}{z}/{x}/{y}.mvt`], minzoom: 6, maxzoom: 6 } },
        layers: [
            ...baseStyle.layers,
            { id: 'road_mot_case_noramp', type: 'line', source: 'protomaps', 'source-layer': 'roads', minzoom: 5, paint: { 'line-color': '#1a1a1a' } },
            { id: 'road_minor_case', type: 'line', source: 'protomaps', 'source-layer': 'roads', minzoom: 13 },
            { id: 'place_city_dot_z7', type: 'symbol', source: 'protomaps', 'source-layer': 'places' },
        ],
    });
    // One vector tile with parallel motorway, trunk, primary, residential, and ramp features.
    const roadsTile = Buffer.from('GrgBCgVyb2FkcxIREgIAABgCIgkJoAbkGQqAMgASERICAAEYAiIJCaAGuBwKgDIAEhESAgACGAIiCQmgBowfCoAy'
        + 'ABIREgIAAxgCIgkJoAbgIQqAMgASERICAAQYAiIJCaAGtCQKgDIAGgtraW5kX2RldGFpbCIKCghtb3RvcndheSIHCgV0cnVuayIJCgdwcmltYXJ5'
        + 'Ig0KC3Jlc2lkZW50aWFsIg8KDW1vdG9yd2F5X2xpbmsogCB4Ag==', 'base64');
    const headers = { 'access-control-allow-origin': '*' };
    await page.route(`${roadsUrl}**`, route => route.fulfill({ headers, contentType: 'application/vnd.mapbox-vector-tile', body: roadsTile }));
    await page.route('https://tiles.mapterhorn.com/**', route => route.fulfill({ headers, contentType: 'image/png', body: tile }));
    await page.route(`${snowDepthTileEndpoint}**`, route => route.fulfill({ headers, contentType: 'image/png', body: tile }));
    const renderer = await captureMap(page);
    await setLayer(page, 'Terrain relief', true);
    await setLayer(page, 'Snow depth', true);
    const layerOrder = ['ski-terrain-relief', 'ski-snow-depth', regionalRoadLayer, 'place_city_dot_z7', 'ski-area-points'];
    expect(await renderer.evaluate((map, layerOrder) => map.getStyle().layers.map(layer => layer.id)
        .filter(id => layerOrder.includes(id)), layerOrder)).toEqual(layerOrder);

    const center: [number, number] = [-120.77839, 47.25];
    const roadClasses = () => renderer.evaluate((map, layer) => [...new Set(map.queryRenderedFeatures({ layers: [layer] })
        .map(feature => feature.properties.kind_detail))].sort(), regionalRoadLayer);
    const opacity = () => evaluatedPaint(renderer, regionalRoadLayer, 'line-opacity');
    const setZoom = (zoom: number) => renderer.evaluate((map, camera) => { map.jumpTo(camera); }, { center, zoom });
    await setZoom(6.75);
    await expect.poll(roadClasses).toEqual(['motorway', 'trunk']);
    await expect.poll(opacity).toBeCloseTo(0.14, 3);

    await setZoom(9.6);
    await expect.poll(() => evaluatedPaint(renderer, regionalRoadLayer, 'line-width')).toBeCloseTo(2, 3);
    for (const [zoom, expected] of [[5.5, 0], [6.25, 0.06], [8.75, 0.38], [9.6, 0.68], [11, 0.4533], [12, 0]]) {
        await setZoom(zoom);
        await expect.poll(opacity).toBeCloseTo(expected, 3);
    }
    await expect.poll(roadClasses).toEqual([]);
    expect(await renderer.evaluate(map => map.getPaintProperty('road_mot_case_noramp', 'line-color'))).toBe('#1a1a1a');
    expect(await renderer.evaluate(map => map.getLayer('road_minor_case')?.minzoom)).toBe(13);
    await renderer.dispose();
});

test('shows route shields for numbered highways at the Tahoe zoom', async ({ page }) => {
    const tileUrl = 'https://ski-shields.test/roads/';
    const fontUrl = 'https://ski-shields.test/fonts/';
    await prepare(page, {
        ...baseStyle, glyphs: `${fontUrl}{fontstack}/{range}.pbf`,
        sources: { protomaps: { type: 'vector', tiles: [`${tileUrl}{z}/{x}/{y}.mvt`], minzoom: 9, maxzoom: 9 } },
        layers: [
            ...baseStyle.layers,
            { id: 'provider-roads', type: 'line', source: 'protomaps', 'source-layer': 'roads' },
            { id: 'provider-towns', type: 'symbol', source: 'protomaps', 'source-layer': 'places' },
        ],
    });
    // This tile has three numbered highways, a road without a reference, and a numbered ramp.
    const roads = Buffer.from('GrECCgVyb2FkcxIWEggAAAEBAgIDAxgCIggJQLQQCoA/ABIWEggABAEFAgYDBxgCIggJQJAXCoA/ABIWEggACAEJAgoDCxgCIggJQOwdC'
        + 'oA/ABIQEgIABBgCIggJQMgkCoA/ABIWEggADAENAgIDAxgCIggJQKQrCoA/ABoLa2luZF9kZXRhaWwaA3JlZhoHbmV0d29yaxoLc2hpZW'
        + 'xkX3RleHQiCgoIbW90b3J3YXkiDAoKSSA4MDtDQSA4OSIGCgRVUzpJIgQKAjgwIgcKBXRydW5rIgcKBVVTIDUwIgcKBVVTOlVTIgQKAjU'
        + 'wIgkKB3ByaW1hcnkiDQoLQ0EgODk7Q0EgMjgiBwoFVVM6Q0EiBAoCODkiDwoNbW90b3J3YXlfbGluayIGCgRJIDgwKIAgeAI=', 'base64');
    // Supply glyph metrics for 80, 50, and CA 89 so the renderer can place the shields offline.
    const glyphs = Buffer.from('CscDGj8IIBIxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgBIAEoADACOA4aPwgwEjEAAAAAA'
        + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAEgASgAMAI4Dho/CDUSMQAAAAAAAAAAAAAAAAAAAAAAAA'
        + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYASABKAAwAjgOGj8IOBIxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
        + 'AAAAAAAAAAAAAAAAAAAAAABgBIAEoADACOA4aPwg5EjEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
        + 'AAAAGAEgASgAMAI4Dho/CEMSMQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYASABKAAwAjgOG'
        + 'j8IQRIxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgBIAEoADACOA4=', 'base64');
    const headers = { 'access-control-allow-origin': '*' };
    await page.route(`${tileUrl}**`, route => route.fulfill({ headers, body: roads }));
    await page.route(`${fontUrl}**`, route => route.fulfill({ headers, body: glyphs }));
    const renderer = await captureMap(page);
    const center: [number, number] = [-120.07693, 39.10];
    const zoomTo = (zoom: number) => renderer.evaluate((map, camera) => { map.jumpTo(camera); }, { center, zoom });
    const visibleReferences = () => renderer.evaluate((map, layer) => [...new Set(map.queryRenderedFeatures({ layers: [layer] })
        .map(feature => feature.properties.ref))].sort(), highwayShieldLayer);
    await zoomTo(8.5);
    await expect.poll(visibleReferences).toEqual([]);
    await zoomTo(9.175);
    await expect.poll(() => evaluatedPaint(renderer, highwayShieldLayer, 'icon-opacity')).toBeCloseTo(0.5, 3);
    await zoomTo(9.6);
    await expect.poll(visibleReferences).toEqual(['CA 89;CA 28', 'I 80;CA 89', 'US 50']);
    await expect.poll(() => evaluatedPaint(renderer, highwayShieldLayer, 'text-opacity')).toBeCloseTo(1, 3);
    const layers = [regionalRoadLayer, highwayShieldLayer, 'provider-towns', 'ski-area-names'];
    expect(await renderer.evaluate((map, ids) => map.getStyle().layers.map(layer => layer.id)
        .filter(id => ids.includes(id)), layers)).toEqual(layers);
    expect(await renderer.evaluate(map => map.listImages().filter(id => id.startsWith('ski-shield-')).sort()))
        .toEqual(['ski-shield-interstate', 'ski-shield-route', 'ski-shield-us-highway']);
    await renderer.dispose();
});

test('fades hillshade in at regional zoom after the visible tiles finish loading', async ({ page }) => {
    await prepare(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    let terrainRequests = 0;
    let releaseTiles = () => {};
    const waitForTiles = new Promise<void>(resolve => { releaseTiles = resolve; });
    await page.route('https://tiles.mapterhorn.com/**', async route => {
        terrainRequests++;
        if (terrainRequests > 1) await waitForTiles;
        return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'image/png', body: tile });
    });
    const renderer = await captureMap(page);
    const firstTile = await renderer.evaluateHandle(map => {
        const status = { loaded: false };
        const onTile = (event: MapSourceDataEvent) => {
            if (event.sourceId !== 'ski-terrain-dem' || !event.tile?.dem) return;
            status.loaded = true;
            map.off('sourcedata', onTile);
        };
        map.on('sourcedata', onTile);
        return status;
    });
    try {
        await setLayer(page, 'Terrain relief', true);
        await expect.poll(() => renderer.evaluate(map => map.getLayer('ski-terrain-relief')?.type)).toBe('hillshade');
        expect(terrainRequests).toBe(0);
        await renderer.evaluate(map => { map.jumpTo({ center: [-111.635515, 40.573361], zoom: 6 }); });
        await expect.poll(() => terrainRequests).toBeGreaterThan(1);
        await expect.poll(() => firstTile.evaluate(status => status.loaded)).toBe(true);
        expect(await renderer.evaluate(map => map.getPaintProperty('ski-terrain-relief', 'hillshade-exaggeration'))).toBe(0);
    } finally {
        releaseTiles();
    }

    const strength = () => evaluatedPaint(renderer, 'ski-terrain-relief', 'hillshade-exaggeration');
    await expect.poll(strength).toBeCloseTo(0.15, 3);
    expect(await renderer.evaluate(map => map.getPaintProperty('ski-terrain-relief', 'hillshade-exaggeration-transition')))
        .toEqual({ duration: 280 });
    for (const [zoom, expected] of [[4, 0], [4.5, 0.04], [5.5, 0.115], [8, 0.22], [10, 0.29], [13, 0.4]]) {
        await renderer.evaluate((map, zoom) => { map.jumpTo({ zoom }); }, zoom);
        await expect.poll(strength).toBeCloseTo(expected, 3);
    }
    expect(await renderer.evaluate(map => Boolean(map.getLayer('background')))).toBe(true);
    await setLayer(page, 'Terrain relief', false);
    await expect.poll(() => renderer.evaluate(map => Boolean(map.getSource('ski-terrain-dem')))).toBe(false);
    await firstTile.dispose();
    await renderer.dispose();
});

test('fades optional snow depth tiles out as the resort terrain appears', async ({ page }) => {
    await prepare(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const requests: URL[] = [];
    let releaseTiles = () => {};
    const waitForTiles = new Promise<void>(resolve => { releaseTiles = resolve; });
    await page.route(`${snowDepthTileEndpoint}**`, async route => {
        requests.push(new URL(route.request().url()));
        await waitForTiles;
        return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'image/png', body: tile });
    });
    const renderer = await captureMap(page);
    const opacity = () => evaluatedPaint(renderer, 'ski-snow-depth', 'raster-opacity');
    try {
        await inDialog(page, 'Layers', async dialog => {
            const toggle = dialog.getByRole('checkbox', { name: 'Snow depth', exact: true });
            await expect(toggle).not.toBeChecked();
            await expect(toggle).toHaveAccessibleDescription('Contiguous U.S.');
            await toggle.check();
            const key = dialog.getByRole('region', { name: 'Estimated snow depth (in)' });
            await expect(key.getByRole('listitem')).toHaveCount(11);
            await expect(key).toContainText('0.39–2');
            await expect(key.getByRole('link', { name: 'NOAA source' })).toHaveAttribute('href', 'https://www.nohrsc.noaa.gov/nsa/');
        });
        await expect(page).toHaveURL(/snowDepth=1/);
        await expect(page.getByRole('button', { name: 'Layers', exact: true })).toHaveAccessibleDescription('Custom map layers');
        expect(requests).toHaveLength(0);
        await renderer.evaluate(map => { map.jumpTo({ center: [138, 36], zoom: 7 }); });
        await expect.poll(() => renderer.evaluate(map => map.loaded())).toBe(true);
        expect(requests).toHaveLength(0);

        await renderer.evaluate(map => { map.jumpTo({ center: [-106, 39.5], zoom: 6 }); });
        await expect.poll(() => requests.length).toBeGreaterThan(0);
        expect(requests[0].searchParams.get('layers')).toBe('show:3');
        expect(requests[0].searchParams.get('transparent')).toBe('true');
        const bounds = requests[0].searchParams.get('bbox')?.split(',').map(Number);
        expect(bounds).toHaveLength(4);
        expect(bounds?.every(Number.isFinite)).toBe(true);
        expect(await opacity()).toBe(0);
    } finally {
        releaseTiles();
    }

    await expect.poll(opacity).toBeCloseTo(0.26, 3);
    await expect.poll(() => renderer.evaluate(map => map.getPaintProperty('ski-snow-depth', 'raster-opacity-transition')))
        .toEqual({ duration: 280 });
    for (const [zoom, expected] of [[4.5, 0.05], [7, 0.39], [9, 0.52], [10, 0.34], [11, 0.16], [13, 0.02], [14, 0], [8, 0.52]]) {
        await renderer.evaluate((map, zoom) => { map.jumpTo({ zoom }); }, zoom);
        await expect.poll(opacity).toBeCloseTo(expected, 3);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => renderer.evaluate(map => map.getPaintProperty('ski-snow-depth', 'raster-fade-duration'))).toBe(0);
    await setFilter(page, 'Units', 'metric');
    await inDialog(page, 'Layers', dialog => expect(dialog.getByRole('region', { name: 'Estimated snow depth (cm)' })).toContainText('1–5.1'));
    await setLayer(page, 'Snow depth', false);
    await expect.poll(() => renderer.evaluate(map => Boolean(map.getSource('ski-snow-depth-tiles')))).toBe(false);
    await expect(page).not.toHaveURL(/snowDepth=1/);
    await renderer.dispose();
});

test('keeps the basemap available when snow depth fails and can load it again', async ({ page }) => {
    await prepare(page);
    let unavailable = true;
    await page.route(`${snowDepthTileEndpoint}**`, route => unavailable
        ? route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: 'Snow depth unavailable' })
        : route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'image/png', body: tile }));
    const renderer = await captureMap(page);
    await renderer.evaluate(map => { map.jumpTo({ center: [-106, 39.5], zoom: 6 }); });
    const error = page.getByText('Snow depth unavailable.', { exact: true });
    await setLayer(page, 'Snow depth', true);
    await expect(error).toBeVisible();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    await renderer.evaluate(map => { map.jumpTo({ zoom: 14 }); });
    await expect(error).toBeHidden();
    await renderer.evaluate(map => { map.jumpTo({ zoom: 6 }); });
    await expect(error).toBeVisible();
    await setLayer(page, 'Snow depth', false);
    await expect(error).toBeHidden();
    unavailable = false;
    await setLayer(page, 'Snow depth', true);
    await expect.poll(() => evaluatedPaint(renderer, 'ski-snow-depth', 'raster-opacity')).toBeCloseTo(0.26, 3);
    await expect(error).toBeHidden();
    await renderer.dispose();
});

test('fades collision-managed resort names in as users zoom closer', async ({ page }) => {
    await prepare(page, {
        ...baseStyle, glyphs: 'https://ski-map.test/font/{fontstack}/{range}.pbf',
        sources: { carto: { type: 'vector', tiles: ['https://ski-map.test/{z}/{x}/{y}.pbf'] } },
        layers: [...baseStyle.layers, { id: 'carto-labels', type: 'symbol', source: 'carto', 'source-layer': 'places', minzoom: 18 }],
    });
    await page.route('https://ski-map.test/**', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, body: Buffer.alloc(0) }));
    const renderer = await captureMap(page);
    for (const [zoom, expected] of [[7, 0], [7.5, 0.26], [8, 0.52], [9.5, 1]]) {
        await renderer.evaluate((map, zoom) => { map.jumpTo({ center: [-111.635515, 40.573361], zoom }); }, zoom);
        await expect.poll(() => evaluatedPaint(renderer, 'ski-area-names', 'text-opacity')).toBeCloseTo(expected, 3);
    }
    expect(await renderer.evaluate(map => map.getLayoutProperty('ski-area-names', 'text-allow-overlap'))).toBeUndefined();
    await renderer.dispose();
});

test('fades peak icons in before their labels and prioritizes trail-map peaks', async ({ page }) => {
    const tileUrl = 'https://ski-peaks.test/tiles/';
    await prepare(page, {
        ...baseStyle,
        sources: { protomaps: { type: 'vector', tiles: [`${tileUrl}{z}/{x}/{y}.mvt`], minzoom: 8, maxzoom: 8 } },
        layers: [...baseStyle.layers, { id: 'provider-roads', type: 'line', source: 'protomaps', 'source-layer': 'roads' }],
    });
    // Nearby Peak has an elevation. Lower Peak has none. The other features test the spatial and name filters.
    const tile = Buffer.from('Gu0BeAIKBHBvaXMogCAaBGtpbmQaBG5hbWUaCWVsZXZhdGlvbiIGCgRwZWFrIg0KC05lYXJieSBQZWFrIgMoxBMiEgoQU2FyZ2VudCBNb3VudG'
        + 'FpbiIICgZzYWRkbGUiDwoNTmVhcmJ5IFNhZGRsZSIKCghGYXIgUGVhayIMCgpMb3dlciBQZWFrEhESBgAAAQECAhgBIgUJ+BnOAxIPEgQAAAED'
        + 'GAEiBQnwGqIEEg0SAgAAGAEiBQnIGr4FEg8SBAAEAQUYASIFCewbiAQSDxIEAAABBhgBIgUJriSUAxIPEgQAAAEHGAEiBQnQG9IE', 'base64');
    await page.route(`${tileUrl}**`, route => route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        body: new URL(route.request().url()).pathname === '/tiles/8/45/92.mvt' ? tile : Buffer.alloc(0),
    }));
    const renderer = await captureMap(page);
    const center = resortPeaks.find(({ id }) => id === 'sargents-brundage')!.coordinates as [number, number];
    const zoomTo = (zoom: number) => renderer.evaluate((map, camera) => { map.jumpTo(camera); }, { center, zoom });
    const peakNames = (layer: string) => renderer.evaluate((map, layer) => [...new Set(map.queryRenderedFeatures({ layers: [layer] })
        .map(feature => feature.properties.name))].sort(), layer);
    const peakIconSize = (layer: string) => renderer.evaluate((map, layer) => {
        const layout = map.getLayer(layer)?.layout as { get: (key: string) => { constantOr: (fallback: number) => number } } | undefined;
        return layout?.get('icon-size').constantOr(0);
    }, layer);
    const peakHasLabel = (layer: string, coordinates: [number, number], name: string) => renderer.evaluate((map, { layer, coordinates, name }) => {
        const { x, y } = map.project(coordinates);
        // The label sits below the triangle. Query past the icon's hit area.
        return map.queryRenderedFeatures([[x - 18, y + 12], [x + 18, y + 32]], { layers: [layer] })
            .some(feature => feature.properties.name === name);
    }, { layer, coordinates, name });
    const peakText = (layer: string, name: string) => renderer.evaluate((map, { layer, name }) => {
        const feature = map.queryRenderedFeatures({ layers: [layer] }).find(feature => feature.properties.name === name);
        if (!feature) return;
        const layout = map.getLayer(layer)?.layout as {
            get: (property: 'text-field') => { evaluate: (feature: MapGeoJSONFeature, state: object) => { toString: () => string } };
        } | undefined;
        return layout?.get('text-field').evaluate(feature, {}).toString();
    }, { layer, name });

    await zoomTo(7.5);
    expect(await peakNames(trailMapPeakLayer)).toEqual([]);
    const nearbyCoordinates: [number, number] = [-116.148834, 45.033016];
    for (const peak of [
        { layer: trailMapPeakLayer, coordinates: center, name: 'Sargents', labelZoom: 10, size: 1 },
        { layer: nearbyPeakLayer, coordinates: nearbyCoordinates, name: 'Nearby Peak', labelZoom: 12, size: 0.78 },
    ]) {
        for (const [offset, scale, opacity] of [[-2, 0.55, 0.28], [-1, 0.78, 0.65], [0, 1, 0.85]]) {
            await zoomTo(peak.labelZoom + offset);
            await expect.poll(() => peakNames(peak.layer)).toContain(peak.name);
            await expect.poll(() => peakIconSize(peak.layer)).toBeCloseTo(scale * peak.size, 3);
            await expect.poll(() => evaluatedPaint(renderer, peak.layer, 'icon-opacity')).toBeCloseTo(opacity, 3);
            await expect.poll(() => peakHasLabel(peak.layer, peak.coordinates, peak.name)).toBe(offset === 0);
            await expect.poll(() => peakText(peak.layer, peak.name)).toBe(offset === 0 ? peak.name : '');
        }
    }
    await zoomTo(13);
    await expect.poll(() => peakNames(nearbyPeakLayer)).toEqual(['Lower Peak', 'Nearby Peak']);
    expect(await peakText(nearbyPeakLayer, 'Lower Peak')).toBe('Lower Peak');
    const canvas = page.getByTestId('ski-status-map').locator('canvas');
    const tooltip = page.locator('.ski-area-popup-hover .maplibregl-popup-content');
    const hoverPeak = async (coordinates: [number, number], text: string) => {
        const position = await renderer.evaluate((map, point) => map.project(point), coordinates);
        await canvas.hover({ position });
        await expect(tooltip).toBeVisible();
        await expect.poll(() => tooltip.innerText()).toBe(text);
    };
    await hoverPeak(center, 'Sargents · Trail map\n7,803 ft');
    await hoverPeak(nearbyCoordinates, 'Nearby Peak\n8,202 ft');
    await hoverPeak([-116.111755, 45.017001], 'Lower Peak');

    await setFilter(page, 'Units', 'metric');
    await expect.poll(() => peakText(trailMapPeakLayer, 'Sargents')).toBe('Sargents');
    await hoverPeak(center, 'Sargents · Trail map\n2,378 m');
    await hoverPeak(nearbyCoordinates, 'Nearby Peak\n2,500 m');

    await setLayer(page, 'Mountain peaks', false);
    await expect(page).toHaveURL(/(?:\?|&)peaks=0(?:&|$)/);
    expect(await renderer.evaluate(map => Boolean(map.getSource('ski-resort-peaks')))).toBe(false);
    await expect(tooltip).toBeHidden();
    await setLayer(page, 'Mountain peaks', true);
    await expect.poll(() => peakNames(trailMapPeakLayer)).toEqual(['Sargents']);
    await expect.poll(() => peakNames(nearbyPeakLayer)).toEqual(['Lower Peak', 'Nearby Peak']);
    await expect.poll(() => peakText(trailMapPeakLayer, 'Sargents')).toBe('Sargents');

    await renderer.evaluate(map => { map.jumpTo({ center: [-115.92, 45.04] }); });
    await expect.poll(() => renderer.evaluate(map => map.querySourceFeatures('protomaps', { sourceLayer: 'pois' })
        .some(feature => feature.properties.name === 'Far Peak') && map.loaded())).toBe(true);
    expect(await peakNames(nearbyPeakLayer)).toEqual([]);
    await renderer.dispose();
});

test('keeps trail-map peaks on the fallback background and after a retry', async ({ page }) => {
    await prepare(page, null);
    const renderer = await captureMap(page, { state: 'degraded' });
    await renderer.evaluate(map => { map.jumpTo({ center: [-111.54, 40.613], zoom: 13 }); });
    const showsJupiter = () => renderer.evaluate((map, layer) => map.queryRenderedFeatures({ layers: [layer] })
        .some(feature => feature.properties.name === 'Jupiter Peak'), trailMapPeakLayer);
    await expect.poll(showsJupiter).toBe(true);
    expect(await renderer.evaluate(map => map.getGlyphs())).toBeNull();
    await page.route(styleUrl, route => route.fulfill({ json: baseStyle, headers: { 'access-control-allow-origin': '*' } }));
    await page.getByRole('button', { name: 'Retry background', exact: true }).click();
    await expect(page.getByTestId('ski-status-map')).toHaveAttribute('data-map-state', 'ready');
    await expect.poll(showsJupiter).toBe(true);
    await renderer.dispose();
});

test('keeps the basemap and trail-map peaks when the provider only supplies roads', async ({ page }) => {
    const tileUrl = 'https://ski-roads-only.test/';
    await prepare(page, {
        ...baseStyle,
        sources: { provider: { type: 'vector', url: `${tileUrl}tiles.json` } },
        layers: [...baseStyle.layers, { id: 'provider-roads', type: 'line', source: 'provider', 'source-layer': 'roads' }],
    });
    const headers = { 'access-control-allow-origin': '*' };
    await page.route(`${tileUrl}tiles/**`, route => route.fulfill({ headers, body: Buffer.alloc(0) }));
    await page.route(`${tileUrl}tiles.json`, route => route.fulfill({ headers, json: {
        tilejson: '3.0.0', tiles: [`${tileUrl}tiles/{z}/{x}/{y}.mvt`],
        vector_layers: [{ id: 'roads', fields: {} }],
    } }));
    const renderer = await captureMap(page);
    await renderer.evaluate(map => { map.jumpTo({ center: [-111.54, 40.613], zoom: 12 }); });
    await expect.poll(() => renderer.evaluate((map, layer) => map.queryRenderedFeatures({ layers: [layer] })
        .some(feature => feature.properties.name === 'Jupiter Peak'), trailMapPeakLayer)).toBe(true);
    expect(await renderer.evaluate((map, layer) => Boolean(map.getLayer(layer)), nearbyPeakLayer)).toBe(false);
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
    await expect.poll(() => renderer.evaluate(map => map.getPaintProperty('ski-terrain-relief', 'hillshade-exaggeration-transition')))
        .toEqual({ duration: 0 });
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
    const footprintOpacity = () => evaluatedPaint(renderer, 'ski-resort-footprints', 'fill-opacity');
    await expect.poll(footprintOpacity).toBeCloseTo(0.04, 3);
    await renderer.evaluate(map => { map.jumpTo({ zoom: 11.625 }); });
    await expect.poll(() => evaluatedPaint(renderer, 'ski-resort-lifts', 'line-opacity')).toBeCloseTo(0.59, 3);
    await expect.poll(footprintOpacity).toBeCloseTo(0.045, 3);
    await renderer.evaluate(map => { map.jumpTo({ zoom: 12 }); });
    await expect.poll(footprintOpacity).toBe(0);
    await renderer.evaluate(map => { map.jumpTo({ zoom: 13.05 }); });
    await expect.poll(footprintOpacity).toBe(0);
    await expect.poll(() => evaluatedPaint(renderer, 'ski-resort-footprint-outline', 'line-opacity')).toBeCloseTo(0.72, 3);
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
    test.skip(!hasTerrain, 'Requires the current ski terrain archive in SKI_ASSETS_ROOT');
    await page.setViewportSize({ width: 1280, height: 900 });
    await prepare(page);
    const archive = await readSkiAsset(skiAssetsRoot(), skiTerrainAsset);
    expect(archive).toBeDefined();
    const ranges: Response[] = [];
    page.on('response', response => {
        const url = new URL(response.url());
        if (skiTerrainArchivePath.test(url.pathname) && !url.searchParams.has('import')) ranges.push(response);
    });

    await page.goto(SKI_TERRAIN_ROUTE);
    await verifyRenderedSkiTerrain(page, 10_000);
    expect(ranges.length).toBeGreaterThan(1);
    await Promise.all(ranges.map(response => verifySkiTerrainResponse(response, archive!)));
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
        ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.fallback());
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
        ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.fallback());
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
