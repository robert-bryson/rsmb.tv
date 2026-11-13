import type { FeatureCollection, LineString } from 'geojson';
import { pinContext, type MapPin } from '../../../shared/worldPins';
import { destination, formatRadius } from './geometry';
import type { ExpressionSpecification } from '../../maps/maplibre';
import { PIN_MAX_ZOOM, ZOOM_FADE } from './zoom';

export const RADIUS_MIN_ZOOM = { country: 4, state: 5, county: 10 } as const;
export const RADIUS_MIN_PIXELS = 70;

/** Composite paint stops fade each spoke at its own screen-size threshold.
 * Keep zoom at the top level, as required by the MapLibre expression grammar. */
export function radiusOpacity(minimumZoom: number): ExpressionSpecification {
    const stops: Array<number | ExpressionSpecification> = [];
    for (let zoom = minimumZoom; zoom < PIN_MAX_ZOOM; zoom++) {
        stops.push(zoom, ['case', ['<', ['get', 'minimumZoom'], zoom], 0.8, 0],
            zoom + ZOOM_FADE, ['case', ['<=', ['get', 'minimumZoom'], zoom], 0.8, 0]);
    }
    // Features that first become readable at the zoom limit cannot wait for a
    // fade beyond it. The layer filter keeps them hidden before this last stop.
    stops.push(PIN_MAX_ZOOM, ['case', ['<=', ['get', 'minimumZoom'], PIN_MAX_ZOOM], 0.8, 0]);
    return ['interpolate', ['linear'], ['zoom'], ...stops] as ExpressionSpecification;
}

export function radiusLabelMinimumZoom(minimumZoom: number) {
    return Math.max(minimumZoom, Math.min(minimumZoom + ZOOM_FADE, PIN_MAX_ZOOM));
}

export interface RadiusProperties {
    id: string;
    pinId: string;
    level: MapPin['level'];
    name: string;
    label: string;
    distanceMeters: number;
    selected: boolean;
    minimumZoom: number;
}
export type RadiusLines = FeatureCollection<LineString, RadiusProperties>;

export function radiusMinimumZoom(pin: MapPin) {
    const metersPerPixelAtZero = 40_075_016.686 * Math.cos(pin.lat * Math.PI / 180) / 512;
    return Math.max(RADIUS_MIN_ZOOM[pin.level], Math.ceil(Math.log2(RADIUS_MIN_PIXELS * metersPerPixelAtZero / pin.radiusMeters)));
}

export function radiusLines(pins: MapPin[], unit: 'mi' | 'km', selectedId: string | null): RadiusLines {
    return { type: 'FeatureCollection', features: pins.flatMap(pin => pin.boundaryContacts.map((contact, index) => {
        const segments = Math.max(2, Math.ceil(contact.distanceMeters / 25_000));
        const coordinates = Array.from({ length: segments + 1 }, (_, step) => destination(pin.lng, pin.lat, contact.bearingDegrees, contact.distanceMeters * step / segments));
        // Retain the published endpoint exactly, with a continuous longitude at the date line.
        coordinates[0] = [pin.lng, pin.lat];
        coordinates[segments] = [pin.lng + ((contact.coordinates[0] - pin.lng + 540) % 360 - 180), contact.coordinates[1]];
        return { type: 'Feature' as const, properties: {
            id: `${pin.id}:${index}`, pinId: pin.id, level: pin.level,
            name: pinContext(pin) ? `${pin.name}, ${pinContext(pin)}` : pin.name,
            label: formatRadius(contact.distanceMeters, unit), distanceMeters: contact.distanceMeters,
            selected: pin.id === selectedId,
            minimumZoom: radiusMinimumZoom(pin),
        }, geometry: { type: 'LineString' as const, coordinates } };
    })) };
}
