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

export function useTemperatureData(): TemperatureData {
    const [stateRecords, setStateRecords] = useState<StateRecordsCollection | null>(null);
    const [countyRecords, setCountyRecords] = useState<CountyRecordsCollection | null>(null);
    const [recentRecords, setRecentRecords] = useState<RecentRecords | null>(null);
    const [summary, setSummary] = useState<TemperatureSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const [stateData, countyData, recentData, summaryData] = await Promise.all([
                    fetchWithCache<StateRecordsCollection>(STATE_RECORDS_URL),
                    fetchWithCache<CountyRecordsCollection>(COUNTY_RECORDS_URL),
                    fetchWithCache<RecentRecords>(RECENT_RECORDS_URL),
                    fetchWithCache<TemperatureSummary>(SUMMARY_URL),
                ]);

                if (cancelled) return;

                setStateRecords(stateData);
                setCountyRecords(countyData);
                setRecentRecords(recentData);
                setSummary(summaryData);
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to load temperature data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, []);

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

    return { stateRecords, countyRecords, recentRecords, summary, loading, error, stateHighs, stateLows };
}
