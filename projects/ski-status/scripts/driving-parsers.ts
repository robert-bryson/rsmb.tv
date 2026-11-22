import { z } from 'zod';
import { drivingLine, drivingPoint, drivingTimeZone, isDriveBcImageUrl, normalizeDrivingDirection, normalizeDrivingRoad,
    type DrivingBulletin, type DrivingCamera, type DrivingPoint, type DrivingProvider } from '../../../shared/skiDriving.ts';
import { drivingProviderSources } from '../../../shared/skiDrivingCatalog.ts';
import { isoTime } from '../../../src/features/ski-status/schemas.ts';
import { conditionsXmlRoot } from './conditions-xml.ts';

const source = drivingProviderSources;
const highwayPattern = /\b(?:I|US|SR|Interstate|State Route)[ -]*\d+[A-Z]?\b/i;
const idValue = z.union([z.number().int().nonnegative(), z.string().trim().min(1).max(130)]);
type Region = [west: number, south: number, east: number, north: number];
const windows: Record<DrivingProvider, Region[]> = {
    wsdot: [[-121.95, 47.27, -121.13, 47.55], [-121.68, 47.57, -120.65, 47.96]],
    drivebc: [[-123.39, 49.36, -122.80, 50.20]],
    udot: [[-111.85, 40.52, -111.53, 40.69]],
    tripcheck: [],
    caltrans: [[-120.64, 39.07, -120.01, 39.48]],
};
const roads: Record<DrivingProvider, string[]> = {
    wsdot: ['I 90', 'US 2', 'SR 906'], drivebc: ['SR 99'], udot: ['SR 190', 'SR 210'],
    tripcheck: [], caltrans: ['I 80', 'SR 89'],
};
function inside(region: Region, [lon, lat]: DrivingPoint) {
    const [west, south, east, north] = region;
    return lon >= west && lon <= east && lat >= south && lat <= north;
}

function inRegion(provider: DrivingProvider, road: string, point: DrivingPoint) {
    return roads[provider].includes(normalizeDrivingRoad(road))
        && windows[provider].some(region => inside(region, point));
}

function pointOnLineInRegion(provider: DrivingProvider, road: string, points: DrivingPoint[]) {
    if (!roads[provider].includes(normalizeDrivingRoad(road))) return;
    for (const region of windows[provider]) {
        const vertex = points.find(point => inside(region, point));
        if (vertex) return vertex;
        for (let index = 1; index < points.length; index++) {
            const [lon, lat] = points[index - 1];
            const dx = points[index][0] - lon;
            const dy = points[index][1] - lat;
            const [west, south, east, north] = region;
            // Intersect the reported edge with the window borders when both vertices are outside.
            const crossings = [dx && (west - lon) / dx, dx && (east - lon) / dx,
                dy && (south - lat) / dy, dy && (north - lat) / dy];
            for (const fraction of crossings) {
                const candidate: DrivingPoint = [lon + fraction * dx, lat + fraction * dy];
                if (fraction > 0 && fraction < 1 && inside(region, candidate)) return candidate;
            }
        }
    }
}

function point(input: unknown) {
    const result = drivingPoint.safeParse(input);
    return result.success ? result.data : undefined;
}

function clean(value: string) {
    return value.replace(/<(?:br\s*\/?|\/div|\/p|\/li)>/gi, '\n').replace(/<[^>]*>/g, '')
        .replace(/&(?:amp|nbsp|quot|apos|deg|lt|gt|#39);/gi, entity => ({
            '&amp;': '&', '&nbsp;': ' ', '&quot;': '"', '&apos;': "'", '&deg;': '°', '&lt;': '<', '&gt;': '>', '&#39;': "'",
        })[entity.toLowerCase()] ?? entity)
        .split('\n').map(line => line.trim()).filter(Boolean).join('\n').slice(0, 6_000);
}

function timestamp(value: unknown) {
    if (!isoTime.safeParse(value).success) return;
    const date = new Date(value as string);
    if (Number.isFinite(+date)) return date.toISOString();
}

