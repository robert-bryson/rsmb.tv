import { mapCameraCodec } from '../../maps/mapCamera';

type Coordinate = readonly [number, number];

export interface SkiMapArea {
    center: [number, number];
    zoom: number;
    outline: readonly Coordinate[];
}

export const skiMapMinZoom = -2;
export const skiMapMaxZoom = 16;
export const { encode: encodeSkiMapCamera, read: readSkiMapCamera } = mapCameraCodec(skiMapMinZoom, skiMapMaxZoom);
const edgeSamples = 24;
const outlineSize = 4 * edgeSamples;
const coordinateScale = 1e8;
const zoomScale = 1e5;
const degrees = Math.PI / 180;

function projectFrom(center: Coordinate) {
    const centerLatitude = center[1] * degrees;
    const sinCenter = Math.sin(centerLatitude);
    const cosCenter = Math.cos(centerLatitude);
    return ([longitude, latitude]: Coordinate) => {
        const delta = (longitude - center[0]) * degrees;
        const sinLatitude = Math.sin(latitude * degrees);
        const cosLatitude = Math.cos(latitude * degrees);
        const facing = cosLatitude * Math.cos(delta);
        return {
            x: cosLatitude * Math.sin(delta),
            y: cosCenter * sinLatitude - sinCenter * facing,
            front: sinCenter * sinLatitude + cosCenter * facing >= 0,
        };
    };
}

/** Sample the rendered perimeter, including the visible limb when a pixel falls outside the globe. */
export function captureSkiMapArea(center: Coordinate, zoom: number, width: number, height: number,
    unproject: (point: [number, number]) => Coordinate): SkiMapArea {
    const normalized: [number, number] = [((center[0] + 180) % 360 + 360) % 360 - 180, center[1]];
    const rounded = normalized.map(value => Math.round(value * coordinateScale) / coordinateScale) as [number, number];
    const project = projectFrom(rounded);
    const edges: Coordinate[] = [[0, 0], [width, 0], [width, height], [0, height]];
    const outline = edges.flatMap(([x, y], index) => {
        const [nextX, nextY] = edges[(index + 1) % edges.length];
        return Array.from({ length: edgeSamples }, (_, sample): Coordinate => {
            const ratio = sample / edgeSamples;
            const point = project(unproject([x + (nextX - x) * ratio, y + (nextY - y) * ratio]));
            return [point.x, point.y];
        });
    });
    return { center: rounded, zoom, outline };
}

// The outline uses a plane centered on the searched view. Longitudes can cross 180°
// without splitting the outline, and the back of the globe never matches the front.
export function skiMapAreaContains(area: SkiMapArea) {
    const project = projectFrom(area.center);
    return (coordinates: Coordinate) => {
        const { x, y, front } = project(coordinates);
        if (!front) return false;
        let inside = false;
        for (let index = 0, last = area.outline.length - 1; index < area.outline.length; last = index++) {
            const [x1, y1] = area.outline[last];
            const [x2, y2] = area.outline[index];
            if ((y1 > y) !== (y2 > y) && x < x1 + (x2 - x1) * (y - y1) / (y2 - y1)) inside = !inside;
        }
        return inside;
    };
}

export function encodeSkiMapArea({ center, zoom, outline }: SkiMapArea) {
    const encode = (value: number, scale: number) => Math.round(value * scale).toString(36);
    return ['1', ...center.map(value => encode(value, coordinateScale)), encode(zoom, zoomScale),
        ...outline.flatMap(point => point.map(value => encode(value, coordinateScale)))].join('.');
}

export function readSkiMapArea(value: string | null): SkiMapArea | undefined {
    if (!value || value.length > 1800) return;
    const [version, ...parts] = value.split('.');
    if (version !== '1' || parts.length !== 3 + outlineSize * 2 || parts.some(part => !/^-?[0-9a-z]{1,7}$/.test(part))) return;
    const [longitude, latitude, scaledZoom, ...points] = parts.map(part => Number.parseInt(part, 36));
    if (Math.abs(longitude) > 180 * coordinateScale || Math.abs(latitude) > 90 * coordinateScale ||
        points.some(point => Math.abs(point) > coordinateScale)) return;
    const zoom = scaledZoom / zoomScale;
    if (zoom < skiMapMinZoom || zoom > skiMapMaxZoom) return;
    const outline = Array.from({ length: outlineSize }, (_, index): Coordinate =>
        [points[2 * index] / coordinateScale, points[2 * index + 1] / coordinateScale]);
    return { center: [longitude / coordinateScale, latitude / coordinateScale], zoom, outline };
}
