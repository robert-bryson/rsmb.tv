import { describe, expect, it, vi } from 'vitest';
import { caltransChains, caltransClosures, driveBcCameras, driveBcEvents, drivingLocalTime, udotCameras, udotEvents, wsdotAlerts, wsdotPasses } from '../projects/ski-status/scripts/driving-parsers';
import { drivingDigest, publishDriving } from '../projects/ski-status/scripts/driving-publication';
import { createDrivingCollectors } from '../projects/ski-status/scripts/sync-driving';
import type { ConditionsStore } from '../projects/ski-status/scripts/conditions-store';
import { drivingBulletinMatches, drivingBulletinState, type DrivingBulletin } from '../shared/skiDriving';

const now = '2026-11-22T12:00:00.000Z';
const point = [-122.959218, 50.116028] as [number, number];
const pass = `\uFEFF<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark id="ID 11"><name>Snoqualmie Pass I-90</name>
  <description><![CDATA[<strong>Snoqualmie Pass I-90</strong><br/>11/22/2026 3:30 AM<br/>
    <strong>Eastbound</strong><br/>Traction tires advised<br/>
    <strong>Westbound</strong><br/>No restrictions<br/>Snow and ice.]]></description><Point><coordinates>-121.405833,47.41</coordinates></Point>
  </Placemark></Document></kml>`;
const event = { id: 'drivebc.ca/example-512', headline: 'Highway 99 closed', status: 'ACTIVE', updated: '2026-11-22T03:00:00-08:00',
    geography: { type: 'Point', coordinates: point }, roads: [{ name: 'Highway 99', direction: 'N', state: 'ALL_LANES_CLOSED' }],
    schedule: { intervals: ['2026-11-22T11:00/2026-11-22T18:00'] } };

