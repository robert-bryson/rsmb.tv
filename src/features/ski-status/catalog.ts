import { z } from 'zod';
import areaData from '../../../projects/ski-status/data/pilot-areas.json';
import locationData from '../../../projects/ski-status/data/pilot-locations.json';
import passData from '../../../projects/ski-status/data/passes-2026-27.json';

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const httpsUrl = z.url({ protocol: /^https$/ });
const amount = z.number().nonnegative();
const count = z.int().nonnegative();
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
    }).optional(),
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

const areas = z.array(areaSchema).parse(areaData);
const locations = locationsSchema.parse(locationData);
const passes = passesSchema.parse(passData);

export const passSeason = passes.season;
export const locationAttribution = locations.attribution;
export const locationLicense = locations.license;
export const skiAreas: SkiArea[] = areas.map(area => {
    const location = locations.locations.find(point => point.id === area.id);
    if (!location) throw new Error(`No mapped location for ${area.id}`);
    return { ...area, location, passes: passes.memberships.filter(pass => pass.areaId === area.id) };
});
