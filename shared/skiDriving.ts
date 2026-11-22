import { z } from 'zod';
import { httpsUrl, isoTime, skiCoordinates } from '../src/features/ski-status/schemas.ts';

export const drivingProviders = ['wsdot', 'drivebc', 'udot', 'tripcheck', 'caltrans'] as const;
export const drivingProvider = z.enum(drivingProviders);
export type DrivingProvider = z.infer<typeof drivingProvider>;

export const drivingProviderNames: Record<DrivingProvider, string> = {
    wsdot: 'WSDOT', drivebc: 'DriveBC', udot: 'UDOT', tripcheck: 'ODOT TripCheck', caltrans: 'Caltrans',
};
export const drivingDirectory = '.cache/ski-driving';
export const drivingPrefix = 'ski-status/driving/';
export const drivingRefreshMs = 5 * 60_000;
export const drivingStaleMs = 15 * 60_000;
export function drivingCameraRefreshMs(provider: DrivingProvider) {
    return (provider === 'drivebc' ? 30 : 6 * 60) * 60_000;
}
export const drivingManifestLimit = 32 * 1024;
export const drivingSnapshotLimit = 1024 * 1024;

const id = z.string().min(1).max(200);
const text = z.string().trim().min(1).max(6_000);
const mileposts = z.tuple([z.number().nonnegative(), z.number().nonnegative()]);
export const drivingDirection = z.enum(['north', 'south', 'east', 'west', 'both']);
export type DrivingDirection = z.infer<typeof drivingDirection>;
export const drivingPoint = skiCoordinates;
export type DrivingPoint = z.infer<typeof drivingPoint>;
export const drivingLine = z.array(drivingPoint).min(2).max(2_000);

export const drivingSegment = z.strictObject({
    road: text, direction: drivingDirection.optional(), mileposts: mileposts.optional(),
    line: drivingLine.optional(),
}).refine(segment => segment.line || segment.mileposts, 'A road segment needs geometry or mileposts');
export type DrivingSegment = z.infer<typeof drivingSegment>;

export const drivingBulletin = z.strictObject({
    id, road: text, direction: drivingDirection.optional(), mileposts: mileposts.optional(),
    point: drivingPoint, line: drivingLine.optional(),
    kind: z.enum(['closure', 'restriction', 'delay', 'condition']),
    title: text, description: text.optional(), source: httpsUrl,
    observedAt: isoTime.optional(), startsAt: isoTime.optional(), endsAt: isoTime.optional(),
    advisory: z.literal(true).optional(),
    awaitingStart: z.literal(true).optional(),
});
export type DrivingBulletin = z.infer<typeof drivingBulletin>;

export const drivingCamera = z.strictObject({
    id, name: text, road: text, view: text.optional(), point: drivingPoint, source: httpsUrl,
    image: httpsUrl.optional(), imageUpdatedAt: isoTime.optional(), credit: text.optional(),
});
export type DrivingCamera = z.infer<typeof drivingCamera>;

export function isDriveBcImageUrl(id: string, url: string) {
    const match = /^https:\/\/www\.drivebc\.ca\/images\/([1-9]\d*)\.jpg(?:\?t=\d+)?$/.exec(url);
    return match !== null && match[0] === url && match[1] === id;
}

const snapshot = { version: z.literal(1), provider: drivingProvider, checkedAt: isoTime };
function uniqueEntries(entries: { id: string }[]) {
    return new Set(entries.map(entry => entry.id)).size === entries.length;
}
export const drivingReportsSchema = z.strictObject({
    ...snapshot, entries: z.array(drivingBulletin).max(1_000).refine(uniqueEntries, 'Duplicate road bulletin ID'),
});
export const drivingCamerasSchema = z.strictObject({
    ...snapshot, entries: z.array(drivingCamera).max(1_000).refine(uniqueEntries, 'Duplicate road camera ID'),
});
export type DrivingReports = z.infer<typeof drivingReportsSchema>;
export type DrivingCameras = z.infer<typeof drivingCamerasSchema>;

function drivingFeed(kind: 'reports' | 'cameras') {
    return z.strictObject({
        file: z.string().regex(new RegExp(`^${kind}-[a-f0-9]{64}\\.json$`)).optional(),
        status: z.enum(['available', 'unavailable', 'unconfigured']),
    }).refine(feed => feed.status !== 'available' || feed.file !== undefined, 'An available feed needs a snapshot file');
}
export const drivingManifestSchema = z.strictObject({
    version: z.literal(1), updatedAt: isoTime,
    providers: z.partialRecord(drivingProvider, z.strictObject({ reports: drivingFeed('reports'), cameras: drivingFeed('cameras') })),
});
export type DrivingManifest = z.infer<typeof drivingManifestSchema>;

export function drivingTimeZone(zone: string, instant: number) {
    // Use Pacific Time (UTC−07) on browsers with an older time zone database.
    return zone === 'America/Vancouver' && instant >= Date.UTC(2026, 10, 1, 9) ? 'Etc/GMT+7' : zone;
}

