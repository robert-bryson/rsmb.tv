import { z } from 'zod';
import areaData from '../../../projects/ski-status/data/areas.json';
import locationData from '../../../projects/ski-status/data/locations.json';
import passData from '../../../projects/ski-status/data/passes-2026-27.json';

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const label = z.string().trim().min(1);
const httpsUrl = z.string().trim().refine(value => {
    if (!/^https:\/\//i.test(value)) return false;
    try {
        const { username, password } = new URL(value);
        return !username && !password;
    } catch {
        return false;
    }
}, 'Use an HTTPS source URL without credentials');
const amount = z.number().nonnegative();
const count = z.int().nonnegative();
const minimumSkiableAcres = 100;
const mountainStats = {
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
    seasonWindow: label.optional(),
    grades: z.strictObject({
        unit: z.enum(['count', 'percent']),
        of: z.enum(['terrain', 'trails']).optional(),
        values: z.record(label, amount),
    }).refine(grades => Object.values(grades.values).every(value =>
        grades.unit === 'percent' ? value <= 100 : Number.isInteger(value)), 'Use whole trail counts or percentages from 0 to 100').optional(),
};
const statisticKeys = Object.keys(mountainStats) as (keyof typeof mountainStats)[];
const areaSchema = z.strictObject({
    id,
    name: label,
    aliases: z.array(label).optional(),
    region: z.string().regex(/^[A-Z]{2}(?:\/[A-Z]{2})?$/).optional(),
    country: z.string().regex(/^[A-Z]{2}$/),
    locality: label,
    website: httpsUrl,
    statsUrl: httpsUrl.optional(),
    reportUrl: httpsUrl.optional(),
    ...mountainStats,
    additionalSources: z.array(httpsUrl).optional(),
});

const locationsSchema = z.strictObject({
    source: httpsUrl,
    buildTime: z.iso.datetime(),
    license: httpsUrl,
    attribution: z.record(label, httpsUrl).refine(links => Object.keys(links).length > 0, 'Add a location attribution link'),
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
    season: z.string().regex(/^\d{4}\/\d{2}$/).refine(value =>
        Number(value.slice(5)) === (Number(value.slice(0, 4)) + 1) % 100, 'Pass season must end the next year'),
    checkedOn: z.iso.date(),
    memberships: z.array(z.strictObject({
        areaId: id,
        family: passFamilySchema,
        access: z.enum(['included', 'discount', 'listed']),
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
        if (!area.statsUrl && statisticKeys.some(key => area[key] !== undefined)) throw new Error(`No mountain statistics source for ${area.id}`);
        if ((area.acres ?? 0) < minimumSkiableAcres && !areaPasses.some(pass => pass.access === 'included' || pass.access === 'listed')) {
            throw new Error(`Ski area ${area.id} requires ${minimumSkiableAcres} skiable acres, included pass access, or an official pass listing`);
        }
        if ((area.acresQualifier && area.acres === undefined) || (area.trailCountQualifier && area.trailCount === undefined)) {
            throw new Error(`Lower bound for ${area.id} requires a reported value`);
        }
        if (area.nightSkiing === false && (area.nightAcres ?? 0) > 0) throw new Error(`Conflicting night skiing values for ${area.id}`);
        if (area.nightAcres !== undefined && area.acres !== undefined && !area.acresQualifier && area.nightAcres > area.acres) {
            throw new Error(`Night skiable acreage exceeds skiable acreage for ${area.id}`);
        }
        if (area.baseFt !== undefined && area.summitFt !== undefined && area.baseFt > area.summitFt) {
            throw new Error(`Inverted base and summit elevations for ${area.id}`);
        }
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
