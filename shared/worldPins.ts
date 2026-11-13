import { z } from 'zod';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { pinSchema, type Pin } from './pins';
import { geographicName, pinGeometryFields, polygonGeometrySchema, validatePinGeometry } from './pinGeometry';
import snapshot from './geography/naturalEarthSnapshot.json' with { type: 'json' };
import catalog from './geography/worldCatalog.json' with { type: 'json' };

export const WORLD_COUNTRIES = catalog.countries;
export const WORLD_COUNTRY_LOOKUP: ReadonlyMap<string, typeof WORLD_COUNTRIES[number]> = new Map(WORLD_COUNTRIES.map(country => [country.code, country]));
export const WORLD_COUNTRY_COUNT = WORLD_COUNTRIES.length;
export const WORLD_REGION_COUNT = WORLD_COUNTRIES.reduce((count, country) => count + country.regionIds.length, 0);
export const WORLD_OVERVIEW_BOUNDS: [number, number, number, number] = [-180, -60, 180, 83];
const FOREIGN_COUNTRIES = WORLD_COUNTRIES.filter(country => country.code !== 'USA');
const FOREIGN_REGION_IDS = new Set(FOREIGN_COUNTRIES.flatMap(country => country.regionIds));
const FOREIGN_IDS = new Set([...FOREIGN_COUNTRIES.map(country => country.id), ...FOREIGN_REGION_IDS]);
const REGION_COUNTRIES = new Map(FOREIGN_COUNTRIES.flatMap(country => country.regionIds.map(id => [id, country.code] as const)));

export const worldPinSchema = z.object({
    ...pinGeometryFields, level: z.enum(['country', 'state']),
    kind: geographicName, code: z.string().min(1).max(60), countryCode: z.string().regex(/^[A-Z]{3}$/), countryName: geographicName,
    radiusMeters: pinGeometryFields.radiusMeters.max(snapshot.maxRadiusMeters),
    areaKm2: z.number().finite().nonnegative(), searchToleranceMeters: z.number().finite().positive().max(25),
    solveSimplificationMeters: z.number().finite().nonnegative().max(20), unnamed: z.boolean(), countryBoundaryAdjusted: z.boolean(),
}).superRefine((pin, ctx) => {
    validatePinGeometry(pin, ctx, snapshot.maxRadiusMeters);
    const country = WORLD_COUNTRY_LOOKUP.get(pin.countryCode);
    if (!country || country.code === 'USA' || pin.countryName !== country.name
        || (pin.level === 'country' ? pin.id !== country.id || pin.name !== country.name : REGION_COUNTRIES.get(pin.id) !== country.code)) {
        ctx.addIssue({ code: 'custom', message: 'Invalid global jurisdiction identity' });
    }
});
export type WorldPin = z.infer<typeof worldPinSchema>;
export type MapPin = Pin | WorldPin;

export const worldPinsDataSchema = z.object({
    metadata: z.object({
        version: z.literal(snapshot.version), scale: z.literal(snapshot.scale), license: z.literal(snapshot.license),
        generatedAt: z.iso.datetime({ offset: true }), source: z.literal('Natural Earth / U.S. Census'), definition: z.string().min(1),
        sourceSha256: z.object({ country: z.literal(snapshot.sources.country.sha256), region: z.literal(snapshot.sources.region.sha256) }),
        countryCount: z.literal(WORLD_COUNTRY_COUNT), regionCount: z.literal(WORLD_REGION_COUNT),
        regionalBoundaryAlignment: z.literal(snapshot.regionalBoundaryAlignment), adjustedRegionCount: z.number().int().nonnegative().max(FOREIGN_REGION_IDS.size),
        verification: z.object({ checked: z.literal(FOREIGN_IDS.size), circleSamples: z.literal(FOREIGN_IDS.size * 72),
            maxRadiusErrorMeters: z.number().finite().nonnegative().lt(1), maxContactBoundaryErrorMeters: z.number().finite().nonnegative().lt(1) }),
    }),
    pins: z.array(z.union([worldPinSchema, pinSchema])).length(WORLD_COUNTRY_COUNT),
}).superRefine(({ pins }, ctx) => {
    const expected = new Set(WORLD_COUNTRIES.map(country => country.id));
    if (new Set(pins.map(pin => pin.id)).size !== expected.size || pins.some(pin => pin.level !== 'country' || !expected.has(pin.id))) {
        ctx.addIssue({ code: 'custom', message: 'Incomplete or duplicate global coverage' });
    }
});
export type WorldPinsData = z.infer<typeof worldPinsDataSchema>;

