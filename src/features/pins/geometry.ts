import { geodesicDestination as destination } from '../../../shared/geography/geodesy';
export { geodesicDestination as destination } from '../../../shared/geography/geodesy';
import type { FeatureCollection, Point, Polygon } from 'geojson';
import { pinContext, pinDisplayCode, pinStateFips, type MapPin } from '../../../shared/worldPins';
import { countyDetailZooms, COUNTY_ZOOM } from './zoom';
export { COUNTY_ZOOM } from './zoom';

export type CountyMode = 'off' | 'auto' | 'on';
export const OVERVIEW_BOUNDS: [number, number, number, number] = [-125, 24, -66, 50];
export const STATE_COLOR = '#f5bd63';
export const COUNTY_COLOR = '#69d2c1';
export const NATIONAL_COLOR = '#c3a2f6';
export const CONTEXT_COLOR = '#93a1af';
const NO_CONTEXT: ReadonlySet<string> = new Set();
// Geometry is independent of units, selection, and context styling. Weak keys
// release it when its pin dataset is no longer retained by the resource cache.
const circleGeometry: Partial<Record<number, WeakMap<MapPin, Polygon>>> = { 48: new WeakMap(), 72: new WeakMap() };
export const COUNTY_CIRCLE_STEPS = 48;

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

export function pinCircles(pins: MapPin[], steps = 72, context: ReadonlySet<string> = NO_CONTEXT): FeatureCollection<Polygon> {
    return { type: 'FeatureCollection', features: pins.map(pin => {
        const cache = circleGeometry[steps];
        let geometry = cache?.get(pin);
        if (!geometry) {
            const ring = Array.from({ length: steps }, (_, step) => destination(pin.lng, pin.lat, step * 360 / steps, pin.radiusMeters));
            // Six decimal places are about 0.1 m. Overview county circles do
            // not need full double precision in the worker message.
            if (steps === COUNTY_CIRCLE_STEPS) for (const point of ring) {
                point[0] = Math.round(point[0] * 1e6) / 1e6;
                point[1] = Math.round(point[1] * 1e6) / 1e6;
            }
            ring.push(ring[0]);
            geometry = { type: 'Polygon', coordinates: [ring] };
            cache?.set(pin, geometry);
        }
        return { type: 'Feature', properties: { id: pin.id, level: pin.level, context: context.has(pin.id),
            ...(pin.level === 'county' ? { countyCircleZoom: countyDetailZooms(pin).countyCircleZoom } : {}) }, geometry };
    }) };
}

export function pinPoints(pins: MapPin[], context: ReadonlySet<string> = NO_CONTEXT): FeatureCollection<Point> {
    return { type: 'FeatureCollection', features: pins.map(pin => ({
        type: 'Feature', id: pin.id,
        properties: { id: pin.id, level: pin.level, name: pin.name, radiusMeters: pin.radiusMeters,
            ...(pin.level === 'county' ? countyDetailZooms(pin) : {}),
            context: context.has(pin.id), stateAbbr: pinDisplayCode(pin), stateFips: pinStateFips(pin), label: pin.id === 'country-US' ? 'U.S. pole' : pin.name },
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
