import { z } from 'zod';

const finiteNumber = z.number().finite();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const recordType = z.enum(['high', 'low']);

const pointGeometry = z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([finiteNumber, finiteNumber]),
});

const stateRecordProperties = z.object({
    state: z.string().min(2),
    stateName: z.string().min(1),
    type: recordType,
    tempF: finiteNumber,
    date: dateString,
    location: z.string(),
    station: z.string(),
});

const countyRecordProperties = z.object({
    countyFips: z.string().min(1),
    countyName: z.string().min(1),
    state: z.string().min(2),
    type: recordType,
    tempF: finiteNumber,
    date: dateString,
    stationName: z.string(),
    lat: finiteNumber,
    lon: finiteNumber,
});

function featureCollectionSchema<P extends z.ZodType>(properties: P) {
    return z.object({
        type: z.literal('FeatureCollection'),
        features: z.array(z.object({
            type: z.literal('Feature'),
            geometry: pointGeometry,
            properties,
        })),
    });
}

export const stateRecordsSchema = featureCollectionSchema(stateRecordProperties);
export const countyRecordsSchema = featureCollectionSchema(countyRecordProperties);

const brokenRecordSchema = z.object({
    stationName: z.string().min(1),
    uid: finiteNumber,
    state: z.string(),
    stateName: z.string(),
    county: z.string(),
    lat: finiteNumber,
    lon: finiteNumber,
    elev: finiteNumber.nullable(),
    type: recordType,
    tempF: finiteNumber,
    prevRecordF: finiteNumber,
    prevRecordDate: z.string(),
    normalF: finiteNumber.nullable(),
    date: dateString,
    recordScope: z.enum(['daily', 'monthly', 'county-alltime', 'state-alltime']).optional(),
});

export const recentRecordsSchema = z.object({
    asOf: dateString,
    dates: z.array(dateString).optional(),
    yesterday: z.array(brokenRecordSchema),
    last7Days: z.array(brokenRecordSchema),
});

export const temperatureSummarySchema = z.object({
    lastUpdated: z.string().min(1),
    stateRecordCount: z.number().int().nonnegative(),
    countyRecordCount: z.number().int().nonnegative(),
    statesProcessed: z.number().int().nonnegative(),
});

const yearDataSchema = z.object({
    year: z.number().int(),
    highs: z.number().int().nonnegative(),
    lows: z.number().int().nonnegative(),
});

export const climateTrendsSchema = z.object({
    source: z.string().min(1),
    description: z.string().min(1),
    totalHighs: z.number().int().nonnegative(),
    totalLows: z.number().int().nonnegative(),
    byDecade: z.array(z.object({
        decade: z.number().int(),
        label: z.string().min(1),
        highs: z.number().int().nonnegative(),
        lows: z.number().int().nonnegative(),
        ratio: finiteNumber.nullable(),
    })),
    byYear: z.array(yearDataSchema),
    rollingRatio: z.array(z.object({
        year: z.number().int(),
        ratio: finiteNumber.nullable(),
        highs10yr: z.number().int().nonnegative(),
        lows10yr: z.number().int().nonnegative(),
    })),
}).superRefine((data, context) => {
    const annualHighs = data.byYear.reduce((total, year) => total + year.highs, 0);
    const annualLows = data.byYear.reduce((total, year) => total + year.lows, 0);
    if (annualHighs !== data.totalHighs) {
        context.addIssue({
            code: 'custom',
            path: ['totalHighs'],
            message: 'Must equal the sum of byYear high counts',
        });
    }
    if (annualLows !== data.totalLows) {
        context.addIssue({
            code: 'custom',
            path: ['totalLows'],
            message: 'Must equal the sum of byYear low counts',
        });
    }
    for (let index = 1; index < data.byYear.length; index++) {
        if (data.byYear[index].year <= data.byYear[index - 1].year) {
            context.addIssue({
                code: 'custom',
                path: ['byYear', index, 'year'],
                message: 'Years must be unique and in ascending order',
            });
            break;
        }
    }
});

export function parseTemperaturePayload<T>(schema: z.ZodType<T>, payload: unknown, label: string): T {
    const result = schema.safeParse(payload);
    if (result.success) return result.data;

    const issue = result.error.issues[0];
    const path = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
    throw new Error(`Invalid ${label}${path}: ${issue.message}`);
}