export function normalizeDrivingRoad(value: string) {
    const road = value.trim().toUpperCase();
    const numbered = /^(INTERSTATE|I|US|SR|STATE ROUTE|STATE HIGHWAY|HIGHWAY|HWY|WA|UT|OR|BC|CA)[ -]*(\d+)([A-Z]?)$/.exec(road);
    if (!numbered) return road;
    const [, prefix, number, suffix] = numbered;
    const family = prefix === 'I' || prefix === 'INTERSTATE' ? 'I' : prefix === 'US' ? 'US' : 'SR';
    return `${family} ${Number(number)}${suffix}`;
}

export function normalizeDrivingDirection(value: string | undefined): DrivingDirection | undefined {
    const clean = value?.trim().toLowerCase().replace(/\s*bound$/, '');
    switch (clean) {
        case 'n': case 'nb': case 'north': return 'north';
        case 's': case 'sb': case 'south': return 'south';
        case 'e': case 'eb': case 'east': return 'east';
        case 'w': case 'wb': case 'west': return 'west';
        case 'both': case 'all': case 'both directions': case 'all directions': return 'both';
    }
    if (clean && /^(?:north\s*\/\s*south|east\s*\/\s*west)$/.test(clean)) return 'both';
}

export function drivingDistanceMeters([fromLon, fromLat]: DrivingPoint, [toLon, toLat]: DrivingPoint) {
    const rad = Math.PI / 180;
    const latitude = Math.sin((toLat - fromLat) * rad / 2);
    const longitude = Math.sin((toLon - fromLon) * rad / 2);
    const x = latitude ** 2 + Math.cos(fromLat * rad) * Math.cos(toLat * rad) * longitude ** 2;
    return 12_742_000 * Math.asin(Math.sqrt(Math.min(1, x)));
}

const roadToleranceMeters = 30;

function overlapsRoadSection(bulletin: DrivingBulletin, section: DrivingPoint[]) {
    // Project each report point onto the direction of a short, reviewed road edge.
    for (let i = 1; i < section.length; i++) {
        const [lon, lat] = section[i - 1];
        const lonScale = Math.cos(lat * Math.PI / 180) * 111_195;
        const dx = (section[i][0] - lon) * lonScale;
        const dy = (section[i][1] - lat) * 111_195;
        const length = Math.hypot(dx, dy);
        if (length === 0) continue;
        const project = (point: DrivingPoint) => {
            const x = (point[0] - lon) * lonScale;
            const y = (point[1] - lat) * 111_195;
            return { along: (x * dx + y * dy) / length, across: (x * dy - y * dx) / length };
        };
        if (!bulletin.line) {
            const { along, across } = project(bulletin.point);
            if (along >= 0 && along <= length + 1e-6 && Math.abs(across) <= roadToleranceMeters) return true;
            continue;
        }
        let start = project(bulletin.line[0]);
        for (const point of bulletin.line.slice(1)) {
            const end = project(point);
            const overlapStart = Math.max(0, Math.min(start.along, end.along));
            const overlapEnd = Math.min(length, Math.max(start.along, end.along));
            const along = end.along - start.along;
            const across = end.across - start.across;
            // Require shared distance and alignment. A crossing or an endpoint at the exit is insufficient.
            if (overlapEnd - overlapStart >= 1 && Math.abs(along) >= Math.abs(across)) {
                const offsetAt = (distance: number) => start.across + (distance - start.along) * across / along;
                if (Math.max(Math.abs(offsetAt(overlapStart)), Math.abs(offsetAt(overlapEnd))) <= roadToleranceMeters) return true;
            }
            start = end;
        }
    }
    return false;
}

export function drivingBulletinMatches(bulletin: DrivingBulletin, segment: DrivingSegment) {
    if (normalizeDrivingRoad(bulletin.road) !== normalizeDrivingRoad(segment.road)) return false;
    if (bulletin.direction !== 'both' && (!bulletin.direction || bulletin.direction !== segment.direction)) return false;
    if (bulletin.mileposts && segment.mileposts) {
        return Math.min(...bulletin.mileposts) <= Math.max(...segment.mileposts)
            && Math.min(...segment.mileposts) <= Math.max(...bulletin.mileposts);
    }
    return Boolean(segment.line && overlapsRoadSection(bulletin, segment.line));
}

export function drivingBulletinState(bulletin: DrivingBulletin, feed: Pick<DrivingReports, 'provider' | 'checkedAt'>, now: number, available: boolean) {
    const age = now - Date.parse(feed.checkedAt);
    if (!available || age < 0 || age >= drivingStaleMs) return 'stale';
    // Caltrans publishes actual closure status separately from the planned end time.
    const confirmedCaltransWork = feed.provider === 'caltrans' && bulletin.kind !== 'condition' && !bulletin.awaitingStart;
    if (bulletin.advisory || (!confirmedCaltransWork && bulletin.endsAt && Date.parse(bulletin.endsAt) <= now)) return 'advisory';
    if (bulletin.startsAt && Date.parse(bulletin.startsAt) > now) return 'scheduled';
    if (bulletin.awaitingStart) return 'advisory';
    if (bulletin.kind === 'condition') {
        const observedAge = bulletin.observedAt ? now - Date.parse(bulletin.observedAt) : Infinity;
        if (observedAge < 0 || observedAge > 6 * 60 * 60_000) return 'stale';
    }
    return 'active';
}