describe('road agency adapters', () => {
    it('converts local times and rejects skipped or ambiguous times', () => {
        expect(drivingLocalTime('2026-11-22T07:15', 'America/Los_Angeles')).toBe('2026-11-22T15:15:00.000Z');
        expect(drivingLocalTime('2026-03-08T02:30', 'America/Los_Angeles')).toBeUndefined();
        expect(drivingLocalTime('2026-11-01T01:30', 'America/Los_Angeles')).toBeUndefined();
        expect(drivingLocalTime('2026-11-01T01:30:00-07:00', 'America/Los_Angeles')).toBe('2026-11-01T08:30:00.000Z');
        expect(drivingLocalTime('2026-02-30T08:00', 'America/Los_Angeles')).toBeUndefined();
        expect(drivingLocalTime('2026-11-01T01:30', 'America/Vancouver')).toBe('2026-11-01T08:30:00.000Z');
    });

    it('keeps WSDOT pass observations separate from text-only alerts', () => {
        expect(wsdotPasses(pass)).toEqual([expect.objectContaining({
            id: 'pass-snoqualmie-conditions', road: 'I-90', observedAt: '2026-11-22T11:30:00.000Z',
            description: expect.stringContaining('Eastbound\nTraction tires advised\nWestbound\nNo restrictions'),
        })]);
        const alert = pass.replace('ID 11', 'ID 51').replace('<name>Snoqualmie Pass I-90</name>', '<name>Eastbound I-90 lane closure</name>');
        expect(wsdotAlerts(alert)).toEqual([expect.objectContaining({ advisory: true, direction: 'east', road: 'I-90' })]);
        expect(wsdotPasses(pass.replace('3:30 AM', '13:30 AM'))[0].observedAt).toBeUndefined();
        expect(() => wsdotAlerts('<!DOCTYPE kml><kml/>')).toThrow(/document type/);
    });

    it('preserves DriveBC lane status and scheduled direction', () => {
        const [closure] = driveBcEvents({ events: [event] });
        expect(closure).toMatchObject({ kind: 'closure', direction: 'north', startsAt: '2026-11-22T11:00:00.000Z',
            endsAt: '2026-11-22T18:00:00.000Z' });
        expect(drivingBulletinState(closure, Date.parse(now), now, true)).toBe('active');
        const [uncertain] = driveBcEvents({ events: [{ ...event, schedule: { recurring_schedules: [] } }] });
        expect(uncertain).toMatchObject({ advisory: true });
        const [weekdayClosure] = driveBcEvents({ events: [{ ...event, description: 'Closed weekdays only.' }] });
        expect(weekdayClosure.advisory).toBe(true);
        expect(weekdayClosure.startsAt).toBeUndefined();
        expect(driveBcEvents({ events: [{ ...event, status: 'ARCHIVED' }] })).toEqual([]);
        expect(() => driveBcEvents({ events: [event], pagination: { next_url: '/events?offset=1' } })).toThrow(/incomplete/);
    });

    it('uses a supplied DriveBC zone and resolves the exact event link', () => {
        const [closure] = driveBcEvents({ events: [{ ...event, url: '/events/drivebc.ca/example-512', timezone: 'America/Vancouver',
            schedule: { intervals: ['2026-11-22T05:00/'] } }] });
        expect(closure).toMatchObject({
            startsAt: now, source: 'https://api.open511.gov.bc.ca/events/drivebc.ca/example-512',
        });
        expect(closure.endsAt).toBeUndefined();
        expect(closure.advisory).toBeUndefined();
        const [invalid] = driveBcEvents({ events: [{ ...event, timezone: 'Unknown/Zone', url: '//example.test/untrusted' }] });
        expect(invalid).toMatchObject({ advisory: true, source: 'https://www.drivebc.ca/' });
    });

    it('retains DriveBC lines that cross the pilot even when both points lie outside it', () => {
        const line = [[-123.5, 50], [-122.7, 50]];
        const [report] = driveBcEvents({ events: [{ ...event, geography: { type: 'LineString', coordinates: line } }] });
        expect(report).toMatchObject({ line, point: [-123.39, 50] });
        expect(drivingBulletinMatches(report, { road: 'BC 99', direction: 'north', line: [[-123, 50], [-122.992, 50]] })).toBe(true);
        expect(driveBcEvents({ events: [{ ...event, geography: { type: 'LineString', coordinates: [[-123.5, 49], [-122.7, 49]] } }] })).toEqual([]);
    });

    it('rejects malformed agency rows instead of publishing a successful empty report', () => {
        expect(() => driveBcEvents({ events: [{ ...event, geography: { type: 'Point', coordinates: [] } }] })).toThrow();
        expect(() => caltransChains({ data: [{ cc: {} }] })).toThrow();
        expect(() => caltransClosures({ data: [{ lcs: {} }] })).toThrow();
        expect(() => udotEvents([{ ID: 71 }])).toThrow();
        expect(driveBcEvents({ events: [], pagination: { next_url: null } })).toEqual([]);
    });

    it('keeps third-party, delayed and mismatched camera image URLs as links only', () => {
        const camera = { id: 519, name: 'Whistler Village Gate - N', highway: '99', orientation: 'N',
            location: { type: 'Point', coordinates: point }, links: { imageDisplay: '/images/519.jpg?t=123' },
            last_update_modified: '2026-11-22T03:55:00-08:00', marked_stale: false, marked_delayed: false,
            https_cam: true, is_on: true, should_appear: true };
        const entries = driveBcCameras([camera, { ...camera, credit: 'Third party' },
            { ...camera, marked_delayed: true }, { ...camera, links: { imageDisplay: '/images/520.jpg' } }]);
        expect(entries[0]).toMatchObject({
            view: 'north', source: 'https://www.drivebc.ca/cameras/519', image: 'https://www.drivebc.ca/images/519.jpg?t=123',
        });
        expect(entries.slice(1).every(entry => !entry.image)).toBe(true);
    });

    it('uses Caltrans status time and keeps R-0 as a point observation', () => {
        const [chain] = caltransChains({ data: [{ cc: { index: 'R89-N', inService: 'true',
            location: { route: 'SR-89', locationName: 'Truckee', direction: 'North', longitude: '-120.18', latitude: '39.32' },
            recordTimestamp: { recordDate: '2026-11-22', recordTime: '03:58:00' },
            statusData: { status: 'R-0', statusDescription: 'No chain controls', statusTimestamp: { statusDate: '2026-11-21', statusTime: '10:00:00' } },
        } }] });
        expect(chain).toMatchObject({ kind: 'condition', direction: 'north', observedAt: '2026-11-21T18:00:00.000Z' });
        expect(drivingBulletinState(chain, Date.parse(now), now, true)).toBe('stale');
    });

    it('reads UDOT route geometry and milepost labels and keeps recurring closures advisory', () => {
        const event = { ID: 71, RoadwayName: 'SR-210', DirectionOfTravel: 'Eastbound', Description: 'Uphill closure',
            Latitude: 40.58, Longitude: -111.67, StartDate: 1795341600, MPStart: 'MP 9.1', MPEnd: '9.4', IsFullClosure: true,
            EncodedPolyline: '_xtvFnpqhT?o}@g^o}@' };
        expect(udotEvents([event])[0]).toMatchObject({
            kind: 'closure', direction: 'east', mileposts: [9.1, 9.4], line: [[-111.67, 40.58], [-111.66, 40.58], [-111.65, 40.585]],
        });
        expect(udotEvents([{ ...event, Recurrence: 'Weekdays' }])[0].advisory).toBe(true);
        expect(udotEvents([{ ...event, IsFullClosure: false, NumberOfAffectedLanes: 1 }])[0].kind).toBe('restriction');
        expect(udotEvents([{ ...event, IsFullClosure: false }])[0].kind).toBe('condition');
        expect(() => udotEvents([{ ...event, EncodedPolyline: '_xtvFnpqhT?' }])).toThrow(/geometry/);
    });

    it('shows only the enabled UDOT camera view links in the canyon', () => {
        const view = { Id: 123, Url: 'https://www.udottraffic.utah.gov/map/Cctv/123', Status: 'Enabled', Description: 'Looking uphill' };
        expect(udotCameras([{ Id: 1, Roadway: 'SR-210', Direction: 'East', Location: 'Little Cottonwood Canyon',
            Latitude: 40.58, Longitude: -111.66, Views: [view, { ...view, Id: 124, Status: 'Disabled' }],
        }])).toEqual([expect.objectContaining({ id: '1-123', view: 'Looking uphill', source: view.Url })]);
    });

    it('requires a started mainline record for a Caltrans closure and ignores cancelled work', () => {
        const epoch = (offset: number) => String(Date.parse(now) / 1000 + offset);
        const work = {
            index: 'C49-1', location: { travelFlowDirection: 'East', begin: {
                beginRoute: 'I-80', beginMilepost: '192', beginLocationName: 'Donner Summit', beginLongitude: '-120.34', beginLatitude: '39.33',
            }, end: { endRoute: 'I-80', endMilepost: '194', endLocationName: 'Truckee' } },
            closure: { facility: 'Mainline', typeOfClosure: 'Full', durationOfClosure: 'Standard', typeOfWork: 'Maintenance', lanesClosed: 'All',
                closureTimestamp: { closureStartEpoch: epoch(-900), closureEndEpoch: epoch(900), isClosureEndIndefinite: 'false' },
                code1097: { isCode1097: 'true', code1097Timestamp: { code1097Epoch: epoch(-500) } },
                code1098: { isCode1098: 'false' }, code1022: { isCode1022: 'false' },
            },
        };
        const parse = (closure = work.closure) => caltransClosures({ data: [{ lcs: { ...work, closure } }] }, Date.parse(now));
        expect(parse()).toEqual([expect.objectContaining({ kind: 'closure', direction: 'east', mileposts: [192, 194], advisory: undefined })]);
        expect(parse({ ...work.closure, facility: 'Conventional Hwy' })[0]).toMatchObject({ kind: 'closure' });
        expect(parse({ ...work.closure, durationOfClosure: 'Intermittent' })[0].advisory).toBe(true);
        expect(parse({ ...work.closure, facility: 'Connector' })[0]).toMatchObject({ kind: 'restriction', advisory: true });
        expect(parse({ ...work.closure, code1098: { isCode1098: 'true' } })).toEqual([]);
        expect(parse({ ...work.closure, code1022: { isCode1022: 'true' } })).toEqual([]);
        const [scheduled] = parse({ ...work.closure, code1097: { isCode1097: 'false', code1097Timestamp: { code1097Epoch: '' } },
            closureTimestamp: { ...work.closure.closureTimestamp, closureStartEpoch: epoch(300) } });
        expect(drivingBulletinState(scheduled, Date.parse(now), now, true)).toBe('scheduled');
        expect(drivingBulletinState(scheduled, Date.parse(now) + 600_000, now, true)).toBe('advisory');
    });
});

