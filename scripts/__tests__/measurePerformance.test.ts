// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { measurePerformance, parsePerformanceOptions, validatePerformanceSample, scriptBodyBytes } from '../measure-performance.js';

const roots: string[] = [];
afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe('performance measurement inputs', () => {
    it('parses explicit, bounded laboratory settings and keeps route queries', () => {
        expect(parsePerformanceOptions(['--base-url', 'http://127.0.0.1:4176', '--samples', '2', '--paths', '/,/projects/flights/map?year=2024', '--settle-ms', '250', '--timeout-ms', '5000']))
            .toMatchObject({ baseURL: 'http://127.0.0.1:4176', samples: 2, paths: ['/', '/projects/flights/map?year=2024'], settleMs: 250, timeoutMs: 5000 });
    });

    it.each(['file:///tmp/site', 'https://example.test/path', 'https://example.test?token=1', 'https://example.test#fragment', 'https://user:pass@example.test'])('rejects non-origin targets: %s', baseURL => {
        expect(() => parsePerformanceOptions(['--base-url', baseURL])).toThrow(/HTTP origin/);
    });

    it.each(['', '//other.test/page', 'https://other.test/page', '/\\other.test/page'])('rejects invalid or external routes: %s', routes => {
        expect(() => parsePerformanceOptions(['--paths', routes])).toThrow(/selected origin/);
    });

    it.each(['0', '11', '-1', 'NaN', 'Infinity', '1.5', ''])('rejects invalid sample counts: %s', count => {
        expect(() => parsePerformanceOptions(['--samples', count])).toThrow(/--samples/);
    });

    it('rejects unknown flags and missing option values instead of applying hidden defaults', () => {
        expect(() => parsePerformanceOptions(['--sampls', '2'])).toThrow();
        expect(() => parsePerformanceOptions(['--out'])).toThrow();
        expect(() => parsePerformanceOptions(['--out', ' '])).toThrow(/report file/);
    });
});

function sample() {
    const metric = (value: number) => ({ value, rating: 'good', target: null });
    return { status: 200, errors: [] as string[], scriptBytes: 100, metrics: {
        LCP: metric(100), FCP: metric(50), TTFB: metric(0), CLS: metric(0),
    } };
}

describe('performance result integrity', () => {
    it('accepts valid paint and timing measurements, including genuine zero CLS and TTFB', () => {
        expect(() => validatePerformanceSample(sample())).not.toThrow();
    });

    it.each([null, 404, 500, 503])('rejects unsuccessful HTTP status %s', status => {
        expect(() => validatePerformanceSample({ ...sample(), status })).toThrow(/HTTP/);
    });

    it('rejects an uncaught application error despite a successful HTTP response', () => {
        expect(() => validatePerformanceSample({ ...sample(), errors: ['Application crashed'] })).toThrow(/Application crashed/);
    });

    it.each(['LCP', 'CLS', 'FCP', 'TTFB'])('rejects missing %s measurements', name => {
        const entry = sample();
        delete (entry.metrics as Record<string, unknown>)[name];
        expect(() => validatePerformanceSample(entry)).toThrow(name);
    });

    it.each([NaN, Infinity, -1, 0])('rejects invalid paint timing %s', value => {
        const entry = sample();
        entry.metrics.LCP.value = value;
        expect(() => validatePerformanceSample(entry)).toThrow('LCP');
    });

    it.each([-1, NaN, Infinity])('rejects invalid script byte count %s', scriptBytes => {
        expect(() => validatePerformanceSample({ ...sample(), scriptBytes })).toThrow('script byte');
    });
});

interface NetworkTransfer {
    requestId: string;
    type: string;
    mimeType: string;
    bytes: number;
    url?: string;
}

