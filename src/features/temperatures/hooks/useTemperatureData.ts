import { useState, useEffect, useMemo } from 'react';
import { fetchWithCache } from '../../flights/utils/fetchCache';
import {
    STATE_RECORDS_URL,
    COUNTY_RECORDS_URL,
    RECENT_RECORDS_URL,
    SUMMARY_URL,
} from '../constants';
import type {
    StateRecordsCollection,
    CountyRecordsCollection,
    RecentRecords,
    TemperatureSummary,
    StateRecordProperties,
} from '../types';
import {
    countyRecordsSchema,
    parseTemperaturePayload,
    recentRecordsSchema,
    stateRecordsSchema,
    temperatureSummarySchema,
} from '../schemas';

interface TemperatureData {
    stateRecords: StateRecordsCollection | null;
    countyRecords: CountyRecordsCollection | null;
    recentRecords: RecentRecords | null;
    summary: TemperatureSummary | null;
    loading: boolean;
    error: string | null;
    stateHighs: StateRecordProperties[];
    stateLows: StateRecordProperties[];
}

interface UseTemperatureDataOptions {
    loadAllTimeRecords?: boolean;
}

export function useTemperatureData({ loadAllTimeRecords = true }: UseTemperatureDataOptions = {}): TemperatureData {
    const [stateRecords, setStateRecords] = useState<StateRecordsCollection | null>(null);
    const [countyRecords, setCountyRecords] = useState<CountyRecordsCollection | null>(null);
    const [recentRecords, setRecentRecords] = useState<RecentRecords | null>(null);
    const [summary, setSummary] = useState<TemperatureSummary | null>(null);
    const [recentLoading, setRecentLoading] = useState(true);
    const [allTimeLoading, setAllTimeLoading] = useState(loadAllTimeRecords);
    const [recentError, setRecentError] = useState<string | null>(null);
    const [allTimeError, setAllTimeError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setRecentLoading(true);
                setRecentError(null);
                const [recentPayload, summaryPayload] = await Promise.all([
                    fetchWithCache<unknown>(RECENT_RECORDS_URL),
                    fetchWithCache<unknown>(SUMMARY_URL),
                ]);

                if (cancelled) return;

                setRecentRecords(parseTemperaturePayload(recentRecordsSchema, recentPayload, 'recent records data'));
                setSummary(parseTemperaturePayload(temperatureSummarySchema, summaryPayload, 'temperature summary data'));
            } catch (err) {
                if (cancelled) return;
                setRecentError(err instanceof Error ? err.message : 'Failed to load temperature data');
            } finally {
                if (!cancelled) setRecentLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!loadAllTimeRecords) {
            return;
        }

        if (stateRecords && countyRecords) {
            return;
        }

        let cancelled = false;

        async function loadAllTime() {
            try {
                setAllTimeLoading(true);
                setAllTimeError(null);
                const [statePayload, countyPayload] = await Promise.all([
                    fetchWithCache<unknown>(STATE_RECORDS_URL),
                    fetchWithCache<unknown>(COUNTY_RECORDS_URL),
                ]);

                if (cancelled) return;
                setStateRecords(parseTemperaturePayload(stateRecordsSchema, statePayload, 'state records data'));
                setCountyRecords(parseTemperaturePayload(countyRecordsSchema, countyPayload, 'county records data'));
            } catch (err) {
                if (cancelled) return;
                setAllTimeError(err instanceof Error ? err.message : 'Failed to load all-time temperature data');
            } finally {
                if (!cancelled) setAllTimeLoading(false);
            }
        }

        loadAllTime();
        return () => { cancelled = true; };
    }, [countyRecords, loadAllTimeRecords, stateRecords]);

    const stateHighs = useMemo(
        () => stateRecords?.features
            .filter(f => f.properties.type === 'high')
            .map(f => f.properties) ?? [],
        [stateRecords]
    );

    const stateLows = useMemo(
        () => stateRecords?.features
            .filter(f => f.properties.type === 'low')
            .map(f => f.properties) ?? [],
        [stateRecords]
    );
    const needsAllTimeRecords = loadAllTimeRecords && (!stateRecords || !countyRecords);
    const error = recentError ?? (loadAllTimeRecords ? allTimeError : null);

    return {
        stateRecords,
        countyRecords,
        recentRecords,
        summary,
        loading: recentLoading || (needsAllTimeRecords && allTimeLoading),
        error,
        stateHighs,
        stateLows,
    };
}
