import type { FeatureCollection, Point } from 'geojson';
import type { ExpressionSpecification, Map as MapLibreMap } from '../../maps/maplibre';
import { passFamilySchema, type SkiArea } from './catalog';
import { isSkiingStatus, type ResortStatus } from './conditions';
import { markerAppearance, multiplePassColor, passBadgeId, passBadgeSize, passBadgeTextColor, statusMarkers, type MarkerMode } from './mapAppearance';
import type { PassFilter } from './browse';
import { passIconUrls } from './passIcons';

export const sourceId = 'ski-areas';
export const selectionSource = 'ski-area-selection';
export const pointLayer = 'ski-area-points';
export const selectedLayer = 'ski-area-selected';
export const clusterLayer = 'ski-area-clusters';
const clusterCountLayer = 'ski-area-cluster-counts';
const statusLayer = 'ski-area-status';
const selectedStatusLayer = 'ski-area-selected-status';
const passBadgeLayer = 'ski-status-pass-badges';
const selectedPassBadgeLayer = 'ski-status-selected-pass-badge';
const passImagePrefix = 'ski-status-pass-badge-';
const selectedPassImagePrefix = 'ski-status-selected-pass-badge-';
const statusImagePrefix = 'ski-status-mark-';
const countImagePrefix = 'ski-status-count-';
export const markerLayers = [selectedLayer, pointLayer, statusLayer, selectedStatusLayer, passBadgeLayer, selectedPassBadgeLayer];
const unclustered: ExpressionSpecification = ['!', ['has', 'point_count']];
const participating: ExpressionSpecification = ['>', ['get', 'skiingCount'], 0];
const resortIconScale: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 3, 0.55, 6, 0.75, 9, 1];

export function areaFeatures(areas: readonly SkiArea[], mode: MarkerMode, statuses: ReadonlyMap<string, ResortStatus>, pass?: PassFilter): FeatureCollection<Point> {
    return { type: 'FeatureCollection', features: areas.map(area => {
        const status = statuses.get(area.id) ?? 'unknown';
        const appearance = mode === 'operatingStatus' ? statusMarkers[status] : markerAppearance(area, mode, pass);
        return {
            type: 'Feature', id: area.id,
            properties: {
                areaId: area.id, name: area.name, color: appearance.color, passBadge: 'passBadge' in appearance ? appearance.passBadge : '',
                statusIcon: mode === 'operatingStatus' ? `${statusImagePrefix}${status}` : '',
                skiing: Number(isSkiingStatus(status)),
            },
            geometry: { type: 'Point', coordinates: area.location.coordinates },
        };
    }) };
}

function drawImage(map: MapLibreMap, id: string, size: number, draw: (context: CanvasRenderingContext2D) => void) {
    const pixelRatio = 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size * pixelRatio;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(pixelRatio, pixelRatio);
    draw(context);
    map.addImage(id, context.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio });
}

export function addCountImage(map: MapLibreMap, id: string) {
    if (!id.startsWith(countImagePrefix) || map.hasImage(id)) return;
    const count = id.slice(countImagePrefix.length);
    if (!/^\d{1,4}$/.test(count)) return;
    drawImage(map, id, 30, context => {
        context.font = 'bold 13px system-ui, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#142b39';
        context.fillText(count, 15, 15);
    });
}

function addStatusImages(map: MapLibreMap) {
    for (const [status, { glyph, color }] of Object.entries(statusMarkers)) {
        drawImage(map, statusImagePrefix + status, 20, context => {
            context.beginPath();
            context.arc(10, 10, status === 'unknown' ? 6 : 9, 0, Math.PI * 2);
            context.fillStyle = '#182938';
            context.fill();
            context.strokeStyle = color;
            context.lineWidth = status === 'unknown' ? 0.65 : 1;
            context.stroke();
            if (status === 'unknown') return;
            context.fillStyle = color;
            context.font = 'bold 13px system-ui, sans-serif';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(glyph, 10, 10);
        });
    }
}

export function updateClusterStyle(map: MapLibreMap, mode: MarkerMode) {
    const conditions = mode === 'operatingStatus';
    const count = conditions ? 'skiingCount' : 'point_count';
    map.setPaintProperty(clusterLayer, 'circle-color', conditions ? ['case', participating, '#b6e7f2', '#243747'] : '#b6e7f2');
    map.setPaintProperty(clusterLayer, 'circle-stroke-color', conditions ? ['case', participating, '#182938', '#647887'] : '#182938');
    map.setPaintProperty(clusterLayer, 'circle-radius', conditions
        ? ['case', participating, ['interpolate', ['linear'], ['get', count], 1, 14, 25, 20, 150, 25], 5]
        : ['interpolate', ['linear'], ['get', count], 2, 14, 25, 20, 150, 25]);
    map.setFilter(clusterCountLayer, ['all', ['has', 'point_count'], ['>', ['get', count], 0]]);
    map.setLayoutProperty(clusterCountLayer, 'icon-image', ['concat', countImagePrefix, ['to-string', ['get', count]]]);
}

