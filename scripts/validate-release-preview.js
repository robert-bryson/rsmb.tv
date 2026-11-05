/* global Image */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { recentRecordsSchema, stateRecordsSchema, countyRecordsSchema } from '../shared/temperatureSchemas.ts';
import { parseTornadoAnnualSummary, parseTornadoTrendIndex } from '../shared/tornadoTrends.ts';
import { flightsSchema, visitedAirportsSchema } from '../shared/flightSchemas.ts';
import { assertDeploymentIdentity, assertReleaseURL, RELEASE_ROUTES } from './release-proof.js';
import { assertHostingHeaders } from './release-headers.js';

export { assertDeploymentIdentity } from './release-proof.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const javascriptType = /^(?:text|application)\/(?:javascript|ecmascript)$/;
const jsonType = /^application\/(?:[\w.+-]+\+)?json$/;
const assetTypes = {
    '.js': javascriptType, '.mjs': javascriptType, '.css': /^text\/css$/,
    '.json': jsonType, '.geojson': jsonType,
    '.avif': /^image\/avif$/, '.webp': /^image\/webp$/, '.png': /^image\/png$/,
    '.jpg': /^image\/jpeg$/, '.jpeg': /^image\/jpeg$/, '.svg': /^image\/svg\+xml$/,
    '.woff': /^(?:font\/woff|application\/font-woff)$/, '.woff2': /^font\/woff2$/,
};

export function assertAssetType(url, contentType) {
    const pathname = new URL(url).pathname;
    const type = contentType.split(';')[0].trim().toLowerCase();
    const expected = assetTypes[path.extname(pathname)];
    if (expected && !expected.test(type)) throw new Error(`Wrong MIME type for ${pathname}: ${contentType || '(missing)'}`);
}

export function assertReleaseData(payloads) {
    for (const filename of ['recentRecords.json', 'stateRecords.json', 'countyRecords.json', 'annual-summary.json', 'trend-index.json', 'flights.geojson', 'visitedAirports.geojson']) {
        if (!payloads.has(filename)) throw new Error(`Preview did not load ${filename}.`);
    }
    const recent = payloads.get('recentRecords.json');
    recentRecordsSchema.parse(recent);
    if (recent.monthlyThresholdVersion !== 2) throw new Error('Published monthly temperature thresholds need regeneration (version 2 required).');
    stateRecordsSchema.parse(payloads.get('stateRecords.json'));
    countyRecordsSchema.parse(payloads.get('countyRecords.json'));
    const annual = parseTornadoAnnualSummary(payloads.get('annual-summary.json'));
    parseTornadoTrendIndex(payloads.get('trend-index.json'), annual);
    flightsSchema.parse(payloads.get('flights.geojson'));
    visitedAirportsSchema.parse(payloads.get('visitedAirports.geojson'));
}

const requiredPayload = /^(recentRecords|stateRecords|countyRecords|annual-summary|trend-index)\.json$|^(flights|visitedAirports)\.geojson$/;
const tornadoGeometry = /\/(tracks|track-points)\/\d{4}\.geojson$/;
const assetExtension = /\.(?:m?js|css|json|geojson|avif|webp|png|jpe?g|svg|woff2?)$/;
const headings = new Map([['/', "Hi, I'm Robby"], ['/about', 'About'], ['/posts', 'Posts'], ['/projects', 'Projects']]);

export function assertTornadoGeometry(data, pathname) {
    const point = pathname.includes('/track-points/');
    const position = value => Array.isArray(value) && value.length >= 2
        && Number.isFinite(value[0]) && Math.abs(value[0]) <= 180 && Number.isFinite(value[1]) && Math.abs(value[1]) <= 90;
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.some(feature => {
        const geometry = feature?.geometry;
        const properties = feature?.properties;
        return feature?.type !== 'Feature' || !properties || typeof properties.id !== 'string' || !properties.id
            || !Number.isSafeInteger(properties.year) || String(properties.year) !== path.basename(pathname, '.geojson')
            || geometry?.type !== (point ? 'Point' : 'LineString')
            || (point ? !position(geometry.coordinates) : !Array.isArray(geometry.coordinates)
                || geometry.coordinates.length < 2 || !geometry.coordinates.every(position));
    })) throw new Error(`Invalid tornado geometry: ${pathname}`);
}

