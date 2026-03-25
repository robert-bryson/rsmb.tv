import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTemperatureData } from '../hooks/useTemperatureData';
import { useClimateTrends } from '../hooks/useClimateTrends';
import { SummaryPanel } from './SummaryPanel';
import { RecordAgeChart } from './RecordAgeChart';
import { RecordsBrokenTimeSeries } from './RecordsBrokenTimeSeries';
import { HighLowRatioChart } from './HighLowRatioChart';
import type { BrokenRecord, ViewMode, HighlightRange } from '../types';
import {
    INITIAL_CENTER,
    INITIAL_ZOOM,
    MIN_ZOOM,
    MAX_ZOOM,
    COUNTY_ZOOM_THRESHOLD,
    HIGH_TEMP_COLOR,
    LOW_TEMP_COLOR,
    FRESHNESS_COLORS,
    yearToColor,
} from '../constants';

/** Format a date string like "1925-09-06" as "Sep 6, 1925" */
function formatDate(dateStr: string): string {
    if (!dateStr) return 'Date unknown';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Convert °F to °C */
function fToC(f: number): string {
    return ((f - 32) * 5 / 9).toFixed(1);
}

function buildPopupHTML(props: Record<string, unknown>, layerType: 'state' | 'county' | 'broken'): string {
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
        const typeLabel = isHigh ? 'NEW RECORD HIGH' : 'NEW RECORD LOW';
        return `<div style="
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            background:#18181b;color:#e4e4e7;padding:12px 14px;border-radius:8px;
            min-width:220px;line-height:1.6;font-size:13px;
            border:1px solid ${color}44;box-shadow:0 4px 20px rgba(0,0,0,.5)">
            <div style="font-size:12px;font-weight:700;color:${color};letter-spacing:.5px;margin-bottom:4px">${icon} ${typeLabel}</div>
            <div style="font-size:14px;font-weight:600;margin-bottom:4px">${props.stationName}</div>
            <div style="color:#a1a1aa;font-size:12px;margin-bottom:6px">${props.stateName}</div>
            <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px">
                <span style="color:${color};font-size:22px;font-weight:700">${tempF}°F</span>
                <span style="color:#71717a;font-size:12px">(${fToC(tempF)}°C)</span>
            </div>
            <div style="border-top:1px solid #27272a;padding-top:6px;font-size:12px;color:#a1a1aa">
                <div style="display:flex;justify-content:space-between;margin-bottom:2px">
                    <span style="color:#71717a">Previous record</span>
                    <span style="color:#d4d4d8">${prevF}°F on ${prevDate}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:2px">
                    <span style="color:#71717a">Margin</span>
                    <span style="color:${color}">${arrow}${margin.toFixed(1)}°F</span>
                </div>
                <div style="display:flex;justify-content:space-between">
                    <span style="color:#71717a">Date</span>
                    <span style="color:#d4d4d8">${formatDate(props.date as string)}</span>
                </div>
            </div>
        </div>`;
    }

    const typeLabel = isHigh ? 'All-Time Record High' : 'All-Time Record Low';
    const title = layerType === 'state'
        ? props.stateName as string
        : `${props.countyName}, ${props.state}`;
    const location = layerType === 'state' ? props.location as string : props.stationName as string;
    const station = layerType === 'state' ? props.station as string : '';
    const date = formatDate(props.date as string);

    return `<div style="
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        background:#18181b;color:#e4e4e7;padding:12px 14px;border-radius:8px;
        min-width:200px;line-height:1.6;font-size:13px;
        border:1px solid #3f3f46;box-shadow:0 4px 20px rgba(0,0,0,.5)">
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">${title}</div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px">
            <span style="font-size:11px">${icon}</span>
            <span style="color:${color};font-size:20px;font-weight:700">${tempF}°F</span>
            <span style="color:#71717a;font-size:12px">(${fToC(tempF)}°C)</span>
        </div>
        <div style="font-size:11px;color:#a1a1aa;font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${typeLabel}</div>
        <div style="border-top:1px solid #27272a;padding-top:6px;font-size:12px;color:#a1a1aa">
            <div style="display:flex;justify-content:space-between;margin-bottom:2px">
                <span style="color:#71717a">Date</span>
                <span style="color:#d4d4d8">${date}</span>
            </div>
            ${location ? `<div style="display:flex;justify-content:space-between;margin-bottom:2px">
                <span style="color:#71717a">Location</span>
                <span style="color:#d4d4d8">${location}</span>
            </div>` : ''}
            ${station ? `<div style="display:flex;justify-content:space-between">
                <span style="color:#71717a">Station</span>
                <span style="color:#d4d4d8">${station}</span>
            </div>` : ''}
        </div>
    </div>`;
}