export function drivingLocalTime(value: string, zone: string) {
    const explicit = timestamp(value);
    if (explicit) return explicit;
    const local = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)
        ? value.padEnd(19, ':00') : undefined;
    if (!local) return;
    const utc = Date.parse(`${local}Z`);
    if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 19) !== local) return;
    const formatter = (timeZone: string) => new Intl.DateTimeFormat('sv-SE', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    const regional = formatter(zone);
    const current = drivingTimeZone(zone, utc + 86_400_000);
    const fixed = current === zone ? regional : formatter(current);
    const shown = (instant: number) => (drivingTimeZone(zone, instant) === zone ? regional : fixed).format(instant).replace(' ', 'T');
    // Test offsets on both sides of the date so skipped and repeated local times have no inferred timestamp.
    const day = 86_400_000;
    const offsets = new Set([utc - day, utc + day].map(instant => Date.parse(`${shown(instant)}Z`) - instant));
    const candidates = [...offsets].map(offset => utc - offset).filter(instant => shown(instant) === local);
    if (candidates.length === 1) return new Date(candidates[0]).toISOString();
}

function placemarks(xml: string, allowIncomplete = false) {
    const root = conditionsXmlRoot(xml.replace(/^\uFEFF/, ''), 'WSDOT');
    if (root?.localName !== 'kml' || !root.getElementsByTagNameNS('*', 'Document').length) throw Error('Expected a WSDOT KML document');
    return Array.from(root.getElementsByTagNameNS('*', 'Placemark')).flatMap(marker => {
        const name = marker.getElementsByTagNameNS('*', 'name')[0]?.textContent?.trim();
        const rawId = marker.getAttribute('id')?.match(/^ID (\d+)$/)?.[1];
        const location = marker.getElementsByTagNameNS('*', 'Point')[0]?.getElementsByTagNameNS('*', 'coordinates')[0];
        const locationText = location?.textContent?.trim();
        const coordinates = locationText && point(locationText.split(',').slice(0, 2).map(value => value.trim() ? Number(value) : NaN));
        const description = marker.getElementsByTagNameNS('*', 'description')[0]?.textContent ?? '';
        if (rawId && name && coordinates) return [{ id: rawId, name, point: coordinates, description }];
        if (allowIncomplete) return [];
        throw Error('WSDOT report is missing a valid placemark ID, name, or point');
    });
}

export function wsdotAlerts(xml: string): DrivingBulletin[] {
    return placemarks(xml).flatMap(({ id, name, point, description }) => {
        const road = highwayPattern.exec(name)?.[0];
        if (!road || !inRegion('wsdot', road, point)) return [];
        const direction = normalizeDrivingDirection(/\b(both directions|northbound|southbound|eastbound|westbound)\b/i.exec(name)?.[0]);
        return [{ id: `alert-${id}`, road, point, direction, kind: 'condition', title: clean(name),
            description: clean(description) || undefined, source: source.wsdot, advisory: true }];
    });
}

export function wsdotPasses(xml: string): DrivingBulletin[] {
    const passes: Record<string, { slug: string; name: string; road: string }> = {
        '11': { slug: 'snoqualmie', name: 'Snoqualmie Pass', road: 'I-90' },
        '10': { slug: 'stevens', name: 'Stevens Pass', road: 'US 2' },
    };
    return placemarks(xml).flatMap(({ id, name, point, description }) => {
        const pass = passes[id];
        if (!pass || !name.startsWith(pass.name)) return [];
        const value = clean(description);
        const match = /\b(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}) (AM|PM)\b/i.exec(value);
        let observedAt: string | undefined;
        if (match && Number(match[4]) >= 1 && Number(match[4]) <= 12) {
            const [, month, day, year, hour, minute, half] = match;
            const localHour = Number(hour) % 12 + (half.toUpperCase() === 'PM' ? 12 : 0);
            observedAt = drivingLocalTime(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(localHour).padStart(2, '0')}:${minute}`, 'America/Los_Angeles');
        }
        return [{ id: `pass-${pass.slug}-conditions`, road: pass.road, point, direction: 'both', kind: 'condition',
            title: pass.name, description: value.split('\n').slice(match ? 2 : 1).join('\n') || undefined,
            observedAt, source: `https://wsdot.com/travel/real-time/mountainpasses/${pass.name.split(' ')[0]}` }];
    });
}

function agencyLink(value: string | undefined, host: string, fallback: string) {
    if (!value?.trim()) return fallback;
    const origin = `https://${host}`;
    try {
        const url = new URL(value, origin);
        if (url.origin === origin && !url.username && !url.password) return url.href;
    } catch { /* The agency page is still available. */ }
    return fallback;
}

