/* global window, document, innerHeight */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const journeys = {
    about: { from: '/projects', href: '/about', ready: 'about' },
    flights: { from: '/projects/flights', href: '/projects/flights/map', ready: 'flights' },
};

export async function measurePrefetch({ baseURL, label, samples = 10, hovers = [0, 200, 500, 1000], out, warm = false }) {
    const browser = await chromium.launch({ headless: true });
    const report = { label, measuredAt: new Date().toISOString(), conditions: {
        browser: browser.version(), samples, hoverMs: hovers, cache: warm ? 'previously visited destination in the same document' : 'fresh context per sample',
        viewport: '1280x900', reducedMotion: 'reduce', latencyMs: 100, downloadMbps: 10, cpuSlowdown: 4,
        notes: 'Local production preview; response compression is determined by the preview. Not field measurements. External services blocked.',
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
                await page.addInitScript(() => {
                    window.__prefetchMeasure = { longTasks: [], shifts: [] };
                    if (PerformanceObserver.supportedEntryTypes.includes('longtask')) new PerformanceObserver(list => {
                        window.__prefetchMeasure.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })));
                    }).observe({ type: 'longtask', buffered: true });
                    if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) new PerformanceObserver(list => {
                        window.__prefetchMeasure.shifts.push(...list.getEntries().filter(e => !e.hadRecentInput).map(e => ({ start: e.startTime, value: e.value })));
                    }).observe({ type: 'layout-shift', buffered: true });
                });
                const waitReady = async () => {
                    if (target.ready === 'about') await page.getByRole('heading', { name: 'About', exact: true }).waitFor();
                    else await page.waitForFunction(() => {
                        const canvas = document.querySelector('.flights-globe canvas');
                        const globe = document.querySelector('[role="application"]');
                        return canvas && /showing [1-9]\d* flights/.test(globe?.getAttribute('aria-label') ?? '')
                            && ![...document.querySelectorAll('div')].some(e => e.textContent === 'Loading globe...');
                    });
                };
                await page.goto(new URL(target.from, baseURL).href, { waitUntil: 'networkidle' });
                if (warm) {
                    await page.locator(`a[href="${target.href}"]`).first().evaluate(element => element.click());
                    await waitReady();
                    await page.goBack();
                    await page.waitForURL(new URL(target.from, baseURL).href);
                    await page.locator('main h1').waitFor();
                    await page.locator(`a[href="${target.href}"]`).first().scrollIntoViewIfNeeded();
                    // A same-document Back visit can retain an earlier load-state event.
                    // Wait for current requests, including nearby lazy images, to settle.
                    const deadline = Date.now() + 30_000;
                    while (pendingRequests.size || Date.now() - networkActivity < 500) {
                        if (Date.now() > deadline) throw new Error('Return-visit source requests did not settle');
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }
                await page.waitForFunction(() => [...document.images].every(image => {
                    const box = image.getBoundingClientRect();
                    return image.complete || box.bottom <= 0 || box.top >= innerHeight || box.width === 0;
                }));
                await page.mouse.move(1, 850);
                const sourceBytes = encodedBytes;
                const requests = [];
                const bodies = [];
                page.on('request', request => { if (request.resourceType() === 'script') requests.push(request.url()); });
                page.on('response', response => {
                    if (response.request().resourceType() === 'script') bodies.push(response.finished().then(async () => ({ url: response.url(), decodedBytes: (await response.body()).length })).catch(() => null));
                });
                const link = page.locator(`a[href="${target.href}"]`).first();
                await link.scrollIntoViewIfNeeded();
                const intentStart = await page.evaluate(() => performance.now());
                if (hoverMs) { await link.hover(); await page.waitForTimeout(hoverMs); }
                const beforeClickRequests = [...requests];
                const beforeClickBytes = encodedBytes - sourceBytes;
                const start = await page.evaluate(() => performance.now());
                // Native activation without Playwright's implicit pre-click hover.
                await link.evaluate(element => element.click());
                await waitReady();
                const metrics = await page.evaluate(({ start, intentStart }) => {
                    const end = performance.now();
                    const data = window.__prefetchMeasure;
                    return { clickToReadyMs: end - start,
                        intentLongTaskMs: data.longTasks.filter(e => e.start >= intentStart && e.start < start).reduce((sum, e) => sum + e.duration, 0),
                        longTaskMs: data.longTasks.filter(e => e.start >= start).reduce((sum, e) => sum + e.duration, 0),
                        cls: data.shifts.reduce((sum, e) => sum + e.value, 0) };
                }, { start, intentStart });
                const resources = (await Promise.all(bodies)).filter(Boolean);
                const duplicates = [...new Set(requests.filter((url, index) => requests.indexOf(url) !== index))];
                report.results.push({ journey, hoverMs, sample, ...metrics, journeyEncodedBytes: encodedBytes,
                    beforeClickEncodedBytes: beforeClickBytes, afterSourceReadyEncodedBytes: encodedBytes - sourceBytes,
                    beforeClickRequests, resources, duplicates, errors });
                await fs.mkdir(path.dirname(out), { recursive: true });
                await fs.writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
            } finally { await context.close(); }
        }
    } finally { await browser.close(); }
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
