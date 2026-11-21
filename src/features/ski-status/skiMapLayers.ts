import type { FeatureCollection, Point } from 'geojson';
import type { ExpressionSpecification, Map as MapLibreMap } from '../../maps/maplibre';
import { passFamilySchema, skiAreaMapPoint, skiAreas, type SkiArea } from './catalog';
import type { ResortStatus } from './conditions';
import { markerAppearance, multiplePassColor, passBadgeId, passBadgeSize, passBadgeTextColor, resortMarkerColor, statusMarkers, type MarkerMode } from './mapAppearance';
import type { SkiPassSelection } from './browse';
import { passIconUrls } from './passIcons';
import { skiResortIcon } from './resortDetailsData';
import type { SkiArchive } from './useSkiArchive';

export const sourceId = 'ski-areas';
export const selectionSource = 'ski-area-selection';
export const pointLayer = 'ski-area-points';
export const selectedLayer = 'ski-area-selected';
const statusLayer = 'ski-area-status';
const selectedStatusLayer = 'ski-area-selected-status';
export const resortIconLayer = 'ski-area-icons';
const selectedResortIconLayer = 'ski-area-selected-icon';
const passBadgeLayer = 'ski-status-pass-badges';
const selectedPassBadgeLayer = 'ski-status-selected-pass-badge';
const passImagePrefix = 'ski-status-pass-badge-';
const selectedPassImagePrefix = 'ski-status-selected-pass-badge-';
const statusImagePrefix = 'ski-status-mark-';
const resortImagePrefix = 'ski-resort-image-';
const mountainImage = 'ski-area-mountain';
const resortImageSize = 20;
const showResortIcon: ExpressionSpecification = ['==', ['get', 'markerMode'], 'default'];
const markerBackground = '#182938';
export const markerLayers = [selectedLayer, pointLayer, statusLayer, selectedStatusLayer, resortIconLayer, selectedResortIconLayer, passBadgeLayer, selectedPassBadgeLayer];
const resortIconScale: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 0, 0.16, 3, 0.24, 6, 0.5, 9, 0.8, 12, 1];
const selectedIconScale: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 0, 0.68, 5, 0.8, 9, 0.95, 12, 1];
const resortNameMinZoom = 7;

export function areaFeatures(areas: readonly SkiArea[], mode: MarkerMode, statuses: ReadonlyMap<string, ResortStatus>, passes?: SkiPassSelection): FeatureCollection<Point> {
    return { type: 'FeatureCollection', features: areas.map(area => {
        const status = statuses.get(area.id) ?? 'unknown';
        const appearance = mode === 'operatingStatus' ? statusMarkers[status] : markerAppearance(area, mode, passes);
        return {
            type: 'Feature', id: area.id,
            properties: {
                areaId: area.id, name: area.name, markerMode: mode, color: appearance.color, passBadge: 'passBadge' in appearance ? appearance.passBadge : '',
                statusIcon: mode === 'operatingStatus' ? `${statusImagePrefix}${status}` : '',
            },
            geometry: { type: 'Point', coordinates: skiAreaMapPoint(area) },
        };
    }) };
}

function drawImage(map: MapLibreMap, id: string, size: number, draw: (context: CanvasRenderingContext2D) => void | false, update = false) {
    const pixelRatio = 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size * pixelRatio;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(pixelRatio, pixelRatio);
    if (draw(context) === false) return;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    if (update) map.updateImage(id, pixels);
    else map.addImage(id, pixels, { pixelRatio });
}

function addMountainImage(map: MapLibreMap) {
    drawImage(map, mountainImage, resortImageSize, context => {
        context.beginPath();
        context.moveTo(1.5, 17.5);
        context.lineTo(7, 7);
        context.lineTo(10, 12);
        context.lineTo(13.5, 3);
        context.lineTo(18.5, 17.5);
        context.closePath();
        context.strokeStyle = markerBackground;
        context.lineWidth = 2;
        context.lineJoin = 'round';
        context.stroke();
        context.fillStyle = resortMarkerColor;
        context.fill();
    });
}

