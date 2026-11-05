// @vitest-environment node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyTornadoPublication } from '../verify-tornado-publication.js';
import packageJson from '../../package.json';

const annual = [{ year: 2025, count: 1, unknown: 0, ef0: 0, ef1: 0, ef2: 1, ef3: 0, ef4: 0, ef5: 0,
    ef1Plus: 1, ef2Plus: 1, deaths: 0, injuries: 0, trackMiles: 1, medianWidthYards: 100 }];
const index = { version: 1, groups: [{ year: 2025, state: 'MO', scale: 2, count: 1, deaths: 0, injuries: 0,
    trackMiles: 1, widths: [[100, 1]] }] };
const roots: string[] = [];
const json = (value: unknown) => new Response(JSON.stringify(value));

afterEach(async () => {
    vi.useRealTimers();
    await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe('tornado release publication check', () => {
    it('verifies both files at the same configured data prefix', async () => {
        const fetchImpl = vi.fn(async (url: URL) => json(url.pathname.endsWith('annual-summary.json') ? annual : index));
        expect(await verifyTornadoPublication({ baseUrl: 'https://example.test/custom/tornadoes/', fetchImpl }))
            .toEqual({ years: 1, groups: 1 });
        expect(fetchImpl.mock.calls.map(([url]) => url.href)).toEqual([
            'https://example.test/custom/tornadoes/annual-summary.json', 'https://example.test/custom/tornadoes/trend-index.json',
        ]);
    });

    it.each([404, 503])('blocks a release when the new artifact returns HTTP %s', async status => {
        const fetchImpl = vi.fn(async (url: URL) => url.pathname.endsWith('annual-summary.json') ? json(annual) : new Response(null, { status }));
        await expect(verifyTornadoPublication({ fetchImpl })).rejects.toMatchObject({
            message: expect.stringContaining('Publish matching'), cause: { message: `trend-index.json: HTTP ${status}` },
        });
    });

    it.each([{}, { version: 1, groups: [] }, { version: 1, groups: [{ ...index.groups[0], year: 2024 }] }])(
        'blocks malformed or incompatible publication: %j', async value => {
            await expect(verifyTornadoPublication({ fetchImpl: async (url: URL) => json(url.pathname.endsWith('annual-summary.json') ? annual : value) }))
                .rejects.toThrow('publication check failed');
        },
    );

    it.each(['file:///tmp/data', 'https://user:password@example.test/data', 'https://example.test/data?key=example',
        'https://example.test/data#fragment'])('rejects unsupported publication location %s', async baseUrl => {
        const fetchImpl = vi.fn();
        await expect(verifyTornadoPublication({ baseUrl, fetchImpl })).rejects.toThrow('publication check failed');
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each(['annual-summary.json', 'trend-index.json'])('bounds stalled %s body reads', async stalled => {
        vi.useFakeTimers();
        const fetchImpl = vi.fn(async (url: URL, options: RequestInit) => {
            if (!url.pathname.endsWith(stalled)) return json(annual);
            return new Response(new ReadableStream({
                start(controller) {
                    options.signal!.addEventListener('abort', () => controller.error(options.signal!.reason), { once: true });
                },
            }));
        });
        const rejected = expect(verifyTornadoPublication({ fetchImpl, timeoutMs: 25 })).rejects.toMatchObject({
            cause: { message: `${stalled}: Tornado publication request timed out.` },
        });
        await vi.advanceTimersByTimeAsync(30);
        await rejected;
        expect(vi.getTimerCount()).toBe(0);
    });

    it('supports bundled data and rejects directory and file symlink escapes', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tornado-publication-'));
        roots.push(root);
        const publicRoot = path.join(root, 'public');
        const directory = path.join(publicRoot, 'data/tornadoes');
        const privateRoot = path.join(root, 'private');
        await fs.mkdir(directory, { recursive: true });
        await fs.mkdir(privateRoot);
        await fs.writeFile(path.join(directory, 'annual-summary.json'), JSON.stringify(annual));
        await fs.writeFile(path.join(directory, 'trend-index.json'), JSON.stringify(index));
        expect(await verifyTornadoPublication({ baseUrl: '/data/tornadoes', publicRoot })).toEqual({ years: 1, groups: 1 });
        await fs.writeFile(path.join(publicRoot, 'annual-summary.json'), JSON.stringify(annual));
        await fs.writeFile(path.join(publicRoot, 'trend-index.json'), JSON.stringify(index));
        expect(await verifyTornadoPublication({ baseUrl: '/', publicRoot })).toEqual({ years: 1, groups: 1 });
        await fs.symlink(privateRoot, path.join(publicRoot, 'escape'));
        await expect(verifyTornadoPublication({ baseUrl: '/escape', publicRoot })).rejects.toMatchObject({
            cause: { message: 'Tornado data must be inside public/.' },
        });
        await fs.writeFile(path.join(privateRoot, 'index.json'), JSON.stringify(index));
        await fs.unlink(path.join(directory, 'trend-index.json'));
        await fs.symlink(path.join(privateRoot, 'index.json'), path.join(directory, 'trend-index.json'));
        await expect(verifyTornadoPublication({ baseUrl: '/data/tornadoes', publicRoot })).rejects.toMatchObject({
            cause: { message: 'Tornado data must be inside public/.' },
        });
        await expect(verifyTornadoPublication({ baseUrl: '/data?key=example', publicRoot })).rejects.toThrow('publication check failed');
    });

    it('checks publication before both release builds', () => {
        for (const script of [packageJson.scripts.build, packageJson.scripts['build:dev']]) {
            expect(script).toContain('npm run verify-tornado-publication');
            expect(script.indexOf('verify-tornado-publication')).toBeLessThan(script.indexOf('vite build'));
        }
        expect(packageJson.scripts['build:dev']).toContain('verify-tornado-publication -- --mode development');
    });
});
