import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { measurePerformance, parsePerformanceOptions } from '../../scripts/measure-performance.js';

test.skip(({ browserName }) => browserName !== 'chromium',
    'Performance measurement uses Chromium CDP for network and CPU emulation.');

let server: Server;
let origin: string;
let outputRoot: string;
let imageSent = false;
const image = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#336699"/><circle cx="160" cy="90" r="60" fill="#eeaa33"/></svg>';
const preloadedScript = gzipSync(`window.measurementModuleLoaded = true;/*${'compressed module fixture '.repeat(100)}*/`);

test.beforeAll(async () => {
    outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rsmb-metrics-browser-'));
    server = createServer((request, response) => {
        if (request.url === '/preloaded.js') {
            response.writeHead(200, { 'Content-Type': 'application/javascript', 'Content-Encoding': 'gzip', 'Content-Length': preloadedScript.length }).end(preloadedScript);
            return;
        }
        if (request.url === '/fixture.css') {
            response.writeHead(200, { 'Content-Type': 'text/css' }).end('h1 { color: #336699; }');
            return;
        }
        if (request.url === '/delayed.svg') {
            setTimeout(() => {
                imageSent = true;
                response.writeHead(200, { 'Content-Type': 'image/svg+xml' }).end(image);
            }, 500);
            return;
        }
        if (request.url === '/missing.svg') { response.writeHead(404).end(); return; }
        const status = request.url === '/unavailable' ? 503 : 200;
        const crash = request.url === '/crash' ? '<script>throw new Error("Synthetic application crash")</script>' : '';
        const picture = request.url === '/slow-image' || request.url === '/modulepreload' ? '<img src="/delayed.svg" width="320" height="180" alt="Synthetic preview">' : request.url === '/broken-image' ? '<img src="/missing.svg" width="320" height="180" alt="Broken preview">' : '';
        const external = request.url === '/external-script' ? `<script src="${origin.replace('127.0.0.1', 'localhost')}/preloaded.js"></script>` : '';
        const preload = request.url === '/modulepreload' ? '<link rel="modulepreload" href="/preloaded.js"><link rel="stylesheet" href="/fixture.css"><script type="module" src="/preloaded.js"></script>' : '';
        const state = request.url === '/failed/map' ? 'error' : request.url === '/recovered/map' ? 'degraded' : 'ready';
        const warning = request.url === '/recovered/map' ? 'console.error("MapLibre error: AJAXError: background HTTP 503");' : '';
        const map = request.url?.endsWith('/map') ? `<div data-map-state="loading"></div><script>${warning}setTimeout(() => document.querySelector('[data-map-state]').setAttribute('data-map-state', '${state}'), 300)</script>` : '';
        response.writeHead(status, { 'Content-Type': 'text/html' }).end(`<!doctype html><html><head><meta name="viewport" content="width=device-width">${preload}${external}</head><body><h1>Synthetic page</h1>${picture}${map}<button>Filter</button>${crash}</body></html>`);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing fixture address');
    origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
    // A project-level skip can bypass beforeAll. Setup failures can also leave only some resources.
    try {
        if (server) {
            server.closeAllConnections();
            await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        }
    } finally {
        if (outputRoot) await fs.rm(outputRoot, { recursive: true, force: true });
    }
});

function options(route: string) {
    return parsePerformanceOptions(['--base-url', origin, '--paths', route, '--samples', '1', '--settle-ms', '200', '--timeout-ms', '5000', '--out', path.join(outputRoot, 'report.json')]);
}

test('measurement CLI returns failure for a real HTTP error page', async () => {
    const output = path.join(outputRoot, 'failed-cli.json');
    await expect(promisify(execFile)(process.execPath, ['scripts/measure-performance.js', '--base-url', origin, '--paths', '/unavailable', '--samples', '1', '--out', output]))
        .rejects.toMatchObject({ code: 1 });
    expect(JSON.parse(await fs.readFile(output, 'utf8'))).toMatchObject({ failedSamples: 1, results: [{ status: 503, error: 'HTTP 503' }] });
});

test('measurement rejects a successful response whose application crashes', async ({ browser }) => {
    const report = await measurePerformance(options('/crash'), { browser, onSample() {} });
    expect(report).toMatchObject({ failedSamples: 1, results: [{ status: 200, error: expect.stringContaining('Synthetic application crash') }] });
});

test('measurement waits for an above-fold image before taking the load snapshot', async ({ browser }) => {
    imageSent = false;
    const report = await measurePerformance(options('/slow-image'), { browser, onSample() {} });
    expect(imageSent).toBe(true);
    expect(report.failedSamples).toBe(0);
    expect(report.results[0].metrics?.LCP?.value ?? 0).toBeGreaterThan(0);
});

test('measurement fails when an above-fold image cannot load', async ({ browser }) => {
    const report = await measurePerformance(options('/broken-image'), { browser, onSample() {} });
    expect(report).toMatchObject({ failedSamples: 1, results: [{ error: expect.stringContaining('above-fold image failed') }] });
});

test('measurement counts compressed modulepreloads without counting styles or images', async ({ browser }) => {
    const report = await measurePerformance(options('/modulepreload'), { browser, onSample() {} });
    expect(report.failedSamples).toBe(0);
    expect(report.results[0].scriptBytes).toBe(preloadedScript.length);
});

test('measurement records map readiness separately from an earlier text paint', async ({ browser }) => {
    const report = await measurePerformance(options('/synthetic/map'), { browser, onSample() {} });
    expect(report.failedSamples).toBe(0);
    expect(report.results[0].mapReady?.state).toBe('ready');
    expect(report.results[0].mapReady?.durationMs).toBeGreaterThanOrEqual(300);
});

test('measurement rejects a map startup error even when the document loaded', async ({ browser }) => {
    const report = await measurePerformance(options('/failed/map'), { browser, onSample() {} });
    expect(report.failedSamples).toBe(1);
    expect(report.results[0].error).toContain('Map startup failed');
});

test('measurement accepts a usable map after its background provider fails', async ({ browser }) => {
    const report = await measurePerformance(options('/recovered/map'), { browser, onSample() {} });
    expect(report.failedSamples).toBe(0);
    expect(report.results[0].mapReady?.state).toBe('degraded');
    expect(report.results[0].errors).toEqual([]);
});

test('measurement identifies its first-party scope and separately counts opaque external scripts', async ({ browser }) => {
    const report = await measurePerformance(options('/external-script'), { browser, onSample() {} });
    expect(report.failedSamples).toBe(0);
    expect(report.conditions.scriptByteScope).toBe('same-origin encoded bodies');
    expect(report.results[0]).toMatchObject({ scriptBytes: 0, externalScriptRequests: 1 });
});
