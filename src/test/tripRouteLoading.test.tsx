import { StrictMode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearTripRouteCache, useTripRoute } from '../features/trips/useTripRoute';
const route = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } };

afterEach(() => { cleanup(); clearTripRouteCache(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('trip route loading', () => {
    it('waits until enabled and shares a successful request across Strict Mode and map instances', async () => {
        const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => route });
        vi.stubGlobal('fetch', fetch);
        const first = renderHook(({ enabled }) => useTripRoute('/route', enabled), { initialProps: { enabled: false }, wrapper: StrictMode });
        expect(fetch).not.toHaveBeenCalled();
        first.rerender({ enabled: true });
        await waitFor(() => expect(first.result.current.route).toEqual(route));
        first.unmount();
        const second = renderHook(() => useTripRoute('/route'), { wrapper: StrictMode });
        await waitFor(() => expect(second.result.current.route).toEqual(route));
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('allows retry after a failed request', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({ ok: true, json: async () => route }));
        const { result } = renderHook(() => useTripRoute('/retry'));
        await waitFor(() => expect(result.current.error).toContain('503'));
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.route).toEqual(route));
        expect(result.current.error).toBe('');
    });

    it('aborts a stalled request after ten seconds with a recoverable message', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn((_url, { signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason));
        })));
        const { result } = renderHook(() => useTripRoute('/slow'));
        await act(() => vi.advanceTimersByTimeAsync(10_000));
        expect(result.current.error).toContain('timed out');
        expect(result.current.route).toBeNull();
    });

    it('aborts an unused pending request when retry replaces it', async () => {
        const signals: AbortSignal[] = [];
        vi.stubGlobal('fetch', vi.fn((_url, { signal }: { signal: AbortSignal }) => {
            signals.push(signal);
            return new Promise((_resolve, reject) => {
                signal.addEventListener('abort', () => reject(signal.reason));
            });
        }));
        const { result } = renderHook(() => useTripRoute('/pending'));
        await act(async () => result.current.retry());
        expect(signals).toHaveLength(2);
        expect(signals[0].aborted).toBe(true);
        expect(signals[1].aborted).toBe(false);
    });

    it('evicts released routes when active readers exceed the cache limit', async () => {
        const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => route });
        vi.stubGlobal('fetch', fetch);
        const readers = Array.from({ length: 9 }, (_, index) => renderHook(() => useTripRoute(`/route-${index}`)));
        await waitFor(() => readers.forEach(reader => expect(reader.result.current.route).toEqual(route)));
        await act(async () => readers.forEach(reader => reader.unmount()));
        const first = renderHook(() => useTripRoute('/route-0'));
        await waitFor(() => expect(first.result.current.route).toEqual(route));
        expect(fetch).toHaveBeenCalledTimes(10);
    });
});
