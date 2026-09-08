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

function roundedRatio(highs: number, lows: number): number | null {
    return lows > 0 ? Math.round((highs / lows) * 100) / 100 : null;
}

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
}).transform(data => {
    const countsByYear = new Map(data.byYear.map(year => [year.year, year]));
    const firstYear = data.byYear[0]?.year;
    const lastYear = data.byYear.at(-1)?.year;
    const byYear = firstYear === undefined || lastYear === undefined
        ? []
        : Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
            const year = firstYear + index;
            return countsByYear.get(year) ?? { year, highs: 0, lows: 0 };
        });
    const expectedDecades = new Map<number, { highs: number; lows: number }>();
    for (const year of byYear) {
        const decade = Math.floor(year.year / 10) * 10;
        const counts = expectedDecades.get(decade) ?? { highs: 0, lows: 0 };
        counts.highs += year.highs;
        counts.lows += year.lows;
        expectedDecades.set(decade, counts);
    }
    const byDecade = [...expectedDecades].map(([decade, counts]) => ({
        decade,
        label: `${decade}s`,
        ...counts,
        ratio: roundedRatio(counts.highs, counts.lows),
    }));
    const rollingRatio = byYear.slice(9).map((year, index) => {
        const window = byYear.slice(index, index + 10);
        const highs10yr = window.reduce((total, item) => total + item.highs, 0);
        const lows10yr = window.reduce((total, item) => total + item.lows, 0);
        return {
            year: year.year,
            ratio: roundedRatio(highs10yr, lows10yr),
            highs10yr,
            lows10yr,
        };
    });
    return {
        ...data,
        totalHighs: byYear.reduce((total, year) => total + year.highs, 0),
        totalLows: byYear.reduce((total, year) => total + year.lows, 0),
        byDecade,
        byYear,
        rollingRatio,
    };
});

export function parseTemperaturePayload<T>(schema: z.ZodType<T>, payload: unknown, label: string): T {
    const result = schema.safeParse(payload);
    if (result.success) return result.data;

    const issue = result.error.issues[0];
    const path = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
    throw new Error(`Invalid ${label}${path}: ${issue.message}`);
}