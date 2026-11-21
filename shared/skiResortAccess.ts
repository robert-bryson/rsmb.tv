import { z } from 'zod';
import { httpsUrl, passSeasonId, skiCoordinates, skiId } from '../src/features/ski-status/schemas.ts';

const label = z.string().trim().min(1);
const seasonId = z.union([passSeasonId, z.string().regex(/^\d{4}$/)]);
const checkedSource = { checkedOn: z.iso.date().optional(), source: httpsUrl };
const mappedPlace = { coordinates: skiCoordinates.optional(), mapSource: httpsUrl.optional() };
const currency = z.string().regex(/^[A-Z]{3}$/);
const rate = z.object({
    amount: z.number().nonnegative(),
    appliesTo: label,
    kind: z.enum(['minimum', 'maximum']).optional(),
});

const lodge = z.object({ ...checkedSource, ...mappedPlace, name: label, role: label.optional(), address: label.optional() });
const entrance = z.object({
    ...checkedSource, base: label, coordinates: skiCoordinates, mapSource: httpsUrl.optional(),
    result: z.enum(['confirmed', 'updated']),
});
const parkingLot = z.object({
    ...checkedSource, ...mappedPlace, name: label, location: label.optional(),
    rates: rate.extend({ currency }).array().min(1).optional(), rateSource: httpsUrl.optional(),
    policy: label.optional(), policySource: httpsUrl.optional(), note: label.optional(),
});
const trailMap = z.object({
    source: httpsUrl, checkedOn: z.iso.date(), coverage: label, assetUrl: httpsUrl.optional(),
    season: seasonId.optional(), note: label.optional(),
});
const liftTickets = z.object({
    source: httpsUrl, checkedOn: z.iso.date(), product: label, currency,
    rates: rate.array().min(1), note: label.optional(),
});
const camera = z.object({
    name: label, location: label.optional(), view: label.optional(), availability: label.optional(),
    source: httpsUrl.optional(), feedUrl: httpsUrl.optional(), embedUrl: httpsUrl.optional(),
});
const webcams = z.object({ ...checkedSource, cameras: camera.array().min(1) });
const accessNote = z.object({ ...checkedSource, description: label });

// Only select the fields the visitor panel displays. Research-only fields can coexist in each record.
const resortAccess = z.object({
    checkedOn: z.iso.date(),
    lodges: lodge.array().min(1).optional(),
    mapPin: entrance.optional(),
    parking: parkingLot.array().min(1).optional(),
    parkingPolicy: accessNote.optional(),
    shuttle: accessNote.optional(),
    trailMaps: trailMap.array().min(1).optional(),
    liftTickets: liftTickets.optional(),
    webcams: webcams.optional(),
}).refine(({ lodges, mapPin, parking, parkingPolicy, shuttle, trailMaps, liftTickets, webcams }) =>
    lodges || mapPin || parking || parkingPolicy || shuttle || trailMaps || liftTickets || webcams, 'Add a verified visitor record');
const accessSeason = z.object({ season: seasonId, resorts: z.record(skiId, resortAccess) });

export type ResortAccess = z.infer<typeof resortAccess> & { season: string };

export function readResortAccess(files: readonly unknown[], areas: readonly { id: string }[]) {
    const catalogIds = new Set(areas.map(({ id }) => id));
    const seasons = new Set<string>();
    const result = new Map<string, ResortAccess>();
    for (const input of files) {
        const { season, resorts } = accessSeason.parse(input);
        if (seasons.has(season)) throw new Error(`Duplicate visitor records for season ${season}`);
        seasons.add(season);
        for (const [id, info] of Object.entries(resorts)) {
            if (!catalogIds.has(id)) throw new Error(`Visitor record has no ski area ${id}`);
            const previous = result.get(id);
            if (!previous || season > previous.season) result.set(id, { ...info, season });
        }
    }
    return result;
}
