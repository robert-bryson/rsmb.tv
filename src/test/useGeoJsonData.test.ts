import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGeoJsonData } from '../features/flights/hooks/useGeoJsonData';
import { clearCache } from '../features/flights/utils/fetchCache';
import { jsonFetchResponse } from './helpers/fetch';

describe('useGeoJsonData', () => {
    beforeEach(() => {
        clearCache();
        vi.restoreAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    it('starts in loading state', () => {
        // Keep request pending so the assertion only checks initial hook state.
        globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => { }));

        const { result, unmount } = renderHook(() => useGeoJsonData('test.geojson'));
        expect(result.current.loading).toBe(true);
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeNull();

        unmount();
    });

    it('fetches and returns data', async () => {
        const mockData = { type: 'FeatureCollection', features: [{ id: 1 }] };
        globalThis.fetch = vi.fn().mockResolvedValue(jsonFetchResponse(mockData));

        const { result } = renderHook(() => useGeoJsonData('airports.geojson'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.data).toEqual(mockData);
        expect(result.current.error).toBeNull();
    });

    it('does not fetch while disabled', () => {
        globalThis.fetch = vi.fn();

        const { result } = renderHook(() => useGeoJsonData('airports.geojson', { enabled: false }));

        expect(result.current.loading).toBe(false);
        expect(result.current.data).toBeNull();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('re-enters loading state when an enabled request retries after failure', async () => {
        let resolveRetry!: (value: Response) => void;
        globalThis.fetch = vi
            .fn()
            .mockRejectedValueOnce(new Error('Network error'))
            .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveRetry = resolve; }));

        const { result, rerender } = renderHook(
            ({ enabled }) => useGeoJsonData('airports.geojson', { enabled }),
            { initialProps: { enabled: true } },
        );

        await waitFor(() => expect(result.current.error?.message).toBe('Network error'));

        rerender({ enabled: false });
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();

        rerender({ enabled: true });
        await waitFor(() => expect(result.current.loading).toBe(true));
        expect(result.current.error).toBeNull();

        resolveRetry(jsonFetchResponse({ type: 'FeatureCollection', features: [] }));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.data).toEqual({ type: 'FeatureCollection', features: [] });
    });

    it('sets error on fetch failure', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useGeoJsonData('bad.geojson'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toBe('Network error');
    });

    it('constructs URL from BASE_URL and filename', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(jsonFetchResponse({}));

        renderHook(() => useGeoJsonData('flights.geojson'));

        await waitFor(() => {
            expect(fetch).toHaveBeenCalled();
        });

        const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
        expect(calledUrl).toContain('data/flights/flights.geojson');
    });

    it('does not update state after unmount (cancelled flag)', async () => {
        let resolvePromise: (value: unknown) => void;
        globalThis.fetch = vi.fn().mockReturnValue(
            new Promise(resolve => {
                resolvePromise = () => resolve(jsonFetchResponse({ type: 'FeatureCollection', features: [] }));
            })
        );

        const { result, unmount } = renderHook(() => useGeoJsonData('slow.geojson'));
        expect(result.current.loading).toBe(true);

        // Unmount before fetch resolves
        unmount();

        // Resolve the fetch — should not throw or update state
        resolvePromise!(undefined);
        // If the cancelled flag works, no error is thrown and state doesn't update
    });
});
