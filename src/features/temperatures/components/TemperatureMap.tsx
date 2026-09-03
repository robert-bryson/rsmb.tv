import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTemperatureData } from '../hooks/useTemperatureData';
import { useClimateTrends } from '../hooks/useClimateTrends';
import { SummaryPanel } from './SummaryPanel';
import type { RecordSort } from './SummaryPanel';
import { StationDetailPanel } from './StationDetailPanel';
import { RecordAgeChart } from './RecordAgeChart';
import { RecordsBrokenTimeSeries } from './RecordsBrokenTimeSeries';
import { HighLowRatioChart } from './HighLowRatioChart';
import { RecentRecordFilters } from '../map/RecentRecordFilters';
import { buildBrokenRecordsGeoJson, buildFreshnessGeoJson } from '../map/temperatureMapLayers';
import { escapeMapText, styleDarkPopup } from '../map/temperatureMapPopup';
import type { BrokenRecord, ViewMode, HighlightRange, GeoJsonFeature, CountyRecordProperties, TimePeriod, RecordScope, StateRecordsCollection, CountyRecordsCollection } from '../types';
import {
    INITIAL_CENTER,
    INITIAL_ZOOM,
    MIN_ZOOM,
    MAX_ZOOM,
    COUNTY_ZOOM_THRESHOLD,
    HIGH_TEMP_COLOR,
    LOW_TEMP_COLOR,
    FRESHNESS_COLORS,
} from '../constants';
import { formatComparisonPeriod, formatTemp, formatTempDelta } from '../utils/temperature';
import { escapeHtml } from '../../../utils/escapeHtml';

function useIsMobile() {
    const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)') : null;
    const [isMobile, setIsMobile] = useState(() => mq?.matches ?? false);
    useEffect(() => {
        if (!mq) return;
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [mq]);
    return isMobile;
}

