import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIntentScheduler, canPrefetch } from '../navigation/intentPrefetch';
import { moduleLoader, settlePreparation } from '../navigation/moduleLoader';
import type { PrefetchTarget } from '../navigation/prefetchTargets';

const target = (key: string, map?: PrefetchTarget['map']): PrefetchTarget => ({ key, page: key as PrefetchTarget['page'], search: '', map });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('shares module promises across preparation and navigation, and retries an application-level rejection', async () => {
    const first = deferred();
    const load = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue({ default: 'page' });
    const shared = moduleLoader(load);
    const pending = shared();
    expect(shared()).toBe(pending);
    first.resolve(); await pending;
    expect(shared()).toBe(pending);
    expect(load).toHaveBeenCalledTimes(1);
    const retry = moduleLoader(vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue('ok'));
    await expect(retry()).rejects.toThrow('network');
    await expect(retry()).resolves.toBe('ok');
});

it('keeps preparation pending until all started resources finish even after an early failure', async () => {
    const resource = deferred(); const completed = vi.fn();
    const preparation = settlePreparation([Promise.reject(new Error('failed')), resource.promise]);
    void preparation.catch(completed);
    await vi.advanceTimersByTimeAsync(0); expect(completed).not.toHaveBeenCalled();
    resource.resolve(); await expect(preparation).rejects.toThrow('failed');
});

describe('intent scheduling', () => {
    function setup(prepare = vi.fn().mockResolvedValue(undefined)) {
        const canStart = vi.fn(() => true);
        const scheduler = createIntentScheduler({ prepare, canStart, rollout: () => 'all' });
        return { scheduler, prepare, canStart };
    }

    it('does nothing for short intent or canceled intent and uses the appropriate dwell', async () => {
        const { scheduler, prepare } = setup();
        const cancel = scheduler.schedule(target('/about'), 'page');
        await vi.advanceTimersByTimeAsync(149); expect(prepare).not.toHaveBeenCalled();
        cancel(); await vi.advanceTimersByTimeAsync(1); expect(prepare).not.toHaveBeenCalled();
        scheduler.schedule(target('/projects/flights/map', 'flights'), 'destination');
        await vi.advanceTimersByTimeAsync(299); expect(prepare).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ map: 'flights' }), true, true);
    });

    it('shares active work, retains only two waiting destinations, and drops expired owners', async () => {
        const hold = deferred();
        const { scheduler, prepare } = setup(vi.fn().mockImplementationOnce(() => hold.promise).mockResolvedValue(undefined));
        scheduler.schedule(target('/about'), 'page'); await vi.advanceTimersByTimeAsync(150);
        scheduler.schedule(target('/about'), 'page');
        scheduler.schedule(target('/posts'), 'page'); await vi.advanceTimersByTimeAsync(150);
        const cancel = scheduler.schedule(target('/projects'), 'page');
        scheduler.schedule(target('/projects/bookend'), 'page'); await vi.advanceTimersByTimeAsync(150);
        expect(scheduler.diagnostics().queued).toBe(2);
        cancel(); hold.resolve(); await vi.advanceTimersByTimeAsync(0);
        expect(prepare.mock.calls.map(args => args[0].key)).toEqual(['/about', '/projects/bookend']);
    });

    it('checks policy again before starting queued work, and never retains a rejected job', async () => {
        const { scheduler, prepare, canStart } = setup(vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined));
        scheduler.schedule(target('/about'), 'page'); await vi.advanceTimersByTimeAsync(150);
        expect(scheduler.diagnostics().outcomes).toContainEqual({ key: '/about', outcome: 'failed' });
        scheduler.schedule(target('/about'), 'page'); await vi.advanceTimersByTimeAsync(150);
        expect(prepare).toHaveBeenCalledTimes(2);
        canStart.mockReturnValue(false);
        scheduler.schedule(target('/posts'), 'page'); await vi.advanceTimersByTimeAsync(150);
        expect(prepare).toHaveBeenCalledTimes(2);
    });

    it('caps distinct heavy map attempts and clears waiting work without aborting active readers', async () => {
        const { scheduler, prepare } = setup();
        for (const map of ['flights', 'temperatures', 'tornadoes'] as const) {
            scheduler.schedule(target(`/map/${map}`, map), 'destination'); await vi.advanceTimersByTimeAsync(300);
        }
        expect(prepare).toHaveBeenCalledTimes(2);
        scheduler.schedule(target('/posts'), 'page'); scheduler.cancelPending();
        await vi.advanceTimersByTimeAsync(300);
        expect(prepare).toHaveBeenCalledTimes(2);
        expect(scheduler.diagnostics()).toMatchObject({ queued: 0, timers: 0, heavyMaps: 2 });
    });

    it('supports off and page-only rollout without starting nested renderers', async () => {
        const prepare = vi.fn().mockResolvedValue(undefined);
        let rollout: 'off' | 'pages' = 'off';
        const scheduler = createIntentScheduler({ prepare, canStart: () => true, rollout: () => rollout });
        scheduler.schedule(target('/about'), 'page'); await vi.advanceTimersByTimeAsync(1000);
        expect(prepare).not.toHaveBeenCalled();
        rollout = 'pages';
        scheduler.schedule(target('/projects/flights/map', 'flights'), 'destination'); await vi.advanceTimersByTimeAsync(150);
        expect(prepare).toHaveBeenCalledWith(expect.anything(), true, false);
    });

    it('retains another owner of a queued destination after one link loses intent', async () => {
        const hold = deferred();
        const { scheduler, prepare } = setup(vi.fn().mockImplementationOnce(() => hold.promise).mockResolvedValue(undefined));
        scheduler.schedule(target('/about'), 'page'); await vi.advanceTimersByTimeAsync(150);
        const cancel = scheduler.schedule(target('/posts'), 'destination');
        scheduler.schedule(target('/posts'), 'destination'); await vi.advanceTimersByTimeAsync(150);
        cancel(); hold.resolve(); await vi.advanceTimersByTimeAsync(0);
        expect(prepare.mock.calls.map(args => args[0].key)).toEqual(['/about', '/posts']);
    });

    it('downgrades queued heavy work when the rollout is restricted before it starts', async () => {
        const hold = deferred();
        const prepare = vi.fn().mockImplementationOnce(() => hold.promise).mockResolvedValue(undefined);
        let policy: 'all' | 'pages' = 'all';
        const scheduler = createIntentScheduler({ prepare, canStart: () => true, rollout: () => policy });
        scheduler.schedule(target('/about'), 'page'); await vi.advanceTimersByTimeAsync(150);
        scheduler.schedule(target('/flights', 'flights'), 'destination'); await vi.advanceTimersByTimeAsync(300);
        policy = 'pages'; hold.resolve(); await vi.advanceTimersByTimeAsync(0);
        expect(prepare).toHaveBeenLastCalledWith(expect.objectContaining({ map: 'flights' }), true, false);
        expect(scheduler.diagnostics().heavyMaps).toBe(0);
    });

    it('checks readiness again when active work finishes and bounds diagnostic history', async () => {
        const hold = deferred();
        const { scheduler, prepare, canStart } = setup(vi.fn().mockImplementationOnce(() => hold.promise).mockResolvedValue(undefined));
        scheduler.schedule(target('/about'), 'page'); await vi.advanceTimersByTimeAsync(150);
        scheduler.schedule(target('/posts'), 'page'); await vi.advanceTimersByTimeAsync(150);
        canStart.mockReturnValue(false); hold.resolve(); await vi.advanceTimersByTimeAsync(0);
        expect(prepare).toHaveBeenCalledTimes(1);
        expect(scheduler.diagnostics().outcomes).toContainEqual({ key: '/posts', outcome: 'skipped' });
        for (let i = 0; i < 35; i++) {
            scheduler.schedule(target(`/skip/${i}`), 'page'); await vi.advanceTimersByTimeAsync(150);
        }
        expect(scheduler.diagnostics().outcomes).toHaveLength(32);
        expect(scheduler.diagnostics().outcomes[0].key).toBe('/skip/3');
    });
});

