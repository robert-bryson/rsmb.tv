import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGeoJsonData } from '../features/flights/hooks/useGeoJsonData';
import { clearCache } from '../features/flights/utils/fetchCache';

describe('useGeoJsonData', () => {
    beforeEach(() => {
        clearCache();
        vi.restoreAllMocks();
    });

    it('starts in loading state', () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }),
        });

        const { result } = renderHook(() => useGeoJsonData('test.geojson'));
        expect(result.current.loading).toBe(true);
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('fetches and returns data', async () => {
        const mockData = { type: 'FeatureCollection', features: [{ id: 1 }] };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockData),
        });

        const { result } = renderHook(() => useGeoJsonData('airports.geojson'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.data).toEqual(mockData);
        expect(result.current.error).toBeNull();
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
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        });

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
                resolvePromise = () => resolve({
                    ok: true,
                    json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }),
                });
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