export function wsdotCameras(xml: string): DrivingCamera[] {
    return placemarks(xml, true).flatMap(({ id, name, point, description }) => {
        const road = highwayPattern.exec(name)?.[0];
        if (!road || !inRegion('wsdot', road, point)) return [];
        const image = /\bsrc="([^"]+)"/i.exec(description)?.[1];
        return [{ id, road, point, name: clean(name), source: agencyLink(image, 'images.wsdot.wa.gov', source.wsdot) }];
    });
}

const bcEvent = z.object({
    id: idValue, url: z.string().optional(), headline: z.string(), description: z.string().optional(),
    status: z.enum(['ACTIVE', 'ARCHIVED']), updated: z.string().optional(), event_type: z.string().optional(),
    timezone: z.string().optional(),
    geography: z.discriminatedUnion('type', [
        z.object({ type: z.literal('Point'), coordinates: drivingPoint }),
        z.object({ type: z.literal('LineString'), coordinates: drivingLine }),
    ]),
    schedule: z.object({ intervals: z.array(z.string()).optional() }).passthrough().optional(),
    roads: z.array(z.object({ name: z.string(), direction: z.string().optional(), state: z.string().optional(),
        from: z.string().optional(), to: z.string().optional(), '+delay': z.union([z.number(), z.string()]).nullish() })).min(1),
});

function driveBcWindow(event: z.infer<typeof bcEvent>) {
    const { schedule, timezone = 'UTC' } = event;
    if (schedule?.intervals?.length !== 1 || Object.keys(schedule).length !== 1) return;
    if (/\b(?:weekdays|weekends|daily|nightly|every day|intermittent(?:ly)?|alternating days)\b/i.test(event.description ?? '')) return;
    // The reviewed Highway 99 feed uses UTC when it omits the zone.
    if (timezone !== 'UTC' && timezone !== 'America/Vancouver') return;
    const [first, last, ...extra] = schedule.intervals[0].split('/');
    if (!first || last === undefined || extra.length) return;
    const startsAt = drivingLocalTime(first, timezone);
    const endsAt = last ? drivingLocalTime(last, timezone) : undefined;
    if (!startsAt || (last && (!endsAt || endsAt <= startsAt))) return;
    return { startsAt, endsAt };
}

export function driveBcEvents(input: unknown): DrivingBulletin[] {
    const { events, pagination } = z.object({ events: z.array(z.unknown()),
        pagination: z.object({ next_url: z.string().nullish() }).optional() }).parse(input);
    if (pagination?.next_url) throw Error('DriveBC event result is incomplete');
    return events.flatMap(row => {
        if (z.object({ status: z.literal('ARCHIVED') }).safeParse(row).success) return [];
        const event = bcEvent.parse(row);
        const title = clean(event.headline);
        if (!title) throw Error('DriveBC event is missing a headline');
        const { geography } = event;
        const line = geography.type === 'LineString' ? geography.coordinates : undefined;
        const coordinates = geography.type === 'Point' ? [geography.coordinates] : geography.coordinates;
        const window = driveBcWindow(event);
        const observation = event.event_type === 'ROAD_CONDITION' || event.event_type === 'WEATHER_CONDITION';
        return event.roads.flatMap((affected, index): DrivingBulletin[] => {
            const road = affected.name;
            const regionalPoint = pointOnLineInRegion('drivebc', road, coordinates);
            if (!regionalPoint) return [];
            const direction = normalizeDrivingDirection(affected.direction);
            const minutes = Number(affected['+delay']);
            const delay = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
            const kind = affected.state === 'ALL_LANES_CLOSED' || affected.state === 'CLOSED' ? 'closure'
                : affected.state === 'SOME_LANES_CLOSED' ? 'restriction' : delay ? 'delay' : 'condition';
            const section = [affected.from, affected.to].filter(Boolean).join(' to ');
            const description = clean([section, event.description, delay ? `Reported delay ${delay} minutes.` : undefined].filter(Boolean).join('\n'));
            return [{ id: `${event.id}-${index}`, road, direction, point: regionalPoint, line, kind, title,
                description: description || undefined, observedAt: timestamp(event.updated), ...window,
                advisory: (!direction || (!window && !(observation && kind === 'condition' && !event.schedule))) ? true : undefined,
                source: agencyLink(event.url, 'api.open511.gov.bc.ca', source.drivebc) }];
        });
    });
}