function loadResortImage(url: string) {
    return new Promise<HTMLImageElement | undefined>(resolve => {
        // Use the browser decoder for both PNG files and resort favicons.
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(undefined);
        image.src = url;
    });
}

export async function loadResortImages(archive?: SkiArchive) {
    const images = await Promise.all(skiAreas.flatMap(({ id }) => {
        const local = archive?.get(id);
        const runtime = skiResortIcon(id);
        const candidates = [local?.mapIcon, local?.detailsIcon, runtime].filter(url => url !== undefined);
        if (!candidates.length) return [];
        return [(async () => {
            for (const url of new Set(candidates)) {
                const image = await loadResortImage(url);
                if (image) return { id, image, archived: url !== runtime };
            }
        })()];
    }));
    return images.filter(image => image !== undefined);
}

function drawResortIcon(context: CanvasRenderingContext2D, image: HTMLImageElement) {
    const sampleSize = context.canvas.width;
    const sampleScale = sampleSize / Math.max(image.naturalWidth, image.naturalHeight);
    context.imageSmoothingQuality = 'high';
    context.save();
    context.resetTransform();
    context.drawImage(image, 0, 0, image.naturalWidth * sampleScale, image.naturalHeight * sampleScale);
    const { data } = context.getImageData(0, 0, sampleSize, sampleSize);
    context.clearRect(0, 0, sampleSize, sampleSize);
    context.restore();

    // Sample the visible artwork at sprite resolution so transparent padding does not affect the fit or backing.
    let left = sampleSize;
    let top = sampleSize;
    let right = 0;
    let bottom = 0;
    let dark = 0;
    let light = 0;
    for (let y = 0; y < sampleSize; y++) {
        for (let x = 0; x < sampleSize; x++) {
            const index = (y * sampleSize + x) * 4;
            const alpha = data[index + 3];
            if (alpha < 32) continue;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x + 1);
            bottom = Math.max(bottom, y + 1);
            const tone = data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;
            if (tone < 140) dark += alpha;
            else light += alpha;
        }
    }
    if (!right) return false;

    const sourceX = left / sampleScale;
    const sourceY = top / sampleScale;
    const sourceWidth = Math.min(right / sampleScale, image.naturalWidth) - sourceX;
    const sourceHeight = Math.min(bottom / sampleScale, image.naturalHeight) - sourceY;
    const scale = (resortImageSize - 3) / Math.max(sourceWidth, sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    const lightBacking = dark >= light;
    context.beginPath();
    context.roundRect(0.5, 0.5, resortImageSize - 1, resortImageSize - 1, 3.5);
    context.fillStyle = lightBacking ? '#edf5fa' : markerBackground;
    context.fill();
    context.save();
    context.clip();
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight,
        (resortImageSize - width) / 2, (resortImageSize - height) / 2, width, height);
    context.restore();
    context.strokeStyle = lightBacking ? markerBackground : '#a2b7c7';
    context.stroke();
}

export function addResortImages(map: MapLibreMap, images: Awaited<ReturnType<typeof loadResortImages>>) {
    if (!map.hasImage(mountainImage)) return;
    for (const { id, image, archived } of images) {
        const name = resortImagePrefix + id;
        const update = map.hasImage(name);
        if (update && !archived) continue;
        drawImage(map, name, resortImageSize, context => drawResortIcon(context, image), update);
    }
    const available = images.filter(({ id }) => map.hasImage(resortImagePrefix + id)).map(({ id }) => id);
    const icon: string | ExpressionSpecification = available.length > 0
        ? ['image', ['match', ['get', 'areaId'], available, ['concat', resortImagePrefix, ['get', 'areaId']], mountainImage]]
        : mountainImage;
    for (const layer of [resortIconLayer, selectedResortIconLayer]) map.setLayoutProperty(layer, 'icon-image', icon);
}

