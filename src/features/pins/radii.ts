import type { FeatureCollection, LineString } from 'geojson';
import { pinContext, type MapPin } from '../../../shared/worldPins';
import { destination, formatRadius } from './geometry';
import type { ExpressionSpecification } from '../../maps/maplibre';
import { featureZoomFade, PIN_MAX_ZOOM, screenSizeZoom, ZOOM_FADE } from './zoom';

export const RADIUS_MIN_ZOOM = { country: 4, state: 5, county: 6 } as const;
export const RADIUS_MIN_PIXELS = 70;

/** Composite paint stops fade each spoke at its own screen-size threshold.
 * Keep zoom at the top level, as required by the MapLibre expression grammar. */
export function radiusOpacity(minimumZoom: number): ExpressionSpecification {
    return featureZoomFade(minimumZoom, 'minimumZoom', 0.7);
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
    return screenSizeZoom(pin, RADIUS_MIN_PIXELS, RADIUS_MIN_ZOOM[pin.level]);
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
