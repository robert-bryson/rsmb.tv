import { useState, useEffect } from 'react';
import { fetchWithCache } from '../../flights/utils/fetchCache';
import { CLIMATE_TRENDS_URL } from '../constants';
import type { ClimateTrends } from '../types';

interface ClimateTrendsState {
    trends: ClimateTrends | null;
    loading: boolean;
    error: string | null;
}

export function useClimateTrends(): ClimateTrendsState {
    const [trends, setTrends] = useState<ClimateTrends | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const data = await fetchWithCache<ClimateTrends>(CLIMATE_TRENDS_URL);
                if (!cancelled) setTrends(data);
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load climate trends');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, []);

    return { trends, loading, error };
}
