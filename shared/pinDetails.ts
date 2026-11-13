import { z } from 'zod';
import { geographicName, latitude, longitude } from './pinGeometry';
import { pinCountryCode, WORLD_COUNTRIES, WORLD_COUNTRY_LOOKUP, type MapPin } from './worldPins';

const scopeSchema = z.string().regex(/^(countries|regions\/[A-Z]{3}|counties\/\d{2})\.json$/);
const count = z.number().int().positive().max(100_000);
const knownIds = new Set(WORLD_COUNTRIES.flatMap(country => [country.id, ...country.regionIds]));

export const pinDetailsManifestSchema = z.object({
    schemaVersion: z.literal(1), release: z.string().regex(/^[a-f0-9]{64}$/), generatedAt: z.iso.datetime({ offset: true }),
    files: z.record(scopeSchema, z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().positive().max(10_000_000), count })),
    coverage: z.object({ pins: count, elevations: z.number().int().nonnegative(), places: count }),
}).superRefine(({ files, coverage }, ctx) => {
    if (Object.values(files).reduce((total, file) => total + file.count, 0) !== coverage.pins
        || coverage.elevations > coverage.pins || coverage.places !== coverage.pins) {
        ctx.addIssue({ code: 'custom', message: 'Incomplete pin context coverage' });
    }
});

export const pinDetailsSchema = z.object({
    id: z.string().min(1).max(100).refine(id => knownIds.has(id) || /^county-\d{5}$/.test(id), 'Unknown pin identity'),
    lat: latitude, lng: longitude,
    elevationMeters: z.number().finite().min(-500).max(9000).nullable(),
    elevationDataset: z.enum(['srtm30m', 'aster30m']).nullable(),
    nearestPlace: z.object({
        geonameId: z.number().int().positive(), name: geographicName,
        lat: latitude, lng: longitude, admin1Name: z.union([geographicName, z.literal('')]),
        countryCode: z.string().regex(/^[A-Z]{2}$/), countryName: geographicName,
        distanceMeters: z.number().finite().nonnegative().max(21_000_000),
        bearingDegrees: z.number().finite().min(0).max(360),
    }),
}).refine(pin => (pin.elevationMeters === null) === (pin.elevationDataset === null), 'Elevation must identify its dataset');

export type PinDetails = z.infer<typeof pinDetailsSchema>;
export type PinDetailsManifest = z.infer<typeof pinDetailsManifestSchema>;

export function pinDetailsScope(pin: MapPin): string {
    return pin.level === 'country' ? 'countries.json' : pin.level === 'county' && 'stateFips' in pin
        ? `counties/${pin.stateFips}.json` : `regions/${pinCountryCode(pin)}.json`;
}

export function parsePinDetails(value: unknown, scope: string, expectedCount: number) {
    const data = z.object({ schemaVersion: z.literal(1), scope: z.literal(scope), pins: z.array(pinDetailsSchema).length(expectedCount) }).parse(value);
    const country = scope.startsWith('regions/') ? WORLD_COUNTRY_LOOKUP.get(scope.slice(8, 11)) : null;
    if (new Set(data.pins.map(pin => pin.id)).size !== expectedCount || data.pins.some(pin => scope === 'countries.json'
        ? !pin.id.startsWith('country-') : scope.startsWith('counties/') ? !pin.id.startsWith(`county-${scope.slice(9, 11)}`)
            : !country?.regionIds.includes(pin.id))) {
        throw new Error('Pin context identities do not match their scope');
    }
    return data;
}

/** Never attach context sampled at an old pole after a boundary recalculation. */
export function pinDetailsMatch(pin: MapPin, details: PinDetails) {
    return pin.id === details.id && Math.abs(pin.lat - details.lat) <= 1e-7 && Math.abs(pin.lng - details.lng) <= 1e-7;
}
