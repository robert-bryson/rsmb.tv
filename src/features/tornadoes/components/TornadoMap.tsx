import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon, Position } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { escapeHtml } from '../../../utils/escapeHtml';
import {
    DECADE_COLORS,
    DEFAULT_END_YEAR,
    MAX_ZOOM,
    MIN_DATA_YEAR,
    MIN_ZOOM,
    REGION_LABELS,
    REGION_STATES,
    SCALE_COLORS,
    scaleFilterBounds,
    YEAR_COLOR_STOPS,
} from '../constants';
import { useTornadoData } from '../hooks/useTornadoData';
import { useTornadoFilters } from '../hooks/useTornadoFilters';
import type {
    NotableTornadoEvent,
    TornadoPointCollection,
    TornadoRegionPreset,
    TornadoTrackProperties,
    TornadoTrackCollection,
    TornadoTrackFeature,
} from '../types';
import {
    type FallbackViewBox,
    INITIAL_VIEW_BOX,
    SVG_CANVAS_HEIGHT,
    SVG_CANVAS_WIDTH,
    clampViewBox,
    computeStateBreakdown,
    computeAnnualSummaryFromTracks,
    fallbackBounds,
    projectFallbackPoint,
    summarize,
    toTrackPoints,
    zoomFallbackViewBox,
} from '../utils';
import { TornadoSummaryPanel } from './TornadoSummaryPanel';
import { TornadoTimeline } from './TornadoTimeline';

const LARGE_TRACK_WARNING_THRESHOLD = 5_000;

const EMPTY_TRACKS: TornadoTrackCollection = { type: 'FeatureCollection', features: [] };
const EMPTY_POINTS: TornadoPointCollection = { type: 'FeatureCollection', features: [] };
const EMPTY_TRACK_POINTS: FeatureCollection<Point, TornadoTrackProperties> = { type: 'FeatureCollection', features: [] };
const EMPTY_STATE_BOUNDARIES: StateBoundaryCollection = { type: 'FeatureCollection', features: [] };
const US_STATES_URL = '/data/flights/usStates.geojson';

interface StateBoundaryProperties {
    code: string;
    name: string;
    abbr: string;
}

type StateBoundaryCollection = FeatureCollection<Polygon | MultiPolygon, StateBoundaryProperties>;
type StateBoundaryFeature = Feature<Polygon | MultiPolygon, StateBoundaryProperties>;

interface FallbackDragState {
    pointerId: number;
    clientX: number;
    clientY: number;
    viewBox: FallbackViewBox;
    moved: boolean;
}

const SCALE_COLOR_EXPRESSION = [
    'match', ['get', 'scale'],
    -1, SCALE_COLORS[-1],
    0, SCALE_COLORS[0],
    1, SCALE_COLORS[1],
    2, SCALE_COLORS[2],
    3, SCALE_COLORS[3],
    4, SCALE_COLORS[4],
    5, SCALE_COLORS[5],
    SCALE_COLORS[-1],
] as unknown as maplibregl.ExpressionSpecification;

// Maps each track's year to its decade colour using floor division.
// e.g. year 1987 -> decade 1980 -> DECADE_COLORS[1980]
const DECADE_COLOR_EXPRESSION = [
    'match',
    ['*', ['floor', ['/', ['get', 'year'], 10]], 10],
    ...Object.entries(DECADE_COLORS).flatMap(([decade, color]) => [Number(decade), color]),
    DECADE_COLORS[2020], // fallback
] as unknown as maplibregl.ExpressionSpecification;

const YEAR_COLOR_EXPRESSION = [
    'interpolate', ['linear'], ['get', 'year'],
    ...YEAR_COLOR_STOPS.flatMap(({ year, color }) => [year, color]),
] as unknown as maplibregl.ExpressionSpecification;

// EF scale shorthand used in expressions below.
const EF = ['coalesce', ['get', 'scale'], -1] as unknown as maplibregl.ExpressionSpecification;

// At national zoom (z2-z4) circles stay intentionally small so the spatial
// distribution reads clearly. Size ramps up at closer zooms where individual
// events don't overlap.  EF ratio at z2 is ~2x (EF5 vs EF0) not 4x, so the
// map doesn't blob. At z7+ the 4x ratio becomes useful for identification.
const EF_RADIUS_EXPRESSION = [
    'interpolate', ['linear'], ['zoom'],
    2, ['interpolate', ['linear'], EF, -1, 1.0, 0, 1.2, 1, 1.4, 2, 1.7, 3, 2.1, 4, 2.6, 5, 3.2],
    4, ['interpolate', ['linear'], EF, -1, 1.4, 0, 1.8, 1, 2.2, 2, 2.8, 3, 3.6, 4, 4.8, 5, 6.0],
    7, ['interpolate', ['linear'], EF, -1, 2.5, 0, 3.5, 1, 5.0, 2, 7.5, 3, 10.5, 4, 14.0, 5, 18.0],
    10, ['interpolate', ['linear'], EF, -1, 5.0, 0, 7.0, 1, 10.0, 2, 15.0, 3, 20.0, 4, 26.0, 5, 32.0],
] as unknown as maplibregl.ExpressionSpecification;

// Low-EF events are dimmed at national view to let the significant events
// pop visually without increasing their physical size too much.
const EF_CIRCLE_OPACITY_EXPRESSION = [
    'interpolate', ['linear'], ['zoom'],
    2, ['interpolate', ['linear'], EF, -1, 0.28, 0, 0.36, 1, 0.48, 2, 0.62, 3, 0.78, 4, 0.90, 5, 0.96],
    6, ['interpolate', ['linear'], EF, -1, 0.50, 0, 0.60, 1, 0.70, 2, 0.82, 3, 0.90, 4, 0.96, 5, 1.00],
] as unknown as maplibregl.ExpressionSpecification;

