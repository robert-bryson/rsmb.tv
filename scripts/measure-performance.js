/* global window, document */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium, devices } from '@playwright/test';
import { writeAtomically } from './atomic-write.js';

const DEFAULT_PATHS = '/,/posts,/trips/ocean-shores-2024,/projects/flights/map,/projects/temperature-records/map,/projects/tornado-tracks/map';

function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

function boundedInteger(value, name, minimum, maximum) {
    const number = Number(value);
    if (!/^\d+$/.test(value) || !Number.isInteger(number) || number < minimum || number > maximum) {
        throw new Error(`${name} must be an integer from ${minimum} through ${maximum}.`);
    }
    return number;
}

export function parsePerformanceOptions(args) {
    const { values } = parseArgs({ args, options: {
        'base-url': { type: 'string', default: 'https://www.rsmb.tv' },
        samples: { type: 'string', default: '3' },
        out: { type: 'string', default: path.join(os.tmpdir(), 'rsmb-performance.json') },
        paths: { type: 'string', default: DEFAULT_PATHS },
        'settle-ms': { type: 'string', default: '8000' },
        'timeout-ms': { type: 'string', default: '45000' },
    } });
    const base = new URL(values['base-url']);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
        throw new Error('Supply an HTTP origin without credentials, path, query parameters, or fragment.');
    }
    const paths = values.paths.split(',').map(route => route.trim());
    if (paths.some(route => !route.startsWith('/') || route.startsWith('//') || route.includes('\\') || new URL(route, base).origin !== base.origin)) {
        throw new Error('--paths must contain absolute paths on the selected origin.');
    }
    if (!values.out.trim()) throw new Error('--out must name a report file.');
    return {
        baseURL: base.origin, paths, outputPath: path.resolve(values.out),
        samples: boundedInteger(values.samples, '--samples', 1, 10),
        settleMs: boundedInteger(values['settle-ms'], '--settle-ms', 0, 60_000),
        timeoutMs: boundedInteger(values['timeout-ms'], '--timeout-ms', 100, 120_000),
    };
}

export function validatePerformanceSample(sample) {
    if (sample.status < 200 || sample.status >= 300 || !Number.isInteger(sample.status)) throw new Error(`HTTP ${sample.status ?? 'response missing'}`);
    if (sample.errors.length) throw new Error(`Application error: ${sample.errors.join('; ')}`);
    for (const name of ['LCP', 'CLS', 'FCP', 'TTFB']) {
        const value = sample.metrics?.[name]?.value;
        if (!Number.isFinite(value) || value < 0 || ((name === 'LCP' || name === 'FCP') && value === 0)) {
            throw new Error(`Invalid or missing ${name} measurement.`);
        }
    }
    if (!Number.isFinite(sample.scriptBytes) || sample.scriptBytes < 0) throw new Error('Invalid script byte measurement.');
}

/** Sum completed script bodies without HTTP headers or CDP buffering artifacts. */
export function scriptBodyBytes(transfers, resources) {
    const entries = new Map();
    for (const resource of resources) {
        const matches = entries.get(resource.name) ?? [];
        matches.push(resource);
        entries.set(resource.name, matches);
    }
    return transfers.reduce((sum, transfer) => {
        const resource = entries.get(transfer.url)?.shift();
        // Cross-origin entries without Timing-Allow-Origin hide all size fields.
        // Content-Length still describes the compressed body, when provided.
        const observable = resource && (resource.transferSize > 0 || resource.decodedBodySize > 0);
        const bytes = observable ? resource.encodedBodySize : transfer.contentLength;
        if (!Number.isFinite(bytes) || bytes < 0) throw new Error(`JavaScript body size unavailable: ${transfer.url}`);
        return sum + bytes;
    }, 0);
}

