// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { measurePerformance, parsePerformanceOptions, validatePerformanceSample } from '../measure-performance.js';

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

async function browserFixture({ status = 200, applicationError = '', control = 'none' } = {}) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rsmb-metrics-test-'));
    roots.push(directory);
    let onError: (error: Error) => void = () => {};
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
        on: vi.fn((_event: string, listener: (error: Error) => void) => { onError = listener; }),
        addInitScript: vi.fn(async () => {}),
        goto: vi.fn(async () => ({ status: () => status, ok: () => status >= 200 && status < 300 })),
        waitForFunction: vi.fn<(predicate: () => unknown, argument?: unknown, options?: unknown) => Promise<void>>().mockResolvedValue(undefined),
        waitForTimeout: vi.fn(async () => {}),
        evaluate: vi.fn<(evaluate: () => unknown) => Promise<unknown>>()
            .mockImplementationOnce(async () => {
                if (applicationError) onError(new Error(applicationError));
                return { metrics: sample().metrics, scriptBytes: 100 };
            })
            .mockResolvedValueOnce(null),
        getByRole: vi.fn((role: string, options?: { name?: string }) => role === 'link' ? controls.projects : options?.name ? controls.pause : controls.button),
        keyboard: { press: vi.fn(async () => {}) },
    };
    const context = { newPage: vi.fn(async () => page), newCDPSession: vi.fn(async () => ({ send: vi.fn(async () => {}) })), close: vi.fn(async () => {}) };
    const browser = { newContext: vi.fn(async () => context), version: () => 'test Chromium', close: vi.fn(async () => {}) };
    const options = parsePerformanceOptions(['--samples', '1', '--paths', '/', '--out', path.join(directory, 'report.json'), '--settle-ms', '0']);
    return { browser: browser as unknown as Browser, context, page, controls, options };
}

describe('measurement lifecycle', () => {
    it('checks actual readiness callbacks and counts script bodies without treating offscreen failures as load failures', async () => {
        const fixture = await browserFixture();
        const image = (top: number, naturalWidth: number) => ({
            complete: true, naturalWidth,
            getBoundingClientRect: () => ({ width: 100, height: 100, left: 0, right: 100, top, bottom: top + 100 }),
        });
        vi.stubGlobal('window', { innerHeight: 844, innerWidth: 390, __metrics: sample().metrics });
        vi.stubGlobal('document', { querySelector: () => ({}), images: [image(0, 100), image(1000, 0)], fonts: { status: 'loaded' } });
        const entries = performance.getEntriesByType.bind(performance);
        vi.spyOn(performance, 'getEntriesByType').mockImplementation(type => type === 'resource' ? [
            { initiatorType: 'script', encodedBodySize: 100 },
            { initiatorType: 'link', encodedBodySize: 900 },
        ] as unknown as ReturnType<typeof performance.getEntriesByType> : entries(type));
        fixture.page.waitForFunction.mockImplementation(async (predicate: () => unknown) => { if (!predicate()) throw new Error('Assets not ready'); });
        fixture.page.evaluate.mockReset().mockImplementation(async (evaluate: () => unknown) => evaluate());
        const report = await measurePerformance(fixture.options, { browser: fixture.browser, onSample: vi.fn() });
        expect(report.failedSamples).toBe(0);
        expect(report.results[0]).toMatchObject({ scriptBytes: 100, sampledINP: null });
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
});
