import { z } from 'zod';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { usStatesAndTerritories } from './geography/usStates';
import { geodesicDestination } from './geography/geodesy';
import { lineDistanceKilometers } from './routeGeometry';
import censusSnapshot from './geography/census2025.json' with { type: 'json' };

export const PINS_CENSUS_VINTAGE = censusSnapshot.vintage;
export const MAX_PIN_RADIUS_METERS = censusSnapshot.maxRadiusMeters;
/** Counts from the pinned 2025 TIGER county archive, including county equivalents. */
export const CENSUS_COUNTIES_2025: Readonly<Record<string, number>> = censusSnapshot.countyCounts;
export const CENSUS_COUNTY_COUNT = Object.values(CENSUS_COUNTIES_2025).reduce((total, count) => total + count, 0);
const JURISDICTIONS = new Map(usStatesAndTerritories.map(state => [state.fips as string, state]));
const OFFICIAL_NAMES: Readonly<Record<string, string>> = censusSnapshot.officialNames;

const longitude = z.number().finite().min(-180).max(180);
const latitude = z.number().finite().min(-90).max(90);
const position = z.tuple([longitude, latitude]);
const name = z.string().trim().min(1).max(200);
const stateNameMatches = (fips: string, value: string) => value === JURISDICTIONS.get(fips)?.name || value === OFFICIAL_NAMES[fips];

function samePosition(a: number[], b: number[], toleranceMeters = 1) {
    return lineDistanceKilometers([a, b]) * 1000 <= toleranceMeters;
}

function insideBounds(bounds: number[], point: number[]) {
    const [west, south, east, north] = bounds;
    const lng = point[0] + 360 * Math.round(((west + east) / 2 - point[0]) / 360);
    const tolerance = 0.00002; // The published bounds use five decimal places.
    return lng >= west - tolerance && lng <= east + tolerance && point[1] >= south - tolerance && point[1] <= north + tolerance;
}

function completeCounties(counties: ReadonlyArray<{ stateFips: string }>) {
    const counts = new Map<string, number>();
    for (const county of counties) counts.set(county.stateFips, (counts.get(county.stateFips) ?? 0) + 1);
    return counts.size === JURISDICTIONS.size && Object.entries(CENSUS_COUNTIES_2025).every(([fips, count]) => counts.get(fips) === count);
}

export const pinSchema = z.object({
    id: z.string(), fips: z.string().regex(/^(US|\d{2}(\d{3})?)$/),
    level: z.enum(['country', 'state', 'county']), kind: z.enum(['country', 'state', 'district', 'territory', 'county']),
    name, stateFips: z.string().regex(/^(\d{2})?$/), stateAbbr: z.string().regex(/^[A-Z]{2}$/),
    lng: longitude, lat: latitude.min(-85).max(85), radiusMeters: z.number().finite().positive().max(MAX_PIN_RADIUS_METERS),
    nearestBoundary: position, landAreaKm2: z.number().finite().nonnegative(),
    boundaryContacts: z.array(z.object({
        coordinates: position, distanceMeters: z.number().finite().positive(),
        bearingDegrees: z.number().finite().min(-180).max(180),
    })).min(1).max(4),
    bounds: z.tuple([z.number().finite().min(-180).max(180), latitude, z.number().finite().min(-180).max(540), latitude])
        .refine(([w, s, e, n]) => w < e && e - w <= 360 && s < n, 'Invalid geographic bounds'),
}).superRefine((pin, ctx) => {
    if (pin.radiusMeters > MAX_PIN_RADIUS_METERS) return;
    if (pin.boundaryContacts.some(contact => Math.abs(contact.distanceMeters - pin.radiusMeters) > Math.min(100, pin.radiusMeters * 0.01) + 2)) {
        ctx.addIssue({ code: 'custom', message: 'Boundary contact is not near the circle radius' });
    }
    const primary = pin.boundaryContacts[0];
    if (!primary || !samePosition(primary.coordinates, pin.nearestBoundary) || Math.abs(primary.distanceMeters - pin.radiusMeters) > 1) {
        ctx.addIssue({ code: 'custom', message: 'Primary boundary contact disagrees with the radius' });
    }
    if (!insideBounds(pin.bounds, [pin.lng, pin.lat]) || !insideBounds(pin.bounds, pin.nearestBoundary)) {
        ctx.addIssue({ code: 'custom', message: 'Pin or boundary point is outside its jurisdiction bounds' });
    }
    for (const [index, contact] of pin.boundaryContacts.entries()) {
        const endpoint = geodesicDestination(pin.lng, pin.lat, contact.bearingDegrees, contact.distanceMeters);
        if (!samePosition(endpoint, contact.coordinates) || !insideBounds(pin.bounds, contact.coordinates)) {
            ctx.addIssue({ code: 'custom', message: 'Boundary contact has inconsistent coordinates, bearing, or distance' });
        }
        if (pin.boundaryContacts.slice(0, index).some(previous => Math.abs((previous.bearingDegrees - contact.bearingDegrees + 540) % 360 - 180) < 24.99999)) {
            ctx.addIssue({ code: 'custom', message: 'Duplicate boundary contact direction' });
        }
    }
    if (pin.level === 'country') {
        if (pin.id !== 'country-US' || pin.fips !== 'US' || pin.kind !== 'country' || pin.stateFips !== '' || pin.stateAbbr !== 'US' || pin.name !== 'United States') {
            ctx.addIssue({ code: 'custom', message: 'Invalid national identity' });
        }
        return;
    }
    const state = JURISDICTIONS.get(pin.stateFips);
    if (!state || state.abbr !== pin.stateAbbr || pin.id !== `${pin.level}-${pin.fips}`
        || (pin.level === 'county' ? pin.kind !== 'county' || pin.fips.length !== 5 || !pin.fips.startsWith(pin.stateFips)
            : pin.fips !== pin.stateFips || !stateNameMatches(pin.fips, pin.name) || pin.kind !== (pin.fips === '11' ? 'district' : Number(pin.fips) > 56 ? 'territory' : 'state'))) {
        ctx.addIssue({ code: 'custom', message: 'Invalid jurisdiction identity' });
    }
});

