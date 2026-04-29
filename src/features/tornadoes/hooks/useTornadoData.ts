import { useEffect, useMemo, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import { fetchWithCache } from '../../flights/utils/fetchCache';
import {
    DEFAULT_END_YEAR,
    DEFAULT_START_YEAR,
    MIN_DATA_YEAR,
    TORNADO_ANNUAL_SUMMARY_URL,
    TORNADO_NOTABLE_EVENTS_URL,
    TORNADO_WARNING_SUMMARY_URL,
    tornadoPointsYearUrl,
    tornadoTracksYearUrl,
} from '../constants';
import type {
    AnnualTornadoSummary,
    NotableTornadoEvent,
    TornadoPointCollection,
    TornadoTrackCollection,
    WarningSummary,
} from '../types';

interface TornadoDataState {
    tracks: TornadoTrackCollection | null;
    points: TornadoPointCollection | null;
    annualSummary: AnnualTornadoSummary[];
    notableEvents: NotableTornadoEvent[];
    warningSummary: WarningSummary | null;
    loading: boolean;
    /** Non-null when any fetch has failed. Metadata errors survive independent
     *  of track/point load outcomes; data errors clear on the next successful
     *  load for the same year range. */
    error: string | null;
    minYear: number;
    maxYear: number;
}


function clampYear(value: number) {
    if (!Number.isFinite(value)) return DEFAULT_START_YEAR;
    return Math.max(MIN_DATA_YEAR, Math.min(new Date().getFullYear(), Math.round(value)));
}

function yearsInRange(startYear: number, endYear: number) {
    const start = Math.min(clampYear(startYear), clampYear(endYear));
    const end = Math.max(clampYear(startYear), clampYear(endYear));
    const years: number[] = [];
    for (let year = start; year <= end; year += 1) years.push(year);
    return years;
}

type TornadoFeatureCollection = FeatureCollection & { metadata?: { source: string; generatedAt: string; count: number } };

function mergeCollections<T extends TornadoFeatureCollection>(collections: T[]): T {
    return {
        type: 'FeatureCollection',
        metadata: {
            source: 'NOAA/NCEI StormEvents details CSV',
            generatedAt: collections[0]?.metadata?.generatedAt ?? new Date().toISOString(),
            count: collections.reduce((sum, c) => sum + c.features.length, 0),
        },
        features: collections.flatMap((c) => c.features),
    } as T;
}

export function useTornadoData({ startYear = DEFAULT_START_YEAR, endYear = DEFAULT_END_YEAR, loadPoints = false } = {}): TornadoDataState {
    const [tracks, setTracks] = useState<TornadoTrackCollection | null>(null);
    const [points, setPoints] = useState<TornadoPointCollection | null>(null);
    const [annualSummary, setAnnualSummary] = useState<AnnualTornadoSummary[]>([]);
    const [notableEvents, setNotableEvents] = useState<NotableTornadoEvent[]>([]);
    const [warningSummary, setWarningSummary] = useState<WarningSummary | null>(null);
    const [metadataLoading, setMetadataLoading] = useState(true);
    const [loadedTracksKey, setLoadedTracksKey] = useState('');
    const [loadedPointsKey, setLoadedPointsKey] = useState('');
    // Two separate error buckets so that a successful track/point load never
    // silently clears a prior metadata fetch failure (missing annual summary
    // or notable events would leave the trends panel empty with no explanation).
    const [metadataError, setMetadataError] = useState<string | null>(null);
    const [dataError, setDataError] = useState<string | null>(null);

    const selectedYearsKey = useMemo(() => yearsInRange(startYear, endYear).join(','), [startYear, endYear]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const [annualData, notableData, warningData] = await Promise.all([
                    fetchWithCache<AnnualTornadoSummary[]>(TORNADO_ANNUAL_SUMMARY_URL, { ttl: 30 * 60 * 1000 }),
                    fetchWithCache<NotableTornadoEvent[]>(TORNADO_NOTABLE_EVENTS_URL, { ttl: 30 * 60 * 1000 }),
                    fetchWithCache<WarningSummary>(TORNADO_WARNING_SUMMARY_URL, { ttl: 30 * 60 * 1000 }).catch(() => null),
                ]);

                if (cancelled) return;
                setAnnualSummary(annualData);
                setNotableEvents(notableData);
                setWarningSummary(warningData);
            } catch (err) {
                if (!cancelled) setMetadataError(err instanceof Error ? err.message : 'Failed to load tornado data');
            } finally {
                if (!cancelled) setMetadataLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const years = selectedYearsKey.split(',').map((year) => Number(year));

        async function loadTrackData() {
            try {
                const collections = await Promise.all(
                    years.map((year) => fetchWithCache<TornadoTrackCollection>(tornadoTracksYearUrl(year), { ttl: 30 * 60 * 1000 })),
                );
                if (!cancelled) {
                    setTracks(mergeCollections(collections));
                    setLoadedTracksKey(selectedYearsKey);
                    setDataError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setDataError(err instanceof Error ? err.message : 'Failed to load tornado track data');
                    setLoadedTracksKey(selectedYearsKey);
                }
            }
        }

        loadTrackData();
        return () => { cancelled = true; };
    }, [selectedYearsKey]);

    useEffect(() => {
        if (!loadPoints) return;
        let cancelled = false;
        const years = selectedYearsKey.split(',').map((year) => Number(year));

        async function loadPointData() {
            try {
                const collections = await Promise.all(
                    years.map((year) => fetchWithCache<TornadoPointCollection>(tornadoPointsYearUrl(year), { ttl: 30 * 60 * 1000 })),
                );
                if (!cancelled) {
                    setPoints(mergeCollections(collections));
                    setLoadedPointsKey(selectedYearsKey);
                    setDataError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setDataError(err instanceof Error ? err.message : 'Failed to load tornado point data');
                    setLoadedPointsKey(selectedYearsKey);
                }
            }
        }

        loadPointData();
        return () => { cancelled = true; };
    }, [loadPoints, selectedYearsKey]);

    const [minYear, maxYear] = useMemo(() => {
        if (annualSummary.length === 0) return [MIN_DATA_YEAR, new Date().getFullYear()];
        const years = annualSummary.map((summary) => summary.year);
        return [Math.min(...years), Math.max(...years)];
    }, [annualSummary]);

    const loading = metadataLoading || loadedTracksKey !== selectedYearsKey || (loadPoints && loadedPointsKey !== selectedYearsKey);

    return { tracks, points, annualSummary, notableEvents, warningSummary, loading, error: metadataError ?? dataError, minYear, maxYear };
}