const bcCamera = z.object({
    id: z.number().int().positive(), name: z.string(), highway: z.string(), orientation: z.string().nullish(),
    location: z.object({ type: z.literal('Point'), coordinates: drivingPoint }),
    links: z.object({ imageDisplay: z.string().optional() }).optional(), last_update_modified: z.string().nullish(),
    marked_stale: z.boolean().optional(), marked_delayed: z.boolean().optional(), https_cam: z.boolean().optional(),
    credit: z.string().nullish(), is_on: z.boolean(), should_appear: z.boolean(),
});
export function driveBcCameras(input: unknown): DrivingCamera[] {
    return z.array(z.unknown()).parse(input).flatMap(row => {
        const parsed = bcCamera.safeParse(row);
        if (!parsed.success) return [];
        const camera = parsed.data;
        const location = camera.location.coordinates;
        const road = `BC ${camera.highway}`;
        if (!camera.is_on || !camera.should_appear || !inRegion('drivebc', road, location)) return [];
        const view = normalizeDrivingDirection(camera.orientation ?? undefined);
        const imageUpdatedAt = timestamp(camera.last_update_modified);
        const path = camera.links?.imageDisplay;
        const url = path && `https://www.drivebc.ca${path}`;
        const image = camera.marked_stale === false && camera.marked_delayed === false && camera.https_cam
            && !camera.credit?.trim() && imageUpdatedAt && url && isDriveBcImageUrl(String(camera.id), url) ? url : undefined;
        return [{ id: String(camera.id), name: clean(camera.name), road, point: location, view,
            source: `https://www.drivebc.ca/cameras/${camera.id}`, image, imageUpdatedAt,
            credit: camera.credit?.trim() || 'DriveBC, Province of British Columbia' }];
    });
}

const caltransLocation = z.object({
    route: z.string(), routeSuffix: z.string().optional(), locationName: z.string(), direction: z.string(),
    longitude: z.string(), latitude: z.string(),
});
const caltransRecord = z.object({ index: idValue, location: caltransLocation, inService: z.string() });
const chainRecord = caltransRecord.extend({
    statusData: z.object({ statusTimestamp: z.object({ statusDate: z.string(), statusTime: z.string() }),
        status: z.string(), statusDescription: z.string() }),
});
const caRows = z.object({ data: z.array(z.unknown()) });

export function caltransChains(input: unknown): DrivingBulletin[] {
    const { data } = z.object({ data: z.array(z.object({ cc: chainRecord })) }).parse(input);
    return data.flatMap(({ cc: { index, location, statusData, inService } }): DrivingBulletin[] => {
        if (inService !== 'true') return [];
        const { status, statusDescription, statusTimestamp: { statusDate, statusTime } } = statusData;
        const coordinates = point([Number(location.longitude || NaN), Number(location.latitude || NaN)]);
        const road = `${location.route}${location.routeSuffix ?? ''}`;
        if (!coordinates || !inRegion('caltrans', road, coordinates) || !/^R-[0-3]$/.test(status)) return [];
        return [{ id: `chains-${index}`, title: `${clean(location.locationName)} (${status})`, road, point: coordinates,
            kind: 'condition', direction: normalizeDrivingDirection(location.direction), description: clean(statusDescription) || undefined,
            observedAt: drivingLocalTime(`${statusDate}T${statusTime}`, 'America/Los_Angeles'), source: source.caltrans }];
    });
}

export function caltransCameras(input: unknown): DrivingCamera[] {
    return caRows.parse(input).data.flatMap(row => {
        const parsed = z.object({ cctv: caltransRecord.extend({
            imageData: z.object({ static: z.object({ currentImageURL: z.string().optional() }).optional() }).optional(),
        }) }).safeParse(row);
        if (!parsed.success || parsed.data.cctv.inService !== 'true') return [];
        const { index, location, imageData } = parsed.data.cctv;
        const coordinates = point([Number(location.longitude || NaN), Number(location.latitude || NaN)]);
        const road = `${location.route}${location.routeSuffix ?? ''}`;
        return coordinates && inRegion('caltrans', road, coordinates) ? [{ id: String(index), point: coordinates, road,
            name: clean(location.locationName), source: agencyLink(imageData?.static?.currentImageURL, 'cwwp2.dot.ca.gov', source.caltrans) }] : [];
    });
}

function unixSeconds(value: number | null | undefined) {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 && value < 32_503_680_000
        ? new Date(value * 1000).toISOString() : undefined;
}

function readMilepost(value: string | null | undefined) {
    const match = /^(?:MP\s+)?(\d+(?:\.\d+)?)$/i.exec(value?.trim() ?? '');
    return match && Number.isFinite(Number(match[1])) ? Number(match[1]) : undefined;
}

