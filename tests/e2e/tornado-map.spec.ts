import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { parse } from 'yaml';
import type { AnnualTornadoSummary, TornadoTrackFeature } from '../../src/features/tornadoes/types';
import type { Map as MapLibreMap } from 'maplibre-gl';

const config = parse(fs.readFileSync('customHttp.yml', 'utf8'));
const policy: string = config.customHeaders.find(({ pattern }: { pattern: string }) => pattern === '**')
    .headers.find(({ key }: { key: string }) => key === 'Content-Security-Policy').value;

const track: TornadoTrackFeature = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[-96.5, 38.7], [-95, 39.5]] },
    properties: {
        id: 'test-track', eventId: '1', episodeId: '1', year: 2025, month: 5,
        date: '2025-05-01', beginTime: '12:00', endTime: '12:30', timezone: 'CST-6',
        state: 'KS', stateName: 'Kansas', county: 'Test County', countyFips: '001', wfo: 'TOP',
        scale: 2, scaleLabel: 'EF2', lengthMiles: 12, widthYards: 100,
        deaths: 0, injuries: 0, propertyDamage: 0, cropDamage: 0, source: 'test', dataSource: 'test',
    },
};
const summary: AnnualTornadoSummary = {
    year: 2025, count: 1, unknown: 0, ef0: 0, ef1: 0, ef2: 1, ef3: 0, ef4: 0, ef5: 0,
    ef1Plus: 1, ef2Plus: 1, deaths: 0, injuries: 0, trackMiles: 12, medianWidthYards: 100,
};
const trendIndex = { version: 1, groups: [
    ...[2023, 2024, 2025].map(year => ({ year, state: 'KS', scale: year === 2024 ? 1 : 2, count: year === 2023 ? 7 : 1,
        deaths: 0, injuries: 0, trackMiles: year === 2023 ? 84 : 12, widths: [[100, year === 2023 ? 7 : 1]] })),
    { year: 2023, state: 'MO', scale: 2, count: 2, deaths: 0, injuries: 0, trackMiles: 24, widths: [[100, 2]] },
] };