export function parseWorldRegionPins(value: unknown, countryCode: string) {
    const country = WORLD_COUNTRY_LOOKUP.get(countryCode);
    if (!country || countryCode === 'USA') throw new Error('Unsupported global pin country');
    const data = z.object({
        metadata: z.object({ version: z.literal(snapshot.version), countryCode: z.literal(countryCode),
            sourceSha256: z.object({ country: z.literal(snapshot.sources.country.sha256), region: z.literal(snapshot.sources.region.sha256) }) }),
        pins: z.array(worldPinSchema).length(country.regionIds.length),
    }).parse(value);
    if (new Set(data.pins.map(pin => pin.id)).size !== country.regionIds.length
        || data.pins.some(pin => pin.countryCode !== countryCode || pin.level !== 'state' || REGION_COUNTRIES.get(pin.id) !== countryCode)) {
        throw new Error('Incomplete global region pin coverage');
    }
    return data;
}

const worldBoundariesSchema = z.object({
    type: z.literal('FeatureCollection'), features: z.array(z.object({
        type: z.literal('Feature'), id: z.string(),
        properties: z.object({ id: z.string(), name: geographicName, countryCode: z.string(), level: z.enum(['country', 'state']) }),
        geometry: polygonGeometrySchema,
    })),
});
export type DisplayBoundaries = FeatureCollection<Polygon | MultiPolygon, { id: string; name: string; stateFips?: string; countryCode?: string; level?: string }>;

/** Each country has its own exact province IDs; a swapped file must never enter the cache. */
export function parseWorldBoundaries(value: unknown, countryCode?: string): DisplayBoundaries {
    const country = countryCode ? WORLD_COUNTRY_LOOKUP.get(countryCode) : undefined;
    if (countryCode && (!country || countryCode === 'USA')) throw new Error('Unsupported global boundary country');
    const expected = new Set(country ? country.regionIds : WORLD_COUNTRIES.map(country => country.id));
    const data = worldBoundariesSchema.parse(value);
    if (data.features.length !== expected.size || new Set(data.features.map(feature => feature.id)).size !== expected.size) throw new Error('Incomplete global boundary coverage');
    for (const feature of data.features) {
        const properties = feature.properties;
        const owner = WORLD_COUNTRY_LOOKUP.get(properties.countryCode);
        if (!expected.has(feature.id) || feature.id !== properties.id || !owner
            || (country ? properties.countryCode !== countryCode || properties.level !== 'state'
                : properties.level !== 'country' || owner.id !== feature.id)) throw new Error('Invalid global boundary identity');
    }
    return data;
}
export const parseWorldCountries = (value: unknown) => parseWorldBoundaries(value);

export const pinCountryCode = (pin: MapPin) => 'countryCode' in pin ? pin.countryCode : 'USA';
export const pinDisplayCode = (pin: MapPin) => 'code' in pin ? pin.code : pin.stateAbbr;
export const pinStateFips = (pin: MapPin) => 'stateFips' in pin ? pin.stateFips : '';
export const pinContext = (pin: MapPin) => 'countryName' in pin ? pin.level === 'country' ? '' : pin.countryName : pin.level === 'county' ? pin.stateAbbr : '';
export const pinArea = (pin: MapPin) => 'areaKm2' in pin ? { label: 'Mapped area', value: pin.areaKm2 } : { label: 'Land area', value: pin.landAreaKm2 };
export const pinSource = (pin: MapPin) => 'countryCode' in pin ? `Natural Earth ${snapshot.version} · ${snapshot.scale}` : 'Census TIGER/Line 2025';

/** URL values select only catalog entries; they cannot become arbitrary asset paths. */
export function resolveCountry(value: string | null, selectedId: string | null): string {
    if (value === 'ALL' || (value && WORLD_COUNTRY_LOOKUP.has(value))) return value;
    if (!value && selectedId) {
        const region = REGION_COUNTRIES.get(selectedId);
        if (region) return region;
        const country = FOREIGN_COUNTRIES.find(country => country.id === selectedId);
        if (country) return country.code;
    }
    return 'USA';
}