describe('collector requests', () => {
    it('keeps the optional key out of other provider requests and rejects redirects', async () => {
        const fetcher = vi.fn<typeof fetch>(async url => new URL(String(url)).host === 'api.open511.gov.bc.ca'
            ? Response.json({ events: [] }) : Response.json([]));
        expect(createDrivingCollectors(fetcher).udot).toBeUndefined();
        const collectors = createDrivingCollectors(fetcher, ' fixture key ');
        await expect(collectors.udot?.reports?.()).resolves.toEqual([]);
        await expect(collectors.drivebc?.reports?.()).resolves.toEqual([]);
        const [[utah, utahInit], [bc, bcInit]] = fetcher.mock.calls;
        expect(new URL(String(utah)).searchParams.get('key')).toBe('fixture key');
        expect(new URL(String(bc)).searchParams.has('key')).toBe(false);
        expect(new URL(String(bc)).searchParams.get('status')).toBe('ACTIVE');
        for (const init of [utahInit, bcInit]) {
            expect(init).toMatchObject({ redirect: 'error', headers: { accept: 'application/json' } });
            expect(init?.signal).toBeInstanceOf(AbortSignal);
        }
    });

    it('passes transport and size errors to the publisher', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(null, { status: 429 }))
            .mockResolvedValueOnce(new Response('x'.repeat(5 * 1024 * 1024 + 1)));
        const collect = createDrivingCollectors(fetcher).drivebc?.reports;
        await expect(collect?.()).rejects.toThrow(/429/);
        await expect(collect?.()).rejects.toThrow(/size limit/);
    });
});

