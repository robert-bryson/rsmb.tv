import { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTemperatureData } from '../hooks/useTemperatureData';
import { INITIAL_CENTER, MIN_ZOOM, MAX_ZOOM, FRESHNESS_COLORS, yearToColor } from '../constants';

type RecordType = 'high' | 'low';

/**
 * Map showing county all-time records colored by when they were set.
 * Older records are cool colors, recent records are warm — revealing where records are "freshest".
 */
export function RecordFreshnessMap() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [recordType, setRecordType] = useState<RecordType>('high');

    const { countyRecords, loading } = useTemperatureData();

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
                layers: [{
                    id: 'carto-dark-layer',
                    type: 'raster',
                    source: 'carto-dark',
                    minzoom: 0,
                    maxzoom: 20,
                }],
            },
            center: INITIAL_CENTER,
            zoom: 3.8,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        map.on('load', () => {
            map.resize();
            setMapLoaded(true);
        });

        mapRef.current = map;
        return () => { map.remove(); mapRef.current = null; };
    }, []);

    // Add/update data layer
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded || !countyRecords) return;

        // Filter features by selected record type and add a year property
        const features = countyRecords.features
            .filter(f => f.properties.type === recordType)
            .map(f => {
                const dateStr = f.properties.date || '';
                const year = dateStr.length >= 4 ? parseInt(dateStr.slice(0, 4), 10) : 1900;
                return {
                    ...f,
                    properties: {
                        ...f.properties,
                        year: isNaN(year) ? 1900 : year,
                        color: yearToColor(isNaN(year) ? 1900 : year),
                    },
                };
            });

        const geojson = {
            type: 'FeatureCollection' as const,
            features,
        };

        const sourceId = 'freshness-records';
        if (map.getSource(sourceId)) {
            (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson as GeoJSON.GeoJSON);
        } else {
            map.addSource(sourceId, { type: 'geojson', data: geojson as GeoJSON.GeoJSON });

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
                },
                paint: {
                    'text-color': '#d4d4d8',
                    'text-halo-color': '#000000',
                    'text-halo-width': 1,
                },
            });

            // Click popup
            map.on('click', 'freshness-circles', (e) => {
                if (!e.features?.length) return;
                const p = e.features[0].properties;
                const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];
                const typeLabel = p.type === 'high' ? 'Record High' : 'Record Low';

                new maplibregl.Popup({ closeButton: true, maxWidth: '260px', className: 'dark-popup' })
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

                const el = document.querySelector('.dark-popup .maplibregl-popup-content') as HTMLElement;
                if (el) el.style.cssText = 'background:transparent;padding:0;box-shadow:none;border:none;';
                const tip = document.querySelector('.dark-popup .maplibregl-popup-tip') as HTMLElement;
                if (tip) tip.style.borderTopColor = '#18181b';
                const close = document.querySelector('.dark-popup .maplibregl-popup-close-button') as HTMLElement;
                if (close) close.style.cssText = 'color:#a1a1aa;font-size:16px;right:4px;top:4px;';
            });

            map.on('mouseenter', 'freshness-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', 'freshness-circles', () => { map.getCanvas().style.cursor = ''; });
        }
    }, [mapLoaded, countyRecords, recordType]);

    return (
        <div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-1">Record Freshness Map</h3>
            <p className="text-xs text-zinc-400 mb-3">
                Each dot is a county's all-time record, colored by when it was set.
                <span style={{ color: '#dc2626' }}> Red = recent</span>, <span style={{ color: '#1e3a5f' }}>blue = oldest</span>.
                Areas with more recent records indicate where climate extremes are shifting.
            </p>

            {/* Record type toggle */}
            <div className="flex gap-2 mb-3">
                {(['high', 'low'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setRecordType(t)}
                        className={`px-3 py-1 text-xs rounded border transition-colors ${recordType === t
                            ? 'bg-zinc-700 border-zinc-500 text-zinc-100'
                            : 'bg-zinc-900/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200'
                            }`}
                    >
                        {t === 'high' ? '🔥 Record Highs' : '❄️ Record Lows'}
                    </button>
                ))}
            </div>

            <div className="relative rounded-lg overflow-hidden border border-zinc-700/50" style={{ height: 400 }}>
                <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />

                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/80 z-10">
                        <div className="text-zinc-400 text-sm animate-pulse">Loading...</div>
                    </div>
                )}

                {/* Color legend */}
                <div className="absolute bottom-3 left-3 z-10 bg-zinc-900/90 backdrop-blur rounded px-3 py-2 text-[10px] text-zinc-400 border border-zinc-700/50">
                    <div className="flex items-center gap-1 mb-1 text-zinc-300 font-medium">Year record was set</div>
                    <div className="flex gap-0.5">
                        {FRESHNESS_COLORS.map(([year, color]) => (
                            <div key={year} className="flex flex-col items-center">
                                <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: color }} />
                                <span className="mt-0.5">{year}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
