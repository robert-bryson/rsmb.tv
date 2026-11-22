import { describe, expect, it } from 'vitest';
import areas from '../../projects/ski-status/data/areas.json';
import corridors from '../../projects/ski-status/data/driving-corridors.json';
import roadApproaches from '../../projects/ski-status/research/road-approaches.json';
import { drivingBulletinMatches, drivingBulletinState, drivingDistanceMeters, normalizeDrivingDirection, normalizeDrivingRoad,
    type DrivingBulletin, type DrivingSegment } from '../../shared/skiDriving';
import { readDrivingCatalog } from '../../shared/skiDrivingCatalog';
import { approachLine, drivingApproachReports, drivingCameraImage, drivingMapFeatures, roadReportState } from '../features/ski-status/drivingView';
import { skiResortAccess } from '../features/ski-status/resortAccessData';
import type { SkiDriving } from '../features/ski-status/useSkiDriving';

const now = Date.parse('2026-11-22T12:00:00Z');
const checkedAt = '2026-11-22T11:55:00Z';
const point = [-121.09, 47.745] as [number, number];
const bulletin: DrivingBulletin = { id: '101', direction: 'east', road: 'US-2', title: 'Road closed', point,
    kind: 'closure', source: 'https://wsdot.com/' };

describe('winter driving catalog', () => {
    const catalog = readDrivingCatalog(corridors, roadApproaches, areas);

    it('shares pass markers, merges reviewed routes, and keeps directional approaches distinct', () => {
        expect(Object.values(catalog.approaches).flat()).toHaveLength(
            Object.values(roadApproaches.approachesByArea).flat().length + 2);
        const routes = catalog.approaches['stevens-pass'];
        expect(routes.map(route => route.direction)).toEqual(['east', 'west']);
        expect(routes[0].passIds).toEqual(['us-wa-stevens-pass']);
        expect(routes[1].passIds).toEqual([]);
        expect(routes[0].arrivalId).toBe(routes[1].arrivalId);
        const data: SkiDriving = { catalog, now, catalogFailed: false, feedStatus: 'idle', feed: { providers: {} } };
        const markers = drivingMapFeatures(data);
        const passes = markers.filter(marker => marker.kind === 'pass');
        expect(new Set(passes.map(pass => pass.id)).size).toBe(Object.keys(roadApproaches.mountainPasses).length);
        expect(markers.filter(marker => marker.kind === 'parking')).toHaveLength(Object.keys(corridors.arrivals).length);
    });

    it('publishes connected road sections that end at parking points', () => {
        for (const [id, arrival] of Object.entries(catalog.arrivals)) {
            expect(arrival.connector.line.at(-1), id).toEqual(arrival.point);
            expect(arrival.connector.osmWays.length, id).toBeGreaterThan(0);
            expect(skiResortAccess.get(arrival.areaId)?.parking?.map(lot => lot.name), id).toContain(arrival.parkingRecord);
        }
        const [route] = catalog.approaches['whistler-blackcomb'];
        expect(approachLine(route, catalog.arrivals).at(-1)?.at(-1)).toEqual(catalog.arrivals['whistler-creekside'].point);
        for (const [id, routes] of Object.entries(catalog.approaches)) {
            for (const route of routes) {
                if (!route.segments?.length || !route.arrivalId) continue;
                const lines = approachLine(route, catalog.arrivals);
                for (let i = 1; i < lines.length; i++) {
                    expect(lines[i][0], id).toEqual(lines[i - 1].at(-1));
                }
            }
        }
    });

    it('rejects a connector that ends elsewhere and a route with an unknown pass', () => {
        const moved = structuredClone(corridors);
        moved.arrivals.alpental.point = [-121.40, 47.42];
        expect(() => readDrivingCatalog(moved, roadApproaches, areas)).toThrow(/does not end at its entrance/);
        const unknown = structuredClone(corridors);
        unknown.approaches['stevens-pass-eastbound'].passIds = ['unknown-pass'];
        expect(() => readDrivingCatalog(unknown, roadApproaches, areas)).toThrow(/Unknown or unrelated mountain pass/);
    });

    it('rejects a reviewed road section disconnected from the entrance connector', () => {
        const disconnected = structuredClone(corridors);
        disconnected.approaches['stevens-pass-eastbound'].segments[0].line.pop();
        expect(() => readDrivingCatalog(disconnected, roadApproaches, areas)).toThrow(/Disconnected driving section/);
    });
});

