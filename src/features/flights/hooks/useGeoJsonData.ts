import { useEffect, useState } from 'react';
import { fetchWithCache } from '../utils/fetchCache';

interface UseGeoJsonDataResult<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
}

/**
 * Generic hook for fetching and caching GeoJSON data files.
 * Eliminates the duplicated fetch/state/error pattern used across
 * useAirports, useFlights, useAllAirports, and useUSStates.
 */
export function useGeoJsonData<T>(filename: string): UseGeoJsonDataResult<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let cancelled = false;
        const url = `${import.meta.env.BASE_URL}data/flights/${filename}`;
        fetchWithCache<T>(url)
            .then((json) => {
                if (cancelled) return;
                setData(json);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error(`Error loading ${filename}`, err);
                setError(err);
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [filename]);

    return { data, loading, error };
}
