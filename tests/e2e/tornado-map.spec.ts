import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { parse } from 'yaml';
import type { AnnualTornadoSummary, TornadoTrackFeature } from '../../src/features/tornadoes/types';

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
        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('request', request => { if (request.url().includes('/track-points/')) pointRequests.push(request.url()); });
        page.on('request', request => { if (request.url().includes('/tornadoes/tracks/')) trackRequests.push(request.url()); });
        page.on('request', request => { if (request.url().endsWith('warning-summary.json')) warningRequests.push(request.url()); });

        // Isolate browser rendering from provider availability. Only the keyless
        // basemap is served; requests to the old authenticated provider fail.
        await page.route('https://**/*', route => route.abort());
        const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#18232f' } }).png().toBuffer();
        const exerciseRetry = width === 1280 && renderer === 'webgl';
        let failedTrackRequest = false;
        let styleRequests = 0;
        let tileRequests = 0;
        await page.route('https://tiles.openfreemap.org/**', route => {
            if (new URL(route.request().url()).pathname === '/styles/dark') {
                styleRequests += 1;
                return route.fulfill({ json: {
                    version: 8,
                    sources: { basemap: {
                        type: 'raster', tileSize: 256,
                        tiles: ['https://tiles.openfreemap.org/test/{z}/{x}/{y}.png'],
                        attribution: '<a href="https://openfreemap.org/">OpenFreeMap</a> · OpenStreetMap',
                    } },
                    layers: [{ id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-fade-duration': 0 } }],
                } });
            }
            tileRequests += 1;
            return route.fulfill({ contentType: 'image/png', body: tile });
        });
        await page.route('https://data.rsmb.tv/tornadoes/**', route => {
            const pathname = new URL(route.request().url()).pathname;
            if (pathname.endsWith('annual-summary.json')) return route.fulfill({ json: [{ ...summary, year: 2023 }, { ...summary, year: 2024 }, summary] });
            if (pathname.endsWith('notable-events.json')) return route.fulfill({ json: [{ ...track.properties, id: 'notable-track', year: 2024, scale: 1, scaleLabel: 'EF1', coordinates: track.geometry.coordinates }] });
            if (pathname.endsWith('warning-summary.json')) return route.fulfill({ json: null });
            if (exerciseRetry && !failedTrackRequest) {
                failedTrackRequest = true;
                return route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } });
            }
            const feature = pathname.endsWith('/2024.geojson') ? { ...track, properties: { ...track.properties, id: 'notable-track', year: 2024, scale: 1, scaleLabel: 'EF1' } } : track;
            return route.fulfill({ json: { type: 'FeatureCollection', features: [feature] } });
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
            await expect(page.getByRole('combobox', { name: 'Region', exact: true })).toBeEnabled();
            await page.getByRole('button', { name: 'Retry', exact: true }).click();
        }
        await expect(page.locator('#tornado-summary-panel h2')).toHaveText('1 tracks');
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
        if (renderer === 'webgl') await expect(page.getByRole('link', { name: 'OpenFreeMap', exact: true })).toBeVisible();
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
            await page.route('https://data.rsmb.tv/tornadoes/tracks/2023.geojson', route => failHistory
                ? route.fulfill({ status: 503, json: { error: 'Historical data unavailable' } })
                : route.fulfill({ json: { type: 'FeatureCollection', features: [] } }));
            await page.getByRole('button', { name: 'EF2+', exact: true }).click();
            await page.getByRole('button', { name: /^trends$/i }).click();
            await expect(page.getByRole('alert')).toContainText('Unable to load tornado data');
            failHistory = false;
            // Retry must remain reachable while the mobile controls cover the map.
            await page.getByRole('button', { name: 'Retry', exact: true }).click({ timeout: 3000 });
            await expect(page.getByRole('alert')).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Close controls', exact: true })).toBeVisible();
        }
        expect(pageErrors).toEqual([]);
    });
}