export const pinsDataSchema = z.object({
    metadata: z.object({
        vintage: z.literal(PINS_CENSUS_VINTAGE), generatedAt: z.iso.datetime({ offset: true }), source: z.string().min(1),
        sourceSha256: z.object({ state: z.literal(censusSnapshot.sourceSha256.state), county: z.literal(censusSnapshot.sourceSha256.county) }),
        method: z.string(), coverage: z.string(), water: z.string(),
        searchToleranceMeters: z.number().positive(), solveSimplificationMeters: z.number().nonnegative(),
        stateCount: z.literal(usStatesAndTerritories.length), countyCount: z.literal(CENSUS_COUNTY_COUNT),
        countryCount: z.literal(1), nationalDefinition: z.string().min(1),
    }),
    pins: z.array(pinSchema),
}).superRefine(({ metadata, pins }, ctx) => {
    const states = pins.filter(pin => pin.level === 'state');
    const counties = pins.filter(pin => pin.level === 'county');
    const countries = pins.filter(pin => pin.level === 'country');
    if (countries.length !== metadata.countryCount || states.length !== metadata.stateCount || counties.length !== metadata.countyCount
        || states.length !== usStatesAndTerritories.length || new Set(pins.map(pin => pin.id)).size !== pins.length
        || !completeCounties(counties)) {
        ctx.addIssue({ code: 'custom', message: 'Incomplete or duplicate pin coverage' });
    }
});

export type Pin = z.infer<typeof pinSchema>;
export type PinsData = z.infer<typeof pinsDataSchema>;
export type BoundaryProperties = { id: string; fips: string; name: string; stateFips: string };
export type Boundaries = FeatureCollection<Polygon | MultiPolygon, BoundaryProperties>;

const ring = z.array(position).min(4).refine(points => {
    if (points[0][0] !== points.at(-1)![0] || points[0][1] !== points.at(-1)![1]
        || points.some((point, index) => index > 0 && Math.abs(point[0] - points[index - 1][0]) > 180)) return false;
    const [originX, originY] = points[0];
    const area = points.slice(1).reduce((total, point, index) => total
        + (points[index][0] - originX) * (point[1] - originY) - (point[0] - originX) * (points[index][1] - originY), 0);
    return Math.abs(area) > 1e-14;
}, 'Ring is unclosed or has no area');
const polygon = z.array(ring).min(1);
const boundariesSchema = z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(z.object({
        type: z.literal('Feature'), id: z.string(),
        properties: z.object({ id: z.string(), fips: z.string(), name, stateFips: z.string() }),
        geometry: z.discriminatedUnion('type', [
            z.object({ type: z.literal('Polygon'), coordinates: polygon }),
            z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(polygon).min(1) }),
        ]),
    })).min(1),
});

export function parseBoundaries(value: unknown, expectedLevel?: 'state' | 'county'): Boundaries {
    const data = boundariesSchema.parse(value);
    const level = expectedLevel ?? (data.features[0].id.startsWith('state-') ? 'state' : 'county');
    const expectedCount = level === 'state' ? JURISDICTIONS.size : CENSUS_COUNTY_COUNT;
    if (data.features.length !== expectedCount || new Set(data.features.map(feature => feature.id)).size !== expectedCount) {
        throw new Error(`Incomplete or duplicate ${level} boundaries`);
    }
    for (const feature of data.features) {
        const properties = feature.properties;
        const state = JURISDICTIONS.get(properties.stateFips);
        if (!state || feature.id !== properties.id || feature.id !== `${level}-${properties.fips}`
            || (level === 'state' ? properties.fips !== state.fips || !stateNameMatches(state.fips, properties.name)
                : !/^\d{5}$/.test(properties.fips) || !properties.fips.startsWith(state.fips))) {
            throw new Error(`Invalid ${level} boundary identity`);
        }
    }
    if (level === 'county' && !completeCounties(data.features.map(feature => feature.properties))) throw new Error('Incomplete county coverage');
    return data;
}

export const parseStateBoundaries = (value: unknown) => parseBoundaries(value, 'state');
export const parseCountyBoundaries = (value: unknown) => parseBoundaries(value, 'county');