export function TemperatureMap() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [showCounty, setShowCounty] = useState(false);
    const [panelOpen, setPanelOpen] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('records');
    const [freshnessType, setFreshnessType] = useState<'high' | 'low'>('high');
    const [useCelsius, setUseCelsius] = useState(false);
    const [showTrends, setShowTrends] = useState(false);
    const [highlightRange, setHighlightRange] = useState<HighlightRange | null>(null);
    const [activeChart, setActiveChart] = useState<'age' | 'timeseries' | 'ratio'>('age');
    const prevViewMode = useRef<ViewMode>('records');

    const { stateRecords, countyRecords, recentRecords, loading, error } = useTemperatureData();
    const { trends } = useClimateTrends();

    /** Build GeoJSON from broken records for the map layer */
    const brokenRecordsGeoJson = useMemo(() => {
        if (!recentRecords) return null;
        const records = recentRecords.yesterday || [];
        return {
            type: 'FeatureCollection' as const,
            features: records
                .filter((r: BrokenRecord) => r.lat && r.lon)
                .map((r: BrokenRecord) => ({
                    type: 'Feature' as const,
                    geometry: { type: 'Point' as const, coordinates: [r.lon, r.lat] },
                    properties: {
                        stationName: r.stationName,
                        state: r.state,
                        stateName: r.stateName,
                        county: r.county,
                        type: r.type,
                        tempF: r.tempF,
                        prevRecordF: r.prevRecordF,
                        prevRecordDate: r.prevRecordDate,
                        date: r.date,
                    },
                })),
        };
    }, [recentRecords]);

    /** Build freshness GeoJSON — county records colored by the year they were set */
    const freshnessGeoJson = useMemo(() => {
        if (!countyRecords) return null;
        const features = countyRecords.features
            .filter(f => f.properties.type === freshnessType)
            .map(f => {
                const dateStr = f.properties.date || '';
                const year = dateStr.length >= 4 ? parseInt(dateStr.slice(0, 4), 10) : 1900;
                const safeYear = isNaN(year) ? 1900 : year;
                return {
                    ...f,
                    properties: {
                        ...f.properties,
                        year: safeYear,
                        color: yearToColor(safeYear),
                    },
                };
            });
        return { type: 'FeatureCollection' as const, features };
    }, [countyRecords, freshnessType]);

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

        // High records — red circles with radius encoding temperature magnitude
        map.addLayer({
            id: 'state-highs',
            type: 'circle',
            source: sourceId,
            filter: ['==', ['get', 'type'], 'high'],
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 6, 6, 10, 9, 14],
                'circle-color': HIGH_TEMP_COLOR,
                'circle-opacity': 0.75,
                'circle-stroke-width': 2,
                'circle-stroke-color': 'rgba(239,68,68,0.3)',
            },
        });

        // Low records — blue circles
        map.addLayer({
            id: 'state-lows',
            type: 'circle',
            source: sourceId,
            filter: ['==', ['get', 'type'], 'low'],
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 6, 6, 10, 9, 14],
                'circle-color': LOW_TEMP_COLOR,
                'circle-opacity': 0.75,
                'circle-stroke-width': 2,
                'circle-stroke-color': 'rgba(59,130,246,0.3)',
            },
        });

        // Temperature labels — color-coded red/blue with the temp value
        map.addLayer({
            id: 'state-labels',
            type: 'symbol',
            source: sourceId,
            layout: {
                'text-field': ['concat', ['to-string', ['get', 'tempF']], '°F'],
                'text-font': ['Open Sans Bold'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 6, 13],
                'text-offset': [0, -0.1],
                'text-allow-overlap': false,
                'text-anchor': 'center',
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

            map.addLayer({
                id: 'county-highs',
                type: 'circle',
                source: sourceId,
                filter: ['==', ['get', 'type'], 'high'],
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 8, 7, 11, 11],
                    'circle-color': HIGH_TEMP_COLOR,
                    'circle-opacity': 0.7,
                    'circle-stroke-width': 1.5,
                    'circle-stroke-color': 'rgba(239,68,68,0.3)',
                },
            });

            map.addLayer({
                id: 'county-lows',
                type: 'circle',
                source: sourceId,
                filter: ['==', ['get', 'type'], 'low'],
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 8, 7, 11, 11],
                    'circle-color': LOW_TEMP_COLOR,
                    'circle-opacity': 0.7,
                    'circle-stroke-width': 1.5,
                    'circle-stroke-color': 'rgba(59,130,246,0.3)',
                },
            });

            map.addLayer({
                id: 'county-labels',
                type: 'symbol',
                source: sourceId,
                layout: {
                    'text-field': ['concat', ['to-string', ['get', 'tempF']], '°'],
                    'text-font': ['Open Sans Bold'],
                    'text-size': ['interpolate', ['linear'], ['zoom'], 6, 9, 10, 12],
                    'text-offset': [0, -0.1],
                    'text-anchor': 'center',
                    'text-allow-overlap': false,
                },
                paint: {
                    'text-color': [
                        'case',
                        ['==', ['get', 'type'], 'high'], '#fca5a5',
                        '#93c5fd',
                    ],
                    'text-halo-color': '#000000',
                    'text-halo-width': 1,
                },
            });
        }

        // Toggle county layer visibility based on zoom
        const countyLayers = ['county-highs', 'county-lows', 'county-labels'];
        for (const layerId of countyLayers) {
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', showCounty ? 'visible' : 'none');
            }
        }
    }, [mapLoaded, countyRecords, showCounty]);

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
        });

        // Outer glow ring
        map.addLayer({
            id: 'broken-glow',
            type: 'circle',
            source: sourceId,
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
            filter: ['==', ['get', 'type'], 'high'],
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 7, 8, 10, 11],
                'circle-color': HIGH_TEMP_COLOR,
                'circle-opacity': 0.9,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-opacity': 0.6,
            },
        });

        map.addLayer({
            id: 'broken-lows',
            type: 'circle',
            source: sourceId,
            filter: ['==', ['get', 'type'], 'low'],
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 7, 8, 10, 11],
                'circle-color': LOW_TEMP_COLOR,
                'circle-opacity': 0.9,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-opacity': 0.6,
            },
        });

        // Temperature labels for broken records
        map.addLayer({
            id: 'broken-labels',
            type: 'symbol',
            source: sourceId,
            layout: {
                'text-field': ['concat', ['to-string', ['get', 'tempF']], '°F'],
                'text-font': ['Open Sans Bold'],
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
                'text-font': ['Open Sans Bold'],
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

    // Toggle layer visibility based on viewMode
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;

        const recordLayers = ['state-highs', 'state-lows', 'state-labels', 'broken-glow', 'broken-highs', 'broken-lows', 'broken-labels'];
        const countyLayers = ['county-highs', 'county-lows', 'county-labels'];
        const freshnessLayers = ['freshness-circles', 'freshness-labels'];

        if (viewMode === 'records') {
            for (const id of recordLayers) {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
            }
            for (const id of countyLayers) {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', showCounty ? 'visible' : 'none');
            }
            for (const id of freshnessLayers) {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
            }
        } else {
            for (const id of [...recordLayers, ...countyLayers]) {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
            }
            for (const id of freshnessLayers) {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
            }
        }
    }, [mapLoaded, viewMode, showCounty]);

    // Auto-switch to freshness view when trends panel opens
    useEffect(() => {
        if (showTrends) {
            prevViewMode.current = viewMode;
            if (viewMode !== 'freshness') setViewMode('freshness');
        } else {
            setHighlightRange(null);
            if (prevViewMode.current === 'records') setViewMode('records');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showTrends]);

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

    // Update state layer opacity when zooming to county level
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;

        const stateLayers = ['state-highs', 'state-lows'];
        const stateOpacity = showCounty ? 0.3 : 0.8;
        for (const layerId of stateLayers) {
            if (map.getLayer(layerId)) {
                map.setPaintProperty(layerId, 'circle-opacity', stateOpacity);
                map.setPaintProperty(layerId, 'circle-stroke-opacity', showCounty ? 0.2 : 0.6);
            }
        }

        if (map.getLayer('state-labels')) {
            map.setPaintProperty('state-labels', 'text-opacity', showCounty ? 0.2 : 1);
        }
    }, [mapLoaded, showCounty]);

    // Popup on click — dark themed with full info
    const handleMapClick = useCallback((layerIds: string[]) => {
        const map = mapRef.current;
        if (!map) return;

        for (const layerId of layerIds) {
            map.on('click', layerId, (e) => {
                if (!e.features?.length) return;
                const props = e.features[0].properties;
                const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];
                const layerType: 'state' | 'county' | 'broken' = layerId.startsWith('broken-')
                    ? 'broken'
                    : layerId.startsWith('state-') ? 'state' : 'county';

                const popup = new maplibregl.Popup({
                    closeButton: true,
                    maxWidth: '300px',
                    className: 'dark-popup',
                })
                    .setLngLat(coords)
                    .setHTML(buildPopupHTML(props, layerType))
                    .addTo(map);

                // Ensure the popup tip + close button match the dark theme
                const el = popup.getElement();
                if (el) {
                    el.querySelectorAll('.maplibregl-popup-content').forEach(node => {
                        (node as HTMLElement).style.cssText = 'background:transparent;padding:0;box-shadow:none;border:none;';
                    });
                    el.querySelectorAll('.maplibregl-popup-tip').forEach(node => {
                        (node as HTMLElement).style.borderTopColor = '#18181b';
                    });
                    el.querySelectorAll('.maplibregl-popup-close-button').forEach(node => {
                        (node as HTMLElement).style.cssText = 'color:#a1a1aa;font-size:18px;right:6px;top:6px;';
                    });
                }
            });

            map.on('mouseenter', layerId, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = '';
            });
        }
    }, []);

    // Set up click handlers once map + data are ready
    useEffect(() => {
        if (!mapLoaded) return;
        handleMapClick(['broken-highs', 'broken-lows', 'broken-glow', 'state-highs', 'state-lows', 'county-highs', 'county-lows']);

        // Freshness layer click — separate popup style
        const map = mapRef.current;
        if (!map) return;

        map.on('click', 'freshness-circles', (e) => {
            if (!e.features?.length) return;
            const p = e.features[0].properties;
            const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];
            const typeLabel = p.type === 'high' ? 'Record High' : 'Record Low';

            const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '260px', className: 'dark-popup' })
                .setLngLat(coords)
                .setHTML(`<div style="
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                    background:#18181b;color:#e4e4e7;padding:10px 12px;border-radius:8px;
                    min-width:180px;line-height:1.5;font-size:12px;
                    border:1px solid #3f3f46;box-shadow:0 4px 20px rgba(0,0,0,.5)">
                    <div style="font-size:13px;font-weight:600">${p.countyName}, ${p.state}</div>
                    <div style="font-size:18px;font-weight:700;color:${p.color};margin:4px 0">${p.tempF}°F</div>
                    <div style="font-size:11px;color:#a1a1aa">${typeLabel} · ${p.stationName}</div>
                    <div style="font-size:11px;color:#a1a1aa">Set in <strong style="color:#e4e4e7">${p.year}</strong></div>
                </div>`)
                .addTo(map);

            const el = popup.getElement();
            if (el) {
                el.querySelectorAll('.maplibregl-popup-content').forEach(node => {
                    (node as HTMLElement).style.cssText = 'background:transparent;padding:0;box-shadow:none;border:none;';
                });
                el.querySelectorAll('.maplibregl-popup-tip').forEach(node => {
                    (node as HTMLElement).style.borderTopColor = '#18181b';
                });
                el.querySelectorAll('.maplibregl-popup-close-button').forEach(node => {
                    (node as HTMLElement).style.cssText = 'color:#a1a1aa;font-size:16px;right:4px;top:4px;';
                });
            }
        });

        map.on('mouseenter', 'freshness-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'freshness-circles', () => { map.getCanvas().style.cursor = ''; });
    }, [mapLoaded, handleMapClick]);

    if (error) {
        return (
            <div className="flex items-center justify-center h-full bg-[#0a0a0a] text-zinc-400">
                <div className="text-center p-8">
                    <p className="text-lg mb-2">Failed to load temperature data</p>
                    <p className="text-sm text-zinc-500">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full">
            <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/80 z-10">
                    <div className="text-zinc-400 text-sm animate-pulse">Loading temperature records...</div>
                </div>
            )}

            {/* Back button */}
            <a
                href="/projects"
                className="absolute top-4 left-4 z-20 bg-zinc-900/80 backdrop-blur text-zinc-300 hover:text-white px-3 py-1.5 rounded text-sm border border-zinc-700/50 hover:border-zinc-600 transition-colors"
            >
                ← Projects
            </a>

            {/* Climate Trends toggle */}
            <button
                onClick={() => setShowTrends(s => !s)}
                className={`absolute top-4 left-32 z-20 bg-zinc-900/80 backdrop-blur px-3 py-1.5 rounded text-sm border transition-colors ${
                    showTrends
                        ? 'text-violet-300 border-violet-400/50 bg-violet-900/30'
                        : 'text-violet-400 border-violet-500/30 hover:text-violet-300 hover:border-violet-400/50'
                }`}
            >
                📊 Trends
            </button>

            {/* View mode toggle */}
            <div className="absolute top-14 left-4 z-20 flex gap-1 bg-zinc-900/80 backdrop-blur rounded-lg border border-zinc-700/50 p-1">
                <button
                    onClick={() => setViewMode('records')}
                    className={`px-3 py-1.5 text-xs rounded transition-colors ${viewMode === 'records'
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                >
                    🌡️ Records
                </button>
                <button
                    onClick={() => setViewMode('freshness')}
                    className={`px-3 py-1.5 text-xs rounded transition-colors ${viewMode === 'freshness'
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                >
                    📅 Freshness
                </button>
            </div>

            {/* Legend — changes depending on view mode */}
            {viewMode === 'records' ? (
                <div className={`absolute left-4 z-20 bg-zinc-900/80 backdrop-blur rounded-lg px-4 py-3 text-xs text-zinc-300 border border-zinc-700/50 transition-all ${showTrends ? 'bottom-[44%]' : 'bottom-6'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: HIGH_TEMP_COLOR }} />
                        Record High
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: LOW_TEMP_COLOR }} />
                        Record Low
                    </div>
                    {showCounty && (
                        <div className="mt-2 pt-2 border-t border-zinc-700/50 text-zinc-400">
                            County records visible
                        </div>
                    )}
                </div>
            ) : (
                <div className={`absolute left-4 z-20 bg-zinc-900/80 backdrop-blur rounded-lg px-4 py-3 text-xs text-zinc-300 border border-zinc-700/50 transition-all ${showTrends ? 'bottom-[44%]' : 'bottom-6'}`}>
                    <div className="flex items-center gap-1 mb-1.5 text-zinc-200 font-medium">Year record was set</div>
                    <div className="flex gap-0.5">
                        {FRESHNESS_COLORS.map(([year, color]) => (
                            <div key={year} className="flex flex-col items-center">
                                <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: color }} />
                                <span className="mt-0.5 text-[10px] text-zinc-400">{year}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* °F / °C toggle */}
            <button
                onClick={() => setUseCelsius(c => !c)}
                className="absolute top-4 right-24 z-20 bg-zinc-900/80 backdrop-blur text-zinc-300 hover:text-white w-8 h-8 rounded flex items-center justify-center text-xs font-semibold border border-zinc-700/50 hover:border-zinc-600 transition-colors"
                title={useCelsius ? 'Switch to °F' : 'Switch to °C'}
            >
                {useCelsius ? '°C' : '°F'}
            </button>

            {/* Summary panel toggle */}
            <button
                onClick={() => setPanelOpen(p => !p)}
                className="absolute top-4 right-14 z-20 bg-zinc-900/80 backdrop-blur text-zinc-300 hover:text-white w-8 h-8 rounded flex items-center justify-center text-sm border border-zinc-700/50 hover:border-zinc-600 transition-colors"
                title={panelOpen ? 'Hide summary' : 'Show summary'}
            >
                {panelOpen ? '✕' : '☰'}
            </button>

            {/* Summary panel */}
            {panelOpen && !showTrends && (
                <SummaryPanel
                    viewMode={viewMode}
                    recentRecords={recentRecords}
                    countyRecords={countyRecords}
                    freshnessType={freshnessType}
                    onFreshnessTypeChange={setFreshnessType}
                    useCelsius={useCelsius}
                    onFlyTo={flyToLocation}
                />
            )}

            {/* Climate Trends drawer */}
            {showTrends && trends && (
                <div
                    className="absolute bottom-0 left-0 right-0 z-30 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-700/50 flex flex-col"
                    style={{ height: '42%', minHeight: 300 }}
                >
                    {/* Drawer header */}
                    <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-zinc-800">
                        <div className="flex items-center gap-4">
                            <h2 className="text-sm font-semibold text-zinc-200">Climate Trends</h2>
                            <nav className="flex gap-1">
                                {([
                                    { id: 'age' as const, label: 'Record Age' },
                                    { id: 'timeseries' as const, label: 'Frequency' },
                                    { id: 'ratio' as const, label: 'H:L Ratio' },
                                ] as const).map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setActiveChart(s.id)}
                                        className={`px-2.5 py-1 text-xs rounded transition-colors ${
                                            activeChart === s.id
                                                ? 'bg-zinc-700 text-violet-400'
                                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                                        }`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </nav>
                        </div>
                        <button
                            onClick={() => setShowTrends(false)}
                            className="text-zinc-400 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors text-sm"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Drawer content */}
                    <div className="flex-1 min-h-0 px-4 py-2">
                        {activeChart === 'age' && (
                            <RecordAgeChart data={trends.byDecade} onHoverPeriod={setHighlightRange} compact />
                        )}
                        {activeChart === 'timeseries' && (
                            <RecordsBrokenTimeSeries data={trends.byYear} onHoverPeriod={setHighlightRange} compact />
                        )}
                        {activeChart === 'ratio' && (
                            <HighLowRatioChart decadeData={trends.byDecade} rollingData={trends.rollingRatio} onHoverPeriod={setHighlightRange} compact />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
