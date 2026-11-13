import type { FeatureCollection, LineString } from 'geojson';
import type { Pin } from '../../../shared/pins';
import { destination, formatRadius } from './geometry';

export const RADIUS_MIN_ZOOM = { country: 4, state: 6, county: 9 } as const;
export const RADIUS_MIN_PIXELS = 70;

export interface RadiusProperties {
    id: string;
    pinId: string;
    level: Pin['level'];
    name: string;
    label: string;
    distanceMeters: number;
    selected: boolean;
    minimumZoom: number;
}
export type RadiusLines = FeatureCollection<LineString, RadiusProperties>;

export function radiusMinimumZoom(pin: Pin) {
    const metersPerPixelAtZero = 40_075_016.686 * Math.cos(pin.lat * Math.PI / 180) / 512;
    return Math.max(RADIUS_MIN_ZOOM[pin.level], Math.ceil(Math.log2(RADIUS_MIN_PIXELS * metersPerPixelAtZero / pin.radiusMeters)));
}

export function radiusLines(pins: Pin[], unit: 'mi' | 'km', selectedId: string | null): RadiusLines {
    return { type: 'FeatureCollection', features: pins.flatMap(pin => pin.boundaryContacts.map((contact, index) => {
        const segments = Math.max(2, Math.ceil(contact.distanceMeters / 25_000));
        const coordinates = Array.from({ length: segments + 1 }, (_, step) => destination(pin.lng, pin.lat, contact.bearingDegrees, contact.distanceMeters * step / segments));
        // Retain the published endpoint exactly, with a continuous longitude at the date line.
        coordinates[0] = [pin.lng, pin.lat];
        coordinates[segments] = [pin.lng + ((contact.coordinates[0] - pin.lng + 540) % 360 - 180), contact.coordinates[1]];
        return { type: 'Feature' as const, properties: {
            id: `${pin.id}:${index}`, pinId: pin.id, level: pin.level,
            name: pin.level === 'county' ? `${pin.name}, ${pin.stateAbbr}` : pin.name,
            label: formatRadius(contact.distanceMeters, unit), distanceMeters: contact.distanceMeters,
            selected: pin.id === selectedId,
            minimumZoom: radiusMinimumZoom(pin),
        }, geometry: { type: 'LineString' as const, coordinates } };
    })) };
}

export function visibleRadiusPins(pins: Pin[], zoom: number, circles: boolean, showCounties: boolean, selected: Pin | null) {
    const visible = pins.filter(pin => pin.id === selected?.id
        || (circles && (pin.level !== 'county' || showCounties) && zoom >= radiusMinimumZoom(pin)));
    if (selected && !visible.some(pin => pin.id === selected.id)) visible.push(selected);
    return visible;
}