function udotLine(encoded: string) {
    // Google encodes latitude and longitude deltas in five-bit groups.
    let cursor = 0;
    function delta() {
        let value = 0;
        for (let shift = 0; shift <= 25 && cursor < encoded.length; shift += 5) {
            const group = encoded.charCodeAt(cursor++) - 63;
            if (group < 0 || group > 63) break;
            value += (group & 31) * 2 ** shift;
            if (group < 32) return value % 2 ? -(value + 1) / 2 : value / 2;
        }
        throw Error('Invalid UDOT road geometry');
    }
    const coordinates: DrivingPoint[] = [];
    let lat = 0;
    let lon = 0;
    while (cursor < encoded.length && coordinates.length < 2_000) {
        lat += delta();
        lon += delta();
        coordinates.push([lon / 100_000, lat / 100_000]);
    }
    if (cursor < encoded.length) throw Error('UDOT road geometry exceeds the point limit');
    return drivingLine.parse(coordinates);
}

const udotEvent = z.object({
    ID: idValue, RoadwayName: z.string(), DirectionOfTravel: z.string().nullish(), Description: z.string(),
    Name: z.string().nullish(), Latitude: z.number(), Longitude: z.number(), StartDate: z.number().nullish(),
    PlannedEndDate: z.number().nullish(), LastUpdated: z.number().nullish(), Reported: z.number().nullish(),
    IsFullClosure: z.boolean(), Recurrence: z.string().nullish(), RecurrenceSchedules: z.string().nullish(),
    MPStart: z.string().nullish(), MPEnd: z.string().nullish(), EncodedPolyline: z.string().nullish(),
    NumberOfAffectedLanes: z.number().nullish(),
});
export function udotEvents(input: unknown): DrivingBulletin[] {
    return z.array(udotEvent).parse(input).flatMap((event): DrivingBulletin[] => {
        const road = event.RoadwayName;
        if (!roads.udot.includes(normalizeDrivingRoad(road))) return [];
        const coordinates = drivingPoint.parse([event.Longitude, event.Latitude]);
        const line = event.EncodedPolyline ? udotLine(event.EncodedPolyline) : undefined;
        const location = pointOnLineInRegion('udot', road, line ?? [coordinates]);
        if (!location) return [];
        const description = clean(event.Description);
        const direction = normalizeDrivingDirection(event.DirectionOfTravel ?? undefined);
        const startsAt = unixSeconds(event.StartDate);
        const endsAt = unixSeconds(event.PlannedEndDate);
        const recurrence = Boolean(event.Recurrence?.trim() || event.RecurrenceSchedules?.trim());
        const start = readMilepost(event.MPStart);
        const end = readMilepost(event.MPEnd);
        const mileposts: [number, number] | undefined = start !== undefined && end !== undefined ? [start, end] : undefined;
        const kind = event.IsFullClosure ? 'closure' : (event.NumberOfAffectedLanes ?? 0) > 0 ? 'restriction' : 'condition';
        return [{ id: String(event.ID), road, point: location, line, direction, startsAt, endsAt, mileposts, kind,
            title: clean(event.Name ?? '') || `${road} traffic report`, description: description || undefined,
            advisory: (!direction || !startsAt || recurrence || (endsAt && endsAt <= startsAt)) ? true : undefined,
            observedAt: unixSeconds(event.LastUpdated) ?? unixSeconds(event.Reported), source: source.udot }];
    });
}

