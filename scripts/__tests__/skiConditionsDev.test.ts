// @vitest-environment node
import { resolve } from 'node:path';
import type { Connect, ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { skiConditionsDevPlugin } from '../ski-conditions-dev-plugin';
import { skiConditionsRefreshWaitMs } from '../../shared/skiConditionsCache';

const { collect, stat } = vi.hoisted(() => ({
    collect: vi.fn<(...args: unknown[]) => Promise<void>>(),
    stat: vi.fn<(path: string) => Promise<{ mtimeMs: number }>>(),
}));
vi.mock('node:fs/promises', async importOriginal => ({ ...await importOriginal<typeof import('node:fs/promises')>(), stat }));
vi.mock('node:child_process', async importOriginal => ({
    ...await importOriginal<typeof import('node:child_process')>(),
    execFile: (file: string, args: string[], options: object, callback: (error?: Error | null) => void) => {
        void collect(file, args, options).then(() => callback(null), callback);
    },
}));

const root = process.cwd();
const now = Date.parse('2026-11-21T16:00:00Z');
const manifest = '/.cache/ski-status/manifest.json';
const collector = ['--import', 'tsx/esm', 'projects/ski-status/scripts/sync-conditions.ts'];

function configure(mode = '1') {
    const use = vi.fn<(middleware: Connect.NextHandleFunction) => void>();
    const warn = vi.fn();
    const plugin = skiConditionsDevPlugin(mode);
    const setup = plugin.configureServer;
    if (typeof setup !== 'function') throw Error('Missing ski conditions middleware');
    const server = { config: { root, logger: { warn } }, middlewares: { use } } as unknown as ViteDevServer;
    setup.call({} as ThisParameterType<typeof setup>, server);
    function request(url = manifest, method = 'GET') {
        const middleware = use.mock.calls[0][0];
        return new Promise<void>((done, failed) => middleware({ url, method } as Parameters<Connect.NextHandleFunction>[0],
            {} as Parameters<Connect.NextHandleFunction>[1], error => { if (error) failed(error); else done(); }));
    }
    return { use, warn, request };
}

describe('local ski conditions', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(now);
        collect.mockReset().mockResolvedValue(undefined);
        stat.mockReset().mockResolvedValue({ mtimeMs: now });
    });

    afterEach(() => vi.useRealTimers());

    it('uses a recent cache and skips unrelated requests', async () => {
        const { request } = configure();
        await request('/projects/ski-status/map');
        await request(manifest, 'HEAD');
        expect(stat).not.toHaveBeenCalled();
        await request(`${manifest}?version=1`);
        expect(stat).toHaveBeenCalledWith(resolve(root, '.cache/ski-status/manifest.json'));
        expect(collect).not.toHaveBeenCalled();
    });

    it('fills a missing cache before serving the manifest and shares the refresh across requests', async () => {
        const { request } = configure();
        stat.mockRejectedValue(Object.assign(Error('No manifest'), { code: 'ENOENT' }));
        let finish!: () => void;
        const active = new Promise<void>(resolve => { finish = resolve; });
        collect.mockReturnValue(active);
        const served = vi.fn();
        const first = request().then(served);
        const second = request().then(served);
        await vi.waitFor(() => expect(collect).toHaveBeenCalledWith(process.execPath, collector, { cwd: root }));
        expect(collect).toHaveBeenCalledTimes(1);
        expect(served).not.toHaveBeenCalled();
        finish();
        await Promise.all([first, second]);
        expect(served).toHaveBeenCalledTimes(2);
    });

    it('serves the cache after a failed refresh and retries after five minutes', async () => {
        const { request, warn } = configure();
        stat.mockResolvedValue({ mtimeMs: now - 60 * 60_000 });
        collect.mockRejectedValueOnce(Error('Network unavailable'));
        await request();
        await request();
        expect(collect).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Network unavailable'));
        vi.setSystemTime(now + 5 * 60_000);
        await request();
        expect(collect).toHaveBeenCalledTimes(2);
    });

    it('releases a manifest request at the deadline and keeps one collector running', async () => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
        const { request } = configure();
        stat.mockResolvedValue({ mtimeMs: now - 2 * 60 * 60_000 });
        let finish!: () => void;
        collect.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
        const served = vi.fn();
        const pending = request().then(served);
        await vi.advanceTimersByTimeAsync(skiConditionsRefreshWaitMs - 1);
        expect(served).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await pending;
        expect(served).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);

        const following = request();
        await vi.advanceTimersByTimeAsync(0);
        finish();
        await following;
        expect(collect).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('selects the Rockies cache explicitly and skips local refreshes in hosted mode', async () => {
        expect(configure('0').use).not.toHaveBeenCalled();
        const { request } = configure('rockies');
        stat.mockResolvedValue({ mtimeMs: now - 2 * 60 * 60_000 });
        await request(manifest);
        expect(collect).not.toHaveBeenCalled();
        await request('/.cache/ski-status-rockies/manifest.json');
        expect(collect).toHaveBeenCalledWith(process.execPath, [...collector, '--rockies-pilot'], { cwd: root });
    });
});
