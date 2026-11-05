import { expect, test, type Browser, type BrowserContextOptions, type TestInfo } from '@playwright/test';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReleasePreview, type ReleaseValidationReport } from '../../scripts/validate-release-preview.js';
import { expectedHostingHeaders } from '../../scripts/release-headers.js';
import { makeAirport, makeFlight } from '../../src/test/helpers/flights';
import { flightsSchema, visitedAirportsSchema } from '../../shared/flightSchemas';
import { recentRecordsSchema, stateRecordsSchema, countyRecordsSchema } from '../../shared/temperatureSchemas';
import { buildTornadoTrendIndex, summarizeTornadoTrends } from '../../shared/tornadoTrends';

const revision = 'a'.repeat(40);
const jobId = '42';
const publicDirectory = fileURLToPath(new URL('../../public/', import.meta.url));
const previewRegistry = readFileSync(new URL('../../src/content/project-previews.json', import.meta.url), 'utf8');
const previewPaths = new Set(previewRegistry.match(/\/images\/previews\/[^" ,]+/g));
const corruptPreview = [...previewPaths].find(pathname => pathname.endsWith('.avif'))!;
const trackURL = 'https://data.rsmb.tv/tornadoes/tracks/2025.geojson';
const routes = ['/', '/about', '/posts', '/projects', '/projects/flights/map?stats=0',
    '/projects/temperature-records/map', '/projects/temperature-records/map?view=state',
    '/projects/temperature-records/map?view=county', '/projects/tornado-tracks/map'];
type Failure = 'aborted-css' | 'aborted-worker' | 'track-http' | 'csp' | 'cache' | 'image' | 'about' | 'deployment' | 'map-console';

const flights = flightsSchema.parse({ type: 'FeatureCollection', features: [{ type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[-122.31, 47.45], [-118.41, 33.94]] }, properties: makeFlight(),
}] });
const airports = visitedAirportsSchema.parse({ type: 'FeatureCollection', features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.31, 47.45] }, properties: makeAirport('SEA') },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-118.41, 33.94] }, properties: makeAirport('LAX') },
] });
const recent = { ...recentRecordsSchema.parse({ asOf: '2026-11-05', yesterday: [], last7Days: [] }), monthlyThresholdVersion: 2 };
const states = stateRecordsSchema.parse({ type: 'FeatureCollection', features: [{ type: 'Feature',
    geometry: { type: 'Point', coordinates: [-93.38, 38.25] },
    properties: { state: 'MO', stateName: 'Missouri', type: 'high', tempF: 118, date: '1954-07-14', location: 'Warsaw', station: 'Test' },
}] });
const counties = countyRecordsSchema.parse({ type: 'FeatureCollection', features: [{ type: 'Feature',
    geometry: { type: 'Point', coordinates: [-94.58, 39.1] },
    properties: { countyFips: '29095', countyName: 'Jackson', state: 'MO', type: 'high', tempF: 115,
        date: '1954-07-14', stationName: 'Test', lat: 39.1, lon: -94.58 },
}] });
const track = { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-96.5, 38.7], [-95, 39.5]] },
    properties: { id: 'fixture-track', year: 2025, state: 'KS', scale: 2, deaths: 0, injuries: 0, lengthMiles: 12, widthYards: 100 } };
const tracks = { type: 'FeatureCollection', features: [track] };
const trendIndex = buildTornadoTrendIndex([track]);
const payloads = new Map<string, unknown>([
    ['/data/flights/flights.geojson', flights], ['/data/flights/visitedAirports.geojson', airports],
    ['/data/temperatures/recentRecords.json', recent], ['/data/temperatures/stateRecords.json', states],
    ['/data/temperatures/countyRecords.json', counties], ['/data/tornadoes/annual-summary.json', summarizeTornadoTrends(trendIndex)],
    ['/data/tornadoes/trend-index.json', trendIndex], ['/data/tornadoes/tracks/2025.geojson', tracks],
]);

