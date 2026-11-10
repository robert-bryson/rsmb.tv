import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { flights, airports } from './flight-duration';

/** Deterministic production assets; no external provider or personal data is needed. */
export async function auditAssets(page: Page) {
    const empty = { type: 'FeatureCollection', features: [] };
    const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#171b24' } }).png().toBuffer();
    await page.route('https://**/*', route => route.abort());
    await page.route('**/basemaps/**', route => route.fulfill({ contentType: 'image/png', body: tile }));
    await page.route('https://basemaps.cartocdn.com/**', route => route.request().url().includes('/style.json')
        ? route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#171b24' } }] } })
        : route.fulfill({ contentType: 'image/png', body: tile }));
    await page.route('https://demotiles.maplibre.org/font/**', route => route.fulfill({ contentType: 'application/x-protobuf', body: Buffer.alloc(0) }));
    await page.route('**/data/flights/flights.geojson', route => route.fulfill({ json: flights }));
    await page.route('**/data/flights/visitedAirports.geojson', route => route.fulfill({ json: airports }));
    await page.route('**/data/flights/usStates.geojson', route => route.fulfill({ json: empty }));
    await page.route('**/recentRecords.json', route => route.fulfill({ json: {
        asOf: '2026-11-03', yesterday: [], last7Days: [],
    } }));
    await page.route('**/summary.json', route => route.fulfill({ json: {
        lastUpdated: '2026-11-03T00:00:00Z', stateRecordCount: 0, countyRecordCount: 0, statesProcessed: 48,
    } }));
    await page.route('https://data.rsmb.tv/tornadoes/**', route => route.fulfill({ json: route.request().url().endsWith('annual-summary.json')
        ? [{ year: 2025, count: 0, unknown: 0, ef0: 0, ef1: 0, ef2: 0, ef3: 0, ef4: 0, ef5: 0, ef1Plus: 0, ef2Plus: 0,
            deaths: 0, injuries: 0, trackMiles: 0, medianWidthYards: 0 }]
        : route.request().url().endsWith('notable-events.json') ? [] : empty }));
    await page.route('**/test-trip/**', route => {
        if (route.request().url().endsWith('.geojson')) return route.fulfill({ json: {
            type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-122, 47], [-122.5, 46.7], [-123, 46]] },
        } });
        const width = Number(route.request().url().match(/-(\d+)\.svg/)?.[1] ?? 1600);
        const height = width * (route.request().url().includes('/photo-4-') ? .175 : .625);
        return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#456"/></svg>` });
    });
}