/** Validate an actual hosted preview, including its response policy and workers. */
export async function validateReleasePreview({ baseURL, revision, jobId, browser, outputPath, timeoutMs = 30_000 }) {
    const base = assertReleaseURL(baseURL, { originOnly: true });
    const report = { baseURL: base.origin, revision, checkedAt: new Date().toISOString(), routes: [], images: 0, errors: [] };
    const payloads = new Map();
    const inspections = [];
    let activeBrowser = browser;
    let context;
    let page;
    let failure;
    let annualURL;
    let tornadoTrackResponses = 0;
    const failOnErrors = () => { if (report.errors.length) throw new Error(report.errors.join('\n')); };
    const relevantURL = url => url.origin === base.origin || requiredPayload.test(path.basename(url.pathname)) || tornadoGeometry.test(url.pathname);
    try {
        activeBrowser ??= await chromium.launch();
        context = await activeBrowser.newContext({ serviceWorkers: 'block' });
        page = await context.newPage();
        page.setDefaultTimeout(timeoutMs);
        page.on('pageerror', error => report.errors.push(error.message));
        page.on('console', message => {
            if (message.type() === 'error' && /MapLibre error:/i.test(message.text())) report.errors.push(message.text());
        });
        page.on('requestfailed', request => {
            if (relevantURL(new URL(request.url()))) report.errors.push(`Request failed: ${request.url()} (${request.failure()?.errorText ?? 'unknown error'})`);
        });
        page.on('response', response => {
            const url = new URL(response.url());
            const filename = path.basename(url.pathname);
            if (!relevantURL(url)) return;
            const firstParty = url.origin === base.origin;
            const isDocument = response.request().resourceType() === 'document';
            if (!isDocument && !assetExtension.test(url.pathname)) return;
            inspections.push((async () => {
                if (!response.ok()) throw new Error(`HTTP ${response.status()} from ${url.href}`);
                if (firstParty) assertHostingHeaders(url.href, await response.allHeaders());
                assertAssetType(url.href, response.headers()['content-type'] ?? '');
                if (requiredPayload.test(filename)) {
                    payloads.set(filename, await response.json());
                    if (filename === 'annual-summary.json') annualURL = url.href;
                } else if (tornadoGeometry.test(url.pathname)) {
                    assertTornadoGeometry(await response.json(), url.pathname);
                    if (url.pathname.includes('/tracks/')) tornadoTrackResponses++;
                }
            })().catch(error => report.errors.push(error.message)));
        });
        async function getJSON(url) {
            const response = await context.request.get(url, { headers: { 'cache-control': 'no-cache' }, timeout: timeoutMs });
            if (!response.ok()) throw new Error(`HTTP ${response.status()} from ${url}`);
            assertAssetType(response.url(), response.headers()['content-type'] ?? '');
            if (new URL(response.url()).origin === base.origin) assertHostingHeaders(response.url(), response.headers());
            return response.json();
        }
        async function verifyRevision() {
            const url = new URL('/deployment.json', base);
            url.search = new URLSearchParams({ revision, t: String(Date.now()) }).toString();
            assertDeploymentIdentity(await getJSON(url.href), revision, jobId);
        }
        await verifyRevision();
        for (const route of RELEASE_ROUTES) {
            const response = await page.goto(new URL(route, base).href, { waitUntil: 'networkidle', timeout: timeoutMs });
            if (!response?.ok()) throw new Error(`Route ${route}: HTTP ${response?.status()}`);
            await Promise.all(inspections);
            failOnErrors();
            if (await page.getByTestId('page-error').count()) throw new Error(`Route failed: ${route}`);
            try {
                if (headings.has(route)) await page.getByRole('heading', { name: headings.get(route), exact: true }).waitFor({ state: 'visible' });
                if (route.startsWith('/projects/flights/map')) await page.locator('.flight-map-label').first().waitFor({ state: 'visible' });
                if (route.startsWith('/projects/temperature-records/map')) await page.locator('[data-testid="temperature-map"][data-map-state="ready"]').waitFor({ state: 'visible' });
                if (route.startsWith('/projects/tornado-tracks/map')) await page.locator('[data-testid="tornado-map"][data-map-state="ready"]').waitFor({ state: 'visible' });
            } catch (cause) { throw new Error(`Route did not become ready: ${route}. ${report.errors.join('\n')}`, { cause }); }
            report.routes.push(route);
        }
        await Promise.all(inspections);
        failOnErrors();
        if (!annualURL) throw new Error('Preview did not request the tornado annual summary.');
        if (!tornadoTrackResponses) throw new Error('Preview did not load any yearly tornado geometry.');
        // Capture the URL from the response, rather than the bounded performance buffer.
        payloads.set('trend-index.json', await getJSON(new URL('trend-index.json', annualURL).href));
        assertReleaseData(payloads);
        const previews = JSON.parse(await fs.readFile(path.join(root, 'src/content/project-previews.json'), 'utf8'));
        const images = [...new Set(Object.values(previews).flatMap(preview => [preview.src, ...[preview.srcSet, preview.avifSrcSet].filter(Boolean).flatMap(set => set.split(',').map(candidate => candidate.trim().split(/\s+/)[0]))]))];
        await page.goto(base.href, { waitUntil: 'networkidle', timeout: timeoutMs });
        for (let i = 0; i < images.length; i += 4) {
            await page.evaluate(async ({ sources, timeoutMs }) => {
                await Promise.all(sources.map(async src => {
                    const image = new Image();
                    image.src = src;
                    let timeout;
                    try {
                        await Promise.race([image.decode(), new Promise((_, reject) => {
                            timeout = setTimeout(() => reject(new Error(`Image decode timed out: ${src}`)), timeoutMs);
                        })]);
                    } catch (cause) { throw new Error(`Image cannot decode: ${src}`, { cause }); }
                    finally { clearTimeout(timeout); }
                    if (!image.naturalWidth) throw new Error(`Image cannot decode: ${src}`);
                }));
            }, { sources: images.slice(i, i + 4), timeoutMs: Math.min(timeoutMs, 15_000) });
        }
        report.images = images.length;
        await Promise.all(inspections);
        await verifyRevision();
        failOnErrors();
    } catch (error) {
        failure = error;
        report.errors.push(error.message);
    } finally {
        // Report persistence must not prevent browser cleanup or hide the original failure.
        page?.removeAllListeners();
        const cleanups = [() => context?.close(), () => !browser && activeBrowser?.close()];
        if (outputPath) cleanups.push(async () => {
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
        });
        for (const cleanup of cleanups) {
            try { await cleanup(); }
            catch (error) { failure ??= error; report.errors.push(error.message); }
        }
    }
    if (failure) throw failure;
    return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const { values } = parseArgs({ options: { 'base-url': { type: 'string' }, revision: { type: 'string' }, out: { type: 'string' } } });
        if (!values['base-url'] || !values.revision) throw new Error('--base-url and --revision are required.');
        console.log(await validateReleasePreview({ baseURL: values['base-url'], revision: values.revision, outputPath: values.out }));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