function addStatusImages(map: MapLibreMap) {
    for (const [status, { glyph, color }] of Object.entries(statusMarkers)) {
        drawImage(map, statusImagePrefix + status, 20, context => {
            context.beginPath();
            context.arc(10, 10, status === 'unknown' ? 6 : 9, 0, Math.PI * 2);
            context.fillStyle = markerBackground;
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

export function addAreaLayers(map: MapLibreMap, data: FeatureCollection<Point>, selection: FeatureCollection<Point>) {
    const labelLayer = map.getStyle().layers.find(layer => layer.type === 'symbol' && ['vector'].includes(map.getSource(layer.source)?.type ?? ''));
    map.addSource(sourceId, {
        type: 'geojson', data,
        attribution: '<a href="https://www.openskidata.org/">OpenSkiData</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
    });
    map.addSource(selectionSource, { type: 'geojson', data: selection });
    addMountainImage(map);
    const hasResortIcons = map.hasImage(mountainImage);
    // Keep the circle hit areas for precise pointer and touch selection behind the icons.
    const circleOpacity: number | ExpressionSpecification = hasResortIcons ? ['case', showResortIcon, 0, 1] : 1;
    map.addLayer({
        id: pointLayer, type: 'circle', source: sourceId,
        paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 1.25, 3, 2, 6, 4, 10, 6],
            'circle-color': ['get', 'color'], 'circle-stroke-color': markerBackground,
            'circle-opacity': circleOpacity, 'circle-stroke-opacity': circleOpacity,
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 6, 1],
        },
    });
    if (labelLayer && map.getGlyphs()) {
        map.addLayer({
            id: 'ski-area-names', type: 'symbol', source: sourceId, minzoom: resortNameMinZoom,
            layout: {
                'text-field': ['get', 'name'], 'text-font': ['Open Sans Regular'],
                'text-size': ['interpolate', ['linear'], ['zoom'], resortNameMinZoom, 10, 9, 12, 12, 13],
                'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 1.2,
                'text-max-width': 12, 'text-justify': 'auto',
            },
            paint: {
                'text-opacity': ['interpolate', ['linear'], ['zoom'], resortNameMinZoom, 0, 8, 0.52, 9.5, 1],
                'text-color': '#e4f2f6', 'text-halo-color': '#182938', 'text-halo-width': 1.5,
            },
        });
    }
    addStatusImages(map);
    map.addLayer({
        id: statusLayer, type: 'symbol', source: sourceId,
        layout: {
            'icon-image': ['image', ['get', 'statusIcon']], 'icon-size': resortIconScale,
            'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'viewport',
        },
    });
    map.addLayer({
        id: selectedLayer, type: 'circle', source: selectionSource,
        paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 7, 5, 8, 9, 9.5, 12, 10],
            'circle-color': hasResortIcons ? ['case', showResortIcon, markerBackground, ['get', 'color']] : ['get', 'color'],
            'circle-stroke-color': '#fbbf24', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 2, 10, 3],
        },
    });
    map.addLayer({
        id: selectedStatusLayer, type: 'symbol', source: selectionSource,
        layout: {
            'icon-image': ['image', ['get', 'statusIcon']], 'icon-size': selectedIconScale,
            'icon-allow-overlap': true, 'icon-rotation-alignment': 'viewport',
        },
    });
    if (hasResortIcons) {
        for (const [id, source, selected] of [[resortIconLayer, sourceId, false], [selectedResortIconLayer, selectionSource, true]] as const) {
            map.addLayer({
                id, type: 'symbol', source, filter: showResortIcon,
                layout: {
                    'icon-image': mountainImage, 'icon-size': selected ? selectedIconScale : resortIconScale,
                    'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-padding': 0, 'icon-rotation-alignment': 'viewport',
                },
            }, selected ? undefined : selectedLayer);
        }
    }
}

export function filterPassBadges(map: MapLibreMap, selected?: SkiArea) {
    if (!map.getLayer(passBadgeLayer)) return;
    const badges = map.listImages().filter(id => id.startsWith(passImagePrefix)).map(id => id.slice(passImagePrefix.length));
    const hasBadge: ExpressionSpecification = ['in', ['get', 'passBadge'], ['literal', badges]];
    map.setFilter(passBadgeLayer, ['all', hasBadge, ['!=', ['get', 'areaId'], selected?.id ?? '']]);
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
                'icon-size': selected ? selectedIconScale : resortIconScale,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-rotation-alignment': 'viewport',
            },
        });
    }
}
