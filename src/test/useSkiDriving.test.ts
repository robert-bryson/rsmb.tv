import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { drivingProviders, drivingRefreshMs } from '../../shared/skiDriving';
import { loadDrivingFeed, type DrivingFeed } from '../features/ski-status/driving-feed';
import { roadReportState } from '../features/ski-status/drivingView';
import { useSkiDriving } from '../features/ski-status/useSkiDriving';

vi.mock('../features/ski-status/driving-feed', () => ({ loadDrivingFeed: vi.fn() }));

const load = vi.mocked(loadDrivingFeed);
const checkedAt = '2026-11-22T12:00:00Z';
const ready: DrivingFeed = { providers: { drivebc: {
    reports: { file: 'fixture', data: { version: 1, provider: 'drivebc', checkedAt, entries: [] } },
    reportsReady: true, camerasReady: false,
} } };

function pendingFeed() {
    let resolve!: (feed: DrivingFeed) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<DrivingFeed>((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
    return { promise, resolve, reject };
}

beforeEach(() => {
    load.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(checkedAt));
});

afterEach(() => vi.useRealTimers());

it('rechecks cached reports when the same scope reopens', async () => {
    const retry = pendingFeed();
    load.mockResolvedValueOnce(ready).mockReturnValueOnce(retry.promise);
    const { result, rerender } = renderHook(({ enabled }) => useSkiDriving(enabled, 'drivebc'), { initialProps: { enabled: true } });
    await waitFor(() => expect(roadReportState(result.current, 'drivebc')).toBe('current'));
    const firstSignal = load.mock.lastCall?.[2];

    rerender({ enabled: false });
    expect(result.current.feedStatus).toBe('idle');
    expect(firstSignal?.aborted).toBe(true);
    rerender({ enabled: true });
    expect(roadReportState(result.current, 'drivebc')).toBe('checking');
    expect(result.current.feed).toBe(ready);
    await waitFor(() => expect(load).toHaveBeenLastCalledWith(ready, ['drivebc'], expect.any(AbortSignal)));

    await act(async () => retry.reject(Error('Network unavailable')));
    expect(roadReportState(result.current, 'drivebc')).toBe('unavailable');
    expect(result.current.feed).toBe(ready);
});

it('ignores an abandoned request and refreshes the active provider scope', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const abandoned = pendingFeed();
    const refreshed = { providers: {} };
    load.mockReturnValueOnce(abandoned.promise).mockResolvedValueOnce(ready).mockResolvedValueOnce(refreshed);
    const { result, rerender, unmount } = renderHook(({ scope }: { scope: 'all' | 'drivebc' }) => useSkiDriving(true, scope),
        { initialProps: { scope: 'all' } });
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(load).toHaveBeenNthCalledWith(1, { providers: {} }, drivingProviders, expect.any(AbortSignal));
    const firstSignal = load.mock.calls[0][2];

    rerender({ scope: 'drivebc' });
    expect(result.current.feedStatus).toBe('checking');
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(roadReportState(result.current, 'drivebc')).toBe('current');
    expect(firstSignal.aborted).toBe(true);

    await act(async () => abandoned.resolve({ providers: {} }));
    expect(result.current.feed).toBe(ready);
    await act(async () => vi.advanceTimersByTimeAsync(drivingRefreshMs));
    expect(load).toHaveBeenCalledTimes(3);
    expect(load).toHaveBeenLastCalledWith(ready, ['drivebc'], expect.any(AbortSignal));
    expect(result.current.feed).toBe(refreshed);
    unmount();
    expect(load.mock.lastCall?.[2].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
});
