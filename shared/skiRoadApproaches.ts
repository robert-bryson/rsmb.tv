import { z } from 'zod';
import { httpsUrl, skiCoordinates, skiId } from '../src/features/ski-status/schemas.ts';

const label = z.string().trim().min(1);
const source = { source: httpsUrl, checkedOn: z.iso.date() };
const approach = z.strictObject({
    ...source,
    from: label,
    to: label,
    roads: z.array(label).min(1),
    passIds: z.array(skiId).optional(),
    statusUrls: z.array(httpsUrl).optional(),
    additionalSources: z.array(httpsUrl).optional(),
    restrictions: z.array(z.strictObject({ ...source, description: label })).optional(),
});
const mountainPass = z.strictObject({ ...source, name: label, road: label, coordinates: skiCoordinates });
const roadApproaches = z.strictObject({
    approachesByArea: z.record(skiId, z.array(approach).min(1)),
    mountainPasses: z.record(skiId, mountainPass),
});

export function readSkiRoadApproaches(input: unknown, areas: readonly { id: string }[]) {
    const data = roadApproaches.parse(input);
    const areaIds = new Set(areas.map(({ id }) => id));
    for (const [id, routes] of Object.entries(data.approachesByArea)) {
        if (!areaIds.has(id)) throw new Error(`Road approach has no ski area ${id}`);
        const seen = new Set<string>();
        for (const route of routes) {
            const key = JSON.stringify([route.from, route.to, route.roads]);
            if (seen.has(key)) throw new Error(`Duplicate road approach for ${id} from ${route.from} to ${route.to}`);
            seen.add(key);
            const passes = route.passIds ?? [];
            if (new Set(passes).size !== passes.length) throw new Error(`Duplicate pass on road approach for ${id} from ${route.from}`);
            for (const passId of passes) {
                if (!Object.hasOwn(data.mountainPasses, passId)) throw new Error(`Unknown road pass ${passId} on approach for ${id}`);
                const pass = data.mountainPasses[passId];
                if (!route.roads.includes(pass.road)) throw new Error(`Road approach for ${id} crosses ${passId} without ${pass.road}`);
            }
        }
    }
    return data;
}