for (const failure of ['style', 'tiles'] as const) {
    for (const width of [390, 1280]) {
        test(`tornado background ${failure} failure recovers without losing selection at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            const errors: string[] = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('https://**/*', route => route.abort());
            const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#18232f' } }).png().toBuffer();
            let failBackground = true;
            let failedRequests = 0;
            let loadedTiles = 0;
            let trackRequests = 0;
            await page.route('https://basemaps.cartocdn.com/**', route => {
                const style = new URL(route.request().url()).pathname.endsWith('/style.json');
                if (failBackground && (failure === 'style' ? style : !style)) {
                    failedRequests += 1;
                    return route.fulfill({ status: 503, json: { error: 'Background unavailable' } });
                }
                if (style) return route.fulfill({ json: {
                    version: 8,
                    sources: { basemap: {
                        type: 'raster', tileSize: 256,
                        tiles: ['https://basemaps.cartocdn.com/test/{z}/{x}/{y}.png?key=browser-test-key'],
                        attribution: '<a href="https://carto.com/attribution/">CARTO</a> · OpenStreetMap',
                    } },
                    layers: [{ id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-fade-duration': 0 } }],
                } });
                loadedTiles += 1;
                return route.fulfill({ contentType: 'image/png', body: tile });
            });
            await page.route('https://data.rsmb.tv/tornadoes/**', route => {
                const pathname = new URL(route.request().url()).pathname;
                if (pathname.endsWith('annual-summary.json')) return route.fulfill({ json: [summary] });
                if (pathname.endsWith('notable-events.json')) return route.fulfill({ json: [] });
                if (pathname.endsWith('/2025.geojson')) {
                    trackRequests += 1;
                    return route.fulfill({ json: { type: 'FeatureCollection', features: [track] } });
                }
                throw new Error(`Unexpected tornado request: ${pathname}`);
            });
            await page.route('**/data/flights/usStates.geojson', route => route.fulfill({ json: { type: 'FeatureCollection', features: [] } }));
            await page.goto('/projects/tornado-tracks/map?start=2025&end=2025&scale=ef2plus&color=year&state=KS&zoom=4');
            await expect(page.getByTestId('tornado-map')).toHaveAttribute('data-map-state', 'degraded');
            await expect(page.getByRole('alert')).toContainText('Tracks and filters still work');
            expect(failedRequests).toBeGreaterThan(0);
            const canvas = page.locator('canvas.maplibregl-canvas');
            // Selection proves that data layers remain rendered on the neutral background.
            await expect.poll(async () => {
                await canvas.click({ position: { x: width / 2, y: 450 } });
                return new URL(page.url()).searchParams.get('track');
            }).toBe('test-track');
            await expect(page.getByRole('heading', { name: 'Test County, KS', exact: true })).toBeVisible();
            const beforeRetry = new URL(page.url()).search;
            failBackground = false;
            await page.getByRole('button', { name: 'Retry background', exact: true }).click();
            await expect(page.getByTestId('tornado-map')).toHaveAttribute('data-map-state', 'ready');
            await expect(page.getByRole('alert')).toHaveCount(0);
            await expect(page.getByRole('heading', { name: 'Test County, KS', exact: true })).toBeVisible();
            expect(new URL(page.url()).search).toBe(beforeRetry);
            expect(trackRequests).toBe(1);
            expect(loadedTiles).toBeGreaterThan(0);
            if (width < 768) await page.getByRole('button', { name: 'Close controls', exact: true }).click();
            // Check actual provider pixels after recovery, rather than only the status text.
            await expect.poll(async () => {
                const pixels = await sharp(await canvas.screenshot()).removeAlpha().raw().toBuffer();
                let backgroundPixels = 0;
                for (let i = 0; i < pixels.length; i += 3) {
                    if (pixels[i] === 24 && pixels[i + 1] === 35 && pixels[i + 2] === 47) backgroundPixels += 1;
                }
                return backgroundPixels;
            }).toBeGreaterThan(10_000);
            expect(errors).toEqual([]);
        });
    }
}

for (const [width, renderer] of [[390, 'webgl'], [1280, 'webgl'], [1280, 'svg']] as const) {
    test(`tornado controls and selectable tracks work at ${width}px with ${renderer}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        if (renderer === 'svg') await page.addInitScript(() => {
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type, ...args) {
                if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
                return original.call(this, type, ...args);
            } as typeof original;
        });
        const pageErrors: string[] = [];
        const pointRequests: string[] = [];
        const trackRequests: string[] = [];
        const warningRequests: string[] = [];
        const trendRequests: string[] = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('console', message => { if (message.type() === 'error' && /same key/i.test(message.text())) pageErrors.push(message.text()); });
        page.on('request', request => { if (request.url().includes('/track-points/')) pointRequests.push(request.url()); });
        page.on('request', request => { if (request.url().includes('/tornadoes/tracks/')) trackRequests.push(request.url()); });
        page.on('request', request => { if (request.url().endsWith('warning-summary.json')) warningRequests.push(request.url()); });
        page.on('request', request => { if (request.url().endsWith('trend-index.json')) trendRequests.push(request.url()); });

        // Isolate rendering from provider availability; use a fake basemap key.
        await page.route('https://**/*', route => route.abort());
        const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#18232f' } }).png().toBuffer();
        const exerciseRetry = width === 1280 && renderer === 'webgl';
        let failedTrackRequest = false;
        let styleRequests = 0;
        let tileRequests = 0;
        await page.route('https://basemaps.cartocdn.com/**', route => {
            expect(new URL(route.request().url()).searchParams.get('key')).toBe('browser-test-key');
            if (new URL(route.request().url()).pathname === '/gl/dark-matter-gl-style/style.json') {
                styleRequests += 1;
                return route.fulfill({ json: {
                    version: 8,
                    sources: { basemap: {
                        type: 'raster', tileSize: 256,
                        tiles: ['https://basemaps.cartocdn.com/test/{z}/{x}/{y}.png?key=browser-test-key'],
                        attribution: '<a href="https://carto.com/attribution/">CARTO</a> · OpenStreetMap',
                    } },
                    layers: [{ id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-fade-duration': 0 } }],
                } });
            }
            tileRequests += 1;
            return route.fulfill({ contentType: 'image/png', body: tile });
        });
        await page.route('https://data.rsmb.tv/tornadoes/**', route => {
            const pathname = new URL(route.request().url()).pathname;
            if (pathname.endsWith('annual-summary.json')) return route.fulfill({ json: [{ ...summary, year: 2023, count: 9, ef2: 9, ef1Plus: 9, ef2Plus: 9, trackMiles: 108 }, { ...summary, year: 2024, ef1: 1, ef2: 0, ef2Plus: 0 }, summary] });
            if (pathname.endsWith('notable-events.json')) return route.fulfill({ json: [{ ...track.properties, id: 'notable-track', year: 2024, date: '2024-05-01', scale: 1, scaleLabel: 'EF1', coordinates: track.geometry.coordinates }] });
            if (pathname.endsWith('warning-summary.json')) return route.fulfill({ json: null });
            if (pathname.endsWith('trend-index.json')) return route.fulfill({ json: trendIndex });
            if (exerciseRetry && !failedTrackRequest) {
                failedTrackRequest = true;
                return route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } });
            }
            const feature = pathname.endsWith('/2024.geojson') ? { ...track, properties: { ...track.properties, id: 'notable-track', year: 2024, date: '2024-05-01', scale: 1, scaleLabel: 'EF1' } } : track;
            const features = pathname.endsWith('/2023.geojson') ? Array.from({ length: 9 }, (_, index) => ({
                ...track, properties: { ...track.properties, id: `historical-${index}`, year: 2023, date: '2023-05-01',
                    state: index < 7 ? 'KS' : 'MO', stateName: index < 7 ? 'Kansas' : 'Missouri' },
            })) : [feature];
            return route.fulfill({ json: { type: 'FeatureCollection', features } });
        });
        await page.route('**/data/flights/usStates.geojson', route => route.fulfill({ json: { type: 'FeatureCollection', features: [] } }));
        await page.route('**/projects/tornado-tracks/map*', async route => {
            const response = await route.fetch();
            // Vite's inline React-refresh preamble needs a nonce in development.
            // Keep the production map/image/worker restrictions intact.
            await route.fulfill({
                response,
                headers: { ...response.headers(), 'content-security-policy': policy.replace("script-src 'self'", "script-src 'self' 'nonce-tornado-map-test'") },
                body: (await response.text()).replaceAll('<script', '<script nonce="tornado-map-test"'),
            });
        });

        await page.goto('/projects/tornado-tracks/map?start=2025&end=2025');
        if (renderer === 'webgl') {
            await expect.poll(() => styleRequests).toBeGreaterThan(0);
            await expect.poll(() => tileRequests).toBeGreaterThan(0);
        }
        await expect(page.getByText('Loading tornado tracks...', { exact: true })).toHaveCount(0);
        if (exerciseRetry) {
            await expect(page.getByRole('alert')).toContainText('Unable to load tornado data');
            await expect(page.getByTestId('tornado-map')).toHaveAttribute('data-map-state', 'error');
            await expect(page.getByRole('combobox', { name: 'Region', exact: true })).toBeEnabled();
            await page.getByRole('button', { name: 'Retry', exact: true }).click();
        }
        await expect(page.locator('#tornado-summary-panel h2')).toHaveText('1 tracks');
        await expect(page.getByTestId('tornado-map')).toHaveAttribute('data-map-state', renderer === 'svg' ? 'fallback' : 'ready');
        const selectedYearRequests = trackRequests.length;

        const canvas = page.locator('canvas.maplibregl-canvas');
        if (renderer === 'webgl') await expect.poll(async () => {
            const pixels = await sharp(await canvas.screenshot()).removeAlpha().raw().toBuffer();
            let basemapPixels = 0;
            for (let i = 0; i < pixels.length; i += 3) {
                if (pixels[i] === 24 && pixels[i + 1] === 35 && pixels[i + 2] === 47) basemapPixels += 1;
            }
            return basemapPixels;
        }).toBeGreaterThan(10_000);
        if (renderer === 'webgl') await expect(page.getByRole('link', { name: 'CARTO', exact: true })).toBeVisible();
        else await expect(page.getByLabel('Tornado track overview')).toBeVisible();
        expect(warningRequests).toEqual([]);
        if (width < 768) await page.getByRole('button', { name: 'Filters & details', exact: true }).click();
        await page.getByRole('button', { name: /^trends$/i }).click();
        await expect(page.getByText('A · Annual count vs selection')).toBeVisible();
        await expect.poll(() => warningRequests.length).toBe(1);
        expect(trackRequests).toHaveLength(selectedYearRequests);
        await page.getByRole('button', { name: /^tracks$/i }).click();
        await page.getByRole('button', { name: 'EF2+', exact: true }).click();
        await expect(page).toHaveURL(/scale=ef2plus/);
        if (width < 768) await page.getByRole('button', { name: 'Close controls', exact: true }).click();

        // The fixture starts at the camera center: hit-testing proves the data
        // layers still render on top of the asynchronously loaded basemap.
        await expect.poll(async () => {
            if (renderer === 'webgl') await canvas.click({ position: { x: width / 2, y: 450 } });
            else await page.locator('svg g.cursor-pointer').first().click();
            return new URL(page.url()).searchParams.get('track');
        }).toBe('test-track');
        expect(new URL(page.url()).searchParams.get('scale')).toBe('ef2plus');
        await expect(page.getByRole('heading', { name: 'Test County, KS' })).toBeVisible();
        if (width < 768) {
            await page.getByRole('button', { name: 'Close controls', exact: true }).click();
            await page.getByRole('button', { name: 'Filters & details', exact: true }).click();
        }
        await page.getByRole('button', { name: 'EF2+', exact: true }).click();
        await expect(page.getByRole('button', { name: 'EF2+', exact: true })).toHaveAttribute('aria-pressed', 'true');
        if (renderer === 'webgl') {
            await page.getByRole('button', { name: /^density$/i }).click();
            await expect(page).toHaveURL(/mode=density/);
            await expect(page.getByRole('button', { name: /^density$/i })).toHaveAttribute('aria-pressed', 'true');
        } else {
            await expect(page.getByRole('button', { name: /^density$/i })).toBeDisabled();
            await page.getByRole('button', { name: 'Year', exact: true }).click();
            await expect(page.locator('svg line[stroke="#eab308"]')).toHaveCount(0);
            await page.getByRole('button', { name: 'Clear', exact: true }).click();
        }
        expect(pointRequests).toEqual([]);
        await page.getByRole('combobox', { name: 'Region', exact: true }).selectOption('dixie');
        await page.getByRole('button', { name: /Test County, KS.*EF1/ }).click();
        await expect(page).toHaveURL(/track=notable-track/);
        await expect(page.getByRole('heading', { name: 'Test County, KS' })).toBeVisible();
        const selectionUrl = new URL(page.url());
        expect(selectionUrl.searchParams.get('scale')).toBeNull();
        expect(selectionUrl.searchParams.get('region')).toBeNull();
        expect(selectionUrl.searchParams.get('start')).toBe('2024');
        if (width >= 768) {
            const histogram = page.getByRole('group', { name: 'Annual track counts', exact: true });
            await histogram.getByRole('button', { name: '2024: 1 track segments', exact: true }).press('ArrowRight');
            await expect(histogram.getByRole('button', { name: '2025: 1 track segments', exact: true })).toHaveAttribute('aria-pressed', 'true');
        }
        if (width < 768) {
            let failHistory = true;
            await page.route('https://data.rsmb.tv/tornadoes/trend-index.json', route => failHistory
                ? route.fulfill({ status: 503, json: { error: 'Historical data unavailable' } })
                : route.fulfill({ json: trendIndex }));
            await page.getByRole('button', { name: 'EF2+', exact: true }).click();
            await page.getByRole('button', { name: /^trends$/i }).click();
            await expect(page.getByRole('alert')).toContainText('Historical trends are unavailable');
            await expect(page.getByText('Loading tornado tracks...', { exact: true })).toHaveCount(0);
            await expect(page.getByRole('button', { name: '2023: 0 track segments', exact: true })).toHaveCount(0);
            failHistory = false;
            // Retry must remain reachable while the mobile controls cover the map.
            const geometryBeforeRetry = trackRequests.length;
            await page.getByRole('button', { name: 'Retry trends', exact: true }).click({ timeout: 3000 });
            await expect(page.getByRole('alert')).toHaveCount(0);
            await expect(page.getByText('A · Annual count vs selection')).toBeVisible();
            expect(trackRequests).toHaveLength(geometryBeforeRetry);
            await expect(page.getByRole('button', { name: 'Close controls', exact: true })).toBeVisible();
        }
        // A filtered full-history chart must not depend on historical geometry.
        // Unmount the first WebGL renderer before replacing its document. This
        // lets WebKit cancel worker/tile requests without navigation errors.
        if (renderer === 'webgl') await page.evaluate(async moduleURL => {
            const maplibre = await import(moduleURL);
            const remove = maplibre.Map.prototype.remove;
            // Stopping an active camera during disposal can emit moveend.
            // Force that order even when a fast test machine finished flying.
            maplibre.Map.prototype.remove = function (this: MapLibreMap) {
                this.fire('moveend');
                return remove.call(this);
            };
        }, '/src/maps/maplibre.ts');
        await page.getByRole('link', { name: '← rsmb.tv', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Tornado Tracks', level: 1, exact: true })).toBeVisible();
        // Both pages have the same heading. Wait for the lazy route to unmount
        // the renderer before replacing the document and its pending tile work.
        await expect(page.getByTestId('tornado-map')).toHaveCount(0);
        const previousTrackRequests = trackRequests.length;
        await page.goto('/projects/tornado-tracks/map?start=2025&end=2025&mode=trends&state=KS&track=test-track');
        await expect(page.getByRole('heading', { name: 'Test County, KS', exact: true })).toBeVisible();
        const stateSelector = page.getByRole('combobox', { name: 'State', exact: true });
        await stateSelector.focus();
        await stateSelector.press('Home');
        await expect(stateSelector).toHaveValue('');
        await expect.poll(() => new URL(page.url()).searchParams.get('state')).toBeNull();
        await stateSelector.press('ArrowDown');
        await stateSelector.press('Enter');
        await expect(page).toHaveURL(/state=AL/);
        expect(new URL(page.url()).searchParams.get('track')).toBeNull();
        expect(new URL(page.url()).searchParams.get('mode')).toBe('trends');
        await stateSelector.selectOption('KS');
        await expect(page.getByText('A · Annual count vs selection')).toBeVisible();
        await expect(page.getByText('Loading tornado tracks...', { exact: true })).toHaveCount(0);
        await expect.poll(() => trendRequests.length).toBeGreaterThan(0);
        expect(trackRequests.slice(previousTrackRequests).map(url => new URL(url).pathname)).toEqual(['/tornadoes/tracks/2025.geojson']);
        if (width < 768) {
            await page.getByRole('button', { name: 'Close controls', exact: true }).click();
            await page.getByRole('button', { name: 'Expand timeline', exact: true }).click();
        }
        await expect(page.getByRole('button', { name: '2023: 7 track segments', exact: true })).toBeVisible();
        if (width < 768) await page.getByRole('button', { name: 'Filters & details', exact: true }).click();
        await page.getByText('View annual track data', { exact: true }).click();
        const annualData = page.getByRole('table', { name: 'Annual track data', exact: true });
        await expect(annualData.getByRole('row', { name: '2023 7 7 0 0.0 No', exact: true })).toBeVisible();
        await stateSelector.focus();
        await stateSelector.press('Home');
        await expect(stateSelector).toHaveValue('');
        await expect.poll(() => new URL(page.url()).searchParams.get('state')).toBeNull();
        await stateSelector.press('ArrowDown');
        await stateSelector.press('Enter');
        await expect(page).toHaveURL(/state=AL/);
        expect(new URL(page.url()).searchParams.get('track')).toBeNull();
        expect(new URL(page.url()).searchParams.get('mode')).toBe('trends');
        await expect(page.getByText('No tracks match the selected years, state, region, and EF filters.', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
        await expect(page.locator('#tornado-summary-panel h2')).toHaveText('11 tracks');
        await expect(page.locator('#tornado-summary-panel')).toBeFocused();
        await expect(page.getByRole('button', { name: 'Reset filters', exact: true })).toHaveCount(0);
        expect(new URL(page.url()).searchParams.get('state')).toBeNull();
        expect(new URL(page.url()).searchParams.get('scale')).toBeNull();
        expect(new URL(page.url()).searchParams.get('region')).toBeNull();
        expect(pageErrors).toEqual([]);
    });
}