const agencyFlag = z.enum(['true', 'false']);
const caClosure = z.object({
    index: idValue,
    location: z.object({
        travelFlowDirection: z.string(),
        begin: z.object({
            beginRoute: z.string(), beginRouteSuffix: z.string().optional(), beginMilepost: z.string(),
            beginLocationName: z.string(), beginLongitude: z.string(), beginLatitude: z.string(),
        }),
        end: z.object({
            endRoute: z.string(), endRouteSuffix: z.string().optional(), endMilepost: z.string(), endLocationName: z.string(),
            endLongitude: z.string().optional(), endLatitude: z.string().optional(),
        }),
    }),
    closure: z.object({
        facility: z.string(), typeOfClosure: z.string(), typeOfWork: z.string(), lanesClosed: z.string(),
        durationOfClosure: z.string().optional(),
        closureTimestamp: z.object({ closureStartEpoch: z.string(), closureEndEpoch: z.string(), isClosureEndIndefinite: agencyFlag }),
        code1097: z.object({ isCode1097: agencyFlag, code1097Timestamp: z.object({ code1097Epoch: z.string() }).optional() }),
        code1098: z.object({ isCode1098: agencyFlag }), code1022: z.object({ isCode1022: agencyFlag }),
    }),
});
export function caltransClosures(input: unknown, now = Date.now()): DrivingBulletin[] {
    const { data } = z.object({ data: z.array(z.object({ lcs: caClosure })) }).parse(input);
    return data.flatMap(({ lcs: { index, location: { begin, end, travelFlowDirection }, closure } }): DrivingBulletin[] => {
        const { closureTimestamp, code1097, code1098, code1022 } = closure;
        if (code1022.isCode1022 !== 'false' || code1098.isCode1098 !== 'false') return [];
        const road = `${begin.beginRoute}${begin.beginRouteSuffix ?? ''}`;
        const sameRoad = normalizeDrivingRoad(road) === normalizeDrivingRoad(end.endRoute + (end.endRouteSuffix ?? ''));
        const beginPoint = point([Number(begin.beginLongitude || NaN), Number(begin.beginLatitude || NaN)]);
        const endPoint = sameRoad && point([Number(end.endLongitude || NaN), Number(end.endLatitude || NaN)]);
        const coordinates = [beginPoint, endPoint].find(point => point && inRegion('caltrans', road, point));
        if (!coordinates) return [];
        const direction = normalizeDrivingDirection(travelFlowDirection);
        const started = code1097.isCode1097 === 'true';
        const observedAt = started ? unixSeconds(Number(code1097.code1097Timestamp?.code1097Epoch)) : undefined;
        const scheduledStart = unixSeconds(Number(closureTimestamp.closureStartEpoch));
        const indefinite = closureTimestamp.isClosureEndIndefinite === 'true';
        const endsAt = indefinite ? undefined : unixSeconds(Number(closureTimestamp.closureEndEpoch));
        if (!started && (!scheduledStart || (endsAt && Date.parse(endsAt) <= now))) return [];
        const validSchedule = indefinite || (endsAt && scheduledStart && endsAt > scheduledStart);
        const first = readMilepost(begin.beginMilepost);
        const last = readMilepost(end.endMilepost);
        const mileposts: [number, number] | undefined = sameRoad && first !== undefined && last !== undefined ? [first, last] : undefined;
        const throughLanes = sameRoad && (closure.facility === 'Mainline' || closure.facility === 'Conventional Hwy');
        const kind = throughLanes && closure.typeOfClosure === 'Full' ? 'closure' : 'restriction';
        const description = clean([begin.beginLocationName, end.endLocationName].filter(Boolean).join(' to ')
            + `\n${closure.facility} · ${closure.typeOfWork}\nLanes affected: ${closure.lanesClosed}`);
        const unclearTime = started ? observedAt && Date.parse(observedAt) > now : !validSchedule;
        return [{
            id: `lcs-${index}`, road, point: coordinates, mileposts, direction, kind,
            title: `${road} ${closure.facility.toLowerCase()} work`,
            description, observedAt, startsAt: started ? observedAt : scheduledStart, endsAt, source: source.caltrans,
            awaitingStart: started ? undefined : true,
            advisory: (!throughLanes || !direction || closure.durationOfClosure === 'Intermittent' || unclearTime) ? true : undefined,
        }];
    });
}

const udotCamera = z.object({
    Id: idValue, Roadway: z.string(), Location: z.string(), Direction: z.string().nullish(),
    Latitude: z.number(), Longitude: z.number(),
    Views: z.array(z.object({ Id: idValue, Status: z.string(), Url: z.string(), Description: z.string().nullish() })),
});
export function udotCameras(input: unknown): DrivingCamera[] {
    return z.array(z.unknown()).parse(input).flatMap(row => {
        const parsed = udotCamera.safeParse(row);
        if (!parsed.success) return [];
        const camera = parsed.data;
        const location = point([camera.Longitude, camera.Latitude]);
        if (!location || !inRegion('udot', camera.Roadway, location)) return [];
        return camera.Views.filter(view => view.Status === 'Enabled').map(view => ({
            id: `${camera.Id}-${view.Id}`, road: camera.Roadway, point: location, name: clean(camera.Location) || camera.Roadway,
            view: clean(view.Description ?? '') || normalizeDrivingDirection(camera.Direction ?? undefined),
            source: agencyLink(view.Url, 'www.udottraffic.utah.gov', source.udot),
        }));
    });
}