async function browserFixture({ status = 200, applicationError = '', control = 'none', transfers = [
    { requestId: 'script', type: 'Script', mimeType: 'application/javascript', bytes: 100 },
] as NetworkTransfer[] } = {}) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rsmb-metrics-test-'));
    roots.push(directory);
    let onError: (error: Error) => void = () => {};
    const pageEvents = new Map<string, (payload: unknown) => void>();
    const listeners = new Map<string, (event: unknown) => void>();
    const session = {
        send: vi.fn(async () => {}),
        on: vi.fn((event: string, listener: (event: unknown) => void) => { listeners.set(event, listener); }),
    };
    function receiveBody(requestId: string, encodedDataLength: number) {
        listeners.get('Network.dataReceived')?.({ requestId, encodedDataLength });
    }
    const resources: Array<{ name: string; encodedBodySize: number; decodedBodySize: number; transferSize: number }> = [];
    function receive(transfer: NetworkTransfer) {
        resources.push({ name: transfer.url ?? 'https://example.test/script.js', encodedBodySize: transfer.bytes, decodedBodySize: transfer.bytes * 2, transferSize: transfer.bytes + 300 });
        listeners.get('Network.responseReceived')?.({ requestId: transfer.requestId, type: transfer.type, response: { mimeType: transfer.mimeType, url: transfer.url } });
        receiveBody(transfer.requestId, transfer.bytes);
        const request = {
            resourceType: () => transfer.type.toLowerCase(),
            sizes: async () => ({ responseBodySize: transfer.bytes }),
        };
        pageEvents.get('response')?.({ request: () => request, headers: () => ({ 'content-type': transfer.mimeType }), url: () => transfer.url ?? 'https://example.test/script.js', ok: () => true });
        pageEvents.get('requestfinished')?.(request);
    }
    const locator = (name: string) => ({
        count: vi.fn(async () => Number(control === name)),
        click: vi.fn(async () => {}),
        getAttribute: vi.fn(async () => 'Filter data'),
        innerText: vi.fn(async () => 'Filter'),
        filter() { return this; }, first() { return this; },
    });
    const controls = { pause: locator('pause'), projects: locator('projects'), button: locator('button') };
    const page = {
        setDefaultTimeout: vi.fn(),
        on: vi.fn((event: string, listener: (payload: unknown) => void) => {
            pageEvents.set(event, listener);
            if (event === 'pageerror') onError = listener;
        }),
        addInitScript: vi.fn(async () => {}),
        goto: vi.fn(async () => {
            transfers.forEach(receive);
            return { status: () => status, ok: () => status >= 200 && status < 300 };
        }),
        waitForFunction: vi.fn<(predicate: () => unknown, argument?: unknown, options?: unknown) => Promise<void>>().mockResolvedValue(undefined),
        waitForTimeout: vi.fn(async () => {}),
        evaluate: vi.fn<(evaluate: () => unknown) => Promise<unknown>>()
            .mockImplementationOnce(async () => {
                if (applicationError) onError(new Error(applicationError));
                return sample().metrics;
            })
            .mockImplementationOnce(async () => resources)
            .mockResolvedValueOnce(null),
        getByRole: vi.fn((role: string, options?: { name?: string }) => role === 'link' ? controls.projects : options?.name ? controls.pause : controls.button),
        keyboard: { press: vi.fn(async () => {}) },
    };
    const context = { newPage: vi.fn(async () => page), newCDPSession: vi.fn(async () => session), close: vi.fn(async () => {}) };
    const browser = { newContext: vi.fn(async () => context), version: () => 'test Chromium', close: vi.fn(async () => {}) };
    const options = parsePerformanceOptions(['--base-url', 'https://example.test', '--samples', '1', '--paths', '/', '--out', path.join(directory, 'report.json'), '--settle-ms', '0']);
    return { browser: browser as unknown as Browser, context, page, controls, options, receive, receiveBody, resources,
        emit: (event: string, payload: unknown) => pageEvents.get(event)?.(payload) };
}

