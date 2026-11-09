/* global window, document, innerHeight, requestAnimationFrame, location, getComputedStyle */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const journeys = {
    about: { from: '/projects', href: '/about', ready: 'about' },
    flights: { from: '/projects/flights', href: '/projects/flights/map', ready: 'flights' },
};

// This function runs in the page. Capture readiness there so selector polling
// and the browser protocol cannot inflate the reported navigation time.
function installNavigationProbe(target) {
    const data = window.__prefetchMeasure = { input: null, readyAt: null, longTasks: [], shifts: [] };
    function checkReady() {
        let ready = false;
        if (location.pathname === target.href) {
            if (target.ready === 'about') {
                const heading = document.querySelector('h1');
                const box = heading?.getBoundingClientRect();
                ready = heading?.textContent?.trim() === 'About' && box.width > 0 && box.height > 0
                    && getComputedStyle(heading).visibility !== 'hidden';
            } else {
                ready = document.querySelector('.flights-globe canvas')
                    && /showing [1-9]\d* flights/.test(document.querySelector('[role="application"]')?.getAttribute('aria-label') ?? '')
                    && ![...document.querySelectorAll('div')].some(element => element.textContent === 'Loading globe...');
            }
        }
        if (ready) requestAnimationFrame(() => requestAnimationFrame(() => { data.readyAt = performance.now(); }));
        else requestAnimationFrame(checkReady);
    }
    document.addEventListener('pointerdown', event => {
        if (data.input || !event.target?.closest?.('a')) return;
        data.input = { timeStamp: event.timeStamp, handlerAt: performance.now(), trusted: event.isTrusted };
        requestAnimationFrame(checkReady);
    }, true);
    if (PerformanceObserver.supportedEntryTypes.includes('longtask')) new PerformanceObserver(list => {
        data.longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration })));
    }).observe({ type: 'longtask', buffered: true });
    if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) new PerformanceObserver(list => {
        data.shifts.push(...list.getEntries().filter(entry => !entry.hadRecentInput).map(entry => ({ start: entry.startTime, value: entry.value })));
    }).observe({ type: 'layout-shift', buffered: true });
}

