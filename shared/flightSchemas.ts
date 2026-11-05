import { z } from 'zod';

const longitude = z.number().finite().min(-180).max(180);
const latitude = z.number().finite().min(-90).max(90);
const position = z.tuple([longitude, latitude]);
const flightDate = z.string().regex(/^\d{1,2}\/\d{1,2}\/\d{4}$/).refine(value => {
    const [month, day, year] = value.split('/').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, 'Invalid flight calendar date');
const location = {
    code: z.string().min(1), name: z.string(), municipality: z.string(), region: z.string(), regionName: z.string(),
    country: z.string(), countryName: z.string(), continent: z.string(), continentName: z.string(),
};

const flightProperties = z.object({
    id: z.number().int().nonnegative(), date: flightDate, airline: z.string(),
    ...Object.fromEntries(['origin', 'destination'].flatMap(prefix => Object.entries(location).map(([key, schema]) => [`${prefix}_${key}`, schema]))),
    origin_lat: latitude, origin_lon: longitude, destination_lat: latitude, destination_lon: longitude,
    durationMinutes: z.number().int().positive().nullable().optional(),
    durationKind: z.enum(['actual-block', 'scheduled-block', 'estimated-block', 'unclassified']).nullable().optional(),
    durationSource: z.string().nullable().optional(),
}).superRefine((value, context) => {
    if (value.durationMinutes != null && (!value.durationKind || !value.durationSource?.trim())) {
        context.addIssue({ code: 'custom', path: ['durationMinutes'], message: 'Elapsed duration requires a kind and source' });
    }
});

export const flightsSchema = z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(z.object({ type: z.literal('Feature'), properties: flightProperties,
        geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(position).min(2) }),
    })).min(1),
});

export const visitedAirportsSchema = z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(z.object({ type: z.literal('Feature'),
        geometry: z.object({ type: z.literal('Point'), coordinates: position }),
        properties: z.object({ ...location, elevationFt: z.number().finite(), elevationM: z.number().finite(),
            visitCount: z.number().int().nonnegative(), arrivalCount: z.number().int().nonnegative(), departureCount: z.number().int().nonnegative(), visitDates: z.array(flightDate),
        }),
    })).min(1),
});