export async function measurePerformance(options, { browser, onSample = row => console.log(JSON.stringify(row)) } = {}) {
    const activeBrowser = browser ?? await chromium.launch({ headless: true });
    const { baseURL, paths, samples, outputPath, settleMs, timeoutMs } = options;
    const bundle = fileURLToPath(new URL('./web-vitals.attribution.iife.js', import.meta.resolve('web-vitals/attribution')));
    const report = {
        measuredAt: new Date().toISOString(), baseURL,
        conditions: { browser: activeBrowser.version(), device: 'Pixel 7 emulation', cpuSlowdown: 4, latencyMs: 150, downloadMbps: 1.6, uploadMbps: 0.75, samples, browserCache: 'disabled', scriptByteScope: 'same-origin encoded bodies', settleMs, timeoutMs },
        failedSamples: 0, errors: [], results: [],
    };
    async function persistReport() {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await writeAtomically(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    }
    try {
        const instrumentation = `${await fs.readFile(bundle, 'utf8')}
performance.setResourceTimingBufferSize(10000);
window.__metrics = {};
for (const name of ['LCP', 'CLS', 'INP', 'FCP', 'TTFB']) {
    webVitals['on' + name](metric => {
        window.__metrics[name] = { value: metric.value, rating: metric.rating, target: metric.attribution?.target ?? metric.attribution?.largestShiftTarget ?? null };
    }, { reportAllChanges: true });
}
window.__mapReady = null;
if (location.pathname.endsWith('/map')) {
    const observer = new MutationObserver(() => {
        const state = document.querySelector('[data-map-state]')?.getAttribute('data-map-state');
        if (['ready', 'degraded', 'fallback'].includes(state)) {
            window.__mapReady = { durationMs: performance.now(), state };
            observer.disconnect();
        }
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-map-state'] });
}`;
        for (const route of paths) for (let sample = 1; sample <= samples; sample++) {
            const row = { route, sample, status: null, metrics: null, mapReady: null, scriptBytes: null, externalScriptRequests: 0, interaction: null, sampledINP: null, errors: [] };
            let context;
            try {
                context = await activeBrowser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
                const page = await context.newPage();
                page.setDefaultTimeout(5000);
                page.on('pageerror', error => row.errors.push(error.message));
                page.on('console', message => {
                    const text = message.text();
                    // Provider failures can recover to a usable neutral background.
                    // Terminal map state handles data failures; retain fatal renderer errors.
                    if (message.type() === 'error' && text.includes('MapLibre error:') && /worker|webgl|context/i.test(text)) row.errors.push(text);
                });
                const scriptRequests = new Map();
                const completedScripts = [];
                page.on('response', response => {
                    if (/maplibre.*worker/.test(response.url()) && !response.ok()) {
                        row.errors.push(`Map worker HTTP ${response.status()}`);
                        return;
                    }
                    const request = response.request();
                    const headers = response.headers();
                    if (request.resourceType() === 'script' || /^(?:application|text)\/(?:x-)?(?:java|ecma)script(?:;|$)/i.test(headers['content-type'] ?? '')) {
                        const length = headers['content-length'];
                        scriptRequests.set(request, {
                            url: response.url(),
                            contentLength: /^\d+$/.test(length ?? '') ? Number(length) : null,
                        });
                    }
                });
                page.on('requestfinished', request => {
                    const transfer = scriptRequests.get(request);
                    if (transfer) completedScripts.push(transfer);
                    scriptRequests.delete(request);
                });
                const session = await context.newCDPSession(page);
                await session.send('Network.enable');
                await session.send('Network.setCacheDisabled', { cacheDisabled: true });
                await session.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 });
                await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
                await page.addInitScript({ content: instrumentation });
                const response = await page.goto(new URL(route, baseURL).href, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
                row.status = response?.status() ?? null;
                if (!response?.ok()) throw new Error(`HTTP ${row.status ?? 'response missing'}`);
                await page.waitForFunction(() => document.querySelector('h1,[role="application"],canvas'), undefined, { timeout: timeoutMs });
                // Do not freeze LCP while an above-fold image or font is still loading.
                await page.waitForFunction(() => {
                    const images = [...document.images].filter(image => {
                        const box = image.getBoundingClientRect();
                        return box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 && box.top < window.innerHeight && box.left < window.innerWidth;
                    });
                    if (images.some(image => image.complete && !image.naturalWidth)) throw new Error('An above-fold image failed to load.');
                    return images.every(image => image.complete && image.naturalWidth > 0) && document.fonts.status === 'loaded';
                }, undefined, { timeout: timeoutMs });
                if (new URL(route, baseURL).pathname.endsWith('/map')) {
                    await page.waitForFunction(() => {
                        if (document.querySelector('[data-map-state="error"]')) throw new Error('Map startup failed.');
                        return window.__mapReady !== null;
                    }, undefined, { timeout: timeoutMs });
                    row.mapReady = await page.evaluate(() => window.__mapReady);
                }
                await page.waitForTimeout(settleMs);
                row.metrics = await page.evaluate(() => window.__metrics);
                const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => ({
                    name: entry.name, encodedBodySize: entry.encodedBodySize,
                    decodedBodySize: entry.decodedBodySize, transferSize: entry.transferSize,
                })));
                // Resource Timing includes buffered/modulepreloaded bodies. Request identity
                // preserves repeated transfers; opaque cross-origin sizes use Content-Length.
                const applicationScripts = completedScripts.filter(transfer => new URL(transfer.url).origin === baseURL);
                row.externalScriptRequests = completedScripts.length - applicationScripts.length;
                row.scriptBytes = scriptBodyBytes(applicationScripts, resources);
                validatePerformanceSample(row);
                row.interaction = 'Tab focus';
                const pause = page.getByRole('button', { name: 'Pause flight animations', exact: true });
                if (await pause.count()) { await pause.click(); row.interaction = 'Pause flight animations'; }
                else {
                    const projects = page.getByRole('link', { name: 'All projects →', exact: true });
                    const button = page.getByRole('button').filter({ visible: true }).first();
                    if (await projects.count()) { await projects.click(); row.interaction = 'All projects'; }
                    else if (await button.count()) {
                        row.interaction = await button.getAttribute('aria-label') || await button.innerText();
                        await button.click();
                    } else await page.keyboard.press('Tab');
                }
                await page.waitForTimeout(1500);
                row.sampledINP = await page.evaluate(() => window.__metrics.INP ?? null);
                validatePerformanceSample(row);
            } catch (error) {
                row.error = errorMessage(error);
                report.failedSamples += 1;
            } finally {
                try {
                    await context?.close();
                } catch (error) {
                    if (!row.error) report.failedSamples += 1;
                    row.error = [row.error, `Browser context cleanup failed: ${errorMessage(error)}`].filter(Boolean).join('; ');
                }
                report.results.push(row);
                onSample(row);
                await persistReport();
            }
        }
        return report;
    } finally {
        if (!browser) {
            try {
                await activeBrowser.close();
            } catch (error) {
                report.errors.push(`Browser cleanup failed: ${errorMessage(error)}`);
                await persistReport();
            }
        }
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const report = await measurePerformance(parsePerformanceOptions(process.argv.slice(2)));
        process.exitCode = report.failedSamples || report.errors.length ? 1 : 0;
    } catch (error) {
        console.error(errorMessage(error));
        process.exitCode = 1;
    }
}