// Line widths kept narrow at national zoom — EF rating visible via colour.
// Significant width differences only kick in at z5+ where overlap is lower.
const EF_LINE_WIDTH_EXPRESSION = [
    'interpolate', ['linear'], ['zoom'],
    2, ['interpolate', ['linear'], EF, -1, 0.5, 0, 0.7, 1, 0.9, 2, 1.1, 3, 1.5, 4, 2.0, 5, 2.6],
    5, ['interpolate', ['linear'], EF, -1, 0.8, 0, 1.1, 1, 1.5, 2, 2.2, 3, 3.2, 4, 4.5, 5, 6.0],
    8, ['interpolate', ['linear'], EF, -1, 1.5, 0, 2.0, 1, 3.0, 2, 4.5, 3, 7.0, 4, 10.0, 5, 13.0],
] as unknown as maplibregl.ExpressionSpecification;

// Halo stays ~2 px wider than the track so it never dominates.
const EF_HALO_WIDTH_EXPRESSION = [
    'interpolate', ['linear'], ['zoom'],
    2, ['interpolate', ['linear'], EF, -1, 1.8, 0, 2.0, 1, 2.2, 2, 2.5, 3, 3.0, 4, 3.6, 5, 4.4],
    5, ['interpolate', ['linear'], EF, -1, 2.4, 0, 2.8, 1, 3.2, 2, 4.0, 3, 5.2, 4, 6.6, 5, 8.4],
    8, ['interpolate', ['linear'], EF, -1, 3.5, 0, 4.5, 1, 5.5, 2, 7.0, 3, 10.0, 4, 14.0, 5, 18.0],
] as unknown as maplibregl.ExpressionSpecification;

// High-EF events are slightly more opaque than low-EF at any zoom.
const EF_LINE_OPACITY_EXPRESSION = [
    'interpolate', ['linear'], ['zoom'],
    2, ['interpolate', ['linear'], EF, -1, 0.35, 0, 0.45, 1, 0.55, 2, 0.65, 3, 0.76, 4, 0.87, 5, 0.95],
    6, 0.90,
    9, 0.95,
] as unknown as maplibregl.ExpressionSpecification;

