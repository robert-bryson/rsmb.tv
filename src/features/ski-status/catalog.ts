import { z } from 'zod';
import areaData from '../../../projects/ski-status/data/areas.json';
import locationData from '../../../projects/ski-status/data/locations.json';
import passData from '../../../projects/ski-status/data/passes-2026-27.json';
import baseData from '../../../projects/ski-status/data/resort-bases.json';
import { httpsUrl, passSeasonId, skiCoordinates, skiId } from './schemas';

const label = z.string().trim().min(1);
const countryCode = z.string().regex(/^[A-Z]{2}$/);
const verifiedTimeZones = new Set<string>();
export const skiTimeZone = label.refine(value => {
    if (value.startsWith('+') || value.startsWith('-')) return false;
    if (verifiedTimeZones.has(value)) return true;
    try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        verifiedTimeZones.add(value);
        return true;
    } catch {
        return false;
    }
}, 'Use an IANA time zone');
const amount = z.number().nonnegative();
const count = z.int().nonnegative();
const minimumSkiableAcres = 100;
export const skiingSchema = z.enum([
    'downhill', 'both', 'cross-country', 'indoor', 'heli-skiing', 'cat-skiing', 'ski-touring', 'dry-slope', 'freeride',
]);
export type Skiing = z.infer<typeof skiingSchema>;

export function isSpecialtySkiing(skiing: Skiing) {
    return skiing !== 'downhill' && skiing !== 'both';
}

const mountainStats = {
    acres: amount.optional(),
    acresQualifier: z.literal('lower-bound').optional(),
    guidedTerrainAcres: amount.optional(),
    liftCount: count.optional(),
    trailCount: count.optional(),
    trailCountQualifier: z.literal('lower-bound').optional(),
    downhillKm: z.number().positive().optional(),
    nordicKm: z.number().positive().optional(),
    baseFt: z.number().optional(),
    summitFt: z.number().optional(),
    verticalFt: amount.optional(),
    highestLiftTerminalFt: z.number().optional(),
    lowestLiftTerminalFt: z.number().optional(),
    nightSkiing: z.boolean().optional(),
    nightAcres: amount.optional(),
    nightAcresQualifier: z.literal('lower-bound').optional(),
    terrainParks: z.boolean().optional(),
    seasonWindow: label.optional(),
    grades: z.strictObject({
        unit: z.enum(['count', 'percent']),
        of: z.enum(['terrain', 'trails']).optional(),
        values: z.record(label, amount),
    }).refine(grades => Object.values(grades.values).every(value =>
        grades.unit === 'percent' ? value <= 100 : Number.isInteger(value)), 'Use whole trail counts or percentages from 0 to 100').optional(),
};
const statisticKeys = Object.keys(mountainStats) as (keyof typeof mountainStats)[];
const statisticSourceSchema = z.strictObject({
    source: httpsUrl,
    checkedOn: z.iso.date(),
    fields: z.array(z.enum(statisticKeys)).min(1),
    note: label.optional(),
    exportLicense: httpsUrl.optional(),
});
const areaSchema = z.strictObject({
    id: skiId,
    name: label,
    aliases: z.array(label).optional(),
    region: z.string().regex(/^[A-Z]{2}(?:\/[A-Z]{2})?$/).optional(),
    country: countryCode,
    otherCountries: z.array(countryCode).min(1).optional(),
    locality: label,
    skiing: skiingSchema.default('downhill'),
    website: httpsUrl,
    statsUrl: httpsUrl.optional(),
    reportUrl: httpsUrl.optional(),
    reportCheckedOn: z.iso.date().optional(),
    ...mountainStats,
    statSources: z.array(statisticSourceSchema).optional(),
    additionalSources: z.array(httpsUrl).optional(),
}).refine(({ reportUrl, reportCheckedOn }) => !reportCheckedOn || Boolean(reportUrl), 'A report check date requires a report link');

const mappedTerrainSchema = z.strictObject({
    source: httpsUrl,
    lifts: z.int().positive().optional(),
    downhillKm: z.number().positive().optional(),
    nordicKm: z.number().positive().optional(),
    namedDownhillRuns: z.int().positive().optional(),
    namedNordicTrails: z.int().positive().optional(),
    elevationM: z.tuple([z.number(), z.number()]).refine(([low, high]) => low < high, 'Use an increasing elevation range').optional(),
}).refine(({ lifts, downhillKm, nordicKm, namedDownhillRuns, namedNordicTrails, elevationM }) =>
    lifts || downhillKm || nordicKm || namedDownhillRuns || namedNordicTrails || elevationM, 'Add a mapped terrain value');

const locationsSchema = z.strictObject({
    source: httpsUrl,
    buildTime: z.iso.datetime(),
    license: httpsUrl,
    attribution: z.record(label, httpsUrl).refine(links => Object.keys(links).length > 0, 'Add a location attribution link'),
    locations: z.array(z.strictObject({
        id: skiId,
        coordinates: skiCoordinates,
        upstream: z.array(httpsUrl).min(1),
        mappedTerrain: mappedTerrainSchema.optional(),
        timeZone: skiTimeZone.optional(),
    })),
});
const baseSchema = z.strictObject({
    buildTime: z.iso.datetime(), license: httpsUrl,
    bases: z.record(skiId, z.strictObject({ coordinates: skiCoordinates, name: label, source: httpsUrl, kind: z.enum(['entrance', 'lift-base']) })),
});

