import { useState, useEffect, useRef, useCallback } from 'react';

export interface PollState<T> {
    data: T | null;
    isLoading: boolean;
    isStale: boolean;
    error: string | null;
    lastUpdated: Date | null;
    refresh: () => void;
}

export function useAwsPoll<T>(
    fetcher: () => Promise<T>,
    intervalMs: number,
): PollState<T> {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStale, setIsStale] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [tick, setTick] = useState(0);
    const mountedRef = useRef(true);

    const refresh = useCallback(() => setTick((t) => t + 1), []);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!mountedRef.current) return;
            if (data !== null) setIsLoading(false);
            else setIsLoading(true);

            try {
                const result = await fetcher();
                if (cancelled) return;
                setData(result);
                setError(null);
                setIsStale(false);
                setLastUpdated(new Date());
            } catch (err) {
                if (cancelled) return;
                const message =
                    err instanceof Error ? err.message : 'Unknown error';
                setError(message);
                if (data !== null) setIsStale(true);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        run();

        const id = setInterval(run, intervalMs);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intervalMs, tick]);

    return { data, isLoading, isStale, error, lastUpdated, refresh };
}