// External files keep the fixture under the real production CSP. Readiness
// waits for network data and an actual browser worker, rather than static flags.
const application = `
const main = document.querySelector('main');
const ready = () => {
    const map = document.querySelector('[data-map-state]');
    if (map) { map.dataset.mapState = 'ready'; map.textContent = 'Map ready'; }
};
const json = url => fetch(url).then(response => response.json());
const workerReady = () => new Promise(resolve => {
    const worker = new Worker('/assets/map-worker.js');
    worker.onmessage = () => { worker.terminate(); resolve(); };
    worker.onerror = event => { event.preventDefault(); worker.terminate(); resolve(); };
});
if (location.pathname === '/projects/flights/map') {
    Promise.all([json('/data/flights/flights.geojson'), json('/data/flights/visitedAirports.geojson')]).then(() => {
        const label = document.createElement('div'); label.className = 'flight-map-label'; label.textContent = 'SEA'; main.append(label);
    });
} else if (location.pathname === '/projects/temperature-records/map') {
    const view = new URLSearchParams(location.search).get('view');
    const file = view === 'state' ? 'stateRecords' : view === 'county' ? 'countyRecords' : 'recentRecords';
    json('/data/temperatures/' + file + '.json').then(workerReady).then(ready);
} else if (location.pathname === '/projects/tornado-tracks/map') {
    Promise.allSettled([json('/data/tornadoes/annual-summary.json'), json('${trackURL}')]).then(workerReady).then(() => {
        ready();
        if (main.dataset.failure === 'map-console') console.error('MapLibre error: fixture context failure');
    });
}
`;

async function startPreview(failure?: Failure, localOnly = false) {
    const servedPreviews = new Set<string>();
    const requests: string[] = [];
    async function respond(request: IncomingMessage, response: ServerResponse) {
        const pathname = new URL(request.url ?? '/', 'http://fixture.invalid').pathname;
        requests.push(pathname);
        const headers = expectedHostingHeaders(pathname);
        if (failure === 'csp' && pathname === '/about') {
            headers['content-security-policy'] = headers['content-security-policy'].replace("frame-ancestors 'none'", "frame-ancestors 'self'");
        }
        if (failure === 'cache' && pathname === '/assets/application.js') headers['cache-control'] = 'public, max-age=0';
        let body: string | Buffer;
        let contentType: string;
        if (pathname === '/deployment.json') {
            body = JSON.stringify({ commitId: failure === 'deployment' ? 'b'.repeat(40) : revision, jobId }); contentType = 'application/json';
        } else if (payloads.has(pathname)) {
            body = JSON.stringify(payloads.get(pathname)); contentType = 'application/json';
        } else if (pathname === '/assets/application.js') {
            body = localOnly ? application.replace(trackURL, '/data/tornadoes/tracks/2025.geojson') : application; contentType = 'application/javascript';
        } else if (pathname === '/assets/map-worker.js') {
            body = "postMessage('ready');"; contentType = 'application/javascript';
        } else if (pathname === '/assets/site.css') {
            body = 'body { margin: 16px; color: #223344; } [data-map-state] { min-height: 32px; }'; contentType = 'text/css';
        } else if (pathname.startsWith('/images/previews/')) {
            body = failure === 'image' && pathname === corruptPreview ? Buffer.from('Corrupted image fixture')
                : await fs.readFile(path.join(publicDirectory, pathname));
            contentType = pathname.endsWith('.avif') ? 'image/avif' : 'image/webp';
            servedPreviews.add(pathname);
        } else if (routes.some(route => new URL(route, 'http://fixture.invalid').pathname === pathname)) {
            const heading = failure === 'about' && pathname === '/about' ? undefined
                : new Map([['/', "Hi, I'm Robby"], ['/about', 'About'], ['/posts', 'Posts'], ['/projects', 'Projects']]).get(pathname);
            const map = pathname.includes('temperature-records') ? 'temperature-map' : pathname.includes('tornado-tracks') ? 'tornado-map' : null;
            body = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/site.css"><script src="/assets/application.js" defer></script></head><body><main data-failure="${failure ?? ''}">${heading ? `<h1>${heading}</h1>` : ''}${map ? `<div data-testid="${map}" data-map-state="loading">Loading map</div>` : ''}</main></body></html>`;
            contentType = 'text/html; charset=utf-8';
        } else {
            response.writeHead(404, headers).end('Missing fixture resource'); return;
        }
        response.writeHead(200, { 'content-type': contentType, ...headers }).end(body);
    }
    const server = createServer((request, response) => {
        void respond(request, response).catch(error => { response.writeHead(500).end(String(error)); });
    });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture server did not bind a port.');
    return {
        origin: `http://127.0.0.1:${address.port}`, servedPreviews, requests,
        close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); },
    };
}

