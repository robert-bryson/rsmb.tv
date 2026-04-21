import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAwsPoll } from '../useAwsPoll.js';
import { addEvent } from '../useEventLog.js';

vi.mock('../useEventLog.js', () => ({
    addEvent: vi.fn(),
}));

describe('useAwsPoll', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('does not emit cold-start error events before any successful fetch', async () => {
        const fetcher = vi.fn().mockRejectedValue(new Error('network down'));

        const { result } = renderHook(() => useAwsPoll(fetcher, 60_000, 'Health'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toBe('network down');
        expect(addEvent).not.toHaveBeenCalled();
    });

    it('emits recovery using the latest source after source prop changes', async () => {
        const fetcher = vi
            .fn<() => Promise<{ ok: boolean }>>()
            .mockResolvedValueOnce({ ok: true })
            .mockRejectedValueOnce(new Error('outage'))
            .mockResolvedValueOnce({ ok: true });

        const { result, rerender } = renderHook(
            ({ source }: { source: string }) => useAwsPoll(fetcher, 60_000, source),
            { initialProps: { source: 'Health' } },
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.error).toBeNull();
        });

        act(() => {
            result.current.refresh();
        });

        await waitFor(() => {
            expect(result.current.error).toBe('outage');
        });

        expect(addEvent).toHaveBeenCalledWith('error', 'Health', 'outage');

        rerender({ source: 'Health v2' });

        act(() => {
            result.current.refresh();
        });

        await waitFor(() => {
            expect(result.current.error).toBeNull();
        });

        expect(addEvent).toHaveBeenCalledWith('info', 'Health v2', 'Recovered');
    });
});