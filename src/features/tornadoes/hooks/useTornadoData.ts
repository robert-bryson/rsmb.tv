import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import { fetchWithCache, invalidateCache } from '../../../data/fetchCache';
import { parseTornadoAnnualSummary, parseTornadoTrendIndex, type TornadoTrendIndex } from '../../../../shared/tornadoTrends';
import {
    DEFAULT_END_YEAR,
    DEFAULT_START_YEAR,
    MIN_DATA_YEAR,
    TORNADO_ANNUAL_SUMMARY_URL,
    TORNADO_TREND_INDEX_URL,
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
    trendIndex: TornadoTrendIndex | null;
    trendsLoading: boolean;
    trendsError: string | null;
    retryTrends: () => void;
    notableEvents: NotableTornadoEvent[];
    warningSummary: WarningSummary | null;
    warningLoading: boolean;
    warningError: string | null;
    loading: boolean;
    /** Reports required metadata failures and active layer failures for the
     *  selected range. Independent requests cannot clear each other's errors. */
    error: string | null;
    minYear: number;
    maxYear: number;
    retry: () => void;
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

type TornadoFeatureCollection = FeatureCollection & { metadata?: { source: string; generatedAt?: string; count: number } };

function mergeCollections<T extends TornadoFeatureCollection>(collections: T[]): T {
    const generatedAt = collections[0]?.metadata?.generatedAt;
    return {
        type: 'FeatureCollection',
        metadata: {
            source: 'NOAA/NCEI StormEvents details CSV',
            ...(generatedAt ? { generatedAt } : {}),
            count: collections.reduce((sum, c) => sum + c.features.length, 0),
        },
        features: collections.flatMap((c) => c.features),
    } as T;
}

async function fetchYearCollections<T>(years: number[], yearUrl: (year: number) => string, cancelled: () => boolean): Promise<T[] | null> {
    const collections: T[] = new Array(years.length);
    let next = 0;
    let failed = false;
    // Historical comparisons can span 77 years. Limit active requests and stop
    // dequeuing obsolete years when a user changes the range or leaves Trends.
    await Promise.all(Array.from({ length: Math.min(6, years.length) }, async () => {
        while (next < years.length && !cancelled() && !failed) {
            const index = next++;
            try {
                collections[index] = await fetchWithCache<T>(yearUrl(years[index]), { ttl: 30 * 60 * 1000 });
            } catch (error) {
                failed = true;
                throw error;
            }
        }
    }));
    return cancelled() ? null : collections;
}

export function useTornadoData({ startYear = DEFAULT_START_YEAR, endYear = DEFAULT_END_YEAR, loadPoints = false, loadWarnings = false, loadTrends = false } = {}): TornadoDataState {
    const [tracks, setTracks] = useState<TornadoTrackCollection | null>(null);
    const [points, setPoints] = useState<TornadoPointCollection | null>(null);
    const [annualSummary, setAnnualSummary] = useState<AnnualTornadoSummary[]>([]);
    const [trendsRetryVersion, setTrendsRetryVersion] = useState(0);
    const [trendRequest, setTrendRequest] = useState<{
        version: string; annual: AnnualTornadoSummary[]; data: TornadoTrendIndex | null; error: string | null;
    } | null>(null);
    const [notableEvents, setNotableEvents] = useState<NotableTornadoEvent[]>([]);
    const [warningSummary, setWarningSummary] = useState<WarningSummary | null>(null);
    const [warningRequest, setWarningRequest] = useState<{ version: number; error: string | null } | null>(null);
    const [retryVersion, setRetryVersion] = useState(0);
    const [metadataLoading, setMetadataLoading] = useState(true);
    const [loadedTracksKey, setLoadedTracksKey] = useState('');
    const [loadedPointsKey, setLoadedPointsKey] = useState('');
    // Each independent request owns its error. Only errors for the selected
    // range and active layers are exposed to the map.
    const [metadataError, setMetadataError] = useState<string | null>(null);
    const [trackError, setTrackError] = useState<{ key: string; message: string } | null>(null);
    const [pointError, setPointError] = useState<{ key: string; message: string } | null>(null);
    const trendVersion = `${retryVersion}:${trendsRetryVersion}`;

    const [minYear, maxYear] = useMemo(() => {
        if (annualSummary.length === 0) return [MIN_DATA_YEAR, new Date().getFullYear()];
        const years = annualSummary.map((summary) => summary.year);
        return [Math.min(...years), Math.max(...years)];
    }, [annualSummary]);

    const selectedYearsKey = useMemo(() => {
        const available = new Set(annualSummary.map(summary => summary.year));
        const start = Math.max(minYear, Math.min(startYear, maxYear));
        const end = Math.max(minYear, Math.min(endYear, maxYear));
        return yearsInRange(start, end).filter(year => available.size === 0 || available.has(year)).join(',');
    }, [startYear, endYear, minYear, maxYear, annualSummary]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const annualData = parseTornadoAnnualSummary(await fetchWithCache<unknown>(TORNADO_ANNUAL_SUMMARY_URL, { ttl: 30 * 60 * 1000 }));

                if (cancelled) return;
                setAnnualSummary(annualData);
            } catch (err) {
                if (!cancelled) setMetadataError(err instanceof Error ? err.message : 'Failed to load tornado data');
            } finally {
                if (!cancelled) setMetadataLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [retryVersion]);

    useEffect(() => {
        if (!loadTrends || metadataLoading || metadataError) return;
        if (trendRequest?.version === trendVersion && trendRequest.annual === annualSummary) return;
        let cancelled = false;
        Promise.all([
            fetchWithCache<unknown>(TORNADO_ANNUAL_SUMMARY_URL, { ttl: 30 * 60 * 1000 }),
            fetchWithCache<unknown>(TORNADO_TREND_INDEX_URL, { ttl: 30 * 60 * 1000 }),
        ]).then(([annualPayload, indexPayload]) => {
            if (cancelled) return;
            const annual = parseTornadoAnnualSummary(annualPayload);
            const data = parseTornadoTrendIndex(indexPayload, annual);
            // Publish both validated resources together. A failed chart
            // refresh cannot replace the map's last usable metadata.
            setAnnualSummary(annual);
            setTrendRequest({ version: trendVersion, annual, data, error: null });
        }).catch(err => {
            if (!cancelled) setTrendRequest({ version: trendVersion, annual: annualSummary, data: null,
                error: err instanceof Error ? err.message : 'Tornado trend aggregates unavailable' });
        });
        return () => { cancelled = true; };
    }, [loadTrends, metadataLoading, metadataError, annualSummary, trendVersion, trendRequest]);

    useEffect(() => {
        let cancelled = false;
        fetchWithCache<NotableTornadoEvent[]>(TORNADO_NOTABLE_EVENTS_URL, { ttl: 30 * 60 * 1000 })
            .then(data => { if (!cancelled) setNotableEvents(data); })
            .catch(() => { if (!cancelled) setNotableEvents([]); });
        return () => { cancelled = true; };
    }, [retryVersion]);

    useEffect(() => {
        if (!loadWarnings) return;
        let cancelled = false;
        fetchWithCache<WarningSummary>(TORNADO_WARNING_SUMMARY_URL, { ttl: 30 * 60 * 1000 })
            .then(data => {
                if (!cancelled) {
                    setWarningSummary(data);
                    setWarningRequest({ version: retryVersion, error: null });
                }
            })
            .catch(err => {
                if (!cancelled) setWarningRequest({ version: retryVersion, error: err instanceof Error ? err.message : 'Warning summaries unavailable' });
            });
        return () => { cancelled = true; };
    }, [loadWarnings, retryVersion]);

    useEffect(() => {
        if (metadataLoading || metadataError || loadedTracksKey === selectedYearsKey) return;
        let cancelled = false;
        const years = selectedYearsKey ? selectedYearsKey.split(',').map(Number) : [];

        async function loadTrackData() {
            try {
                const collections = await fetchYearCollections<TornadoTrackCollection>(years, tornadoTracksYearUrl, () => cancelled);
                if (!cancelled && collections) {
                    setTracks(mergeCollections(collections));
                    setLoadedTracksKey(selectedYearsKey);
                    setTrackError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setTracks(null);
                    setTrackError({ key: selectedYearsKey, message: err instanceof Error ? err.message : 'Failed to load tornado track data' });
                    setLoadedTracksKey(selectedYearsKey);
                }
            }
        }

        loadTrackData();
        return () => { cancelled = true; };
    }, [selectedYearsKey, metadataLoading, metadataError, retryVersion, loadedTracksKey]);

    useEffect(() => {
        if (!loadPoints || metadataLoading || metadataError) return;
        let cancelled = false;
        const years = selectedYearsKey ? selectedYearsKey.split(',').map(Number) : [];

        async function loadPointData() {
            try {
                const collections = await fetchYearCollections<TornadoPointCollection>(years, tornadoPointsYearUrl, () => cancelled);
                if (!cancelled && collections) {
                    setPoints(mergeCollections(collections));
                    setLoadedPointsKey(selectedYearsKey);
                    setPointError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setPoints(null);
                    setPointError({ key: selectedYearsKey, message: err instanceof Error ? err.message : 'Failed to load tornado point data' });
                    setLoadedPointsKey(selectedYearsKey);
                }
            }
        }

        loadPointData();
        return () => { cancelled = true; };
    }, [loadPoints, selectedYearsKey, metadataLoading, metadataError, retryVersion]);

    const retry = useCallback(() => {
        for (const url of [TORNADO_ANNUAL_SUMMARY_URL, TORNADO_TREND_INDEX_URL, TORNADO_NOTABLE_EVENTS_URL, TORNADO_WARNING_SUMMARY_URL]) invalidateCache(url);
        for (const year of selectedYearsKey.split(',').filter(Boolean).map(Number)) {
            invalidateCache(tornadoTracksYearUrl(year));
            invalidateCache(tornadoPointsYearUrl(year));
        }
        setMetadataError(null);
        setTrackError(null);
        setPointError(null);
        setWarningSummary(null);
        setWarningRequest(null);
        setMetadataLoading(true);
        setLoadedTracksKey('');
        setLoadedPointsKey('');
        setRetryVersion(version => version + 1);
    }, [selectedYearsKey]);

    const retryTrends = useCallback(() => {
        if (metadataError) {
            retry();
            return;
        }
        // Both files must describe the same publication. Geometry and optional
        // analytics stay cached when only the chart archive needs recovery.
        invalidateCache(TORNADO_ANNUAL_SUMMARY_URL);
        invalidateCache(TORNADO_TREND_INDEX_URL);
        setTrendsRetryVersion(version => version + 1);
    }, [metadataError, retry]);

    const error = metadataError
        ?? (trackError?.key === selectedYearsKey ? trackError.message : null)
        ?? (loadPoints && pointError?.key === selectedYearsKey ? pointError.message : null);
    const loading = !error && (metadataLoading || loadedTracksKey !== selectedYearsKey || (loadPoints && loadedPointsKey !== selectedYearsKey));

    const currentTrends = loadTrends && trendRequest?.version === trendVersion && trendRequest.annual === annualSummary ? trendRequest : null;
    const trendIndex = currentTrends?.data ?? null;
    const trendsLoading = loadTrends && !metadataError && !currentTrends;
    const trendsError = loadTrends ? metadataError ?? currentTrends?.error ?? null : null;

    const warningLoading = loadWarnings && warningRequest?.version !== retryVersion;
    const warningError = warningRequest?.version === retryVersion ? warningRequest.error : null;
    return { tracks, points, annualSummary, trendIndex, trendsLoading, trendsError, retryTrends,
        notableEvents, warningSummary, warningLoading, warningError, loading, error, minYear, maxYear, retry };
}
