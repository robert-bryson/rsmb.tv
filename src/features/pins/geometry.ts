import { geodesicDestination as destination } from '../../../shared/geography/geodesy';
export { geodesicDestination as destination } from '../../../shared/geography/geodesy';
import type { FeatureCollection, Point, Polygon } from 'geojson';
import { pinContext, pinDisplayCode, pinStateFips, type MapPin } from '../../../shared/worldPins';

export type CountyMode = 'off' | 'auto' | 'on';
export const COUNTY_ZOOM = 6;
export const OVERVIEW_BOUNDS: [number, number, number, number] = [-125, 24, -66, 50];
export const STATE_COLOR = '#f5bd63';
export const COUNTY_COLOR = '#69d2c1';
export const NATIONAL_COLOR = '#c3a2f6';

export function countiesVisible(mode: CountyMode, zoom: number) {
    return mode === 'on' || (mode === 'auto' && zoom >= COUNTY_ZOOM);
}

export function formatRadius(meters: number, unit: 'mi' | 'km') {
    const value = meters / (unit === 'mi' ? 1609.344 : 1000);
    const digits = value < 0.01 ? 4 : value < 10 ? 2 : 1;
    return `${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${unit}`;
}

export function formatArea(areaKm2: number) {
    return `${areaKm2.toLocaleString('en-US', { maximumFractionDigits: areaKm2 < 1 ? 4 : 0 })} km²`;
}

export function pinCircles(pins: MapPin[], steps = 72): FeatureCollection<Polygon> {
    return { type: 'FeatureCollection', features: pins.map(pin => {
        const ring = Array.from({ length: steps }, (_, step) => destination(pin.lng, pin.lat, step * 360 / steps, pin.radiusMeters));
        ring.push(ring[0]);
        return { type: 'Feature', properties: { id: pin.id, level: pin.level }, geometry: { type: 'Polygon', coordinates: [ring] } };
    }) };
}

export function pinPoints(pins: MapPin[]): FeatureCollection<Point> {
    return { type: 'FeatureCollection', features: pins.map(pin => ({
        type: 'Feature', id: pin.id,
        properties: { id: pin.id, level: pin.level, name: pin.name, stateAbbr: pinDisplayCode(pin), stateFips: pinStateFips(pin), label: pin.id === 'country-US' ? 'U.S. pole' : pin.name },
        geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
    })) };
}

export function focusBounds(pin: MapPin): [number, number, number, number] {
    const distance = Math.max(pin.radiusMeters * 1.8, 2500);
    return [destination(pin.lng, pin.lat, 270, distance)[0], destination(pin.lng, pin.lat, 180, distance)[1],
        destination(pin.lng, pin.lat, 90, distance)[0], destination(pin.lng, pin.lat, 0, distance)[1]];
}

export function rankPins<T extends MapPin>(pins: T[], level: MapPin['level'], stateFips: string, query: string, sort: 'largest' | 'smallest' | 'name') {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return pins.filter(pin => pin.level === level && (!stateFips || pinStateFips(pin) === stateFips)
        && terms.every(term => `${pin.name} ${pinDisplayCode(pin)} ${pinContext(pin)} ${'fips' in pin ? pin.fips : pin.countryCode}`.toLocaleLowerCase().includes(term)))
        .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
            : (sort === 'smallest' ? a.radiusMeters - b.radiusMeters : b.radiusMeters - a.radiusMeters) || a.id.localeCompare(b.id));
}
