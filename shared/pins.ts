import { z } from 'zod';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { usStatesAndTerritories } from './geography/usStates';
import { geographicName, pinGeometryFields, polygonGeometrySchema, validatePinGeometry } from './pinGeometry';
import censusSnapshot from './geography/census2025.json' with { type: 'json' };

export const PINS_CENSUS_VINTAGE = censusSnapshot.vintage;
export const MAX_PIN_RADIUS_METERS = censusSnapshot.maxRadiusMeters;
/** Counts from the pinned 2025 TIGER county archive, including county equivalents. */
export const CENSUS_COUNTIES_2025: Readonly<Record<string, number>> = censusSnapshot.countyCounts;
export const CENSUS_COUNTY_COUNT = Object.values(CENSUS_COUNTIES_2025).reduce((total, count) => total + count, 0);
const JURISDICTIONS = new Map(usStatesAndTerritories.map(state => [state.fips as string, state]));
const OFFICIAL_NAMES: Readonly<Record<string, string>> = censusSnapshot.officialNames;

const stateNameMatches = (fips: string, value: string) => value === JURISDICTIONS.get(fips)?.name || value === OFFICIAL_NAMES[fips];

function completeCounties(counties: ReadonlyArray<{ stateFips: string }>) {
    const counts = new Map<string, number>();
    for (const county of counties) counts.set(county.stateFips, (counts.get(county.stateFips) ?? 0) + 1);
    return counts.size === JURISDICTIONS.size && Object.entries(CENSUS_COUNTIES_2025).every(([fips, count]) => counts.get(fips) === count);
}

export const pinSchema = z.object({
    ...pinGeometryFields,
    fips: z.string().regex(/^(US|\d{2}(\d{3})?)$/),
    kind: z.enum(['country', 'state', 'district', 'territory', 'county']),
    stateFips: z.string().regex(/^(\d{2})?$/), stateAbbr: z.string().regex(/^[A-Z]{2}$/),
    radiusMeters: pinGeometryFields.radiusMeters.max(MAX_PIN_RADIUS_METERS),
    landAreaKm2: z.number().finite().nonnegative(),
}).superRefine((pin, ctx) => {
    validatePinGeometry(pin, ctx, MAX_PIN_RADIUS_METERS);
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

const boundariesSchema = z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(z.object({
        type: z.literal('Feature'), id: z.string(),
        properties: z.object({ id: z.string(), fips: z.string(), name: geographicName, stateFips: z.string() }),
        geometry: polygonGeometrySchema,
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