describe('road bulletin scope and freshness', () => {
    it('normalizes numbered routes without merging alternate routes or interstate and state routes', () => {
        expect(normalizeDrivingRoad('us-002A')).toBe('US 2A');
        expect(normalizeDrivingRoad('BC 99')).toBe(normalizeDrivingRoad('Highway 99'));
        expect(normalizeDrivingRoad('I-90')).not.toBe(normalizeDrivingRoad('SR 90'));
        expect(normalizeDrivingDirection('EASTBOUND')).toBe('east');
        expect(normalizeDrivingDirection('Unknown')).toBeUndefined();
    });

    it('requires the same road, direction, and overlapping mileposts', () => {
        const segment: DrivingSegment = { road: 'US 2', direction: 'east', mileposts: [62, 64.5] };
        expect(drivingBulletinMatches({ ...bulletin, mileposts: [65, 66] }, segment)).toBe(false);
        expect(drivingBulletinMatches({ ...bulletin, mileposts: [64.5, 63] }, segment)).toBe(true);
        expect(drivingBulletinMatches({ ...bulletin, direction: 'west', mileposts: [63, 64] }, segment)).toBe(false);
        expect(drivingBulletinMatches({ ...bulletin, direction: undefined, mileposts: [63, 64] }, segment)).toBe(false);
        expect(drivingBulletinMatches({ ...bulletin, direction: 'both', mileposts: [63, 64] }, segment)).toBe(true);
        expect(drivingBulletinMatches({ ...bulletin, road: 'SR 2', mileposts: [63, 64] }, segment)).toBe(false);
    });

    it('does not move a closure past the turn onto a resort route or onto a parallel road', () => {
        const segment: DrivingSegment = { road: 'US 2', direction: 'east', line: [[-121.1, 47.745], [-121.089, 47.745]] };
        expect(drivingBulletinMatches(bulletin, segment)).toBe(true);
        expect(drivingBulletinMatches({ ...bulletin, point: [-121.088, 47.745] }, segment)).toBe(false);
        expect(drivingBulletinMatches({ ...bulletin, point: [-121.09, 47.746] }, segment)).toBe(false);
        expect(drivingBulletinMatches({ ...bulletin, road: 'US 2A' }, segment)).toBe(false);
    });

    it('matches a line that covers the reviewed section and excludes crossings and lines beyond it', () => {
        const segment: DrivingSegment = { road: 'US 2', direction: 'east', line: [[-121.1, 47.745], [-121.089, 47.745]] };
        const matches = (line: NonNullable<DrivingBulletin['line']>) =>
            drivingBulletinMatches({ ...bulletin, point: line[0], line }, segment);
        expect(matches([[-121.109, 47.7451], [-121.08, 47.7451]])).toBe(true);
        expect(matches([[-121.08, 47.745], [-121.089, 47.745]])).toBe(false);
        expect(matches([[-121.08, 47.745], [-121.0889, 47.745]])).toBe(false);
        expect(matches([[-121.09, 47.74], [-121.09, 47.745], [-121.09, 47.75]])).toBe(false);
        expect(matches([[-121.109, 47.7454], [-121.08, 47.7454]])).toBe(false);
    });

    it('matches an uphill closure past Snowbird to Alta only', () => {
        const catalog = readDrivingCatalog(corridors, roadApproaches, areas);
        const alta = catalog.approaches.alta[0].segments?.[0];
        const snowbird = catalog.approaches.snowbird.find(route => route.id === 'snowbird-entry-2-uphill')?.segments?.[0];
        const location = alta?.line?.at(-2);
        expect(alta && snowbird && location).toBeTruthy();
        const closure = { ...bulletin, road: 'SR-210', point: location! };
        expect(drivingBulletinMatches(closure, alta!)).toBe(true);
        expect(drivingBulletinMatches(closure, snowbird!)).toBe(false);
    });

    it('separates a current event from a future event and an old observation', () => {
        expect(drivingBulletinState(bulletin, now, checkedAt, true)).toBe('active');
        expect(drivingBulletinState({ ...bulletin, startsAt: '2026-11-22T13:00:00Z' }, now, checkedAt, true)).toBe('scheduled');
        expect(drivingBulletinState({ ...bulletin, advisory: true }, now, checkedAt, true)).toBe('advisory');
        expect(drivingBulletinState({ ...bulletin, advisory: true, startsAt: '2026-11-22T13:00:00Z' }, now, checkedAt, true)).toBe('advisory');
        expect(drivingBulletinState({ ...bulletin, startsAt: '2026-11-22T13:00:00Z', endsAt: checkedAt }, now, checkedAt, true)).toBe('advisory');
        expect(drivingBulletinState({ ...bulletin, endsAt: '2026-11-22T12:00:00Z' }, now, checkedAt, true)).toBe('advisory');
        expect(drivingBulletinState({ ...bulletin, kind: 'condition', observedAt: '2026-11-22T02:00:00Z' }, now, checkedAt, true)).toBe('stale');
        expect(drivingBulletinState(bulletin, now, '2026-11-22T11:45:00Z', true)).toBe('stale');
        expect(drivingBulletinState(bulletin, now, checkedAt, false)).toBe('stale');
    });

    it('keeps a nearby opposite-direction alert out of matching reports after refresh and outage', () => {
        const catalog = readDrivingCatalog(corridors, roadApproaches, areas);
        const route = catalog.approaches['stevens-pass'][0];
        const line = route.segments?.[0].line;
        expect(line?.length).toBeGreaterThan(1);
        const coordinates = line![1];
        const data: SkiDriving = { catalog, now, catalogFailed: false, feedStatus: 'available', feed: { providers: {
            wsdot: { reportsReady: true, camerasReady: false, reportsStatus: 'available', reports: {
                file: 'reports.json', data: { version: 1, provider: 'wsdot', checkedAt,
                    entries: [{ ...bulletin, point: coordinates }, { ...bulletin, id: '102', direction: 'west', point: coordinates }] },
            } },
        } } };
        const { exact, nearby } = drivingApproachReports(data, 'stevens-pass', coordinates, route);
        expect(exact.map(report => report.entry.id)).toEqual(['101']);
        expect(nearby.map(report => report.entry.id)).toEqual(['102']);
        expect(roadReportState(data, 'wsdot')).toBe('current');
        const outage = { ...data, feedStatus: 'unavailable' } as const;
        expect(roadReportState(outage, 'wsdot')).toBe('unavailable');
        expect(drivingApproachReports(outage, 'stevens-pass', coordinates, route).exact[0].state).toBe('stale');
        expect(drivingMapFeatures(outage).some(feature => feature.kind === 'report')).toBe(false);
    });

    it('calculates straight-line distance across the antimeridian', () => {
        expect(drivingDistanceMeters([179.5, 0], [-179.5, 0])).toBeCloseTo(111_194.9266, 3);
    });
});

describe('road cameras', () => {
    const camera = { id: '519', name: 'Whistler Village Gate', road: 'BC 99', point,
        source: 'https://www.drivebc.ca/cameras/519', image: 'https://www.drivebc.ca/images/519.jpg?t=10', imageUpdatedAt: checkedAt };
    it('approves only the matching DriveBC path and only with a current image time', () => {
        expect(drivingCameraImage(camera, now, true)).toBe(camera.image);
        expect(drivingCameraImage({ ...camera, image: 'https://www.drivebc.ca/images/520.jpg' }, now, true)).toBeUndefined();
        expect(drivingCameraImage({ ...camera, image: 'https://unapproved.example/images/519.jpg' }, now, true)).toBeUndefined();
        expect(drivingCameraImage(camera, now + 60 * 60_000, true)).toBeUndefined();
        expect(drivingCameraImage(camera, now, false)).toBeUndefined();
    });
});
