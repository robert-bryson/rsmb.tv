import { z } from 'zod';

export const tornadoTrackPropertiesSchema = z.object({
    id: z.string(),
    eventId: z.string(),
    episodeId: z.string(),
    year: z.number().int().nonnegative(),
    month: z.number().int().min(1).max(12),
    date: z.string(),
    beginTime: z.string(),
    endTime: z.string(),
    timezone: z.string(),
    state: z.string(),
    stateName: z.string(),
    county: z.string(),
    countyFips: z.string(),
    wfo: z.string(),
    scale: z.number().int().min(-1).max(5),
    scaleLabel: z.string(),
    lengthMiles: z.number().nonnegative(),
    widthYards: z.number().nonnegative(),
    deaths: z.number().int().nonnegative(),
    injuries: z.number().int().nonnegative(),
    propertyDamage: z.number().nonnegative(),
    cropDamage: z.number().nonnegative(),
    source: z.string(),
    dataSource: z.string(),
    narrative: z.string().optional(),
    episodeNarrative: z.string().optional(),
});

export const notableEventsSchema = z.array(tornadoTrackPropertiesSchema.extend({
    coordinates: z.array(z.tuple([
        z.number().min(-180).max(180),
        z.number().min(-90).max(90),
    ])).min(2),
}));

export type TornadoTrackProperties = z.infer<typeof tornadoTrackPropertiesSchema>;
export type NotableTornadoEvent = z.infer<typeof notableEventsSchema>[number];