/** Format a date string like "1925-09-06" as "Sep 6, 1925" */
function formatDate(dateStr: string): string {
    if (!dateStr) return 'Date unknown';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Classify a broken record's significance.
 * Starts from the backend-computed recordScope (daily vs monthly) and promotes
 * to county-alltime or state-alltime if the temp also beats those records.
 */
function classifyBrokenRecord(
    props: Record<string, unknown>,
    stateRecs: StateRecordsCollection | null,
    countyRecs: CountyRecordsCollection | null,
): RecordScope {
    const type = props.type as string;
    const tempF = props.tempF as number;
    const state = props.state as string;
    const county = props.county as string;
    // Backend already determined daily vs monthly
    const baseScope = (props.recordScope as RecordScope) || 'daily';
    if (stateRecs) {
        const sr = stateRecs.features.find(f => f.properties.state === state && f.properties.type === type);
        if (sr && (type === 'high' ? tempF >= sr.properties.tempF : tempF <= sr.properties.tempF)) return 'state-alltime';
    }
    if (countyRecs && county) {
        const cr = countyRecs.features.find(f => f.properties.countyFips === county && f.properties.type === type);
        if (cr && (type === 'high' ? tempF >= cr.properties.tempF : tempF <= cr.properties.tempF)) return 'county-alltime';
    }
    return baseScope;
}

const SCOPE_BADGE: Record<RecordScope, string> = {
    'daily': '',
    'monthly': '<div style="display:inline-block;background:#1e3a5f;color:#7dd3fc;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:.3px;margin-bottom:4px">📅 MONTHLY RECORD</div>',
    'county-alltime': '<div style="display:inline-block;background:#422006;color:#fbbf24;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:.3px;margin-bottom:4px">📊 COUNTY ALL-TIME</div>',
    'state-alltime': '<div style="display:inline-block;background:#78350f;color:#f59e0b;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:.3px;margin-bottom:4px">🏆 STATE ALL-TIME</div>',
};

function buildPopupHTML(props: Record<string, unknown>, layerType: 'state' | 'county' | 'broken', counterpart?: Record<string, unknown> | null, scope?: RecordScope, useCelsius = false): string {
    const type = props.type as string;
    const tempF = props.tempF as number;
    const isHigh = type === 'high';
    const color = isHigh ? HIGH_TEMP_COLOR : LOW_TEMP_COLOR;
    const icon = isHigh ? '🔥' : '❄️';

    if (layerType === 'broken') {
        const prevF = props.prevRecordF as number;
        const prevDate = formatDate(props.prevRecordDate as string);
        const margin = isHigh ? tempF - prevF : prevF - tempF;
        const arrow = isHigh ? '↑' : '↓';
        const baseScope = (props.recordScope as RecordScope) || 'daily';
        const scopeLabel = baseScope === 'monthly' ? 'MONTHLY STATION' : 'DAILY STATION';
        const typeLabel = isHigh ? `NEW ${scopeLabel} RECORD HIGH` : `NEW ${scopeLabel} RECORD LOW`;
        const normalF = props.normalF as number | null;
        const vsNormal = normalF != null ? (tempF - normalF) : null;
        const scopeBadge = scope ? SCOPE_BADGE[scope] : '';
        return `<div style="
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            background:#18181b;color:#e4e4e7;padding:12px 14px;border-radius:8px;
            min-width:220px;line-height:1.6;font-size:13px;
            border:1px solid ${color}44;box-shadow:0 4px 20px rgba(0,0,0,.5)">
            <div style="font-size:12px;font-weight:700;color:${color};letter-spacing:.5px;margin-bottom:4px">${icon} ${typeLabel}</div>
            ${scopeBadge}
            <div style="font-size:14px;font-weight:600;margin-bottom:4px">${escapeHtml(props.stationName as string)}</div>
            <div style="color:#a1a1aa;font-size:12px;margin-bottom:6px">${escapeHtml(props.stateName as string)}</div>
            <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px">
                <span style="color:${color};font-size:22px;font-weight:700">${formatTemp(tempF, useCelsius)}</span>
                <span style="color:#a1a1aa;font-size:12px">(${formatTemp(tempF, !useCelsius)})</span>
            </div>
            <div style="border-top:1px solid #27272a;padding-top:6px;font-size:12px;color:#a1a1aa">
                <div style="display:flex;justify-content:space-between;margin-bottom:2px">
                    <span style="color:#a1a1aa">Previous record</span>
                    <span style="color:#d4d4d8">${formatTemp(prevF, useCelsius)} on ${prevDate}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:2px">
                    <span style="color:#a1a1aa">Margin</span>
                    <span style="color:${color}">${arrow}${formatTempDelta(margin, useCelsius)}</span>
                </div>${vsNormal != null ? `
                <div style="display:flex;justify-content:space-between;margin-bottom:2px">
                    <span style="color:#a1a1aa">vs ${formatComparisonPeriod(props.date as string)}</span>
                    <span style="color:${vsNormal > 0 ? HIGH_TEMP_COLOR : LOW_TEMP_COLOR}">${vsNormal > 0 ? '+' : ''}${formatTempDelta(vsNormal, useCelsius)}</span>
                </div>` : ''}
                <div style="display:flex;justify-content:space-between">
                    <span style="color:#a1a1aa">Date</span>
                    <span style="color:#d4d4d8">${formatDate(props.date as string)}</span>
                </div>
            </div>
            <div style="border-top:1px solid #27272a;margin-top:6px;padding-top:5px;font-size:11px;color:#a1a1aa;text-align:center">
                📊 Station history loaded in panel →
            </div>
        </div>`;
    }

    // State or county record
    const title = layerType === 'state'
        ? escapeHtml(props.stateName as string)
        : `${escapeHtml(props.countyName as string)}, ${escapeHtml(props.state as string)}`;

    // For state or county records, show both high and low if counterpart is available
    if ((layerType === 'county' || layerType === 'state') && counterpart) {
        const highRec = isHigh ? props : counterpart;
        const lowRec = isHigh ? counterpart : props;
        const hF = highRec.tempF as number;
        const lF = lowRec.tempF as number;
        const range = hF - lF;

        return `<div style="
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            background:#18181b;color:#e4e4e7;padding:12px 14px;border-radius:8px;
            min-width:220px;line-height:1.5;font-size:13px;
            border:1px solid #3f3f46;box-shadow:0 4px 20px rgba(0,0,0,.5)">
            <div style="font-size:14px;font-weight:600;margin-bottom:8px">${title}</div>
            <div style="display:flex;gap:12px;margin-bottom:8px">
                <div style="flex:1;background:#27272a;border-radius:6px;padding:8px 10px;border-left:3px solid ${HIGH_TEMP_COLOR}">
                    <div style="font-size:10px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">🔥 Record High</div>
                    <div style="color:${HIGH_TEMP_COLOR};font-size:20px;font-weight:700">${formatTemp(hF, useCelsius)}</div>
                    <div style="color:#a1a1aa;font-size:11px">${formatTemp(hF, !useCelsius)}</div>
                    <div style="color:#a1a1aa;font-size:11px;margin-top:4px">${formatDate(highRec.date as string)}</div>
                    <div style="color:#a1a1aa;font-size:10px">${escapeHtml(highRec.stationName as string || highRec.location as string || '')}</div>
                </div>
                <div style="flex:1;background:#27272a;border-radius:6px;padding:8px 10px;border-left:3px solid ${LOW_TEMP_COLOR}">
                    <div style="font-size:10px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">❄️ Record Low</div>
                    <div style="color:${LOW_TEMP_COLOR};font-size:20px;font-weight:700">${formatTemp(lF, useCelsius)}</div>
                    <div style="color:#a1a1aa;font-size:11px">${formatTemp(lF, !useCelsius)}</div>
                    <div style="color:#a1a1aa;font-size:11px;margin-top:4px">${formatDate(lowRec.date as string)}</div>
                    <div style="color:#a1a1aa;font-size:10px">${escapeHtml(lowRec.stationName as string || lowRec.location as string || '')}</div>
                </div>
            </div>
            <div style="text-align:center;font-size:11px;color:#a1a1aa;border-top:1px solid #27272a;padding-top:6px">
                Temperature range: <span style="color:#d4d4d8;font-weight:600">${formatTempDelta(range, useCelsius)}</span> (${formatTempDelta(range, !useCelsius)})
            </div>
        </div>`;
    }

    // Fallback: single record (state records, or county without counterpart)
    const typeLabel = isHigh ? 'All-Time Record High' : 'All-Time Record Low';
    const location = layerType === 'state' ? escapeHtml(props.location as string) : escapeHtml(props.stationName as string);
    const station = layerType === 'state' ? escapeHtml(props.station as string) : '';
    const date = formatDate(props.date as string);

    return `<div style="
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        background:#18181b;color:#e4e4e7;padding:12px 14px;border-radius:8px;
        min-width:200px;line-height:1.6;font-size:13px;
        border:1px solid #3f3f46;box-shadow:0 4px 20px rgba(0,0,0,.5)">
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">${title}</div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px">
            <span style="font-size:11px">${icon}</span>
            <span style="color:${color};font-size:20px;font-weight:700">${formatTemp(tempF, useCelsius)}</span>
            <span style="color:#a1a1aa;font-size:12px">(${formatTemp(tempF, !useCelsius)})</span>
        </div>
        <div style="font-size:11px;color:#a1a1aa;font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${typeLabel}</div>
        <div style="border-top:1px solid #27272a;padding-top:6px;font-size:12px;color:#a1a1aa">
            <div style="display:flex;justify-content:space-between;margin-bottom:2px">
                <span style="color:#a1a1aa">Date</span>
                <span style="color:#d4d4d8">${date}</span>
            </div>
            ${location ? `<div style="display:flex;justify-content:space-between;margin-bottom:2px">
                <span style="color:#a1a1aa">Location</span>
                <span style="color:#d4d4d8">${location}</span>
            </div>` : ''}
            ${station ? `<div style="display:flex;justify-content:space-between">
                <span style="color:#a1a1aa">Station</span>
                <span style="color:#d4d4d8">${station}</span>
            </div>` : ''}
        </div>
    </div>`;
}

export function TemperatureMap() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const popupRef = useRef<maplibregl.Popup | null>(null);
    const clickHandlersAttached = useRef(false);
    const isMobile = useIsMobile();
    const [searchParams, setSearchParams] = useSearchParams();
    const [mapLoaded, setMapLoaded] = useState(false);
    const [showCounty, setShowCounty] = useState(false);
    const [panelOpen, setPanelOpen] = useState(
        () => typeof window === 'undefined' || !window.matchMedia('(max-width: 768px)').matches,
    );
    const [showTrends, setShowTrends] = useState(false);
    const [highlightRange, setHighlightRange] = useState<HighlightRange | null>(null);
    const [selectedDecade, setSelectedDecade] = useState<number | null>(null);
    const [selectedStation, setSelectedStation] = useState<{ uid: number; name: string; state: string } | null>(null);
    const [selectedState, setSelectedState] = useState<string | null>(null);
    const prevViewMode = useRef<ViewMode>('recent');

    // URL-driven state for shareable views
    const viewParam = searchParams.get('view');
    const viewMode: ViewMode = (viewParam === 'county' || viewParam === 'state' || viewParam === 'freshness') ? viewParam : 'recent';
    const recordType: 'high' | 'low' = searchParams.get('type') === 'low' ? 'low' : 'high';
    const useCelsius = searchParams.get('unit') === 'C';
    const activePeriod: TimePeriod = searchParams.get('period') === '7d' ? 'last7Days' : 'yesterday';
    const stateFilter = /^[A-Z]{2}$/.test(searchParams.get('state') ?? '') ? searchParams.get('state')! : '';
    const scopeFilter = searchParams.get('scope') === 'monthly' ? 'monthly' : searchParams.get('scope') === 'daily' ? 'daily' : 'all';
    const parsedMargin = Number(searchParams.get('margin'));
    const minimumMargin = Number.isFinite(parsedMargin) && parsedMargin > 0 ? Math.min(parsedMargin, 50) : 0;
    const recentSort: RecordSort = searchParams.get('sort') === 'temp' || searchParams.get('sort') === 'margin'
        ? searchParams.get('sort') as RecordSort
        : 'departure';

    const updateSearchParam = useCallback((key: string, value: string, defaultValue = '') => {
        setSearchParams(previous => {
            const next = new URLSearchParams(previous);
            if (value === defaultValue) next.delete(key);
            else next.set(key, value);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const setViewMode = useCallback((mode: ViewMode) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (mode === 'recent') next.delete('view');
            else next.set('view', mode);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const setRecordType = useCallback((type: 'high' | 'low') => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (type === 'high') next.delete('type');
            else next.set('type', type);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const setUseCelsius = useCallback((fn: boolean | ((prev: boolean) => boolean)) => {
        const newVal = typeof fn === 'function' ? fn(useCelsius) : fn;
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (!newVal) next.delete('unit');
            else next.set('unit', 'C');
            return next;
        }, { replace: true });
    }, [setSearchParams, useCelsius]);

    const toggleTrends = useCallback(() => {
        const nextShowTrends = !showTrends;

        if (nextShowTrends) {
            prevViewMode.current = viewMode;
            if (viewMode !== 'freshness') setViewMode('freshness');
        } else {
            setHighlightRange(null);
            if (prevViewMode.current !== 'freshness') setViewMode(prevViewMode.current);
        }

        setShowTrends(nextShowTrends);
    }, [showTrends, viewMode, setViewMode]);

    const closeTrends = useCallback(() => {
        setShowTrends(false);
        setHighlightRange(null);
        if (prevViewMode.current !== 'freshness') setViewMode(prevViewMode.current);
    }, [setViewMode]);

    const handleSelectDecade = useCallback((decade: number | null) => {
        setSelectedDecade(decade);
        if (decade !== null) {
            setHighlightRange({ startYear: decade, endYear: decade + 9 });
        } else {
            setHighlightRange(null);
        }
    }, []);

    const shouldLoadAllTimeRecords = viewMode !== 'recent' || showTrends;
    const { stateRecords, countyRecords, recentRecords, loading, error } = useTemperatureData({ loadAllTimeRecords: shouldLoadAllTimeRecords });
    const { trends, loading: trendsLoading, error: trendsError } = useClimateTrends({ enabled: showTrends });

    const filteredRecentRecords = useMemo(() => {
        if (!recentRecords) return null;
        const filterRecords = (records: BrokenRecord[]) => records.filter(record => {
            const scope = record.recordScope === 'monthly' ? 'monthly' : 'daily';
            const margin = record.type === 'high' ? record.tempF - record.prevRecordF : record.prevRecordF - record.tempF;
            return (!stateFilter || record.state === stateFilter)
                && (scopeFilter === 'all' || scope === scopeFilter)
                && margin >= minimumMargin;
        });
        return {
            ...recentRecords,
            yesterday: filterRecords(recentRecords.yesterday),
            last7Days: filterRecords(recentRecords.last7Days),
        };
    }, [minimumMargin, recentRecords, scopeFilter, stateFilter]);

    const recentStates = useMemo(() => {
        if (!recentRecords) return [];
        return [...new Set(recentRecords.last7Days.map(record => record.state).filter(Boolean))].sort();
    }, [recentRecords]);

    const recentCounts = useMemo(() => {
        const records = filteredRecentRecords?.[activePeriod] ?? [];
        return records.reduce((counts, record) => {
            counts[record.type]++;
            counts[record.recordScope === 'monthly' ? 'monthly' : 'daily']++;
            return counts;
        }, { high: 0, low: 0, daily: 0, monthly: 0 });
    }, [activePeriod, filteredRecentRecords]);

    /** Build GeoJSON from broken records for the map layer */
    const brokenRecordsGeoJson = useMemo(() => {
        if (!filteredRecentRecords) return null;
        return buildBrokenRecordsGeoJson(filteredRecentRecords[activePeriod] || [], activePeriod);
    }, [filteredRecentRecords, activePeriod]);

    /** Build freshness GeoJSON — county records colored by the year they were set */
    const freshnessGeoJson = useMemo(() => {
        if (!countyRecords) return null;
        return buildFreshnessGeoJson(countyRecords, recordType);
    }, [countyRecords, recordType]);

    /** Merged county GeoJSON — one feature per county with both high and low temps for combined labels */
    const countyMergedGeoJson = useMemo(() => {
        if (!countyRecords) return null;
        const byFips = new Map<string, { high?: GeoJsonFeature<CountyRecordProperties>; low?: GeoJsonFeature<CountyRecordProperties> }>();
        for (const f of countyRecords.features) {
            const fips = f.properties.countyFips;
            if (!byFips.has(fips)) byFips.set(fips, {});
            byFips.get(fips)![f.properties.type] = f;
        }
        const features = Array.from(byFips.values()).map(pair => {
            const base = pair.high || pair.low!;
            return {
                type: 'Feature' as const,
                geometry: base.geometry,
                properties: {
                    countyFips: base.properties.countyFips,
                    countyName: base.properties.countyName,
                    state: base.properties.state,
                    highTempF: pair.high?.properties.tempF ?? null,
                    lowTempF: pair.low?.properties.tempF ?? null,
                },
            };
        });
        return { type: 'FeatureCollection' as const, features };
    }, [countyRecords]);

    /** GeoJSON for the selected state's extreme station locations (from county records) */
    const stateDetailGeoJson = useMemo(() => {
        if (!selectedState || !countyRecords) return { type: 'FeatureCollection' as const, features: [] as GeoJsonFeature<CountyRecordProperties>[] };
        const stateFeatures = countyRecords.features.filter(f => f.properties.state === selectedState);
        const highRec = stateFeatures
            .filter(f => f.properties.type === 'high')
            .reduce((best, f) => !best || f.properties.tempF > best.properties.tempF ? f : best, null as GeoJsonFeature<CountyRecordProperties> | null);
        const lowRec = stateFeatures
            .filter(f => f.properties.type === 'low')
            .reduce((best, f) => !best || f.properties.tempF < best.properties.tempF ? f : best, null as GeoJsonFeature<CountyRecordProperties> | null);
        return {
            type: 'FeatureCollection' as const,
            features: [highRec, lowRec].filter((f): f is GeoJsonFeature<CountyRecordProperties> => f !== null),
        };
    }, [selectedState, countyRecords]);

    // Keep refs so click handlers can look up both high+low counterparts
    const countyRecordsRef = useRef(countyRecords);
    useEffect(() => { countyRecordsRef.current = countyRecords; }, [countyRecords]);
    const stateRecordsRef = useRef(stateRecords);
    useEffect(() => { stateRecordsRef.current = stateRecords; }, [stateRecords]);
    const useCelsiusRef = useRef(useCelsius);
    useEffect(() => { useCelsiusRef.current = useCelsius; }, [useCelsius]);

    /** Fly to a specific location (station or state) */
    const flyToLocation = useCallback((lng: number, lat: number) => {
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 8, duration: 1200 });
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
                sources: {
                    'carto-dark': {
                        type: 'raster',
                        tiles: [
                            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                        ],
                        tileSize: 256,
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
                    },
                },
                layers: [
                    {
                        id: 'carto-dark-layer',
                        type: 'raster',
                        source: 'carto-dark',
                        minzoom: 0,
                        maxzoom: 20,
                    },
                ],
            },
            center: INITIAL_CENTER,
            zoom: INITIAL_ZOOM,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        map.on('error', (e) => {
            console.error('MapLibre error:', e.error?.message || e);
        });

        map.on('load', () => {
            map.resize();
            setMapLoaded(true);
        });

        map.on('zoom', () => {
            const zoom = map.getZoom();
            setShowCounty(zoom >= COUNTY_ZOOM_THRESHOLD);
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Add/update state records layer
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded || !stateRecords) return;

        const sourceId = 'state-records';
        if (map.getSource(sourceId)) {
            (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(stateRecords);
            return;
        }

        map.addSource(sourceId, {
            type: 'geojson',
            data: stateRecords,
        });

        // High record labels — state abbrev above in red
        map.addLayer({
            id: 'state-highs',
            type: 'symbol',
            source: sourceId,
            filter: ['==', ['get', 'type'], 'high'],
            layout: {
                'text-field': ['concat', ['to-string', ['get', 'tempF']], '°F'],
                'text-font': ['Open Sans Semibold'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 6, 14, 9, 18],
                'text-offset': [0, -0.8],
                'text-anchor': 'bottom',
                'text-allow-overlap': true,
                visibility: 'none',
            },
            paint: {
                'text-color': '#fca5a5',
                'text-halo-color': '#18181b',
                'text-halo-width': 2,
            },
        });

        // Low record labels — temp below in blue
        map.addLayer({
            id: 'state-lows',
            type: 'symbol',
            source: sourceId,
            filter: ['==', ['get', 'type'], 'low'],
            layout: {
                'text-field': ['concat', ['to-string', ['get', 'tempF']], '°F'],
                'text-font': ['Open Sans Semibold'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 6, 14, 9, 18],
                'text-offset': [0, 0.8],
                'text-anchor': 'top',
                'text-allow-overlap': true,
                visibility: 'none',
            },
            paint: {
                'text-color': '#93c5fd',
                'text-halo-color': '#18181b',
                'text-halo-width': 2,
            },
        });

        // State abbreviation labels — centered between high and low
        map.addLayer({
            id: 'state-labels',
            type: 'symbol',
            source: sourceId,
            filter: ['==', ['get', 'type'], 'high'],
            layout: {
                'text-field': ['get', 'state'],
                'text-font': ['Open Sans Semibold'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 6, 11, 9, 14],
                'text-offset': [0, 0],
                'text-anchor': 'center',
                'text-allow-overlap': true,
                visibility: 'none',
            },
            paint: {
                'text-color': '#d4d4d8',
                'text-halo-color': '#18181b',
                'text-halo-width': 2,
            },
        });
    }, [mapLoaded, stateRecords, showCounty]);

    // Add/update county records layer
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded || !countyRecords) return;

        const sourceId = 'county-records';
        if (map.getSource(sourceId)) {
            (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(countyRecords);
        } else {
            map.addSource(sourceId, {
                type: 'geojson',
                data: countyRecords,
            });

            // High dots — small red circles, offset slightly left
            map.addLayer({
                id: 'county-highs',
                type: 'circle',
                source: sourceId,
                filter: ['==', ['get', 'type'], 'high'],
                layout: { visibility: 'none' },
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 6, 2.5, 9, 4, 12, 6],
                    'circle-color': HIGH_TEMP_COLOR,
                    'circle-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 6, 0.8, 8, 0.3],
                    'circle-translate': [-2, 0],
                    'circle-stroke-width': 0,
                },
            });

            // Low dots — small blue circles, offset slightly right
            map.addLayer({
                id: 'county-lows',
                type: 'circle',
                source: sourceId,
                filter: ['==', ['get', 'type'], 'low'],
                layout: { visibility: 'none' },
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 6, 2.5, 9, 4, 12, 6],
                    'circle-color': LOW_TEMP_COLOR,
                    'circle-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 6, 0.8, 8, 0.3],
                    'circle-translate': [2, 0],
                    'circle-stroke-width': 0,
                },
            });
        }
    }, [mapLoaded, countyRecords]);

    // Add/update combined county labels layer (one feature per county, shows both high and low)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded || !countyMergedGeoJson) return;

        const sourceId = 'county-labels-source';
        if (map.getSource(sourceId)) {
            (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(countyMergedGeoJson as GeoJSON.GeoJSON);
        } else {
            map.addSource(sourceId, { type: 'geojson', data: countyMergedGeoJson as GeoJSON.GeoJSON });

            // Combined label — shows high (red) above and low (blue) below
            map.addLayer({
                id: 'county-labels',
                type: 'symbol',
                source: sourceId,
                minzoom: 7,
                layout: {
                    'text-field': [
                        'format',
                        ['concat', ['to-string', ['coalesce', ['get', 'highTempF'], '']], '°'], { 'text-color': '#fca5a5' },
                        '\n', {},
                        ['concat', ['to-string', ['coalesce', ['get', 'lowTempF'], '']], '°'], { 'text-color': '#93c5fd' },
                    ],
                    'text-font': ['Open Sans Semibold'],
                    'text-size': ['interpolate', ['linear'], ['zoom'], 7, 9, 10, 12],
                    'text-anchor': 'center',
                    'text-allow-overlap': false,
                    'text-padding': 4,
                    visibility: 'none',
                },
                paint: {
                    'text-halo-color': '#000000',
                    'text-halo-width': 1.2,
                },
            });
        }
    }, [mapLoaded, countyMergedGeoJson]);

    // Add/update broken records layer (yesterday's record breakers)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded || !brokenRecordsGeoJson) return;

        const sourceId = 'broken-records';
        if (map.getSource(sourceId)) {
            (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(brokenRecordsGeoJson as GeoJSON.GeoJSON);
            return;
        }

        map.addSource(sourceId, {
            type: 'geojson',
            data: brokenRecordsGeoJson as GeoJSON.GeoJSON,
            cluster: true,
            clusterMaxZoom: 6,
            clusterRadius: 38,
        });

        map.addLayer({
            id: 'broken-clusters',
            type: 'circle',
            source: sourceId,
            filter: ['has', 'point_count'],
            paint: {
                'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 50, 24],
                'circle-color': '#3f3f46',
                'circle-opacity': 0.92,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#d4d4d8',
            },
        });

        map.addLayer({
            id: 'broken-cluster-count',
            type: 'symbol',
            source: sourceId,
            filter: ['has', 'point_count'],
            layout: {
                'text-field': ['get', 'point_count_abbreviated'],
                'text-font': ['Open Sans Semibold'],
                'text-size': 11,
            },
            paint: { 'text-color': '#f4f4f5' },
        });

        // Outer glow ring
        map.addLayer({
            id: 'broken-glow',
            type: 'circle',
            source: sourceId,
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 12, 7, 18, 10, 24],
                'circle-color': [
                    'case',
                    ['==', ['get', 'type'], 'high'], 'rgba(239,68,68,0.15)',
                    'rgba(59,130,246,0.15)',
                ],
                'circle-stroke-width': 0,
            },
        });

        // Solid inner dot
        map.addLayer({
            id: 'broken-highs',
            type: 'circle',
            source: sourceId,
            filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'type'], 'high']],
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 7, 8, 10, 11],
                'circle-color': HIGH_TEMP_COLOR,
                'circle-opacity': 0.9,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-opacity': 0.6,
            },
        });

        // Low records as hollow rings for shape differentiation (a11y)
        map.addLayer({
            id: 'broken-lows',
            type: 'circle',
            source: sourceId,
            filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'type'], 'low']],
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 6, 7, 9, 10, 12],
                'circle-color': 'transparent',
                'circle-opacity': 1,
                'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 2, 7, 2.5, 10, 3],
                'circle-stroke-color': LOW_TEMP_COLOR,
                'circle-stroke-opacity': 0.9,
            },
        });

        // Temperature labels for broken records
        map.addLayer({
            id: 'broken-labels',
            type: 'symbol',
            source: sourceId,
            filter: ['!', ['has', 'point_count']],
            layout: {
                'text-field': ['concat', ['to-string', ['get', 'tempF']], '°F'],
                'text-font': ['Open Sans Semibold'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 7, 13],
                'text-offset': [0, 1.8],
                'text-anchor': 'top',
                'text-allow-overlap': false,
            },
            paint: {
                'text-color': [
                    'case',
                    ['==', ['get', 'type'], 'high'], '#fca5a5',
                    '#93c5fd',
                ],
                'text-halo-color': '#000000',
                'text-halo-width': 1.5,
            },
        });
    }, [mapLoaded, brokenRecordsGeoJson]);

    // Add/update freshness records layer
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded || !freshnessGeoJson) return;

        const sourceId = 'freshness-records';
        if (map.getSource(sourceId)) {
            (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(freshnessGeoJson as GeoJSON.GeoJSON);
            return;
        }

        map.addSource(sourceId, { type: 'geojson', data: freshnessGeoJson as GeoJSON.GeoJSON });

        map.addLayer({
            id: 'freshness-circles',
            type: 'circle',
            source: sourceId,
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 6, 5, 9, 8],
                'circle-color': ['get', 'color'],
                'circle-opacity': 0.8,
                'circle-stroke-width': 0.5,
                'circle-stroke-color': 'rgba(255,255,255,0.15)',
            },
            layout: { visibility: 'none' },
        });

        map.addLayer({
            id: 'freshness-labels',
            type: 'symbol',
            source: sourceId,
            minzoom: 7,
            layout: {
                'text-field': ['to-string', ['get', 'year']],
                'text-font': ['Open Sans Semibold'],
                'text-size': 9,
                'text-offset': [0, 1.2],
                'text-anchor': 'top',
                'text-allow-overlap': false,
                visibility: 'none',
            },
            paint: {
                'text-color': '#d4d4d8',
                'text-halo-color': '#000000',
                'text-halo-width': 1,
            },
        });
    }, [mapLoaded, freshnessGeoJson]);

    // State detail markers — shown when a state is selected in state view
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;
        const sourceId = 'state-detail-records';
        if (map.getSource(sourceId)) return;
        map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
            id: 'state-detail-glow',
            type: 'circle',
            source: sourceId,
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 20, 8, 30, 12, 40],
                'circle-color': ['case', ['==', ['get', 'type'], 'high'], 'rgba(239,68,68,0.2)', 'rgba(59,130,246,0.2)'],
                'circle-stroke-width': 0,
            },
            layout: { visibility: 'none' },
        });
        map.addLayer({
            id: 'state-detail-circle',
            type: 'circle',
            source: sourceId,
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 8, 8, 12, 12, 16],
                'circle-color': ['case', ['==', ['get', 'type'], 'high'], HIGH_TEMP_COLOR, LOW_TEMP_COLOR],
                'circle-stroke-width': 3,
                'circle-stroke-color': '#ffffff',
            },
            layout: { visibility: 'none' },
        });
        map.addLayer({
            id: 'state-detail-label',
            type: 'symbol',
            source: sourceId,
            layout: {
                'text-field': ['concat', ['to-string', ['get', 'tempF']], '°F · ', ['get', 'stationName']],
                'text-font': ['Open Sans Semibold'],
                'text-size': 13,
                'text-offset': [0, 2.2],
                'text-anchor': 'top',
                'text-allow-overlap': true,
                visibility: 'none',
            },
            paint: {
                'text-color': ['case', ['==', ['get', 'type'], 'high'], '#fca5a5', '#93c5fd'],
                'text-halo-color': '#000000',
                'text-halo-width': 2,
            },
        });
    }, [mapLoaded]);

    // Update all map layer text-fields when unit (°F / °C) changes
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;

        // MapLibre expression to convert °F → °C inline: round((tempF - 32) * 5/9)
        const tempExpr = (prop: string): maplibregl.ExpressionSpecification =>
            useCelsius
                ? ['concat', ['to-string', ['round', ['*', ['/', ['-', ['get', prop], 32], 9], 5]]], '°C']
                : ['concat', ['to-string', ['get', prop]], '°F'];

        // State high/low labels
        if (map.getLayer('state-highs')) map.setLayoutProperty('state-highs', 'text-field', tempExpr('tempF'));
        if (map.getLayer('state-lows')) map.setLayoutProperty('state-lows', 'text-field', tempExpr('tempF'));

        // Broken record labels
        if (map.getLayer('broken-labels')) map.setLayoutProperty('broken-labels', 'text-field', tempExpr('tempF'));

        // State detail labels
        if (map.getLayer('state-detail-label')) {
            const detailExpr: maplibregl.ExpressionSpecification = useCelsius
                ? ['concat', ['to-string', ['round', ['*', ['/', ['-', ['get', 'tempF'], 32], 9], 5]]], '°C · ', ['get', 'stationName']]
                : ['concat', ['to-string', ['get', 'tempF']], '°F · ', ['get', 'stationName']];
            map.setLayoutProperty('state-detail-label', 'text-field', detailExpr);
        }

        // County merged labels follow the same high/low type selected in the side panel.
        if (map.getLayer('county-labels')) {
            const countyTempProp = recordType === 'high' ? 'highTempF' : 'lowTempF';
            const countyTextColor = recordType === 'high' ? '#fca5a5' : '#93c5fd';
            const countyExpr: maplibregl.ExpressionSpecification = useCelsius
                ? ['format', ['concat', ['to-string', ['round', ['*', ['/', ['-', ['coalesce', ['get', countyTempProp], 0], 32], 9], 5]]], '°'], { 'text-color': countyTextColor }]
                : ['format', ['concat', ['to-string', ['coalesce', ['get', countyTempProp], '']], '°'], { 'text-color': countyTextColor }];
            map.setLayoutProperty('county-labels', 'text-field', countyExpr);
        }
    }, [countyMergedGeoJson, mapLoaded, recordType, useCelsius]);

    // Keep county/state all-time symbology aligned with the selected high/low tab.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;

        const selectedCountyOpacity: maplibregl.ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 3, 0.65, 6, 0.85, 8, 0.45];
        const mutedCountyOpacity: maplibregl.ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 3, 0.12, 6, 0.18, 8, 0.08];

        if (map.getLayer('county-highs')) {
            map.setPaintProperty('county-highs', 'circle-opacity', recordType === 'high' ? selectedCountyOpacity : mutedCountyOpacity);
            map.setPaintProperty('county-highs', 'circle-stroke-width', recordType === 'high' ? 0.75 : 0);
            map.setPaintProperty('county-highs', 'circle-stroke-color', 'rgba(255,255,255,0.35)');
        }
        if (map.getLayer('county-lows')) {
            map.setPaintProperty('county-lows', 'circle-opacity', recordType === 'low' ? selectedCountyOpacity : mutedCountyOpacity);
            map.setPaintProperty('county-lows', 'circle-stroke-width', recordType === 'low' ? 0.75 : 0);
            map.setPaintProperty('county-lows', 'circle-stroke-color', 'rgba(255,255,255,0.35)');
        }
        if (map.getLayer('state-highs')) {
            map.setPaintProperty('state-highs', 'text-opacity', recordType === 'high' ? 1 : 0.25);
        }
        if (map.getLayer('state-lows')) {
            map.setPaintProperty('state-lows', 'text-opacity', recordType === 'low' ? 1 : 0.25);
        }
    }, [countyRecords, mapLoaded, recordType, stateRecords]);

    // Update state detail source data and zoom when selectedState changes
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;
        const sourceId = 'state-detail-records';
        const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
        if (!source) return;
        const detailLayers = ['state-detail-glow', 'state-detail-circle', 'state-detail-label'];
        if (!selectedState || !stateDetailGeoJson.features.length) {
            source.setData({ type: 'FeatureCollection', features: [] });
            for (const id of detailLayers) {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
            }
            return;
        }
        source.setData(stateDetailGeoJson as GeoJSON.GeoJSON);
        for (const id of detailLayers) {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
        }
        // Zoom to fit the selected state's county records
        if (countyRecords) {
            const sf = countyRecords.features.filter(f => f.properties.state === selectedState);
            if (sf.length > 0) {
                let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
                for (const f of sf) {
                    const [lng, lat] = f.geometry.coordinates;
                    if (lng < minLng) minLng = lng;
                    if (lng > maxLng) maxLng = lng;
                    if (lat < minLat) minLat = lat;
                    if (lat > maxLat) maxLat = lat;
                }
                map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 1200, maxZoom: 9 });
            }
        }
    }, [mapLoaded, selectedState, stateDetailGeoJson, countyRecords]);

    // Toggle layer visibility based on viewMode
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;

        const recentLayers = ['broken-clusters', 'broken-cluster-count', 'broken-glow', 'broken-highs', 'broken-lows', 'broken-labels'];
        const stateLayers = ['state-highs', 'state-lows', 'state-labels'];
        const countyLayers = ['county-highs', 'county-lows', 'county-labels'];
        const freshnessLayers = ['freshness-circles', 'freshness-labels'];
        const stateDetailLayers = ['state-detail-glow', 'state-detail-circle', 'state-detail-label'];

        const allLayers = [...recentLayers, ...stateLayers, ...countyLayers, ...freshnessLayers, ...stateDetailLayers];

        // Close any open popup and station detail when switching views
        popupRef.current?.remove();
        popupRef.current = null;
        setSelectedStation(null);
        setSelectedState(null);

        // Hide everything first
        for (const id of allLayers) {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
        }

        // Show only layers for the active view
        if (viewMode === 'recent') {
            for (const id of recentLayers) {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
            }
        } else if (viewMode === 'county') {
            for (const id of countyLayers) {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
            }
        } else if (viewMode === 'state') {
            for (const id of stateLayers) {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
            }
        } else {
            for (const id of freshnessLayers) {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
            }
        }
    }, [mapLoaded, viewMode, showCounty]);

    // Highlight map features matching hovered chart period
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;

        if (!map.getLayer('freshness-circles')) return;

        if (highlightRange) {
            map.setPaintProperty('freshness-circles', 'circle-opacity', [
                'case',
                ['all',
                    ['>=', ['get', 'year'], highlightRange.startYear],
                    ['<=', ['get', 'year'], highlightRange.endYear],
                ],
                1,
                0.07,
            ]);
            map.setPaintProperty('freshness-circles', 'circle-radius', [
                'case',
                ['all',
                    ['>=', ['get', 'year'], highlightRange.startYear],
                    ['<=', ['get', 'year'], highlightRange.endYear],
                ],
                ['interpolate', ['linear'], ['zoom'], 3, 5, 6, 8, 9, 12],
                ['interpolate', ['linear'], ['zoom'], 3, 2, 6, 3, 9, 5],
            ]);
            map.setPaintProperty('freshness-circles', 'circle-stroke-width', [
                'case',
                ['all',
                    ['>=', ['get', 'year'], highlightRange.startYear],
                    ['<=', ['get', 'year'], highlightRange.endYear],
                ],
                1.5,
                0,
            ]);
            map.setPaintProperty('freshness-circles', 'circle-stroke-color', 'rgba(255,255,255,0.4)');
        } else {
            map.setPaintProperty('freshness-circles', 'circle-opacity', 0.8);
            map.setPaintProperty('freshness-circles', 'circle-radius',
                ['interpolate', ['linear'], ['zoom'], 3, 3, 6, 5, 9, 8]);
            map.setPaintProperty('freshness-circles', 'circle-stroke-width', 0.5);
            map.setPaintProperty('freshness-circles', 'circle-stroke-color', 'rgba(255,255,255,0.15)');
        }
    }, [mapLoaded, highlightRange]);

    // State labels are symbol layers now — no circle opacity to manage
    // (state layers only show in state view mode, not in recent)

    // Set up click + hover handlers once — guarded to avoid duplicate listeners
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded || clickHandlersAttached.current) return;
        clickHandlersAttached.current = true;

        // Persistent hover tooltip (lightweight preview on mousemove)
        let hoverPopup: maplibregl.Popup | null = null;

        map.on('click', 'broken-clusters', async event => {
            const feature = event.features?.[0];
            const clusterId = feature?.properties?.cluster_id;
            const coordinates = (feature?.geometry as GeoJSON.Point | undefined)?.coordinates;
            const source = map.getSource('broken-records') as maplibregl.GeoJSONSource | undefined;
            if (!source || clusterId == null || !coordinates) return;
            const zoom = await source.getClusterExpansionZoom(clusterId);
            map.easeTo({ center: coordinates as [number, number], zoom });
        });

        const allClickLayers = ['broken-highs', 'broken-lows', 'broken-glow', 'state-highs', 'state-lows', 'county-highs', 'county-lows', 'county-labels'];

        for (const layerId of allClickLayers) {
            map.on('click', layerId, (e) => {
                if (!e.features?.length) return;
                hoverPopup?.remove();
                const props = e.features[0].properties;
                const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];
                const layerType: 'state' | 'county' | 'broken' = layerId.startsWith('broken-')
                    ? 'broken'
                    : layerId.startsWith('state-') ? 'state' : 'county';

                // For merged county-labels layer, look up the actual records and show both
                if (layerId === 'county-labels' && props.countyFips && countyRecordsRef.current) {
                    const fips = props.countyFips as string;
                    const highRec = countyRecordsRef.current.features.find(f => f.properties.countyFips === fips && f.properties.type === 'high');
                    const lowRec = countyRecordsRef.current.features.find(f => f.properties.countyFips === fips && f.properties.type === 'low');
                    const primary = highRec || lowRec;
                    if (primary) {
                        const counterpart = highRec && lowRec ? (primary === highRec ? lowRec.properties : highRec.properties) as unknown as Record<string, unknown> : null;
                        popupRef.current?.remove();
                        const popup = new maplibregl.Popup({ closeButton: true, maxWidth: counterpart ? '360px' : '300px', className: 'dark-popup' })
                            .setLngLat(coords)
                            .setHTML(buildPopupHTML(primary.properties as unknown as Record<string, unknown>, 'county', counterpart, undefined, useCelsiusRef.current))
                            .addTo(map);
                        popupRef.current = popup;
                        popup.on('close', () => { if (popupRef.current === popup) popupRef.current = null; });
                        styleDarkPopup(popup);
                    }
                    return;
                }

                // Find the counterpart (high↔low) to show both in popup
                let counterpart: Record<string, unknown> | null = null;
                if (layerType === 'county' && props.countyFips && countyRecordsRef.current) {
                    const fips = props.countyFips as string;
                    const otherType = props.type === 'high' ? 'low' : 'high';
                    const match = countyRecordsRef.current.features.find(
                        f => f.properties.countyFips === fips && f.properties.type === otherType
                    );
                    if (match) counterpart = match.properties as unknown as Record<string, unknown>;
                }
                if (layerType === 'state' && props.state && stateRecordsRef.current) {
                    const st = props.state as string;
                    const otherType = props.type === 'high' ? 'low' : 'high';
                    const match = stateRecordsRef.current.features.find(
                        f => f.properties.state === st && f.properties.type === otherType
                    );
                    if (match) counterpart = match.properties as unknown as Record<string, unknown>;
                }

                popupRef.current?.remove();
                const scope = layerType === 'broken'
                    ? classifyBrokenRecord(props, stateRecordsRef.current, countyRecordsRef.current)
                    : undefined;
                const popup = new maplibregl.Popup({ closeButton: true, maxWidth: (counterpart || layerType === 'state') ? '360px' : '300px', className: 'dark-popup' })
                    .setLngLat(coords)
                    .setHTML(buildPopupHTML(props, layerType, counterpart, scope, useCelsiusRef.current))
                    .addTo(map);
                popupRef.current = popup;
                popup.on('close', () => { if (popupRef.current === popup) popupRef.current = null; });
                styleDarkPopup(popup);

                // Zoom to state and show station detail markers
                if (layerType === 'state') {
                    setSelectedState(props.state as string);
                }

                // Open station detail for broken records (which have uid)
                if (layerType === 'broken' && props.uid) {
                    setSelectedStation({
                        uid: typeof props.uid === 'string' ? parseInt(props.uid, 10) : props.uid as number,
                        name: (props.stationName as string) || 'Unknown',
                        state: (props.stateName as string) || (props.state as string) || '',
                    });
                }
            });

            // Hover tooltip — show station/state name + temp on mousemove
            map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = '';
                hoverPopup?.remove();
                hoverPopup = null;
            });
            map.on('mousemove', layerId, (e) => {
                if (!e.features?.length) return;
                const props = e.features[0].properties;
                const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];
                const isStateLayer = layerId.startsWith('state-');
                const isCountyLayer = layerId.startsWith('county-');

                let hoverHTML: string;
                if (isCountyLayer && countyRecordsRef.current) {
                    // County hover: show both high and low stacked
                    const fips = props.countyFips as string;
                    const highRec = countyRecordsRef.current.features.find(f => f.properties.countyFips === fips && f.properties.type === 'high');
                    const lowRec = countyRecordsRef.current.features.find(f => f.properties.countyFips === fips && f.properties.type === 'low');
                    const countyName = escapeMapText(props.countyName);
                    const state = escapeMapText(props.state);
                    const highF = highRec?.properties.tempF;
                    const lowF = lowRec?.properties.tempF;
                    hoverHTML = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#18181b;color:#e4e4e7;padding:6px 10px;border-radius:6px;font-size:12px;white-space:nowrap;border:1px solid #3f3f46;box-shadow:0 2px 8px rgba(0,0,0,.4)">`
                        + (highF != null ? `<div><span style="color:${HIGH_TEMP_COLOR};font-weight:700">${highF}°F</span></div>` : '')
                        + (lowF != null ? `<div><span style="color:${LOW_TEMP_COLOR};font-weight:700">${lowF}°F</span></div>` : '')
                        + `<div style="color:#a1a1aa;font-size:11px;margin-top:2px">${countyName}, ${state}</div></div>`;
                } else if (isStateLayer && stateRecordsRef.current) {
                    // State hover: show both high and low stacked
                    const st = props.state as string;
                    const highRec = stateRecordsRef.current.features.find(f => f.properties.state === st && f.properties.type === 'high');
                    const lowRec = stateRecordsRef.current.features.find(f => f.properties.state === st && f.properties.type === 'low');
                    const stateName = escapeMapText(props.stateName || st);
                    const highF = highRec?.properties.tempF;
                    const lowF = lowRec?.properties.tempF;
                    hoverHTML = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#18181b;color:#e4e4e7;padding:6px 10px;border-radius:6px;font-size:12px;white-space:nowrap;border:1px solid #3f3f46;box-shadow:0 2px 8px rgba(0,0,0,.4)">`
                        + (highF != null ? `<div><span style="color:${HIGH_TEMP_COLOR};font-weight:700">${highF}°F</span></div>` : '')
                        + (lowF != null ? `<div><span style="color:${LOW_TEMP_COLOR};font-weight:700">${lowF}°F</span></div>` : '')
                        + `<div style="color:#a1a1aa;font-size:11px;margin-top:2px">${stateName}</div></div>`;
                } else {
                    const name = escapeMapText(props.stationName || props.stateName || props.countyName);
                    const tempF = props.tempF;
                    const type = props.type as string;
                    const color = type === 'high' ? HIGH_TEMP_COLOR : LOW_TEMP_COLOR;
                    hoverHTML = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#18181b;color:#e4e4e7;padding:4px 8px;border-radius:6px;font-size:12px;white-space:nowrap;border:1px solid #3f3f46;box-shadow:0 2px 8px rgba(0,0,0,.4)"><span style="color:${color};font-weight:700">${tempF}°F</span> <span style="color:#a1a1aa">${name}</span></div>`;
                }

                if (!hoverPopup) {
                    hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'dark-popup hover-tip', offset: 12 });
                }
                hoverPopup
                    .setLngLat(coords)
                    .setHTML(hoverHTML)
                    .addTo(map);
                const el = hoverPopup.getElement();
                if (el) {
                    el.querySelectorAll('.maplibregl-popup-content').forEach(node => {
                        (node as HTMLElement).style.cssText = 'background:transparent;padding:0;box-shadow:none;border:none;';
                    });
                    el.querySelectorAll('.maplibregl-popup-tip').forEach(node => {
                        (node as HTMLElement).style.display = 'none';
                    });
                }
            });
        }

        // Freshness layer click
        map.on('click', 'freshness-circles', (e) => {
            if (!e.features?.length) return;
            hoverPopup?.remove();
            popupRef.current?.remove();
            const p = e.features[0].properties;
            const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];
            const typeLabel = p.type === 'high' ? 'Record High' : 'Record Low';
            const countyName = escapeMapText(p.countyName);
            const state = escapeMapText(p.state);
            const stationName = escapeMapText(p.stationName);

            const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '260px', className: 'dark-popup' })
                .setLngLat(coords)
                .setHTML(`<div style="
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                    background:#18181b;color:#e4e4e7;padding:10px 12px;border-radius:8px;
                    min-width:180px;line-height:1.5;font-size:12px;
                    border:1px solid #3f3f46;box-shadow:0 4px 20px rgba(0,0,0,.5)">
                    <div style="font-size:13px;font-weight:600">${countyName}, ${state}</div>
                    <div style="font-size:18px;font-weight:700;color:${p.color};margin:4px 0">${p.tempF}°F</div>
                    <div style="font-size:11px;color:#a1a1aa">${typeLabel} · ${stationName}</div>
                    <div style="font-size:11px;color:#a1a1aa">Set in <strong style="color:#e4e4e7">${p.year}</strong></div>
                </div>`)
                .addTo(map);
            popupRef.current = popup;
            popup.on('close', () => { if (popupRef.current === popup) popupRef.current = null; });
            styleDarkPopup(popup);
        });

        // Freshness hover
        map.on('mouseenter', 'freshness-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'freshness-circles', () => {
            map.getCanvas().style.cursor = '';
            hoverPopup?.remove();
            hoverPopup = null;
        });
        map.on('mousemove', 'freshness-circles', (e) => {
            if (!e.features?.length) return;
            const p = e.features[0].properties;
            const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];
            const name = escapeMapText(p.countyName);
            const color = p.color || '#a1a1aa';

            if (!hoverPopup) {
                hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'dark-popup hover-tip', offset: 12 });
            }
            hoverPopup
                .setLngLat(coords)
                .setHTML(`<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#18181b;color:#e4e4e7;padding:4px 8px;border-radius:6px;font-size:12px;white-space:nowrap;border:1px solid #3f3f46;box-shadow:0 2px 8px rgba(0,0,0,.4)"><span style="color:${color};font-weight:700">${p.tempF}°F</span> <span style="color:#a1a1aa">${name} (${p.year})</span></div>`)
                .addTo(map);
            const el = hoverPopup.getElement();
            if (el) {
                el.querySelectorAll('.maplibregl-popup-content').forEach(node => {
                    (node as HTMLElement).style.cssText = 'background:transparent;padding:0;box-shadow:none;border:none;';
                });
                el.querySelectorAll('.maplibregl-popup-tip').forEach(node => {
                    (node as HTMLElement).style.display = 'none';
                });
            }
        });

        // State detail marker clicks — show popup with county record info
        map.on('click', 'state-detail-circle', (e) => {
            if (!e.features?.length) return;
            hoverPopup?.remove();
            const props = e.features[0].properties;
            const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];
            // Find the counterpart (high↔low) in the detail markers
            let counterpart: Record<string, unknown> | null = null;
            if (props.countyFips && countyRecordsRef.current) {
                const otherType = props.type === 'high' ? 'low' : 'high';
                const match = countyRecordsRef.current.features.find(
                    f => f.properties.countyFips === (props.countyFips as string) && f.properties.type === otherType
                );
                if (match) counterpart = match.properties as unknown as Record<string, unknown>;
            }
            popupRef.current?.remove();
            const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '360px', className: 'dark-popup' })
                .setLngLat(coords)
                .setHTML(buildPopupHTML(props, 'county', counterpart, undefined, useCelsiusRef.current))
                .addTo(map);
            popupRef.current = popup;
            popup.on('close', () => { if (popupRef.current === popup) popupRef.current = null; });
            styleDarkPopup(popup);
        });
        map.on('mouseenter', 'state-detail-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'state-detail-circle', () => { map.getCanvas().style.cursor = ''; });

        // Click-away: clear state selection when clicking empty space
        map.on('click', (e) => {
            const interactiveLayers = [
                'state-highs', 'state-lows', 'state-labels',
                'state-detail-circle', 'state-detail-glow', 'state-detail-label',
            ].filter(id => map.getLayer(id));
            if (interactiveLayers.length === 0) return;
            const features = map.queryRenderedFeatures(e.point, { layers: interactiveLayers });
            if (features.length === 0) {
                setSelectedState(null);
            }
        });
    }, [mapLoaded]);

    if (error) {
        return (
            <div className="flex items-center justify-center h-full bg-[#0a0a0a] text-zinc-400">
                <div className="text-center p-8">
                    <p className="text-lg mb-2">Failed to load temperature data</p>
                    <p className="text-sm text-zinc-400 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full">
            <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

            {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div className="flex items-center gap-2.5 bg-zinc-900/90 backdrop-blur rounded-lg px-4 py-2.5 border border-zinc-700/50 pointer-events-auto">
                        <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                        <span className="text-zinc-300 text-sm">Loading temperature records…</span>
                    </div>
                </div>
            )}

            {/* Unified toolbar */}
            <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 max-w-[calc(100vw-7rem)]">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                    <Link
                        to="/projects"
                        aria-label="Back to projects"
                        className="bg-zinc-900/80 backdrop-blur text-zinc-300 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-sm border border-zinc-700/50 hover:border-zinc-600 transition-colors"
                    >
                        <span aria-hidden="true">←</span><span className="hidden sm:inline"> Projects</span>
                    </Link>
                    <button
                        onClick={toggleTrends}
                        className={`bg-zinc-900/80 backdrop-blur px-3 py-1.5 rounded-lg text-sm border transition-colors ${showTrends
                            ? 'text-violet-300 border-violet-400/50 bg-violet-900/30'
                            : 'text-violet-400 border-violet-500/30 hover:text-violet-300 hover:border-violet-400/50'
                            }`}
                    >
                        <span aria-hidden="true">📊</span><span className="hidden sm:inline"> Trends</span>
                    </button>
                    <button
                        onClick={() => setUseCelsius(c => !c)}
                        className="bg-zinc-900/80 backdrop-blur text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-lg text-sm font-semibold border border-zinc-700/50 hover:border-zinc-600 transition-colors"
                        title={useCelsius ? 'Switch to °F' : 'Switch to °C'}
                        aria-label={useCelsius ? 'Switch to Fahrenheit' : 'Switch to Celsius'}
                    >
                        {useCelsius ? '°C' : '°F'}
                    </button>
                    <button
                        onClick={() => setPanelOpen(p => !p)}
                        className="bg-zinc-900/80 backdrop-blur text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-lg text-sm border border-zinc-700/50 hover:border-zinc-600 transition-colors"
                        title={panelOpen ? 'Hide summary' : 'Show summary'}
                        aria-label={panelOpen ? 'Hide summary panel' : 'Show summary panel'}
                        aria-expanded={panelOpen}
                    >
                        <span aria-hidden="true">{panelOpen ? '▾' : '▴'}</span><span className="hidden sm:inline"> {panelOpen ? 'Hide Panel' : 'Show Panel'}</span>
                    </button>
                </div>
                <div className="flex gap-0.5 bg-zinc-900/80 backdrop-blur rounded-lg border border-zinc-700/50 p-0.5 overflow-x-auto">
                    <button
                        onClick={() => setViewMode('recent')}
                        className={`px-2.5 py-1.5 text-xs rounded transition-colors ${viewMode === 'recent'
                            ? 'bg-zinc-700 text-white'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        title="Daily/monthly station records broken recently (yesterday or last 7 days)"
                    >
                        <span className="sm:hidden">Recent</span><span className="hidden sm:inline">🌡️ Recent</span>
                    </button>
                    <button
                        onClick={() => setViewMode('county')}
                        className={`px-2.5 py-1.5 text-xs rounded transition-colors ${viewMode === 'county'
                            ? 'bg-zinc-700 text-white'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        title="All-time high and low temperature records per county"
                    >
                        <span className="sm:hidden">County</span><span className="hidden sm:inline">📍 County All-Time</span>
                    </button>
                    <button
                        onClick={() => setViewMode('state')}
                        className={`px-2.5 py-1.5 text-xs rounded transition-colors ${viewMode === 'state'
                            ? 'bg-zinc-700 text-white'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        title="All-time high and low temperature records per state"
                    >
                        <span className="sm:hidden">State</span><span className="hidden sm:inline">🏛️ State All-Time</span>
                    </button>
                    <button
                        onClick={() => setViewMode('freshness')}
                        className={`px-2.5 py-1.5 text-xs rounded transition-colors ${viewMode === 'freshness'
                            ? 'bg-zinc-700 text-white'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        title="All-time county records colored by the decade they were set — shows how old the records are"
                    >
                        <span className="sm:hidden">Age</span><span className="hidden sm:inline">📅 Record Age</span>
                    </button>
                </div>
                {viewMode === 'recent' && (
                    <RecentRecordFilters states={recentStates} state={stateFilter} scope={scopeFilter} minimumMargin={minimumMargin} onChange={updateSearchParam} />
                )}
                {/* Context headline — promoted */}
                <div className="max-w-md" aria-live="polite">
                    {viewMode === 'recent' && filteredRecentRecords && (
                        <p className="text-xs text-zinc-200 bg-zinc-900/80 backdrop-blur rounded-lg px-3 py-1.5 border border-zinc-700/50">
                            <span className="font-semibold" style={{ color: HIGH_TEMP_COLOR }}>{recentCounts.high.toLocaleString()}</span>
                            {' daily/monthly station record highs and '}
                            <span className="font-semibold" style={{ color: LOW_TEMP_COLOR }}>{recentCounts.low.toLocaleString()}</span>
                            {activePeriod === 'yesterday' ? ' record lows broken yesterday' : ' record lows broken in the last 7 days'} in the contiguous U.S.
                            <span className="block text-[10px] text-zinc-400 mt-0.5">{recentCounts.daily.toLocaleString()} daily · {recentCounts.monthly.toLocaleString()} monthly</span>
                        </p>
                    )}
                    {viewMode === 'county' && countyRecords && (
                        <p className="text-xs text-zinc-200 bg-zinc-900/80 backdrop-blur rounded-lg px-3 py-1.5 border border-zinc-700/50">
                            <span className="font-semibold text-zinc-100">{countyRecords.features.length.toLocaleString()}</span> all-time county temperature records (highest high and lowest low per county)
                        </p>
                    )}
                    {viewMode === 'state' && stateRecords && (
                        <p className="text-xs text-zinc-200 bg-zinc-900/80 backdrop-blur rounded-lg px-3 py-1.5 border border-zinc-700/50">
                            <span className="font-semibold text-zinc-100">{stateRecords.features.length.toLocaleString()}</span> all-time state temperature records (highest high and lowest low per state)
                        </p>
                    )}
                    {viewMode === 'freshness' && (
                        <p className="text-xs text-zinc-200 bg-zinc-900/80 backdrop-blur rounded-lg px-3 py-1.5 border border-zinc-700/50">
                            All-time county records colored by the decade they were set — warmer colors = more recently set
                        </p>
                    )}
                </div>
            </div>

            {/* Legend — changes depending on view mode */}
            {(viewMode === 'recent' || viewMode === 'county' || viewMode === 'state') ? (
                <div className={`absolute left-4 z-20 bg-zinc-900/80 backdrop-blur rounded-lg px-4 py-3 text-xs text-zinc-300 border border-zinc-700/50 transition-all ${showTrends ? (isMobile ? 'bottom-[55%]' : 'bottom-[37%]') : 'bottom-6'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: HIGH_TEMP_COLOR }} />
                        Record High
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: LOW_TEMP_COLOR }} />
                        Record Low
                    </div>
                </div>
            ) : (
                <div className={`absolute left-4 z-20 bg-zinc-900/80 backdrop-blur rounded-lg px-3 py-2 sm:px-4 sm:py-3 text-xs text-zinc-300 border border-zinc-700/50 transition-all max-w-[calc(100vw-2rem)] ${showTrends ? (isMobile ? 'bottom-[55%]' : 'bottom-[37%]') : 'bottom-6'}`}>
                    <div className="flex items-center gap-1 mb-1.5 text-zinc-200 font-medium">Year standing record was set</div>
                    <div className="flex gap-1.5 overflow-x-auto">
                        {FRESHNESS_COLORS.map(([year, color, label]) => (
                            <div key={year} className="flex flex-col items-center shrink-0">
                                <div className="w-8 h-3 rounded-sm" style={{ backgroundColor: color }} />
                                <span className="mt-0.5 text-[9px] text-zinc-400">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {/* Summary panel */}
            {panelOpen && !showTrends && !selectedStation && (
                <SummaryPanel
                    viewMode={viewMode}
                    recentRecords={filteredRecentRecords}
                    countyRecords={countyRecords}
                    stateRecords={stateRecords}
                    recordType={recordType}
                    onRecordTypeChange={setRecordType}
                    useCelsius={useCelsius}
                    onFlyTo={flyToLocation}
                    onSelectState={setSelectedState}
                    activePeriod={activePeriod}
                    onPeriodChange={period => updateSearchParam('period', period === 'last7Days' ? '7d' : '')}
                    recentSort={recentSort}
                    onRecentSortChange={sort => updateSearchParam('sort', sort, 'departure')}
                />
            )}

            {/* Station detail panel — shown when a broken record station is clicked */}
            {selectedStation && !showTrends && (
                <StationDetailPanel
                    uid={selectedStation.uid}
                    stationName={selectedStation.name}
                    state={selectedStation.state}
                    useCelsius={useCelsius}
                    onClose={() => setSelectedStation(null)}
                />
            )}

            {/* Climate Trends drawer — responsive: side-by-side on desktop, tabbed on mobile */}
            {showTrends && (
                <div
                    className="absolute bottom-0 left-0 right-0 z-30 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-700/50 flex flex-col"
                    style={{ height: isMobile ? '50%' : '35%', minHeight: 220 }}
                >
                    {/* Drawer header */}
                    <div className="shrink-0 flex items-center justify-between px-4 py-1.5 border-b border-zinc-800">
                        <h2 className="text-sm font-semibold text-zinc-200">Climate Trends</h2>
                        <button
                            onClick={closeTrends}
                            className="text-zinc-400 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors text-sm"
                            aria-label="Close trends panel"
                        >
                            ✕
                        </button>
                    </div>

                    {trendsError ? (
                        <div className="flex-1 flex items-center justify-center px-4 text-center">
                            <div>
                                <p className="text-sm font-medium text-zinc-200">Failed to load trends</p>
                                <p className="mt-1 text-xs text-zinc-500">{trendsError}</p>
                            </div>
                        </div>
                    ) : trendsLoading || !trends ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="flex items-center gap-2.5">
                                <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                                <span className="text-zinc-400 text-sm">Loading trends…</span>
                            </div>
                        </div>
                    ) : isMobile ? (
                        <MobileTrendsDrawer
                            trends={trends}
                            setHighlightRange={setHighlightRange}
                            selectedDecade={selectedDecade}
                            handleSelectDecade={handleSelectDecade}
                        />
                    ) : (
                        <div className="flex-1 min-h-0 flex gap-1 px-2 py-1.5">
                            <div className="flex-1 min-w-0 flex flex-col">
                                <span className="text-xs text-zinc-400 px-1 mb-0.5 shrink-0">Record Age</span>
                                <div className="flex-1 min-h-0">
                                    <RecordAgeChart data={trends.byDecade} onHoverPeriod={setHighlightRange} selectedDecade={selectedDecade} onSelectDecade={handleSelectDecade} compact />
                                </div>
                            </div>
                            <div className="w-px bg-zinc-800 shrink-0" />
                            <div className="flex-1 min-w-0 flex flex-col">
                                <span className="text-xs text-zinc-400 px-1 mb-0.5 shrink-0">Records Set/Year</span>
                                <div className="flex-1 min-h-0">
                                    <RecordsBrokenTimeSeries data={trends.byYear} onHoverPeriod={setHighlightRange} selectedDecade={selectedDecade} onSelectDecade={handleSelectDecade} compact />
                                </div>
                            </div>
                            <div className="w-px bg-zinc-800 shrink-0" />
                            <div className="flex-1 min-w-0 flex flex-col">
                                <span className="text-xs text-zinc-400 px-1 mb-0.5 shrink-0">H:L Ratio</span>
                                <div className="flex-1 min-h-0">
                                    <HighLowRatioChart decadeData={trends.byDecade} rollingData={trends.rollingRatio} onHoverPeriod={setHighlightRange} selectedDecade={selectedDecade} onSelectDecade={handleSelectDecade} compact />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/** Mobile trends drawer — swipeable tabs instead of side-by-side charts */
function MobileTrendsDrawer({ trends, setHighlightRange, selectedDecade, handleSelectDecade }: {
    trends: { byDecade: import('../types').DecadeData[]; byYear: import('../types').YearData[]; rollingRatio: import('../types').RollingRatioData[] };
    setHighlightRange: (range: HighlightRange | null) => void;
    selectedDecade: number | null;
    handleSelectDecade: (decade: number | null) => void;
}) {
    const [activeTab, setActiveTab] = useState<'age' | 'freq' | 'ratio'>('age');

    return (
        <>
            <div className="flex border-b border-zinc-800 shrink-0">
                {([['age', 'Record Age'], ['freq', 'Records/Year'], ['ratio', 'H:L Ratio']] as const).map(([id, label]) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex-1 px-2 py-1.5 text-[11px] transition-colors ${activeTab === id
                            ? 'text-violet-400 border-b-2 border-violet-400'
                            : 'text-zinc-400 hover:text-zinc-300'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className="flex-1 min-h-0 px-2 py-1.5">
                {activeTab === 'age' && (
                    <RecordAgeChart data={trends.byDecade} onHoverPeriod={setHighlightRange} selectedDecade={selectedDecade} onSelectDecade={handleSelectDecade} compact />
                )}
                {activeTab === 'freq' && (
                    <RecordsBrokenTimeSeries data={trends.byYear} onHoverPeriod={setHighlightRange} selectedDecade={selectedDecade} onSelectDecade={handleSelectDecade} compact />
                )}
                {activeTab === 'ratio' && (
                    <HighLowRatioChart decadeData={trends.byDecade} rollingData={trends.rollingRatio} onHoverPeriod={setHighlightRange} selectedDecade={selectedDecade} onSelectDecade={handleSelectDecade} compact />
                )}
            </div>
        </>
    );
}
