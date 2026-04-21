import { useState, useEffect, useRef, useCallback } from 'react';
import { addEvent } from './useEventLog.js';

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
    source?: string,
): PollState<T> {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStale, setIsStale] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [tick, setTick] = useState(0);
    const mountedRef = useRef(true);
    const hasDataRef = useRef(false);
    const hadErrorRef = useRef(false);
    const sourceRef = useRef(source);

    useEffect(() => {
        sourceRef.current = source;
    }, [source]);

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
            if (!hasDataRef.current) setIsLoading(true);

            try {
                const result = await fetcher();
                if (cancelled) return;
                if (sourceRef.current && hadErrorRef.current) {
                    addEvent('info', sourceRef.current, 'Recovered');
                }
                hasDataRef.current = true;
                hadErrorRef.current = false;
                setData(result);
                setError((prev) => prev !== null ? null : prev);
                setIsStale((prev) => prev !== false ? false : prev);
                setLastUpdated(new Date());
            } catch (err) {
                if (cancelled) return;
                const message =
                    err instanceof Error ? err.message : 'Unknown error';
                // Only log to event log after first successful fetch — skip cold-start noise
                if (sourceRef.current && hasDataRef.current) {
                    addEvent('error', sourceRef.current, message);
                }
                hadErrorRef.current = true;
                setError(message);
                if (hasDataRef.current) setIsStale(true);
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
