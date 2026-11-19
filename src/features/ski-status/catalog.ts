import { z } from 'zod';
import areaData from '../../../projects/ski-status/data/pilot-areas.json';
import locationData from '../../../projects/ski-status/data/pilot-locations.json';
import passData from '../../../projects/ski-status/data/passes-2026-27.json';

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const httpsUrl = z.url({ protocol: /^https$/ }).refine(value => {
    try {
        const { username, password } = new URL(value);
        return !username && !password;
    } catch {
        return false;
    }
}, 'Source URLs must not contain credentials');
const amount = z.number().nonnegative();
const count = z.int().nonnegative();
const minimumSkiableAcres = 100;
const areaSchema = z.strictObject({
    id,
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)).optional(),
    region: z.string().regex(/^[A-Z]{2}(?:\/[A-Z]{2})?$/),
    country: z.string().regex(/^[A-Z]{2}$/),
    locality: z.string().min(1),
    website: httpsUrl,
    statsUrl: httpsUrl,
    reportUrl: httpsUrl,
    acres: amount.optional(),
    acresQualifier: z.literal('lower-bound').optional(),
    liftCount: count.optional(),
    trailCount: count.optional(),
    trailCountQualifier: z.literal('lower-bound').optional(),
    baseFt: z.number().optional(),
    summitFt: z.number().optional(),
    verticalFt: amount.optional(),
    highestLiftTerminalFt: z.number().optional(),
    lowestLiftTerminalFt: z.number().optional(),
    nightSkiing: z.boolean().optional(),
    nightAcres: amount.optional(),
    seasonWindow: z.string().min(1).optional(),
    grades: z.strictObject({
        unit: z.enum(['count', 'percent']),
        of: z.enum(['terrain', 'trails']).optional(),
        values: z.record(z.string().min(1), amount),
    }).refine(grades => Object.values(grades.values).every(value =>
        grades.unit === 'percent' ? value <= 100 : Number.isInteger(value)), 'Use whole trail counts or percentages from 0 to 100').optional(),
    additionalSources: z.array(httpsUrl).optional(),
});

const locationsSchema = z.strictObject({
    source: httpsUrl,
    buildTime: z.iso.datetime(),
    license: httpsUrl,
    attribution: z.record(z.string().min(1), httpsUrl),
    locations: z.array(z.strictObject({
        id,
        coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
        upstream: z.array(httpsUrl).min(1),
    })),
});

export const passFamilySchema = z.enum(['ikon', 'epic', 'indy', 'mountain-collective']);
export type PassFamily = z.infer<typeof passFamilySchema>;
export const passNames: Record<PassFamily, string> = {
    ikon: 'Ikon', epic: 'Epic', indy: 'Indy', 'mountain-collective': 'Mountain Collective',
};

const passesSchema = z.strictObject({
    season: z.string().regex(/^\d{4}\/\d{2}$/),
    checkedOn: z.iso.date(),
    memberships: z.array(z.strictObject({
        areaId: id,
        family: passFamilySchema,
        access: z.enum(['included', 'discount']),
        source: httpsUrl,
    })),
});

export type SkiArea = z.infer<typeof areaSchema> & {
    location: z.infer<typeof locationsSchema>['locations'][number];
    passes: z.infer<typeof passesSchema>['memberships'];
};

function indexById<T extends { id: string }>(records: readonly T[], label: string) {
    const indexed = new Map<string, T>();
    for (const record of records) {
        if (indexed.has(record.id)) throw new Error(`Duplicate ${label} ID ${record.id}`);
        indexed.set(record.id, record);
    }
    return indexed;
}

export function readSkiCatalog(areaInput: unknown, locationInput: unknown, passInput: unknown) {
    const areas = indexById(z.array(areaSchema).min(1).parse(areaInput), 'ski area');
    const locations = locationsSchema.parse(locationInput);
    const points = indexById(locations.locations, 'map point');
    const passes = passesSchema.parse(passInput);
    const memberships = new Map<string, SkiArea['passes']>();

    for (const pointId of points.keys()) {
        if (!areas.has(pointId)) throw new Error(`Map point has no ski area ${pointId}`);
    }
    for (const pass of passes.memberships) {
        if (!areas.has(pass.areaId)) throw new Error(`Pass membership has no ski area ${pass.areaId}`);
        const areaPasses = memberships.get(pass.areaId) ?? [];
        if (areaPasses.some(previous => previous.family === pass.family)) {
            throw new Error(`Duplicate ${pass.family} membership for ${pass.areaId}`);
        }
        areaPasses.push(pass);
        memberships.set(pass.areaId, areaPasses);
    }

    const joined: SkiArea[] = [];
    for (const area of areas.values()) {
        const location = points.get(area.id);
        if (!location) throw new Error(`No map point for ${area.id}`);
        const areaPasses = memberships.get(area.id) ?? [];
        if ((area.acres ?? 0) < minimumSkiableAcres && !areaPasses.some(pass => pass.access === 'included')) {
            throw new Error(`Ski area ${area.id} requires ${minimumSkiableAcres} skiable acres or included pass access`);
        }
        if ((area.acresQualifier && area.acres === undefined) || (area.trailCountQualifier && area.trailCount === undefined)) {
            throw new Error(`Lower bound for ${area.id} requires a reported value`);
        }
        if (area.nightSkiing === false && (area.nightAcres ?? 0) > 0) throw new Error(`Conflicting night skiing values for ${area.id}`);
        if (area.lowestLiftTerminalFt !== undefined && area.highestLiftTerminalFt !== undefined
            && area.lowestLiftTerminalFt > area.highestLiftTerminalFt) throw new Error(`Inverted lift terminal elevations for ${area.id}`);
        joined.push({ ...area, location, passes: areaPasses });
    }

    return {
        areas: joined,
        passSeason: passes.season,
        locationAttribution: locations.attribution,
        locationLicense: locations.license,
    };
}

export const { areas: skiAreas, passSeason, locationAttribution, locationLicense } = readSkiCatalog(areaData, locationData, passData);
