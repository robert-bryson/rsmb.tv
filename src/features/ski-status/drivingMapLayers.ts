import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Map, GeoJSONSource, Point, SymbolLayerSpecification } from '../../maps/maplibre';
import type { DrivingPoint } from '../../../shared/skiDriving';
import { drawImage } from './skiMapLayers';
import { drivingReportLabels, type DrivingFeature } from './drivingView';

const source = 'ski-driving';
const casing = 'ski-driving-casing';
const connector = 'ski-driving-connector';
const closed = 'ski-driving-closure';
const restricted = 'ski-driving-restriction';
const regional = 'ski-driving-regional';
const local = 'ski-driving-local';

const icons = {
    pass: { symbol: '▲', color: '#d7e6f6', label: 'Mountain pass' },
    parking: { symbol: 'P', color: '#9ee0ff', label: 'Parking entrance' },
    camera: { symbol: 'C', color: '#dacbff', label: 'Road camera' },
    report: { symbol: 'i', color: '#e6ecef', label: 'Road report' },
    closure: { symbol: '×', color: '#ffaba6', label: 'Closure' },
    restriction: { symbol: '!', color: '#ffdf88', label: 'Restriction' },
} as const;

function featureIcon(feature: DrivingFeature): keyof typeof icons {
    if (feature.kind !== 'report') return feature.kind;
    const { state, entry } = feature.report;
    return state === 'active' && (entry.kind === 'closure' || entry.kind === 'restriction') ? entry.kind : 'report';
}

export function mapDrivingLabel(feature: DrivingFeature) {
    if (feature.kind === 'report' && feature.report.state === 'scheduled') {
        return `Scheduled ${drivingReportLabels[feature.report.entry.kind].toLowerCase()}`;
    }
    return icons[featureIcon(feature)].label;
}

export function visibleDrivingZoom(feature: DrivingFeature) {
    return feature.kind === 'parking' || feature.kind === 'camera' ? 11 : 8;
}

export function drivingMapData(features: readonly DrivingFeature[], lines: readonly DrivingPoint[][]): FeatureCollection {
    const rendered: Feature<Geometry>[] = lines.map(coordinates => ({
        type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: { type: 'approach' },
    }));
    for (const feature of features) {
        const icon = featureIcon(feature);
        rendered.push({
            type: 'Feature', geometry: { type: 'Point', coordinates: feature.point },
            properties: { id: feature.id, type: feature.kind, icon: `${source}-${icon}`,
                priority: ({ closure: 0, restriction: 1, parking: 2, pass: 3, report: 4, camera: 5 })[icon] },
        });
        if (feature.kind === 'report' && (icon === 'closure' || icon === 'restriction') && feature.report.entry.line) {
            rendered.push({
                type: 'Feature', geometry: { type: 'LineString', coordinates: feature.report.entry.line },
                properties: { type: icon },
            });
        }
    }
    return { type: 'FeatureCollection', features: rendered };
}

export function syncDrivingMap(map: Map, data: FeatureCollection | undefined) {
    const current = map.getSource<GeoJSONSource>(source);
    if (!data) {
        if (current) {
            for (const layer of [casing, connector, closed, restricted, regional, local]) map.removeLayer(layer);
            map.removeSource(source);
        }
        return;
    }
    if (current) { current.setData(data); return; }
    map.addSource(source, { type: 'geojson', data,
        attribution: 'Approach geometry © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' });
    for (const [key, { symbol, color }] of Object.entries(icons)) {
        drawImage(map, `${source}-${key}`, 26, context => {
            context.beginPath();
            context.roundRect(1, 1, 24, 24, 6);
            context.fillStyle = '#101b26';
            context.fill();
            context.lineWidth = 2;
            context.strokeStyle = color;
            context.stroke();
            context.fillStyle = color;
            context.font = 'bold 16px system-ui';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(symbol, 13, 13);
        });
    }
    const layout = { 'line-cap': 'round', 'line-join': 'round' } as const;
    map.addLayer({ id: casing, type: 'line', source, minzoom: 10, layout,
        filter: ['==', ['get', 'type'], 'approach'], paint: { 'line-color': '#071522', 'line-width': 7 } });
    map.addLayer({ id: connector, type: 'line', source, minzoom: 10, layout,
        filter: ['==', ['get', 'type'], 'approach'], paint: { 'line-color': '#f6f4ff', 'line-width': 3.5 } });
    for (const [id, type, dash] of [[closed, 'closure', [1.4, 1]], [restricted, 'restriction', [3.5, 1.4]]] as const) {
        map.addLayer({ id, type: 'line', source, minzoom: 8, layout, filter: ['==', ['get', 'type'], type],
            paint: { 'line-color': icons[type].color, 'line-width': 5, 'line-dasharray': [...dash] } });
    }
    const markerLayout: SymbolLayerSpecification['layout'] = {
        'icon-image': ['get', 'icon'], 'symbol-sort-key': ['get', 'priority'], 'icon-padding': 2,
    };
    map.addLayer({ id: regional, type: 'symbol', source, minzoom: 8,
        filter: ['in', ['get', 'type'], ['literal', ['pass', 'report']]], layout: markerLayout });
    map.addLayer({ id: local, type: 'symbol', source, minzoom: 11,
        filter: ['in', ['get', 'type'], ['literal', ['parking', 'camera']]], layout: markerLayout });
}

export function drivingHit(map: Map, position: Point, padding: number): string | undefined {
    if (!map.getLayer(regional)) return;
    const { x, y } = position;
    const features = map.queryRenderedFeatures([[x - padding, y - padding], [x + padding, y + padding]], { layers: [regional, local] });
    const id: unknown = features[0]?.properties.id;
    return typeof id === 'string' ? id : undefined;
}
