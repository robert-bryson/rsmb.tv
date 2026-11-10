import { useState, useEffect, useMemo, useCallback } from 'react';
import type { z } from 'zod';
import { invalidateCache } from '../../../data/fetchCache';
import { fetchValidatedJson } from '../../../data/validatedJson';
import { STATE_RECORDS_URL, COUNTY_RECORDS_URL, RECENT_RECORDS_URL, SUMMARY_URL } from '../constants';
import { countyRecordsSchema, parseTemperaturePayload, recentRecordsSchema, stateRecordsSchema, temperatureSummarySchema } from '../schemas';

function useTemperatureResource<T>(url: string, schema: z.ZodType<T>, label: string, enabled: boolean) {
    const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
        data: null, loading: true, error: null,
    });
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => {
        invalidateCache(url);
        setState(previous => ({ ...previous, error: null, loading: true }));
        setAttempt(value => value + 1);
    }, [url]);
    useEffect(() => {
        if (!enabled || state.data) return;
        let cancelled = false;
        async function load() {
            setState(previous => ({ ...previous, loading: true, error: null }));
            try {
                const data = await fetchValidatedJson(url, payload => parseTemperaturePayload(schema, payload, label));
                if (!cancelled) setState({ data, loading: false, error: null });
            } catch (error) {
                if (!cancelled) setState({ data: null, loading: false, error: error instanceof Error ? error.message : `Failed to load ${label}` });
            }
        }
        void load();
        return () => { cancelled = true; };
    }, [attempt, enabled, label, schema, state.data, url]);
    return { ...state, retry, loading: enabled && state.loading, error: enabled ? state.error : null };
}

interface UseTemperatureDataOptions {
    loadAllTimeRecords?: boolean;
    loadRecentRecords?: boolean;
    loadStateRecords?: boolean;
    loadCountyRecords?: boolean;
    loadSummary?: boolean;
}

/** Each view waits only for its own data. Update metadata is optional. */
export function useTemperatureData({
    loadAllTimeRecords = true,
    loadRecentRecords = true,
    loadStateRecords = loadAllTimeRecords,
    loadCountyRecords = loadAllTimeRecords,
    loadSummary = true,
}: UseTemperatureDataOptions = {}) {
    const recent = useTemperatureResource(RECENT_RECORDS_URL, recentRecordsSchema, 'recent records data', loadRecentRecords);
    const states = useTemperatureResource(STATE_RECORDS_URL, stateRecordsSchema, 'state records data', loadStateRecords);
    const counties = useTemperatureResource(COUNTY_RECORDS_URL, countyRecordsSchema, 'county records data', loadCountyRecords);
    const summary = useTemperatureResource(SUMMARY_URL, temperatureSummarySchema, 'temperature summary data', loadSummary);
    const stateHighs = useMemo(() => states.data?.features.filter(f => f.properties.type === 'high').map(f => f.properties) ?? [], [states.data]);
    const stateLows = useMemo(() => states.data?.features.filter(f => f.properties.type === 'low').map(f => f.properties) ?? [], [states.data]);
    return {
        stateRecords: states.data,
        countyRecords: counties.data,
        recentRecords: recent.data,
        summary: summary.data,
        loading: recent.loading || states.loading || counties.loading,
        error: recent.error ?? states.error ?? counties.error,
        retry: () => {
            for (const resource of [recent, states, counties, summary]) if (resource.error) resource.retry();
        },
        stateHighs, stateLows,
    };
}