function formatPopup(feature: TornadoTrackFeature) {
    const p = feature.properties;
    const color = SCALE_COLORS[p.scale] ?? SCALE_COLORS[-1];
    return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#18181b;color:#e4e4e7;padding:10px 12px;border-radius:8px;border:1px solid ${color}66;min-width:190px;box-shadow:0 8px 24px rgba(0,0,0,.45)">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:5px">
            <strong style="font-size:13px;color:#fafafa">${escapeHtml(p.county)}, ${escapeHtml(p.state)}</strong>
            <span style="font-size:11px;background:${color};color:#09090b;border-radius:3px;padding:1px 5px;font-weight:700">${escapeHtml(p.scaleLabel)}</span>
        </div>
        <div style="font-size:12px;color:#a1a1aa;margin-bottom:7px">${escapeHtml(p.date)} · ${escapeHtml(p.wfo || 'Unknown WFO')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:12px">
            <span style="color:#71717a">Length</span><span>${p.lengthMiles.toLocaleString()} mi</span>
            <span style="color:#71717a">Width</span><span>${p.widthYards.toLocaleString()} yd</span>
            <span style="color:#71717a">Deaths</span><span>${p.deaths.toLocaleString()}</span>
            <span style="color:#71717a">Injuries</span><span>${p.injuries.toLocaleString()}</span>
        </div>
    </div>`;
}

function formatPathNumber(value: number) {
    return Math.round(value * 10) / 10;
}

function ringToPath(ring: Position[], bounds: ReturnType<typeof fallbackBounds>) {
    return ring.map((coordinate, index) => {
        const [x, y] = projectFallbackPoint(coordinate, bounds);
        return `${index === 0 ? 'M' : 'L'}${formatPathNumber(x)} ${formatPathNumber(y)}`;
    }).join(' ');
}

function statePath(feature: StateBoundaryFeature, bounds: ReturnType<typeof fallbackBounds>) {
    const polygons = feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;

    return polygons
        .map((polygon) => polygon.map((ring) => `${ringToPath(ring, bounds)} Z`).join(' '))
        .join(' ');
}

function clientToFallbackPoint(svg: SVGSVGElement, viewBox: FallbackViewBox, clientX: number, clientY: number) {
    const rect = svg.getBoundingClientRect();
    return {
        x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width,
        y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.height,
    };
}

function StaticTornadoFallback({
    tracks,
    bgTracks,
    region,
    states,
    selectedTrackId,
    selectedState,
    onSelectTrack,
    onSelectState,
}: {
    tracks: TornadoTrackCollection;
    bgTracks?: TornadoTrackCollection;
    region: TornadoRegionPreset;
    states: StateBoundaryCollection | null;
    selectedTrackId?: string;
    selectedState: string | null;
    onSelectTrack: (track: TornadoTrackFeature) => void;
    onSelectState: (state: string) => void;
}) {
    const bounds = fallbackBounds(region);
    const longitudeTicks = Array.from({ length: 7 }, (_, index) => bounds.west + ((bounds.east - bounds.west) / 6) * index);
    const latitudeTicks = Array.from({ length: 5 }, (_, index) => bounds.south + ((bounds.north - bounds.south) / 4) * index);
    const svgRef = useRef<SVGSVGElement>(null);
    const dragState = useRef<FallbackDragState | null>(null);
    const suppressClick = useRef(false);
    const [viewBox, _setViewBox] = useState<FallbackViewBox>(INITIAL_VIEW_BOX);
    // Keep a ref in sync with viewBox state so callbacks always read the current
    // value without capturing stale closures (important for rapid wheel events).
    const viewBoxRef = useRef<FallbackViewBox>(INITIAL_VIEW_BOX);
    const setViewBox = useCallback((next: FallbackViewBox) => {
        viewBoxRef.current = next;
        _setViewBox(next);
    }, []);

    const zoomBy = useCallback((factor: number, clientX?: number, clientY?: number) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const current = viewBoxRef.current;
        const focus = clientX !== undefined && clientY !== undefined
            ? clientToFallbackPoint(svg, current, clientX, clientY)
            : { x: current.x + current.width / 2, y: current.y + current.height / 2 };
        setViewBox(zoomFallbackViewBox(current, focus.x, focus.y, factor));
    }, [setViewBox]);

    const resetView = useCallback(() => {
        setViewBox(INITIAL_VIEW_BOX);
    }, [setViewBox]);

    const handlePointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragState.current = {
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
            viewBox: viewBoxRef.current,
            moved: false,
        };
    }, []);

    const handlePointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
        const drag = dragState.current;
        const svg = svgRef.current;
        if (!drag || !svg || drag.pointerId !== event.pointerId) return;

        const rect = svg.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const dx = ((event.clientX - drag.clientX) / rect.width) * drag.viewBox.width;
        const dy = ((event.clientY - drag.clientY) / rect.height) * drag.viewBox.height;
        if (Math.abs(event.clientX - drag.clientX) > 3 || Math.abs(event.clientY - drag.clientY) > 3) drag.moved = true;

        setViewBox(clampViewBox({
            ...drag.viewBox,
            x: drag.viewBox.x - dx,
            y: drag.viewBox.y - dy,
        }));
    }, [setViewBox]);

    const handlePointerEnd = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
        const drag = dragState.current;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        suppressClick.current = Boolean(drag?.moved);
        dragState.current = null;
        window.setTimeout(() => { suppressClick.current = false; }, 0);
    }, []);

    const handleWheel = useCallback((event: WheelEvent) => {
        event.preventDefault();
        zoomBy(event.deltaY < 0 ? 0.78 : 1.28, event.clientX, event.clientY);
    }, [zoomBy]);

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        svg.addEventListener('wheel', handleWheel, { passive: false });
        return () => svg.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    const handleDoubleClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
        event.preventDefault();
        zoomBy(0.62, event.clientX, event.clientY);
    }, [zoomBy]);

    const handleTrackClick = useCallback((event: React.MouseEvent, feature: TornadoTrackFeature) => {
        if (suppressClick.current) return;
        event.stopPropagation();
        onSelectTrack(feature);
    }, [onSelectTrack]);

    return (
        <div className="absolute inset-0 z-10 overflow-hidden bg-[#020617]">
            <svg
                ref={svgRef}
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                preserveAspectRatio="xMidYMid slice"
                className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onDoubleClick={handleDoubleClick}
            >
                <defs>
                    <radialGradient id="tornadoFallbackGlow" cx="50%" cy="45%" r="70%">
                        <stop offset="0%" stopColor="#082f49" stopOpacity="0.38" />
                        <stop offset="55%" stopColor="#020617" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#020617" stopOpacity="1" />
                    </radialGradient>
                </defs>
                <rect width={SVG_CANVAS_WIDTH} height={SVG_CANVAS_HEIGHT} fill="url(#tornadoFallbackGlow)" />
                <g opacity="0.95">
                    {states?.features.map((feature) => (
                        <path
                            key={feature.properties.code}
                            d={statePath(feature, bounds)}
                            fill={feature.properties.abbr === selectedState ? '#0ea5e9' : '#0f172a'}
                            fillOpacity={feature.properties.abbr === selectedState ? 0.26 : 0.45}
                            stroke={feature.properties.abbr === selectedState ? '#e0f2fe' : '#64748b'}
                            strokeOpacity={feature.properties.abbr === selectedState ? 0.86 : 0.46}
                            strokeWidth={feature.properties.abbr === selectedState ? 2 : 1.1}
                            vectorEffect="non-scaling-stroke"
                            className="cursor-pointer"
                            onClick={(event) => {
                                if (suppressClick.current) return;
                                event.stopPropagation();
                                onSelectState(feature.properties.abbr);
                            }}
                        />
                    ))}
                </g>
                {longitudeTicks.map((lon) => {
                    const [x] = projectFallbackPoint([lon, bounds.south], bounds);
                    return <line key={`lon-${lon}`} x1={x} x2={x} y1="0" y2={SVG_CANVAS_HEIGHT} stroke="#334155" strokeOpacity="0.28" strokeWidth="1" />;
                })}
                {latitudeTicks.map((lat) => {
                    const [, y] = projectFallbackPoint([bounds.west, lat], bounds);
                    return <line key={`lat-${lat}`} x1="0" x2={SVG_CANVAS_WIDTH} y1={y} y2={y} stroke="#334155" strokeOpacity="0.28" strokeWidth="1" />;
                })}
                <rect x="1" y="1" width={SVG_CANVAS_WIDTH - 2} height={SVG_CANVAS_HEIGHT - 2} fill="none" stroke="#475569" strokeOpacity="0.35" strokeWidth="2" />
                {bgTracks?.features.map((feature) => {
                    const [start, end] = feature.geometry.coordinates as [[number, number], [number, number]];
                    const [x1, y1] = projectFallbackPoint(start, bounds);
                    const [x2, y2] = projectFallbackPoint(end, bounds);
                    const samePoint = Math.abs(x1 - x2) < 0.5 && Math.abs(y1 - y2) < 0.5;
                    if (samePoint) {
                        return (
                            <circle
                                key={`bg-${feature.properties.id}`}
                                cx={x1}
                                cy={y1}
                                r={2}
                                fill="#52525b"
                                opacity="0.2"
                            />
                        );
                    }
                    return (
                        <g key={`bg-${feature.properties.id}`} opacity="0.2">
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#09090b" strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#52525b" strokeWidth={1.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                        </g>
                    );
                })}
                {tracks.features.map((feature) => {
                    const [start, end] = feature.geometry.coordinates as [[number, number], [number, number]];
                    const [x1, y1] = projectFallbackPoint(start, bounds);
                    const [x2, y2] = projectFallbackPoint(end, bounds);
                    const color = SCALE_COLORS[feature.properties.scale] ?? SCALE_COLORS[-1];
                    const samePoint = Math.abs(x1 - x2) < 0.5 && Math.abs(y1 - y2) < 0.5;
                    const selected = feature.properties.id === selectedTrackId;

                    if (samePoint) {
                        return (
                            <circle
                                key={feature.properties.id}
                                cx={x1}
                                cy={y1}
                                r={selected ? 5.2 : 2.9}
                                fill={color}
                                opacity="0.86"
                                stroke={selected ? '#f8fafc' : '#020617'}
                                strokeWidth={selected ? 1.6 : 0.7}
                                vectorEffect="non-scaling-stroke"
                                className="cursor-pointer"
                                onClick={(event) => handleTrackClick(event, feature)}
                            />
                        );
                    }

                    return (
                        <g key={feature.properties.id} opacity="0.86" className="cursor-pointer" onClick={(event) => handleTrackClick(event, feature)}>
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={selected ? '#f8fafc' : '#020617'} strokeWidth={selected ? 6 : 4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={selected ? 3 : 2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                        </g>
                    );
                })}
            </svg>
            <div className="pointer-events-auto absolute right-3 top-3 z-10 flex overflow-hidden rounded-md border border-zinc-700/80 bg-zinc-950/90 text-xs shadow-xl backdrop-blur">
                <button type="button" onClick={() => zoomBy(0.72)} className="h-8 w-8 border-r border-zinc-800 text-zinc-200 hover:bg-zinc-800" aria-label="Zoom in">+</button>
                <button type="button" onClick={() => zoomBy(1.38)} className="h-8 w-8 border-r border-zinc-800 text-zinc-200 hover:bg-zinc-800" aria-label="Zoom out">-</button>
                <button type="button" onClick={resetView} className="h-8 px-2.5 text-zinc-200 hover:bg-zinc-800">Reset</button>
            </div>
        </div>
    );
}

export function TornadoMap() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const popupRef = useRef<maplibregl.Popup | null>(null);
    const trackLookup = useRef(new Map<string, TornadoTrackFeature>());
    const pendingFlyTo = useRef<[number, number] | null>(null);
    const selectStateRef = useRef<(state: string) => void>(() => { });
    const setMapViewRef = useRef<(lat: number, lng: number, zoom: number) => void>(() => { });
    const [mapLoaded, setMapLoaded] = useState(false);
    const [selectedTrack, setSelectedTrackState] = useState<TornadoTrackFeature | null>(null);
    const [timelinePlaying, setTimelinePlaying] = useState(false);
    const [timelineCollapsed, setTimelineCollapsed] = useState(false);
    const [summaryCollapsed, setSummaryCollapsed] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [webglUnavailable, setWebglUnavailable] = useState(() => {
        try {
            const canvas = document.createElement('canvas');
            return !(canvas.getContext('webgl2') || canvas.getContext('webgl'));
        } catch {
            return true;
        }
    });
    const [stateBoundaries, setStateBoundaries] = useState<StateBoundaryCollection | null>(null);
    const {
        filters,
        setYearRange,
        setScaleFilter,
        setRegion,
        setMode,
        setColorMode,
        setSelectedState,
        selectState,
        setSelectedTrackId,
        setMapView,
    } = useTornadoFilters();

    // Must be declared after useTornadoFilters so setSelectedTrackId is in scope.
    const setSelectedTrack = useCallback((track: TornadoTrackFeature | null) => {
        setSelectedTrackState(track);
        setSelectedTrackId(track?.properties.id ?? null);
    }, [setSelectedTrackId]);

    const handleShare = useCallback(() => {
        const url = window.location.href;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                setCopiedUrl(true);
                setTimeout(() => setCopiedUrl(false), 2000);
            }).catch(() => { window.prompt('Copy this link:', url); });
        } else {
            // Clipboard API unavailable (HTTP context or older browser).
            window.prompt('Copy this link:', url);
        }
    }, []);
    const handleSelectState = useCallback((state: string) => {
        setSelectedTrackState(null);
        selectState(state);
    }, [selectState]);

    useEffect(() => {
        selectStateRef.current = handleSelectState;
    }, [handleSelectState]);

    useEffect(() => {
        setMapViewRef.current = setMapView;
    }, [setMapView]);

    // useTornadoFilters.setYearRange always stores start <= end in URL params,
    // so no additional normalization is needed before passing to useTornadoData.
    const dataStartYear = filters.mode === 'trends' ? MIN_DATA_YEAR : filters.startYear;
    const dataEndYear = filters.mode === 'trends' ? DEFAULT_END_YEAR : filters.endYear;
    const { tracks, points, annualSummary, notableEvents, warningSummary, loading, error, minYear, maxYear } = useTornadoData({
        startYear: dataStartYear,
        endYear: dataEndYear,
        loadPoints: filters.mode === 'density',
    });

    const normalizedRange = useMemo(() => ({
        startYear: Math.max(minYear, Math.min(filters.startYear, maxYear)),
        endYear: Math.max(minYear, Math.min(filters.endYear, maxYear)),
    }), [filters.startYear, filters.endYear, minYear, maxYear]);

    const regionStates = REGION_STATES[filters.region];
    const { min: minScale, max: maxScale } = scaleFilterBounds(filters.scaleFilter);
    const selectedStateName = useMemo(() => {
        if (!filters.selectedState) return null;
        return stateBoundaries?.features.find((feature) => feature.properties.abbr === filters.selectedState)?.properties.name
            ?? filters.selectedState;
    }, [filters.selectedState, stateBoundaries]);

    const trackMatchesGeography = useCallback((state: string) => {
        if (filters.selectedState) return state === filters.selectedState;
        return regionStates.length === 0 || regionStates.includes(state);
    }, [filters.selectedState, regionStates]);

    const timelineFeatures = useMemo(() => {
        if (!tracks) return [];
        return tracks.features.filter((feature) => {
            const { scale, state } = feature.properties;
            return scale >= minScale && scale <= maxScale
                && trackMatchesGeography(state);
        });
    }, [tracks, minScale, maxScale, trackMatchesGeography]);

    const filteredTracks = useMemo<TornadoTrackCollection>(() => {
        if (!tracks) return EMPTY_TRACKS;
        return {
            type: 'FeatureCollection',
            metadata: tracks.metadata,
            features: timelineFeatures.filter((feature) => {
                const year = feature.properties.year;
                return year >= normalizedRange.startYear && year <= normalizedRange.endYear;
            }),
        };
    }, [tracks, timelineFeatures, normalizedRange.startYear, normalizedRange.endYear]);

    const filteredPoints = useMemo<TornadoPointCollection>(() => {
        if (!points) return EMPTY_POINTS;
        return {
            type: 'FeatureCollection',
            metadata: points.metadata,
            features: points.features.filter((feature) => {
                const { year, scale, state } = feature.properties;
                return year >= normalizedRange.startYear
                    && year <= normalizedRange.endYear
                    && scale >= minScale
                    && scale <= maxScale
                    && trackMatchesGeography(state);
            }),
        };
    }, [points, normalizedRange.startYear, normalizedRange.endYear, minScale, maxScale, trackMatchesGeography]);

    // When a state is selected, the map source needs ALL year+scale tracks so the grey
    // out-of-state layer can render them. When no state is selected, reuse filteredTracks.
    const mapAllTracks = useMemo<TornadoTrackCollection>(() => {
        if (!tracks || !filters.selectedState) return filteredTracks;
        return {
            type: 'FeatureCollection',
            metadata: tracks.metadata,
            features: tracks.features.filter((f) => {
                const { year, scale } = f.properties;
                return year >= normalizedRange.startYear
                    && year <= normalizedRange.endYear
                    && scale >= minScale
                    && scale <= maxScale;
            }),
        };
    }, [tracks, filters.selectedState, filteredTracks, normalizedRange.startYear, normalizedRange.endYear, minScale, maxScale]);

    const mapAllTrackPoints = useMemo(() => toTrackPoints(mapAllTracks), [mapAllTracks]);

    // Out-of-state tracks passed to the SVG fallback for grey rendering.
    const bgTracks = useMemo<TornadoTrackCollection>(() => {
        if (!filters.selectedState) return EMPTY_TRACKS;
        return {
            type: 'FeatureCollection',
            metadata: mapAllTracks.metadata,
            features: mapAllTracks.features.filter((f) => f.properties.state !== filters.selectedState),
        };
    }, [mapAllTracks, filters.selectedState]);

    const stats = useMemo(() => summarize(filteredTracks.features), [filteredTracks]);
    const filteredAnnualSummary = useMemo(
        () => computeAnnualSummaryFromTracks(timelineFeatures, annualSummary.map((summary) => summary.year)),
        [timelineFeatures, annualSummary],
    );
    const panelAnnualSummary = filters.mode === 'trends' ? filteredAnnualSummary : annualSummary;
    // Only compute the per-state breakdown when the trends panel is active —
    // it iterates all filtered features which can be 70k+ for broad year ranges.
    const stateBreakdown = useMemo(
        () => filters.mode === 'trends' ? computeStateBreakdown(filteredTracks.features) : [],
        [filteredTracks, filters.mode],
    );

    useEffect(() => {
        let cancelled = false;

        async function loadStateBoundaries() {
            try {
                const response = await fetch(US_STATES_URL);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json() as StateBoundaryCollection;
                if (!cancelled) setStateBoundaries(data);
            } catch (err) {
                console.warn('Unable to load fallback state boundaries:', err);
            }
        }

        loadStateBoundaries();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        trackLookup.current = new Map(filteredTracks.features.map((feature) => [feature.properties.id, feature]));
    }, [filteredTracks]);

    // Restore selected track from URL param when data loads or changes.
    // If selectNotableEvent stored a fly-to target (year-range navigation case), fly there too.
    useEffect(() => {
        const id = filters.selectedTrackId;
        if (!id) return;
        const feature = trackLookup.current.get(id);
        if (feature) {
            setSelectedTrackState(feature);
            const target = pendingFlyTo.current;
            if (target) {
                pendingFlyTo.current = null;
                mapRef.current?.flyTo({ center: target, zoom: 7, duration: 900 });
            }
        } else {
            setSelectedTrackState(null);
        }
    }, [filters.selectedTrackId, filteredTracks]);

    useEffect(() => {
        if (!mapContainer.current || mapRef.current || webglUnavailable) return;

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
                        attribution: '&copy; OpenStreetMap &copy; CARTO',
                    },
                },
                layers: [{ id: 'carto-dark-layer', type: 'raster', source: 'carto-dark', minzoom: 0, maxzoom: 20 }],
            },
            center: [filters.mapLng, filters.mapLat],
            zoom: filters.mapZoom,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '260px', className: 'tornado-popup' });
        const canvas = map.getCanvas();
        const handleContextLost = (event: Event) => {
            event.preventDefault();
            setWebglUnavailable(true);
        };
        const handleContextRestored = () => {
            setWebglUnavailable(false);
        };
        canvas.addEventListener('webglcontextlost', handleContextLost);
        canvas.addEventListener('webglcontextrestored', handleContextRestored);

        map.on('load', () => {
            map.addSource('tornado-tracks', { type: 'geojson', data: EMPTY_TRACKS });
            map.addSource('tornado-track-points', { type: 'geojson', data: EMPTY_TRACK_POINTS });
            map.addSource('tornado-points', { type: 'geojson', data: EMPTY_POINTS });
            map.addSource('selected-tornado-track', { type: 'geojson', data: EMPTY_TRACKS });
            map.addSource('us-states', { type: 'geojson', data: EMPTY_STATE_BOUNDARIES });

            map.addLayer({
                id: 'us-state-fill',
                type: 'fill',
                source: 'us-states',
                paint: {
                    'fill-color': '#0ea5e9',
                    'fill-opacity': 0.04,
                },
            });

            map.addLayer({
                id: 'us-state-outline',
                type: 'line',
                source: 'us-states',
                paint: {
                    'line-color': '#334155',
                    'line-opacity': 0.65,
                    'line-width': 0.8,
                },
            });

            // De-emphasized grey layers for out-of-state tracks (hidden until a state is selected).
            map.addLayer({
                id: 'tornado-tracks-bg-halo',
                type: 'line',
                source: 'tornado-tracks',
                layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
                paint: {
                    'line-color': '#09090b',
                    'line-opacity': 0.5,
                    'line-width': EF_HALO_WIDTH_EXPRESSION,
                },
            });

            map.addLayer({
                id: 'tornado-tracks-bg-line',
                type: 'line',
                source: 'tornado-tracks',
                layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
                paint: {
                    'line-color': '#52525b',
                    'line-opacity': 0.22,
                    'line-width': EF_LINE_WIDTH_EXPRESSION,
                },
            });

            map.addLayer({
                id: 'tornado-tracks-bg-point',
                type: 'circle',
                source: 'tornado-track-points',
                layout: { 'circle-sort-key': ['coalesce', ['get', 'scale'], -1], visibility: 'none' },
                paint: {
                    'circle-color': '#52525b',
                    'circle-opacity': 0.18,
                    'circle-radius': EF_RADIUS_EXPRESSION,
                    'circle-stroke-color': '#09090b',
                    'circle-stroke-opacity': 0.5,
                    'circle-stroke-width': 0.5,
                },
            });

            map.addLayer({
                id: 'tornado-density',
                type: 'heatmap',
                source: 'tornado-points',
                layout: { visibility: 'none' },
                paint: {
                    'heatmap-weight': ['interpolate', ['linear'], ['coalesce', ['get', 'scale'], 0], -1, 0.25, 0, 0.4, 2, 0.8, 5, 1.5],
                    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 2, 0.7, 6, 1.6],
                    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 2, 7, 6, 22, 9, 36],
                    'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.88, 8, 0.35],
                    'heatmap-color': [
                        'interpolate', ['linear'], ['heatmap-density'],
                        0, 'rgba(8, 47, 73, 0)',
                        0.2, '#155e75',
                        0.45, '#14b8a6',
                        0.7, '#facc15',
                        0.88, '#fb923c',
                        1, '#f0abfc',
                    ],
                },
            });

            map.addLayer({
                id: 'tornado-track-halo',
                type: 'line',
                source: 'tornado-tracks',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#020617',
                    'line-opacity': 0.65,
                    'line-width': EF_HALO_WIDTH_EXPRESSION,
                },
            });

            map.addLayer({
                id: 'tornado-track-line',
                type: 'line',
                source: 'tornado-tracks',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': SCALE_COLOR_EXPRESSION,
                    'line-opacity': EF_LINE_OPACITY_EXPRESSION,
                    'line-width': EF_LINE_WIDTH_EXPRESSION,
                },
            });

            map.addLayer({
                id: 'tornado-track-point',
                type: 'circle',
                source: 'tornado-track-points',
                // Higher EF events are drawn on top so they are never buried
                // under lower-EF dots in dense regions.
                layout: { 'circle-sort-key': ['coalesce', ['get', 'scale'], -1] },
                paint: {
                    'circle-color': SCALE_COLOR_EXPRESSION,
                    'circle-opacity': EF_CIRCLE_OPACITY_EXPRESSION,
                    'circle-radius': EF_RADIUS_EXPRESSION,
                    'circle-stroke-color': '#020617',
                    'circle-stroke-opacity': 0.8,
                    'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 2, 0.7, 6, 1.4, 9, 2.0],
                },
            });

            map.addLayer({
                id: 'selected-tornado-track-line',
                type: 'line',
                source: 'selected-tornado-track',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#f8fafc',
                    'line-opacity': 0.95,
                    'line-width': ['interpolate', ['linear'], ['zoom'], 2, 2.5, 7, 5.5, 10, 8],
                    'line-blur': 0.5,
                },
            });

            // A simple flag to prevent a track click from also triggering state
            // selection. Track handlers run first (registered first); they set this flag
            // which is cleared after the current event via setTimeout.
            let trackClickConsumed = false;

            for (const layerId of ['tornado-track-line', 'tornado-track-point']) {
                map.on('mouseenter', layerId, () => {
                    map.getCanvas().style.cursor = 'pointer';
                });

                map.on('mouseleave', layerId, () => {
                    map.getCanvas().style.cursor = '';
                    popupRef.current?.remove();
                });

                map.on('mousemove', layerId, (event) => {
                    const rendered = event.features?.[0];
                    const id = rendered?.properties?.id as string | undefined;
                    const feature = id ? trackLookup.current.get(id) : null;
                    if (!feature || !event.lngLat) return;
                    popupRef.current?.setLngLat(event.lngLat).setHTML(formatPopup(feature)).addTo(map);
                });

                map.on('click', layerId, (event) => {
                    const rendered = event.features?.[0];
                    const id = rendered?.properties?.id as string | undefined;
                    const feature = id ? trackLookup.current.get(id) : null;
                    if (feature) {
                        trackClickConsumed = true;
                        window.setTimeout(() => { trackClickConsumed = false; }, 0);
                        setSelectedTrack(feature);
                    }
                });
            }

            map.on('mouseenter', 'us-state-fill', () => {
                map.getCanvas().style.cursor = 'pointer';
            });

            map.on('mouseleave', 'us-state-fill', () => {
                map.getCanvas().style.cursor = '';
            });

            map.on('click', 'us-state-fill', (event) => {
                if (trackClickConsumed) return;
                const state = event.features?.[0]?.properties?.abbr as string | undefined;
                if (state) selectStateRef.current(state);
            });

            map.resize();
            requestAnimationFrame(() => map.resize());
            setMapLoaded(true);
        });

        map.on('error', (event) => {
            const message = event.error?.message || String(event);
            if (/webgl|context/i.test(message)) setWebglUnavailable(true);
            console.error('MapLibre error:', message);
        });

        map.on('moveend', () => {
            const center = map.getCenter();
            setMapViewRef.current(center.lat, center.lng, map.getZoom());
        });

        mapRef.current = map;

        return () => {
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener('webglcontextrestored', handleContextRestored);
            popupRef.current?.remove();
            map.remove();
            mapRef.current = null;
        };
        // webglUnavailable intentionally omitted: the effect must only run once on mount.
        // The upfront check (webglUnavailable initial state) prevents map creation when WebGL is
        // already unavailable; the contextlost/contextrestored listeners handle runtime changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;
        (map.getSource('tornado-tracks') as maplibregl.GeoJSONSource).setData(mapAllTracks);
        (map.getSource('tornado-track-points') as maplibregl.GeoJSONSource).setData(mapAllTrackPoints);
        (map.getSource('tornado-points') as maplibregl.GeoJSONSource).setData(filteredPoints);
    }, [mapLoaded, mapAllTracks, mapAllTrackPoints, filteredPoints]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;
        (map.getSource('us-states') as maplibregl.GeoJSONSource).setData(stateBoundaries ?? EMPTY_STATE_BOUNDARIES);
    }, [mapLoaded, stateBoundaries]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;
        const trackVisible = filters.mode !== 'density';
        const bgVisible = trackVisible && !!filters.selectedState;
        map.setLayoutProperty('tornado-density', 'visibility', filters.mode === 'density' ? 'visible' : 'none');
        map.setLayoutProperty('tornado-track-halo', 'visibility', trackVisible ? 'visible' : 'none');
        map.setLayoutProperty('tornado-track-line', 'visibility', trackVisible ? 'visible' : 'none');
        map.setLayoutProperty('tornado-track-point', 'visibility', trackVisible ? 'visible' : 'none');
        map.setLayoutProperty('tornado-tracks-bg-halo', 'visibility', bgVisible ? 'visible' : 'none');
        map.setLayoutProperty('tornado-tracks-bg-line', 'visibility', bgVisible ? 'visible' : 'none');
        map.setLayoutProperty('tornado-tracks-bg-point', 'visibility', bgVisible ? 'visible' : 'none');
        const trackColorExpr = filters.colorMode === 'scale'
            ? SCALE_COLOR_EXPRESSION
            : filters.colorMode === 'decade'
                ? DECADE_COLOR_EXPRESSION
                : YEAR_COLOR_EXPRESSION;
        map.setPaintProperty('tornado-track-line', 'line-color', trackColorExpr);
        map.setPaintProperty('tornado-track-point', 'circle-color', trackColorExpr);
    }, [mapLoaded, filters.mode, filters.colorMode, filters.selectedState]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;
        const selectedState = filters.selectedState ?? '';
        const selectedStateMatch = ['==', ['get', 'abbr'], selectedState] as unknown as maplibregl.ExpressionSpecification;
        map.setPaintProperty('us-state-fill', 'fill-opacity', ['case', selectedStateMatch, 0.22, 0.04]);
        map.setPaintProperty('us-state-outline', 'line-color', ['case', selectedStateMatch, '#e0f2fe', '#334155']);
        map.setPaintProperty('us-state-outline', 'line-width', ['case', selectedStateMatch, 2.2, 0.8]);
        map.setPaintProperty('us-state-outline', 'line-opacity', ['case', selectedStateMatch, 0.95, 0.65]);
        // Filter track layers so in-state tracks render in full colour and
        // out-of-state tracks are caught by the grey background layers.
        if (filters.selectedState) {
            const inStateFilter = ['==', ['get', 'state'], filters.selectedState] as unknown as maplibregl.FilterSpecification;
            const outStateFilter = ['!=', ['get', 'state'], filters.selectedState] as unknown as maplibregl.FilterSpecification;
            map.setFilter('tornado-track-halo', inStateFilter);
            map.setFilter('tornado-track-line', inStateFilter);
            map.setFilter('tornado-track-point', inStateFilter);
            map.setFilter('tornado-tracks-bg-halo', outStateFilter);
            map.setFilter('tornado-tracks-bg-line', outStateFilter);
            map.setFilter('tornado-tracks-bg-point', outStateFilter);
        } else {
            map.setFilter('tornado-track-halo', null);
            map.setFilter('tornado-track-line', null);
            map.setFilter('tornado-track-point', null);
            map.setFilter('tornado-tracks-bg-halo', null);
            map.setFilter('tornado-tracks-bg-line', null);
            map.setFilter('tornado-tracks-bg-point', null);
        }
    }, [mapLoaded, filters.selectedState]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;
        const selectedCollection: TornadoTrackCollection = selectedTrack
            ? { type: 'FeatureCollection', features: [selectedTrack] }
            : EMPTY_TRACKS;
        (map.getSource('selected-tornado-track') as maplibregl.GeoJSONSource).setData(selectedCollection);
    }, [mapLoaded, selectedTrack]);

    const selectNotableEvent = useCallback((event: NotableTornadoEvent) => {
        // trackLookup is a Map<id, feature> kept in sync with filteredTracks —
        // use it instead of a linear scan over tracks?.features.
        const match = trackLookup.current.get(event.id) ?? null;
        if (match) {
            setSelectedTrack(match);
            const map = mapRef.current;
            const first = match.geometry.coordinates[0] as [number, number] | undefined;
            if (map && first) map.flyTo({ center: first, zoom: 7, duration: 900 });
        } else {
            // The event is not in the current year filter — navigate to its year so the
            // data loads, then auto-select via the URL selectedTrackId param.
            // Store the first coordinate so the restore effect can fly to the track.
            const firstCoord = event.coordinates[0] as [number, number] | undefined;
            pendingFlyTo.current = firstCoord ?? null;
            setYearRange(event.year, event.year);
            setSelectedTrackId(event.id);
        }
    }, [setSelectedTrack, setYearRange, setSelectedTrackId]);

    const filterSummary = `${normalizedRange.startYear === normalizedRange.endYear ? normalizedRange.startYear : `${normalizedRange.startYear}-${normalizedRange.endYear}`} · ${REGION_LABELS[filters.region]}`;
    const showStaticFallback = webglUnavailable;

    return (
        <div className="relative h-full w-full overflow-hidden bg-[#020617] text-zinc-100">
            <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            {showStaticFallback && (
                <StaticTornadoFallback
                    tracks={filteredTracks}
                    bgTracks={bgTracks}
                    region={filters.region}
                    states={stateBoundaries}
                    selectedTrackId={selectedTrack?.properties.id}
                    selectedState={filters.selectedState}
                    onSelectTrack={setSelectedTrack}
                    onSelectState={handleSelectState}
                />
            )}

            <div className="absolute left-3 top-3 z-20 flex max-w-[calc(100vw-5.5rem)] flex-wrap items-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-950/90 p-2 text-xs shadow-2xl backdrop-blur-md md:left-6 md:top-6">
                <Link to="/projects/tornado-tracks" className="rounded-md px-2 py-1.5 font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
                    ← rsmb.tv
                </Link>
                <button
                    type="button"
                    onClick={handleShare}
                    className="rounded-md px-2 py-1.5 font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    title="Copy link to clipboard"
                >
                    {copiedUrl ? '✓ Copied' : 'Share'}
                </button>
                <div className="h-5 w-px bg-zinc-700" />
                <div className="grid grid-cols-3 rounded-md bg-zinc-900 p-1">
                    {(['tracks', 'density', 'trends'] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setMode(mode)}
                            className={`rounded px-2 py-1 capitalize ${filters.mode === mode ? 'bg-sky-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'}`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
                <div className="hidden text-zinc-400 sm:block">{filters.selectedState ? `${selectedStateName} · ${filterSummary}` : filterSummary}</div>
            </div>

            <TornadoSummaryPanel
                stats={stats}
                stateBreakdown={stateBreakdown}
                selectedTrack={selectedTrack}
                notableEvents={notableEvents}
                annualSummary={panelAnnualSummary}
                warningSummary={warningSummary}
                startYear={normalizedRange.startYear}
                endYear={normalizedRange.endYear}
                scaleFilter={filters.scaleFilter}
                region={filters.region}
                colorMode={filters.colorMode}
                mode={filters.mode}
                selectedState={filters.selectedState}
                selectedStateName={selectedStateName}
                collapsed={summaryCollapsed}
                onCollapseChange={setSummaryCollapsed}
                onScaleFilterChange={setScaleFilter}
                onRegionChange={setRegion}
                onSelectedStateChange={setSelectedState}
                onColorModeChange={setColorMode}
                onModeChange={setMode}
                onSelectEvent={selectNotableEvent}
                onCloseSelection={() => setSelectedTrack(null)}
            />

            <TornadoTimeline
                annualSummary={filters.mode === 'trends' ? panelAnnualSummary : annualSummary}
                startYear={normalizedRange.startYear}
                endYear={normalizedRange.endYear}
                minYear={minYear}
                maxYear={maxYear}
                onYearRangeChange={setYearRange}
                onPlayingChange={setTimelinePlaying}
                collapsed={timelineCollapsed}
                onCollapseChange={setTimelineCollapsed}
            />

            <div className="absolute bottom-[15rem] left-3 z-20 rounded-md border border-zinc-700/80 bg-zinc-950/85 px-2.5 py-1.5 text-xs text-zinc-400 shadow-xl backdrop-blur md:hidden">
                {stats.count.toLocaleString()} tracks · {stats.ef2Plus.toLocaleString()} EF2+
            </div>

            {filteredTracks.features.length > LARGE_TRACK_WARNING_THRESHOLD && !timelinePlaying && (
                <div className="absolute left-3 top-[4.5rem] z-20 rounded-md border border-amber-700/60 bg-amber-950/90 px-3 py-2 text-xs text-amber-300 shadow-xl backdrop-blur md:left-6">
                    {filteredTracks.features.length.toLocaleString()} tracks — map may be slow. Try narrowing the year range or scale filter.
                </div>
            )}

            {(loading || error) && !timelinePlaying && (
                <div className="absolute inset-0 z-30 grid place-items-center bg-zinc-950/60 backdrop-blur-sm">
                    <div className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 shadow-2xl">
                        {error ? `Unable to load tornado data: ${error}` : 'Loading tornado tracks...'}
                    </div>
                </div>
            )}
        </div>
    );
}