async function validateFixture(browser: Browser, testInfo: TestInfo, failure?: Failure, localOnly = false) {
    const preview = await startPreview(failure, localOnly);
    const externalRequests: string[] = [];
    const unexpectedRequests: string[] = [];
    const wrappedBrowser = localOnly ? browser : new Proxy(browser, { get(target, property, receiver) {
        if (property !== 'newContext') return Reflect.get(target, property, receiver);
        return async (options: BrowserContextOptions) => {
            const context = await target.newContext(options);
            await context.route('**/*', async route => {
                const url = route.request().url();
                if (new URL(url).origin === preview.origin) {
                    const pathname = new URL(url).pathname;
                    if ((failure === 'aborted-css' && pathname === '/assets/site.css')
                        || (failure === 'aborted-worker' && pathname === '/assets/map-worker.js')) return route.abort('failed');
                    return route.continue();
                }
                if (url === trackURL) {
                    externalRequests.push(url);
                    return route.fulfill({ status: failure === 'track-http' ? 503 : 200, contentType: 'application/geo+json',
                        headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(failure === 'track-http' ? { error: 'Temporarily unavailable' } : tracks) });
                }
                unexpectedRequests.push(url);
                return route.abort('blockedbyclient');
            });
            return context;
        };
    } });
    try {
        const report = await validateReleasePreview({ baseURL: preview.origin, revision, jobId, browser: wrappedBrowser,
            outputPath: testInfo.outputPath('release-validation.json'), timeoutMs: 2_000 });
        return { report, servedPreviews: preview.servedPreviews, externalRequests, requests: preview.requests };
    } finally {
        await preview.close();
        expect(unexpectedRequests, 'Every external request must use a local fixture').toEqual([]);
    }
}

test('validates all direct routes, real responsive images, and published data in Chromium', async ({ browser }, testInfo) => {
    const { report, servedPreviews, externalRequests } = await validateFixture(browser, testInfo);
    expect(report.routes).toEqual(routes);
    expect(report.errors).toEqual([]);
    expect(report.images).toBe(previewPaths.size);
    expect(servedPreviews).toEqual(previewPaths);
    expect(externalRequests).toContain(trackURL);
    const saved: ReleaseValidationReport = JSON.parse(await fs.readFile(testInfo.outputPath('release-validation.json'), 'utf8'));
    expect(saved).toEqual(report);
});

test('checks network headers on each repeated immutable worker load', async ({ browser }, testInfo) => {
    // No fixture interception: it would disable the browser cache and hide this regression.
    const { report, requests } = await validateFixture(browser, testInfo, undefined, true);
    expect(report.errors).toEqual([]);
    expect(requests.filter(pathname => pathname === '/assets/map-worker.js')).toHaveLength(4);
});

test('rejects an aborted stylesheet even when headings remain visible', async ({ browser }, testInfo) => {
    await expect(validateFixture(browser, testInfo, 'aborted-css')).rejects.toThrow(/Request failed:.*site\.css/i);
    const report: ReleaseValidationReport = JSON.parse(await fs.readFile(testInfo.outputPath('release-validation.json'), 'utf8'));
    expect(report.errors.join('\n')).toMatch(/Request failed:.*site\.css/i);
});

for (const [description, failure, diagnostic] of [
    ['a failed worker whose onerror handler suppresses the page error', 'aborted-worker', /Request failed:.*map-worker\.js/i],
    ['an HTTP failure for external tornado geometry', 'track-http', /HTTP 503.*tornadoes\/tracks\/2025\.geojson/i],
    ['a changed document security policy', 'csp', /content-security-policy mismatch/i],
    ['a changed immutable asset cache policy', 'cache', /cache-control mismatch/i],
    ['corrupt responsive image bytes served with the correct MIME type', 'image', /Image cannot decode:.*\.avif/i],
    ['an HTTP 200 About page that never renders its heading', 'about', /Route did not become ready: \/about/i],
    ['a stale deployed revision', 'deployment', /Deployed revision does not match/i],
    ['a handled MapLibre renderer error', 'map-console', /MapLibre error: fixture context failure/i],
] as const) {
    test(`rejects ${description} and saves the diagnostic`, async ({ browser }, testInfo) => {
        await expect(validateFixture(browser, testInfo, failure)).rejects.toThrow(diagnostic);
        const report: ReleaseValidationReport = JSON.parse(await fs.readFile(testInfo.outputPath('release-validation.json'), 'utf8'));
        expect(report.errors.join('\n')).toMatch(diagnostic);
    });
}