describe('body size accounting', () => {
    it('uses compressed Resource Timing bodies and excludes protocol overhead', () => {
        expect(scriptBodyBytes([{ url: '/chunk.js', contentLength: null }], [
            { name: '/chunk.js', encodedBodySize: 726, decodedBodySize: 1800, transferSize: 1026 },
        ])).toBe(726);
    });
    it('uses Content-Length for an opaque cross-origin response', () => {
        expect(scriptBodyBytes([{ url: 'https://tracker.test/script.js', contentLength: 200 }], [
            { name: 'https://tracker.test/script.js', encodedBodySize: 0, decodedBodySize: 0, transferSize: 0 },
        ])).toBe(200);
    });
    it('rejects opaque cross-origin bodies whose length is unavailable', () => {
        expect(() => scriptBodyBytes([{ url: 'https://tracker.test/script.js', contentLength: null }], []))
            .toThrow(/body size unavailable/);
    });
});

describe('measurement lifecycle', () => {
    it('allows a recoverable provider error instead of rejecting a usable map', async () => {
        const fixture = await browserFixture();
        fixture.page.waitForTimeout.mockImplementationOnce(async () => {
            fixture.emit('console', { type: () => 'error', text: () => 'MapLibre error: AJAXError: Service Unavailable (503): https://basemaps.example.test/tile.png' });
        });
        const report = await measurePerformance(fixture.options, { browser: fixture.browser, onSample: vi.fn() });
        expect(report.failedSamples).toBe(0);
        expect(report.results[0].errors).toEqual([]);
    });
    it('reports the first-party byte scope and counts external scripts separately', async () => {
        const fixture = await browserFixture({ transfers: [
            { requestId: 'application', type: 'Script', mimeType: 'text/javascript', bytes: 100 },
            { requestId: 'tracker', type: 'Script', mimeType: 'text/javascript', bytes: NaN, url: 'https://tracker.test/script.js' },
        ] });
        const report = await measurePerformance(fixture.options, { browser: fixture.browser, onSample: vi.fn() });
        expect(report.failedSamples).toBe(0);
        expect(report.conditions.scriptByteScope).toBe('same-origin encoded bodies');
        expect(report.results[0]).toMatchObject({ scriptBytes: 100, externalScriptRequests: 1 });
    });
    it('accepts a genuine empty JavaScript body reported by Resource Timing', async () => {
        const fixture = await browserFixture({ transfers: [{ requestId: 'empty-script', type: 'Script', mimeType: 'text/javascript', bytes: 0 }] });
        const report = await measurePerformance(fixture.options, { browser: fixture.browser, onSample: vi.fn() });
        expect(report.failedSamples).toBe(0);
        expect(report.results[0].scriptBytes).toBe(0);
    });
    it('rejects unavailable byte counters instead of reporting a successful zero', async () => {
        const fixture = await browserFixture({ transfers: [{ requestId: 'script', type: 'Script', mimeType: 'text/javascript', bytes: NaN }] });
        const report = await measurePerformance(fixture.options, { browser: fixture.browser, onSample: vi.fn() });
        expect(report.failedSamples).toBe(1);
        expect(report.results[0].error).toMatch(/body size unavailable/);
    });
    it('checks actual readiness callbacks without treating offscreen failures as load failures', async () => {
        const fixture = await browserFixture();
        const image = (top: number, naturalWidth: number) => ({
            complete: true, naturalWidth,
            getBoundingClientRect: () => ({ width: 100, height: 100, left: 0, right: 100, top, bottom: top + 100 }),
        });
        vi.stubGlobal('window', { innerHeight: 844, innerWidth: 390, __metrics: sample().metrics });
        vi.stubGlobal('performance', { getEntriesByType: () => fixture.resources });
        vi.stubGlobal('document', { querySelector: () => ({}), images: [image(0, 100), image(1000, 0)], fonts: { status: 'loaded' } });
        fixture.page.waitForFunction.mockImplementation(async (predicate: () => unknown) => { if (!predicate()) throw new Error('Assets not ready'); });
        fixture.page.evaluate.mockReset().mockImplementation(async (evaluate: () => unknown) => evaluate());
        const report = await measurePerformance(fixture.options, { browser: fixture.browser, onSample: vi.fn() });
        expect(report.failedSamples).toBe(0);
        expect(report.results[0]).toMatchObject({ scriptBytes: 100, sampledINP: null });
    });

    it('counts JavaScript chunks and repeated URL transfers before interaction, excluding non-script bytes', async () => {
        const fixture = await browserFixture({ control: 'pause', transfers: [
            { requestId: 'script-1', type: 'Script', mimeType: 'application/javascript', bytes: 100, url: 'https://example.test/shared.js' },
            { requestId: 'script-2', type: 'Other', mimeType: 'text/javascript', bytes: 150, url: 'https://example.test/shared.js' },
            { requestId: 'style', type: 'Stylesheet', mimeType: 'text/css', bytes: 900 },
            { requestId: 'image', type: 'Image', mimeType: 'image/svg+xml', bytes: 700 },
        ] });
        fixture.page.evaluate.mockReset().mockImplementationOnce(async () => {
            fixture.receiveBody('script-1', 25);
            fixture.receiveBody('style', 50);
            return sample().metrics;
        }).mockImplementationOnce(async () => fixture.resources).mockResolvedValueOnce(null);
        fixture.controls.pause.click.mockImplementation(async () => {
            fixture.receive({ requestId: 'interactive-script', type: 'Script', mimeType: 'application/javascript', bytes: 400 });
        });
        const report = await measurePerformance(fixture.options, { browser: fixture.browser, onSample: vi.fn() });
        expect(report.failedSamples).toBe(0);
        expect(report.results[0].scriptBytes).toBe(250);
    });

    it.each([200, 503])('persists cleanup failures without counting the HTTP %s sample twice', async status => {
        const fixture = await browserFixture({ status });
        fixture.context.close.mockRejectedValue(new Error('Context close failed'));
        const report = await measurePerformance(fixture.options, { browser: fixture.browser, onSample: vi.fn() });
        expect(report.failedSamples).toBe(1);
        expect(report.results[0]).toMatchObject({ status, error: expect.stringContaining('Browser context cleanup failed: Context close failed') });
        expect(JSON.parse(await fs.readFile(fixture.options.outputPath, 'utf8'))).toEqual(report);
    });

    it('persists a failed HTTP sample and does not attempt an interaction', async () => {
        const fixture = await browserFixture({ status: 503 });
        const report = await measurePerformance(fixture.options, { browser: fixture.browser, onSample: vi.fn() });
        expect(report).toMatchObject({ failedSamples: 1, results: [{ status: 503, error: 'HTTP 503', metrics: null }] });
        expect(JSON.parse(await fs.readFile(fixture.options.outputPath, 'utf8'))).toEqual(report);
        expect(fixture.page.waitForFunction).not.toHaveBeenCalled();
        expect(fixture.context.close).toHaveBeenCalledOnce();
        expect(fixture.browser.close).not.toHaveBeenCalled();
    });

    it('marks an application crash as a failed sample', async () => {
        const fixture = await browserFixture({ applicationError: 'Application crashed' });
        const report = await measurePerformance(fixture.options, { browser: fixture.browser, onSample: vi.fn() });
        expect(report).toMatchObject({ failedSamples: 1, results: [{ errors: ['Application crashed'], error: expect.stringContaining('Application crashed') }] });
        expect(fixture.page.keyboard.press).not.toHaveBeenCalled();
    });

    it('rejects a basemap-only sample when the map worker returns 404', async () => {
        const fixture = await browserFixture();
        fixture.page.waitForTimeout.mockImplementationOnce(async () => {
            fixture.emit('response', { url: () => 'https://example.test/assets/maplibre-gl-worker.mjs', ok: () => false, status: () => 404 });
        });
        const report = await measurePerformance(fixture.options, { browser: fixture.browser, onSample: vi.fn() });
        expect(report).toMatchObject({ failedSamples: 1, results: [{ errors: ['Map worker HTTP 404'] }] });
        expect(fixture.page.keyboard.press).not.toHaveBeenCalled();
    });

    it('rejects map initialization errors reported through the console', async () => {
        const fixture = await browserFixture();
        fixture.page.waitForTimeout.mockImplementationOnce(async () => {
            fixture.emit('console', { type: () => 'error', text: () => 'MapLibre error: Worker failed to load' });
        });
        const report = await measurePerformance(fixture.options, { browser: fixture.browser, onSample: vi.fn() });
        expect(report.failedSamples).toBe(1);
    });

    it.each(['pause', 'projects', 'button', 'none'])('records a successful %s interaction without inventing INP', async control => {
        const fixture = await browserFixture({ control });
        const report = await measurePerformance(fixture.options, { browser: fixture.browser, onSample: vi.fn() });
        expect(report.failedSamples).toBe(0);
        expect(report.results[0]).toMatchObject({ metrics: sample().metrics, sampledINP: null });
        if (control === 'none') expect(fixture.page.keyboard.press).toHaveBeenCalledWith('Tab');
        else expect(fixture.controls[control as keyof typeof fixture.controls].click).toHaveBeenCalledOnce();
        expect(fixture.context.close).toHaveBeenCalledOnce();
    });

    it('closes an owned browser after a failed navigation', async () => {
        const fixture = await browserFixture();
        fixture.page.goto.mockRejectedValue(new Error('Network unavailable'));
        vi.spyOn(chromium, 'launch').mockResolvedValue(fixture.browser);
        const report = await measurePerformance(fixture.options, { onSample: vi.fn() });
        expect(report).toMatchObject({ failedSamples: 1, results: [{ error: 'Network unavailable', status: null }] });
        expect(fixture.browser.close).toHaveBeenCalledOnce();
    });

    it('closes the browser context when persisting the report fails', async () => {
        const fixture = await browserFixture();
        vi.spyOn(fs, 'writeFile').mockRejectedValue(new Error('Disk full'));
        await expect(measurePerformance(fixture.options, { browser: fixture.browser, onSample: vi.fn() })).rejects.toThrow('Disk full');
        expect(fixture.context.close).toHaveBeenCalledOnce();
    });

    it('records context creation failures and continues with the remaining samples', async () => {
        const fixture = await browserFixture();
        vi.mocked(fixture.browser.newContext).mockRejectedValueOnce(new Error('Context creation failed'));
        fixture.options.paths = ['/first', '/second'];
        const report = await measurePerformance(fixture.options, { browser: fixture.browser, onSample: vi.fn() });
        expect(report.failedSamples).toBe(1);
        expect(report.results).toMatchObject([
            { route: '/first', status: null, error: 'Context creation failed' },
            { route: '/second', status: 200 },
        ]);
        expect(fixture.context.close).toHaveBeenCalledOnce();
        expect(JSON.parse(await fs.readFile(fixture.options.outputPath, 'utf8'))).toEqual(report);
    });

    it('persists owned-browser cleanup failures separately from sample failures', async () => {
        const fixture = await browserFixture();
        vi.spyOn(chromium, 'launch').mockResolvedValue(fixture.browser);
        vi.mocked(fixture.browser.close).mockRejectedValue(new Error('Browser close failed'));
        const report = await measurePerformance(fixture.options, { onSample: vi.fn() });
        expect(report).toMatchObject({ failedSamples: 0, errors: ['Browser cleanup failed: Browser close failed'] });
        expect(report.results).toHaveLength(1);
        expect(JSON.parse(await fs.readFile(fixture.options.outputPath, 'utf8'))).toEqual(report);
    });
});
