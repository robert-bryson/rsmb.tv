import { z } from 'zod';
import { readSkiRoadApproaches } from './skiRoadApproaches.ts';
import { drivingDirection, drivingLine, drivingPoint, drivingDistanceMeters, normalizeDrivingRoad,
    type DrivingDirection, type DrivingPoint, type DrivingProvider, type DrivingSegment } from './skiDriving.ts';
import { httpsUrl, skiId } from '../src/features/ski-status/schemas.ts';

type RoadCatalog = ReturnType<typeof readSkiRoadApproaches>;
type RoadApproach = RoadCatalog['approachesByArea'][string][number];

const label = z.string().trim().min(1).max(400);
const labels = z.array(label).min(1);
const osmWays = z.array(z.string().regex(/^[1-9]\d*$/)).min(1);
const source = { source: httpsUrl, checkedOn: z.iso.date() };
const connector = z.strictObject({ roads: labels, line: drivingLine, osmWays });
const arrival = z.strictObject({
    ...source, areaId: skiId, name: label, parkingRecord: label, point: drivingPoint, connector,
    notes: z.array(z.strictObject({ label, description: label, source: httpsUrl })).min(1).optional(),
});
const section = z.strictObject({
    road: label, direction: drivingDirection, line: drivingLine, osmWays,
});
const reviewedApproach = z.strictObject({
    ...source, arrivalId: skiId, direction: drivingDirection,
    from: label, to: label, roads: labels, replaces: z.tuple([label, label]).optional(),
    passIds: z.array(skiId).optional(), statusUrls: z.array(httpsUrl).optional(),
    additionalSources: z.array(httpsUrl).optional(),
    restrictions: z.array(z.strictObject({ ...source, description: label })).optional(),
    segments: z.array(section).min(1).optional(),
});
const corridorsSchema = z.strictObject({
    arrivals: z.record(skiId, arrival),
    approaches: z.record(skiId, reviewedApproach),
});

export type DrivingArrival = z.infer<typeof arrival>;
export type DrivingApproach = RoadApproach & {
    id: string;
    arrivalId?: string;
    direction?: DrivingDirection;
    segments?: (DrivingSegment & { osmWays: string[] })[];
};
export type DrivingPass = RoadCatalog['mountainPasses'][string];
export type DrivingCatalog = {
    arrivals: Record<string, DrivingArrival>;
    approaches: Record<string, DrivingApproach[]>;
    passes: RoadCatalog['mountainPasses'];
};

export const drivingAreaProviders: Readonly<Partial<Record<string, DrivingProvider>>> = {
    'the-summit-at-snoqualmie': 'wsdot', 'stevens-pass': 'wsdot', 'whistler-blackcomb': 'drivebc',
    'alta': 'udot', 'snowbird': 'udot', 'mt-hood-meadows': 'tripcheck', 'palisades-tahoe': 'caltrans',
};

export const drivingProviderSources: Record<DrivingProvider, string> = {
    wsdot: 'https://wsdot.com/Travel/Real-time/Map/',
    drivebc: 'https://www.drivebc.ca/',
    udot: 'https://cottonwoodcanyons.udot.utah.gov/road-information/',
    tripcheck: 'https://tripcheck.com/',
    caltrans: 'https://quickmap.dot.ca.gov/',
};

export const drivingPassReports: Readonly<Partial<Record<string, { provider: DrivingProvider; reportId: string }>>> = {
    'us-wa-snoqualmie-pass-i90': { provider: 'wsdot', reportId: 'pass-snoqualmie-conditions' },
    'us-wa-stevens-pass': { provider: 'wsdot', reportId: 'pass-stevens-conditions' },
};

function samePoint(a: DrivingPoint, b: DrivingPoint) {
    return a[0] === b[0] && a[1] === b[1];
}

function checkLine(line: z.infer<typeof drivingLine>, id: string) {
    // A gap of this size indicates a missing extract or a disconnected road.
    for (let i = 1; i < line.length; i++) {
        const distance = drivingDistanceMeters(line[i - 1], line[i]);
        if (!distance || distance > 1_000) throw Error(`Invalid driving centerline for ${id}`);
    }
}

export function readDrivingCatalog(input: unknown, roadInput: unknown, areas: readonly { id: string }[]): DrivingCatalog {
    const { arrivals, approaches } = corridorsSchema.parse(input);
    const roads = readSkiRoadApproaches(roadInput, areas);
    const ids = new Set(areas.map(area => area.id));
    const routes: DrivingCatalog['approaches'] = Object.create(null);
    const used = new Set<string>();
    const replaced = new Set<string>();

    for (const [id, entry] of Object.entries(arrivals)) {
        const end = entry.connector.line.at(-1)!;
        if (!ids.has(entry.areaId) || !samePoint(end, entry.point)) {
            throw Error(`Driving entrance ${id} has no ski area or does not end at its entrance`);
        }
        checkLine(entry.connector.line, id);
    }
    for (const [id, { replaces, ...route }] of Object.entries(approaches)) {
        const destination = arrivals[route.arrivalId];
        if (!Object.hasOwn(arrivals, route.arrivalId)) throw Error(`Unknown driving entrance on ${id}`);
        const area = destination.areaId;
        used.add(route.arrivalId);
        const passIds = route.passIds ?? [];
        if (new Set(passIds).size !== passIds.length) throw Error(`Duplicate mountain pass on ${id}`);
        for (const passId of passIds) {
            const pass = roads.mountainPasses[passId];
            if (!pass || !route.roads.includes(pass.road)) throw Error(`Unknown or unrelated mountain pass ${passId} on ${id}`);
        }
        const normalized = route.roads.map(normalizeDrivingRoad);
        let nextPoint = destination.connector.line[0];
        const segments = route.segments ?? [];
        for (let index = segments.length - 1; index >= 0; index--) {
            const segment = segments[index];
            if (segment.direction !== route.direction || !normalized.includes(normalizeDrivingRoad(segment.road))) {
                throw Error(`Unrelated driving section on ${id}`);
            }
            checkLine(segment.line, id);
            if (!samePoint(segment.line.at(-1)!, nextPoint)) throw Error(`Disconnected driving section on ${id}`);
            nextPoint = segment.line[0];
        }
        if (replaces) {
            const [from, to] = replaces;
            const key = JSON.stringify([area, from, to]);
            const originals = roads.approachesByArea[area]?.filter(route => route.from === from && route.to === to);
            if (originals?.length !== 1 || replaced.has(key)) throw Error(`Invalid driving approach replacement for ${id}`);
            replaced.add(key);
        }
        (routes[area] ??= []).push({ id, ...route });
    }
    for (const id of Object.keys(arrivals)) {
        if (!used.has(id)) throw Error(`Driving entrance ${id} has no approach`);
    }
    for (const [area, entries] of Object.entries(roads.approachesByArea)) {
        for (const route of entries) {
            if (replaced.has(JSON.stringify([area, route.from, route.to]))) continue;
            const id = `legacy-${stableApproachId(area, route)}`;
            if ((routes[area] ??= []).some(route => route.id === id)) throw Error(`Duplicate driving approach ${id}`);
            routes[area].push({ id, ...route });
        }
    }
    return { arrivals, approaches: routes, passes: roads.mountainPasses };
}

// The identity stays the same when a source link, pass list or note changes.
function stableApproachId(area: string, route: RoadApproach) {
    let hash = 0x811c9dc5;
    for (const character of JSON.stringify([area, route.from, route.to, route.roads])) {
        hash = Math.imul(hash ^ character.codePointAt(0)!, 0x01000193);
    }
    return `${area}-${(hash >>> 0).toString(36)}`;
}