function memoryStore() {
    const files = new Map<string, Buffer>();
    const store: ConditionsStore = {
        read: async file => files.has(file) ? { body: files.get(file)! } : undefined,
        write: async (file, data) => { files.set(file, data); },
        commit: async data => { files.set('manifest.json', data); },
    };
    return { files, store };
}

describe('driving publication', () => {
    it('retains a prior snapshot on provider failure and recovers independently', async () => {
        const { files, store } = memoryStore();
        const bulletin: DrivingBulletin = { id: 'event', kind: 'closure', title: 'Highway closed', road: 'BC 99', point,
            source: 'https://www.drivebc.ca/', direction: 'north' };
        const camera = { id: '519', name: 'Whistler Village Gate', road: 'BC 99', point, source: 'https://www.drivebc.ca/cameras/519' };
        const cameras = vi.fn(async () => [camera]);
        const first = await publishDriving(store, { drivebc: { reports: async () => [bulletin, bulletin], cameras } }, () => new Date(now));
        const old = first.providers.drivebc!.reports.file!;
        expect(old).toBe(`reports-${drivingDigest(files.get(old)!)}.json`);
        expect(JSON.parse(files.get(old)!.toString()).entries).toHaveLength(1);
        const later = () => new Date(Date.parse(now) + 5 * 60_000);
        const outage = await publishDriving(store, {
            drivebc: { reports: async () => { throw Error('Upstream unavailable'); }, cameras }, wsdot: { reports: async () => [] },
        }, later);
        expect(outage.providers.drivebc?.reports).toEqual({ file: old, status: 'unavailable' });
        expect(outage.providers.wsdot?.reports.status).toBe('available');
        expect(outage.providers.tripcheck?.reports.status).toBe('unconfigured');
        expect(cameras).toHaveBeenCalledTimes(1);
        const recovery = await publishDriving(store, { drivebc: { reports: async () => [], cameras } },
            () => new Date(Date.parse(now) + 10 * 60_000));
        expect(recovery.providers.drivebc?.reports).toMatchObject({ status: 'available' });
        expect(recovery.providers.drivebc?.reports.file).not.toBe(old);
    });

    it('replaces an invalid cached camera snapshot and completes a same-time publication', async () => {
        const { files, store } = memoryStore();
        const saved = Buffer.from('{"malformed": true}');
        const file = `cameras-${drivingDigest(saved)}.json`;
        files.set(file, saved);
        files.set('manifest.json', Buffer.from(JSON.stringify({ version: 1, updatedAt: now, providers: { drivebc: {
            reports: { status: 'unconfigured' }, cameras: { status: 'available', file },
        } } })));
        const cameras = vi.fn(async () => []);
        const next = await publishDriving(store, { drivebc: { reports: async () => [], cameras } }, () => new Date(now));
        expect(cameras).toHaveBeenCalledOnce();
        expect(next.providers.drivebc?.reports.status).toBe('available');
        expect(next.providers.drivebc?.cameras).toEqual({ status: 'available', file: expect.not.stringMatching(file) });
        expect(Date.parse(next.updatedAt)).toBe(Date.parse(now) + 1);
    });

    it('waits for remaining writes after one snapshot fails and leaves the manifest in place', async () => {
        const { files, store } = memoryStore();
        const first = Buffer.from(JSON.stringify({ version: 1, updatedAt: now, providers: {} }));
        files.set('manifest.json', first);
        let finishCamera!: () => void;
        let startCamera!: () => void;
        const cameraWrite = new Promise<void>(resolve => { finishCamera = resolve; });
        const cameraStarted = new Promise<void>(resolve => { startCamera = resolve; });
        store.write = async file => {
            if (file.startsWith('reports-')) throw Error('write failed');
            startCamera();
            await cameraWrite;
        };
        const publication = publishDriving(store, { drivebc: { reports: async () => [], cameras: async () => [] } }, () => new Date(now));
        const completed = vi.fn();
        void publication.then(completed, completed);
        await cameraStarted;
        await new Promise(resolve => setTimeout(resolve, 0));
        finishCamera();
        expect(completed).not.toHaveBeenCalled();
        await expect(publication).rejects.toThrow('write failed');
        expect(files.get('manifest.json')).toBe(first);
    });

    it('retains the last valid report when the collector returns conflicting IDs', async () => {
        const { store } = memoryStore();
        const entry: DrivingBulletin = { id: 'duplicated', road: 'BC 99', point, title: 'Road closed', kind: 'closure',
            source: 'https://www.drivebc.ca/' };
        const first = await publishDriving(store, { drivebc: { reports: async () => [entry] } }, () => new Date(now));
        const next = await publishDriving(store, { drivebc: { reports: async () => [entry, { ...entry, kind: 'delay' }] } }, () => new Date(now));
        expect(next.providers.drivebc?.reports).toEqual({ status: 'unavailable', file: first.providers.drivebc?.reports.file });
    });
});