export function addAreaLayers(map: MapLibreMap, data: FeatureCollection<Point>, selection: FeatureCollection<Point>, mode: MarkerMode) {
    const labelLayer = map.getStyle().layers.find(layer => layer.type === 'symbol' && ['vector'].includes(map.getSource(layer.source)?.type ?? ''));
    map.addSource(sourceId, {
        type: 'geojson', data, cluster: true, clusterRadius: 38, clusterMaxZoom: 2,
        clusterProperties: { skiingCount: ['+', ['get', 'skiing']] },
        attribution: '<a href="https://www.openskidata.org/">OpenSkiData</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
    });
    map.addSource(selectionSource, { type: 'geojson', data: selection });
    map.addLayer({
        id: pointLayer, type: 'circle', source: sourceId, filter: unclustered,
        paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3, 6, 4, 10, 6],
            'circle-color': ['get', 'color'], 'circle-stroke-color': '#182938', 'circle-stroke-width': 1,
        },
    });
    map.addLayer({
        id: clusterLayer, type: 'circle', source: sourceId, filter: ['has', 'point_count'],
        paint: { 'circle-stroke-width': 1.5, 'circle-pitch-alignment': 'viewport' },
    });
    map.addLayer({
        id: clusterCountLayer, type: 'symbol', source: sourceId, filter: ['has', 'point_count'],
        layout: { 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'viewport' },
    });
    if (labelLayer && map.getGlyphs()) {
        map.addLayer({
            id: 'ski-area-names', type: 'symbol', source: sourceId, filter: unclustered, minzoom: 8,
            layout: {
                'text-field': ['get', 'name'], 'text-size': 12, 'text-font': ['Open Sans Regular'],
                'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 1.2,
                'text-max-width': 12,
            },
            paint: { 'text-color': '#e4f2f6', 'text-halo-color': '#182938', 'text-halo-width': 1.5 },
        });
    }
    addStatusImages(map);
    map.addLayer({
        id: statusLayer, type: 'symbol', source: sourceId, filter: unclustered,
        layout: { 'icon-image': ['image', ['get', 'statusIcon']], 'icon-size': resortIconScale, 'icon-rotation-alignment': 'viewport' },
    });
    map.addLayer({
        id: selectedLayer, type: 'circle', source: selectionSource,
        paint: { 'circle-radius': 10, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fbbf24', 'circle-stroke-width': 3 },
    });
    map.addLayer({
        id: selectedStatusLayer, type: 'symbol', source: selectionSource,
        layout: { 'icon-image': ['image', ['get', 'statusIcon']], 'icon-allow-overlap': true, 'icon-rotation-alignment': 'viewport' },
    });
    updateClusterStyle(map, mode);
}

export function filterPassBadges(map: MapLibreMap, selected?: SkiArea) {
    if (!map.getLayer(passBadgeLayer)) return;
    const badges = map.listImages().filter(id => id.startsWith(passImagePrefix)).map(id => id.slice(passImagePrefix.length));
    const hasBadge: ExpressionSpecification = ['in', ['get', 'passBadge'], ['literal', badges]];
    map.setFilter(passBadgeLayer, ['all', unclustered, hasBadge, ['!=', ['get', 'areaId'], selected?.id ?? '']]);
    map.setFilter(selectedPassBadgeLayer, hasBadge);
}

export async function loadPassImages(map: MapLibreMap) {
    return Promise.all(passFamilySchema.options.map(async family => {
        try {
            return { family, image: (await map.loadImage(passIconUrls[family])).data };
        } catch {
            return { family };
        }
    }));
}

function drawPassBadge(context: CanvasRenderingContext2D, image: CanvasImageSource, multiple: boolean, selected: boolean) {
    context.clearRect(0, 0, passBadgeSize, passBadgeSize);
    const inset = 1.5;
    const size = passBadgeSize - 2 * inset;
    context.beginPath();
    context.roundRect(inset, inset, size, size, 4);
    context.fillStyle = passBadgeTextColor;
    context.fill();
    context.save();
    context.clip();
    context.drawImage(image, inset, inset, size, size);
    context.restore();
    context.strokeStyle = selected ? '#fbbf24' : passBadgeTextColor;
    context.lineWidth = selected ? 2.5 : 1.5;
    context.stroke();

    if (!multiple) return;
    const corner = passBadgeSize - 6;
    context.beginPath();
    context.arc(corner, corner, 5.5, 0, Math.PI * 2);
    context.fillStyle = multiplePassColor;
    context.fill();
    context.strokeStyle = passBadgeTextColor;
    context.lineWidth = 1;
    context.stroke();
    context.beginPath();
    context.moveTo(corner - 2.5, corner);
    context.lineTo(corner + 2.5, corner);
    context.moveTo(corner, corner - 2.5);
    context.lineTo(corner, corner + 2.5);
    context.lineWidth = 1.6;
    context.stroke();
}

export function addPassBadges(map: MapLibreMap, images: Awaited<ReturnType<typeof loadPassImages>>) {
    if (map.getLayer(passBadgeLayer) || !images.some(({ image }) => image)) return;
    const pixelRatio = 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = passBadgeSize * pixelRatio;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.scale(pixelRatio, pixelRatio);
    for (const { family, image } of images) {
        if (!image) continue;
        for (const multiple of [false, true]) {
            for (const selected of [false, true]) {
                drawPassBadge(context, image, multiple, selected);
                const id = (selected ? selectedPassImagePrefix : passImagePrefix) + passBadgeId(family, multiple);
                map.addImage(id, context.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio });
            }
        }
    }

    for (const [id, prefix] of [[passBadgeLayer, passImagePrefix], [selectedPassBadgeLayer, selectedPassImagePrefix]]) {
        const selected = id === selectedPassBadgeLayer;
        map.addLayer({
            id, type: 'symbol', source: selected ? selectionSource : sourceId,
            layout: {
                'icon-image': ['image', ['concat', prefix, ['get', 'passBadge']]],
                'icon-size': selected ? ['interpolate', ['linear'], ['zoom'], 2, 0.68, 5, 0.8, 9, 0.95, 12, 1] : resortIconScale,
                'icon-allow-overlap': selected,
                'icon-ignore-placement': true,
                'icon-rotation-alignment': 'viewport',
            },
        });
    }
}
