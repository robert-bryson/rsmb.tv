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
});