export const passFamilySchema = z.enum(['ikon', 'epic', 'indy', 'mountain-collective']);
export type PassFamily = z.infer<typeof passFamilySchema>;
export const passNames: Record<PassFamily, string> = {
    ikon: 'Ikon', epic: 'Epic', indy: 'Indy', 'mountain-collective': 'Mountain Collective',
};

const passesSchema = z.strictObject({
    season: passSeasonId,
    checkedOn: z.iso.date(),
    memberships: z.array(z.strictObject({
        areaId: skiId,
        family: passFamilySchema,
        access: z.enum(['included', 'discount', 'listed']),
        source: httpsUrl,
    })),
});

export type SkiArea = z.infer<typeof areaSchema> & {
    location: z.infer<typeof locationsSchema>['locations'][number] & { base?: z.infer<typeof baseSchema>['bases'][string] };
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

export function readSkiCatalog(areaInput: unknown, locationInput: unknown, passInput: unknown, baseInput?: unknown) {
    const areas = indexById(z.array(areaSchema).min(1).parse(areaInput), 'ski area');
    const locations = locationsSchema.parse(locationInput);
    const points = indexById(locations.locations, 'map point');
    const passes = passesSchema.parse(passInput);
    const access = baseInput === undefined ? undefined : baseSchema.parse(baseInput);
    const bases = new Map(Object.entries(access?.bases ?? {}));
    const memberships = new Map<string, SkiArea['passes']>();

    for (const pointId of points.keys()) {
        if (!areas.has(pointId)) throw new Error(`Map point has no ski area ${pointId}`);
    }
    if (access && access.license !== locations.license) throw new Error('Resort base points must use the location data license');
    for (const id of bases.keys()) if (!points.has(id)) throw new Error(`Resort base has no ski area ${id}`);
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
        if (area.otherCountries && new Set([area.country, ...area.otherCountries]).size !== area.otherCountries.length + 1) {
            throw new Error(`Duplicate country for ${area.id}`);
        }
        const sourcedFields = new Set<keyof typeof mountainStats>();
        for (const { fields } of area.statSources ?? []) {
            for (const field of fields) {
                if (area[field] === undefined) throw new Error(`Source for missing ${field} on ${area.id}`);
                if (sourcedFields.has(field)) throw new Error(`Duplicate source for ${field} on ${area.id}`);
                sourcedFields.add(field);
            }
        }
        const unsourcedField = !area.statsUrl && statisticKeys.find(key => area[key] !== undefined && !sourcedFields.has(key));
        if (unsourcedField) throw new Error(`No mountain statistics source for ${area.id} (${unsourcedField})`);
        const documentedSpecialty = isSpecialtySkiing(area.skiing) && (area.statsUrl || sourcedFields.size > 0);
        if ((area.acres ?? 0) < minimumSkiableAcres && areaPasses.length === 0 && !documentedSpecialty) {
            throw new Error(`Ski area ${area.id} requires ${minimumSkiableAcres} skiable acres, an official pass listing, or a specialty source`);
        }
        if ((area.acresQualifier && area.acres === undefined) || (area.trailCountQualifier && area.trailCount === undefined)
            || (area.nightAcresQualifier && area.nightAcres === undefined)) {
            throw new Error(`Lower bound for ${area.id} requires a reported value`);
        }
        if (area.nightSkiing === false && (area.nightAcres ?? 0) > 0) throw new Error(`Conflicting night skiing values for ${area.id}`);
        if (area.nightAcres !== undefined && area.acres !== undefined && !area.acresQualifier && area.nightAcres > area.acres) {
            throw new Error(`Night skiable acreage exceeds skiable acreage for ${area.id}`);
        }
        if (area.baseFt !== undefined && area.summitFt !== undefined) {
            if (area.baseFt > area.summitFt) throw new Error(`Inverted base and summit elevations for ${area.id}`);
            if (area.baseFt === area.summitFt && (area.verticalFt ?? 0) > 0) {
                throw new Error(`Equal base and summit elevations with positive vertical drop for ${area.id}`);
            }
        }
        if (area.lowestLiftTerminalFt !== undefined && area.highestLiftTerminalFt !== undefined
            && area.lowestLiftTerminalFt > area.highestLiftTerminalFt) throw new Error(`Inverted lift terminal elevations for ${area.id}`);
        joined.push({ ...area, location: { ...location, base: bases.get(area.id) }, passes: areaPasses });
    }

    return {
        areas: joined,
        passSeason: passes.season,
        locationAttribution: locations.attribution,
        locationLicense: locations.license,
    };
}

export function skiAreaMapPoint(area: SkiArea) {
    return area.location.base?.coordinates ?? area.location.coordinates;
}

export const { areas: skiAreas, passSeason, locationAttribution, locationLicense } = readSkiCatalog(areaData, locationData, passData, baseData);