it('feature detects connection hints and blocks heavy work while a foreground map is loading', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    Object.defineProperty(navigator, 'connection', { configurable: true, get: () => undefined });
    const connection = vi.spyOn(navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }, 'connection', 'get');
    connection.mockReturnValue(undefined);
    expect(canPrefetch(false)).toBe(true);
    connection.mockReturnValue({ saveData: true }); expect(canPrefetch(false)).toBe(false);
    connection.mockReturnValue({ effectiveType: '2g' }); expect(canPrefetch(false)).toBe(false);
    connection.mockReturnValue(undefined);
    const map = document.createElement('div'); map.dataset.mapState = 'loading'; document.body.append(map);
    expect(canPrefetch(false)).toBe(true); expect(canPrefetch(true)).toBe(false);
    map.remove();
});

it('protects document loading, offline state, hidden tabs, and visible image loading', () => {
    const ready = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    expect(canPrefetch(false)).toBe(false);
    ready.mockReturnValue('complete'); online.mockReturnValue(false);
    expect(canPrefetch(false)).toBe(false);
    online.mockReturnValue(true); visibility.mockReturnValue('hidden');
    expect(canPrefetch(false)).toBe(false);
    visibility.mockReturnValue('visible');
    const image = document.createElement('img');
    vi.spyOn(image, 'complete', 'get').mockReturnValue(false);
    const box = vi.spyOn(image, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 10, 100, 100));
    document.body.append(image);
    expect(canPrefetch(false)).toBe(false);
    box.mockReturnValue(new DOMRect(10, innerHeight + 100, 100, 100));
    expect(canPrefetch(false)).toBe(true);
    image.remove();
});
