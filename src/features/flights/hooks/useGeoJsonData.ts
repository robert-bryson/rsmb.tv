import { useEffect, useState } from 'react';
import { fetchWithCache } from '../utils/fetchCache';

interface UseGeoJsonDataResult<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
}

interface UseGeoJsonDataOptions {
    enabled?: boolean;
}

/**
 * Generic hook for fetching and caching GeoJSON data files.
 * Eliminates the duplicated fetch/state/error pattern used across
 * useAirports, useFlights, useAllAirports, and useUSStates.
 */
export function useGeoJsonData<T>(filename: string, options: UseGeoJsonDataOptions = {}): UseGeoJsonDataResult<T> {
    const { enabled = true } = options;
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let cancelled = false;
        const url = `${import.meta.env.BASE_URL}data/flights/${filename}`;

        async function load() {
            try {
                setLoading(true);
                setError(null);
                const json = await fetchWithCache<T>(url);
                if (cancelled) return;
                setData(json);
            } catch (err) {
                if (cancelled) return;
                console.error(`Error loading ${filename}`, err);
                setError(err instanceof Error ? err : new Error(`Failed to load ${filename}`));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [enabled, filename]);

    return { data, loading: enabled && loading, error: enabled ? error : null };
}