export async function measurePrefetch({ baseURL, label, samples = 10, hovers = [0, 200, 500, 1000], out, warm = false }, { browser: suppliedBrowser } = {}) {
    const browser = suppliedBrowser ?? await chromium.launch({ headless: true });
    const report = { measurementVersion: 2, label, measuredAt: new Date().toISOString(), conditions: {
        browser: browser.version(), samples, hoverMs: hovers, cache: warm ? 'previously visited destination in the same document' : 'fresh context per sample',
        viewport: '1280x900', reducedMotion: 'reduce', latencyMs: 100, downloadMbps: 10, cpuSlowdown: 4,
        notes: 'Local production preview; response compression is determined by the preview. Not field measurements. External services blocked.',
        activation: 'Trusted browser mouse input; timing includes input queue delay. Readiness is timestamped in the page after two animation frames.',
    }, results: [] };
    try {
        for (const [journey, target] of Object.entries(journeys)) for (const hoverMs of hovers) for (let sample = 1; sample <= samples; sample++) {
            const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
            try {
                const page = await context.newPage();
                await page.route('https://**/*', route => route.abort());
                const session = await context.newCDPSession(page);
                let encodedBytes = 0;
                const pendingRequests = new Set();
                let networkActivity = Date.now();
                session.on('Network.requestWillBeSent', event => { pendingRequests.add(event.requestId); networkActivity = Date.now(); });
                const finishRequest = event => { pendingRequests.delete(event.requestId); networkActivity = Date.now(); };
                session.on('Network.loadingFinished', finishRequest);
                session.on('Network.loadingFailed', finishRequest);
                session.on('Network.dataReceived', event => { encodedBytes += event.encodedDataLength; });
                await session.send('Network.enable');
                await session.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 10_000_000 / 8, uploadThroughput: 1_000_000 / 8 });
                await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
                const errors = [];
                page.on('pageerror', error => errors.push(error.message));
                await page.addInitScript(installNavigationProbe, target);
                const waitReady = async () => {
                    const handle = await page.waitForFunction(() => window.__prefetchMeasure.readyAt !== null);
                    await handle.dispose();
                };
                await page.goto(new URL(target.from, baseURL).href, { waitUntil: 'networkidle' });
                if (warm) {
                    await page.locator(`a[href="${target.href}"]`).first().click();
                    await waitReady();
                    await page.goBack();
                    await page.waitForURL(new URL(target.from, baseURL).href);
                    await page.locator('main h1').waitFor();
                }
                await page.mouse.move(1, 850);
                const link = page.locator(`a[href="${target.href}"]`).first();
                await link.scrollIntoViewIfNeeded();
                await page.evaluate(() => document.fonts.ready);
                await page.waitForFunction(() => [...document.images].every(image => {
                    const box = image.getBoundingClientRect();
                    return image.complete || box.bottom <= 0 || box.top >= innerHeight || box.width === 0;
                }));
                // Scrolling and same-document Back can start new image requests
                // after an earlier networkidle event. Exclude them from the sample.
                const deadline = Date.now() + 30_000;
                while (pendingRequests.size || Date.now() - networkActivity < 500) {
                    if (Date.now() > deadline) throw new Error('Source requests did not settle');
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                const box = await link.boundingBox();
                if (!box) throw new Error('Destination link is not visible');
                const sourceBytes = encodedBytes;
                const requests = [];
                const bodies = [];
                page.on('request', request => { if (request.resourceType() === 'script') requests.push(request.url()); });
                page.on('response', response => {
                    if (response.request().resourceType() === 'script') bodies.push(response.finished().then(async () => ({ url: response.url(), decodedBytes: (await response.body()).length })).catch(() => null));
                });
                const { timeOrigin, intentStart } = await page.evaluate(() => {
                    window.__prefetchMeasure.input = null;
                    window.__prefetchMeasure.readyAt = null;
                    return { timeOrigin: performance.timeOrigin, intentStart: performance.now() };
                });
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                if (hoverMs) await new Promise(resolve => setTimeout(resolve, hoverMs));
                const beforeClickRequests = [...requests];
                const beforeClickBytes = encodedBytes - sourceBytes;
                // Do not evaluate in the page after hover: a busy main thread
                // would postpone the input and conceal its dispatch delay.
                const epoch = Date.now();
                const start = epoch - timeOrigin;
                await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x + box.width / 2,
                    y: box.y + box.height / 2, button: 'left', clickCount: 1, timestamp: epoch / 1000 });
                await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + box.width / 2,
                    y: box.y + box.height / 2, button: 'left', clickCount: 1, timestamp: (epoch + 1) / 1000 });
                await waitReady();
                await page.waitForTimeout(80);
                const metrics = await page.evaluate(({ start, intentStart }) => {
                    const data = window.__prefetchMeasure;
                    return { clickToReadyMs: data.readyAt - start, readyAt: data.readyAt, activationAt: start,
                        trustedInput: data.input?.trusted ?? false,
                        inputDelayMs: data.input ? data.input.handlerAt - data.input.timeStamp : null,
                        intentLongTaskMs: data.longTasks.filter(e => e.start >= intentStart && e.start < start).reduce((sum, e) => sum + e.duration, 0),
                        longTaskMs: data.longTasks.filter(e => e.start >= start && e.start <= data.readyAt).reduce((sum, e) => sum + e.duration, 0),
                        cls: data.shifts.reduce((sum, e) => sum + e.value, 0) };
                }, { start, intentStart });
                if (!metrics.trustedInput) throw new Error('Measurement did not receive trusted browser input');
                const resources = (await Promise.all(bodies)).filter(Boolean);
                const duplicates = [...new Set(requests.filter((url, index) => requests.indexOf(url) !== index))];
                report.results.push({ journey, hoverMs, sample, ...metrics, journeyEncodedBytes: encodedBytes,
                    beforeClickEncodedBytes: beforeClickBytes, afterSourceReadyEncodedBytes: encodedBytes - sourceBytes,
                    beforeClickRequests, resources, duplicates, errors });
                await fs.mkdir(path.dirname(out), { recursive: true });
                await fs.writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
            } finally { await context.close(); }
        }
    } finally { if (!suppliedBrowser) await browser.close(); }
    return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { values } = parseArgs({ options: { 'base-url': { type: 'string' }, label: { type: 'string' }, out: { type: 'string' }, samples: { type: 'string', default: '10' }, hovers: { type: 'string', default: '0,200,500,1000' }, warm: { type: 'boolean', default: false } } });
    if (!values['base-url'] || !values.label || !values.out) throw new Error('Supply --base-url, --label, and --out.');
    const samples = Number(values.samples);
    const hovers = values.hovers.split(',').map(Number);
    if (!Number.isInteger(samples) || samples < 1 || samples > 30 || hovers.some(n => !Number.isFinite(n) || n < 0 || n > 5000)) throw new Error('Invalid samples or hover windows.');
    const report = await measurePrefetch({ baseURL: values['base-url'], label: values.label, samples, hovers, out: values.out, warm: values.warm });
    console.log(JSON.stringify({ label: report.label, samples: report.results.length, errors: report.results.filter(row => row.errors.length).length }));
    if (report.results.some(row => row.errors.length)) process.exitCode = 1;
}
