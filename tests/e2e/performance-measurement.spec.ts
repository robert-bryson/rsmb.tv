import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { measurePerformance, parsePerformanceOptions } from '../../scripts/measure-performance.js';

let server: Server;
let origin: string;
let outputRoot: string;
let imageSent = false;
const image = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#336699"/><circle cx="160" cy="90" r="60" fill="#eeaa33"/></svg>';

test.beforeAll(async () => {
    outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rsmb-metrics-browser-'));
    server = createServer((request, response) => {
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
        const picture = request.url === '/slow-image' ? '<img src="/delayed.svg" width="320" height="180" alt="Synthetic preview">' : request.url === '/broken-image' ? '<img src="/missing.svg" width="320" height="180" alt="Broken preview">' : '';
        response.writeHead(status, { 'Content-Type': 'text/html' }).end(`<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><h1>Synthetic page</h1>${picture}<button>Filter</button>${crash}</body></html>`);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing fixture address');
    origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await fs.rm(outputRoot, { recursive: true, force: true });
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
