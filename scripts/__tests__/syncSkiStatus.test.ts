// @vitest-environment node
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { digest, publishConditions } from '../../projects/ski-status/scripts/conditions-publication';
import { fetchOpenDataHubReport, pilotAreas } from '../../projects/ski-status/scripts/conditions-sources';
import { manifestName, withConditionsStore } from '../../projects/ski-status/scripts/conditions-store';
import { loadConditionsFeed } from '../../src/features/ski-status/conditions-feed';
import { maxConditionsManifestBytes, maxConditionsSnapshotBytes } from '../../src/features/ski-status/conditions-response';
import { type BaseForecast, type ConditionsManifest, type ResortReport } from '../../src/features/ski-status/conditions';

const retrievedAt = '2026-12-25T12:00:00Z';
const revision = 'a'.repeat(64);
const areaId = 'alta';
const source = { name: 'Operator', url: 'https://example.test/report', license: 'https://example.test/license', exportable: true };
const report: ResortReport = { areaId, source, status: 'limited', retrievedAt, reportedAt: retrievedAt, lifts: { open: 2, total: 4 } };
const forecast: BaseForecast = {
    areaId, source, retrievedAt, startsAt: retrievedAt, endsAt: '2026-12-26T12:00:00Z', location: 'Main base', snowfallCm: 6,
};

function fixtureFile(kind: string, data: object) {
    const body = JSON.stringify(data);
    return { file: `${kind}-${digest(Buffer.from(body))}.json`, body };
}

function reportFile(generatedAt: string, row = report) {
    return fixtureFile('reports', { version: 1, generatedAt, reports: [row] });
}

function manifest(fields: Omit<ConditionsManifest, 'version' | 'catalogRevision'>): ConditionsManifest {
    return { version: 1, catalogRevision: revision, ...fields };
}

describe('ski-status client feed', () => {
    let files: Map<string, BodyInit>;
    const signal = new AbortController().signal;
    const read = vi.fn((url: URL) => {
        const body = files.get(url.pathname.split('/').at(-1) ?? '');
        return Promise.resolve(body === undefined ? new Response(null, { status: 503 }) : new Response(body));
    });

    beforeEach(() => {
        files = new Map();
        vi.stubGlobal('fetch', read);
        read.mockClear();
    });
    afterEach(() => vi.unstubAllGlobals());

    it('verifies each file independently and retries only the failed file on an unchanged manifest', async () => {
        const reports = reportFile(retrievedAt);
        const forecasts = fixtureFile('forecasts', { version: 1, generatedAt: retrievedAt, forecasts: [forecast] });
        files.set(reports.file, reports.body.replace('"limited"', '"open"'));
        files.set(forecasts.file, forecasts.body);
        files.set(manifestName, JSON.stringify(manifest({ updatedAt: retrievedAt, reports: reports.file, forecasts: forecasts.file })));

        const first = await loadConditionsFeed({}, signal);
        expect(first.reports).toBeUndefined();
        expect(first.forecasts?.data.forecasts).toEqual([forecast]);

        files.set(reports.file, reports.body);
        read.mockClear();
        const recovered = await loadConditionsFeed(first, signal);
        expect(recovered.reports?.data.reports).toEqual([report]);
        expect(recovered.forecasts).toBe(first.forecasts);
        expect(read.mock.calls.map(([url]) => url.pathname)).toEqual([`/ski-status/${manifestName}`, `/ski-status/${reports.file}`]);
        read.mockClear();
        expect(await loadConditionsFeed(recovered, signal)).toBe(recovered);
        expect(read).toHaveBeenCalledTimes(1);
    });

    it('keeps verified data during partial failure and accepts an explicit rollback without a reload', async () => {
        const firstFile = reportFile(retrievedAt);
        const nextTime = '2026-12-25T13:00:00Z';
        const nextFile = reportFile(nextTime, { ...report, status: 'open' });
        files.set(firstFile.file, firstFile.body);
        files.set(nextFile.file, nextFile.body);
        files.set(manifestName, JSON.stringify(manifest({ updatedAt: nextTime, reports: nextFile.file })));
        const initial = await loadConditionsFeed({}, signal);
        expect(initial.reports?.data.reports[0].status).toBe('open');

        for (const [updatedAt, error] of [
            [retrievedAt, 'older than the last verified publication'],
            [nextTime, 'changed its snapshots without a new publication time'],
        ]) {
            files.set(manifestName, JSON.stringify(manifest({ updatedAt, reports: firstFile.file })));
            read.mockClear();
            await expect(loadConditionsFeed(initial, signal)).rejects.toThrow(error);
            expect(read).toHaveBeenCalledTimes(1);
        }
        const futureFile = reportFile('2026-12-25T18:00:00Z');
        const updatedAt = '2026-12-25T14:00:00Z';
        files.set(futureFile.file, futureFile.body);
        files.set(manifestName, JSON.stringify(manifest({ updatedAt, reports: futureFile.file })));
        const partial = await loadConditionsFeed(initial, signal);
        expect(partial.reports).toBe(initial.reports);

        files.set(manifestName, JSON.stringify(manifest({ updatedAt: '2026-12-25T15:00:00Z', reports: firstFile.file })));
        const rolledBack = await loadConditionsFeed(partial, signal);
        expect(rolledBack.reports?.data.reports).toEqual([report]);
    });

    it.each([{}, { reports: '../forecast.json' }, { reports: `reports-${'f'.repeat(64)}.json`, catalogRevision: 'local' }])(
        'rejects invalid manifest fields before requesting a snapshot (%j)', async fields => {
            files.set(manifestName, JSON.stringify({ ...manifest({ updatedAt: retrievedAt }), ...fields }));
            await expect(loadConditionsFeed({}, signal)).rejects.toThrow();
            expect(read).toHaveBeenCalledTimes(1);
        },
    );

    it('rejects an oversized manifest before reading its snapshot', async () => {
        const reports = reportFile(retrievedAt);
        const body = JSON.stringify(manifest({ updatedAt: retrievedAt, reports: reports.file }));
        files.set(manifestName, ' '.repeat(64 * 1024) + body);
        files.set(reports.file, reports.body);
        await expect(loadConditionsFeed({}, signal)).rejects.toThrow('exceeds the size limit');
        expect(read).toHaveBeenCalledTimes(1);
    });

    it('reports an empty manifest response before reading a snapshot', async () => {
        read.mockResolvedValueOnce(new Response(null));
        await expect(loadConditionsFeed({}, signal)).rejects.toThrow('Ski conditions response is empty');
        expect(read).toHaveBeenCalledTimes(1);
    });

    it('cancels an oversized snapshot stream and keeps the previous verified report', async () => {
        const previousFile = reportFile(retrievedAt);
        files.set(previousFile.file, previousFile.body);
        files.set(manifestName, JSON.stringify(manifest({ updatedAt: retrievedAt, reports: previousFile.file })));
        const previous = await loadConditionsFeed({}, signal);

        const file = `reports-${'f'.repeat(64)}.json`;
        const updatedAt = '2026-12-25T13:00:00Z';
        files.set(manifestName, JSON.stringify(manifest({ updatedAt, reports: file })));
        const cancel = vi.fn();
        const chunk = new Uint8Array(1024 * 1024);
        files.set(file, new ReadableStream({
            start(controller) {
                for (let index = 0; index < 10; index++) controller.enqueue(chunk);
                controller.close();
            },
            cancel,
        }));
        expect((await loadConditionsFeed(previous, signal)).reports).toBe(previous.reports);
        expect(cancel).toHaveBeenCalledOnce();
    });
});

describe('ski-status publication', () => {
    let directory: string;
    const offline = async () => { throw Error('Provider unavailable'); };

    const options = () => ({
        areas: [{ areaId }, { areaId: 'snowbird' }],
        catalogRevision: revision,
        refreshForecasts: true,
        fetchReport: vi.fn(async ({ areaId }: { areaId: string }) => ({ ...report, areaId })),
        fetchForecast: vi.fn(async ({ areaId }: { areaId: string }) => ({ ...forecast, areaId })),
        warn: vi.fn(),
        now: () => Date.parse(retrievedAt),
    });

    beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'ski-conditions-test-')); });
    afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

    function publish(parameters = options()) {
        return withConditionsStore(directory, undefined, store => publishConditions(store, parameters));
    }

    it('retains failed resort rows and unchanged streams and archives the exact previous manifest', async () => {
        const initial = options();
        const terrain: NonNullable<ResortReport['terrain']> = {
            source, retrievedAt, items: [{ id: 'lift-1', name: 'First chair', kind: 'lift', status: 'open', updatedAt: retrievedAt }],
        };
        initial.fetchReport.mockImplementation(async ({ areaId }) => ({ ...report, areaId, terrain }));
        const first = await publish(initial);
        const previous = await readFile(join(directory, manifestName));
        const secondOptions = options();
        secondOptions.refreshForecasts = false;
        secondOptions.fetchReport.mockImplementation(async ({ areaId }) => {
            if (areaId === 'snowbird') return offline();
            return { ...report, areaId, status: 'open' };
        });
        const second = await publish(secondOptions);

        expect(first.received).toEqual({ reports: 2, forecasts: 2 });
        expect(second.received).toEqual({ reports: 1, forecasts: 0 });
        expect(secondOptions.fetchForecast).not.toHaveBeenCalled();
        expect(secondOptions.warn).toHaveBeenCalledWith(expect.stringContaining('snowbird'));
        expect(second.manifest.forecasts).toBe(first.manifest.forecasts);
        expect(second.manifest.reports).not.toBe(first.manifest.reports);
        expect(Date.parse(second.manifest.updatedAt)).toBe(Date.parse(first.manifest.updatedAt) + 1);
        const reportsFile = await readFile(join(directory, second.manifest.reports!), 'utf8');
        expect(JSON.parse(reportsFile).reports).toMatchObject([{ areaId, status: 'open', terrain }, { areaId: 'snowbird', status: 'limited', terrain }]);
        expect(second.manifest.previousManifest).toBe(`manifest-${digest(previous)}.json`);
        expect(await readFile(join(directory, second.manifest.previousManifest!))).toEqual(previous);
        const history = join(directory, 'history', '2026-12-25');
        const entries = (await readdir(history)).sort();
        expect(entries).toHaveLength(2);
        expect(JSON.parse(await readFile(join(history, entries[1]), 'utf8'))).toMatchObject({
            catalogRevision: revision, reports: second.manifest.reports, forecasts: first.manifest.forecasts, received: second.received,
        });
    });

    it.each([
        { nextTime: '2026-12-25T14:00:00Z', recentReports: 2 },
        { nextTime: '2026-12-26T08:15:00Z', recentReports: 0 },
    ])('keeps verified operations when the $nextTime poll omits the ski day', async ({ nextTime, recentReports }) => {
        const initial = options();
        const temperature = { valueC: -11, location: 'Upper mountain', measuredAt: retrievedAt };
        initial.fetchReport.mockImplementation(async ({ areaId }) => ({ ...report, areaId, temperature }));
        const first = await publish(initial);
        expect(first.coverage.reportFields.temperature).toBe(2);

        const next = options();
        next.now = () => Date.parse(nextTime);
        next.refreshForecasts = false;
        next.fetchReport.mockImplementation(async ({ areaId }) => ({
            ...report, areaId, retrievedAt: nextTime, reportedAt: undefined, status: 'unknown',
        }));
        const second = await publish(next);
        const history = join(directory, 'history', nextTime.slice(0, 10));
        const name = (await readdir(history)).sort().at(-1)!;
        const archived = await readFile(join(history, name));
        expect(name).toBe(`${new Date(nextTime).toISOString().replaceAll(':', '-')}-${digest(archived)}.json`);
        const entry = JSON.parse(archived.toString());
        const snapshot = JSON.parse(await readFile(join(directory, entry.reports), 'utf8'));
        expect(second.coverage.recentReports).toBe(recentReports);
        expect(snapshot.reports).toEqual([areaId, 'snowbird'].map(areaId => ({ ...report, areaId, temperature })));
    });

    it('leaves the active manifest unchanged when an archive write fails', async () => {
        await publish();
        const previous = await readFile(join(directory, manifestName));
        const failingArchive = withConditionsStore(directory, undefined, store => publishConditions({
            ...store,
            write(file, body) {
                if (file.startsWith('history/')) throw Error('Archive unavailable');
                return store.write(file, body);
            },
        }, options()));
        await expect(failingArchive).rejects.toThrow('Archive unavailable');
        expect(await readFile(join(directory, manifestName))).toEqual(previous);
        expect(await readdir(join(directory, 'history', '2026-12-25'))).toHaveLength(1);
        expect((await publish()).manifest.previousManifest).toBe(`manifest-${digest(previous)}.json`);
    });

    it('removes a retired area from retained forecasts and reports when the scope changes', async () => {
        const first = await publish();
        const next = options();
        next.areas = [{ areaId }];
        next.refreshForecasts = false;
        const second = await publish(next);
        expect(second.manifest.forecasts).not.toBe(first.manifest.forecasts);
        expect(next.fetchForecast).not.toHaveBeenCalled();
        expect(second.coverage).toMatchObject({ areas: 1, reports: 1, forecasts: 1 });
        expect(JSON.parse(await readFile(join(directory, second.manifest.forecasts!), 'utf8')).forecasts).toEqual([forecast]);
        const refresh = options();
        refresh.areas = [{ areaId: 'snowbird' }];
        refresh.fetchReport.mockImplementation(offline);
        const third = await publish(refresh);
        expect(JSON.parse(await readFile(join(directory, third.manifest.reports!), 'utf8')).reports).toEqual([]);
        expect(third.coverage).toMatchObject({ areas: 1, reports: 0, forecasts: 1 });
    });

    it('counts dated unknown reports as available records with unknown operating status', async () => {
        const inputs = options();
        inputs.fetchReport.mockImplementation(async ({ areaId }) => ({ ...report, areaId, status: 'unknown' }));
        expect((await publish(inputs)).coverage).toMatchObject({ reports: 2, recentReports: 0, reportFields: { status: 0 } });
    });

    it('keeps past ski-day reports in the snapshot and excludes them from current coverage', async () => {
        const input = options();
        input.now = () => Date.parse('2026-12-26T07:00:00Z');
        expect((await publish(input)).coverage).toMatchObject({ reports: 2, recentReports: 0, reportFields: { status: 2 } });
    });

    it('excludes forecasts retrieved after the collection clock from coverage', async () => {
        await publish();
        const next = options();
        next.now = () => Date.parse(retrievedAt) - 1;
        next.refreshForecasts = false;
        expect((await publish(next)).coverage.forecasts).toBe(0);
    });

    it('refreshes expired forecasts on a report-only run', async () => {
        const first = await publish();
        const inputs = options();
        const start = Date.parse(forecast.endsAt) + 1;
        inputs.now = () => start;
        inputs.refreshForecasts = false;
        inputs.fetchForecast.mockImplementation(async ({ areaId }) => ({ ...forecast, areaId,
            startsAt: new Date(start).toISOString(), retrievedAt: new Date(start).toISOString(),
            endsAt: new Date(start + 86_400_000).toISOString(),
        }));
        const refreshed = await publish(inputs);
        expect(refreshed.manifest.forecasts).not.toBe(first.manifest.forecasts);
        expect(refreshed.coverage.forecasts).toBe(2);
        expect(inputs.fetchForecast).toHaveBeenCalledTimes(2);
    });

    it.each(['missing', 'expired'])('retries a %s forecast while another area still has a current forecast', async state => {
        const nextTime = '2026-12-25T14:00:00Z';
        const initial = options();
        initial.fetchForecast.mockImplementation(async ({ areaId }) => {
            if (areaId === 'alta') return forecast;
            if (state === 'missing') return offline();
            return { ...forecast, areaId, endsAt: nextTime };
        });
        await publish(initial);

        const inputs = options();
        inputs.now = () => Date.parse(nextTime);
        inputs.refreshForecasts = false;
        inputs.fetchReport.mockImplementation(offline);
        const newForecast = { ...forecast, areaId: 'snowbird', startsAt: nextTime, retrievedAt: nextTime };
        inputs.fetchForecast.mockResolvedValue(newForecast);
        const updated = await publish(inputs);

        expect(inputs.fetchForecast).toHaveBeenCalledExactlyOnceWith({ areaId: 'snowbird' },
            state === 'expired' ? { ...forecast, areaId: 'snowbird', endsAt: nextTime } : undefined);
        expect(updated.received).toEqual({ reports: 0, forecasts: 1 });
        expect(updated.coverage.forecasts).toBe(2);
        const published = JSON.parse(await readFile(join(directory, updated.manifest.forecasts!), 'utf8'));
        expect(published.forecasts).toEqual([forecast, newForecast]);
    });

    it('preserves the active manifest and history when every source fails', async () => {
        await publish();
        const previous = await readFile(join(directory, manifestName));
        const failed = options();
        failed.fetchReport.mockImplementation(offline);
        failed.fetchForecast.mockImplementation(offline);
        await expect(publish(failed)).rejects.toThrow('No valid ski conditions updates');
        expect(await readFile(join(directory, manifestName))).toEqual(previous);
        expect(await readdir(join(directory, 'history', '2026-12-25'))).toHaveLength(1);
    });

    it('preserves the published files when a new snapshot exceeds the client limit', async () => {
        await publish();
        const oldFiles = (await readdir(directory)).sort();
        const previous = await readFile(join(directory, manifestName));
        const next = options();
        const largeSource = { ...source, name: 'A'.repeat(8 * 1024 * 1024) };
        next.fetchReport.mockImplementation(async ({ areaId }) => ({ ...report, areaId, source: largeSource }));
        await expect(publish(next)).rejects.toThrow('publication exceeds the size limit');
        expect(await readFile(join(directory, manifestName))).toEqual(previous);
        expect((await readdir(directory)).sort()).toEqual(oldFiles);
        expect(await readdir(join(directory, 'history', '2026-12-25'))).toHaveLength(1);
    });

    it('reads at most the requested bytes plus one byte from a local file', async () => {
        await writeFile(join(directory, manifestName), '123456789');
        await withConditionsStore(directory, undefined, async store => {
            expect((await store.read(manifestName, 9))?.body.toString()).toBe('123456789');
            expect((await store.read(manifestName, 4))?.body.toString()).toBe('12345');
        });
    });

    it('stops before fetching reports when the active manifest exceeds the size limit', async () => {
        const { manifest } = await publish();
        const oversized = `${' '.repeat(maxConditionsManifestBytes)}${JSON.stringify(manifest)}`;
        await writeFile(join(directory, manifestName), oversized);
        const next = options();

        await expect(publish(next)).rejects.toThrow('Ski conditions manifest exceeds the size limit');
        expect(next.fetchReport).not.toHaveBeenCalled();
        expect(next.fetchForecast).not.toHaveBeenCalled();
        expect(await readFile(join(directory, manifestName), 'utf8')).toBe(oversized);
    });

    it.each(['bad checksum', 'too large'])('refreshes a forecast snapshot with %s outside its normal schedule', async fault => {
        const first = await publish();
        const file = first.manifest.forecasts!;
        await writeFile(join(directory, file), fault === 'bad checksum' ? 'corrupt' : Buffer.alloc(maxConditionsSnapshotBytes + 2));
        const secondOptions = options();
        secondOptions.refreshForecasts = false;
        secondOptions.fetchReport.mockImplementation(offline);
        const recovered = await publish(secondOptions);
        expect(secondOptions.warn).toHaveBeenCalledWith(expect.stringContaining(
            fault === 'bad checksum' ? 'Invalid checksum' : 'Snapshot exceeds the size limit',
        ));
        expect(recovered.manifest.reports).toBe(first.manifest.reports);
        expect(recovered.manifest.forecasts).not.toBe(file);
        expect(recovered.received).toEqual({ reports: 0, forecasts: 2 });
    });

    it('excludes simultaneous local writers and releases the lock after failure', async () => {
        await expect(withConditionsStore(directory, undefined, async () => {
            await expect(publish()).rejects.toThrow('publication is already running');
            throw Error('Interrupted');
        })).rejects.toThrow('Interrupted');
        expect((await publish()).manifest.previousManifest).toBeUndefined();
    });

    it('publishes the manifest with a conditional S3 put and leaves the local mirror unchanged on conflict', async () => {
        const objects = new Map<string, Buffer>();
        let conflict = false;
        let failedRead = '';
        const aws = vi.fn(async (args: string[]) => {
            const value = (flag: string) => args[args.indexOf(flag) + 1];
            const key = value('--key');
            switch (args[1]) {
                case 'list-objects-v2': {
                    const prefix = value('--prefix');
                    expect(prefix).toMatch(/^ski-status\//);
                    const body = objects.get(prefix);
                    return JSON.stringify({ Contents: body ? [{ Key: prefix, Size: body.length }] : [] });
                }
                case 'get-object': {
                    const limit = key === `ski-status/${manifestName}` ? maxConditionsManifestBytes : maxConditionsSnapshotBytes;
                    expect(value('--range')).toBe(`bytes=0-${limit}`);
                    if (key === failedRead) throw Error('Read failed');
                    const body = objects.get(key);
                    if (!body) throw Error('NoSuchKey');
                    if (body.length === 0) throw Error('InvalidRange');
                    await writeFile(args.at(-1)!, body.subarray(0, limit + 1));
                    return JSON.stringify({ ETag: '"current-etag"' });
                }
                case 'put-object':
                    expect(value('--bucket')).toBe('test-bucket');
                    if (key === 'ski-status/manifest.json') {
                        if (objects.has(key)) {
                            expect(value('--if-match')).toBe('"current-etag"');
                            expect(args).not.toContain('--if-none-match');
                        } else {
                            expect(value('--if-none-match')).toBe('*');
                        }
                        if (conflict) throw Error('PreconditionFailed');
                        expect(value('--cache-control')).toBe('public, max-age=60');
                    }
                    objects.set(key, await readFile(value('--body')));
                    return '{}';
                default:
                    throw Error(`Unexpected command ${args[1]}`);
            }
        });
        const run = () => withConditionsStore(directory, 'test-bucket', store => publishConditions(store, options()), aws);
        const first = await run();
        const previous = await readFile(join(directory, manifestName));
        expect(objects.get(`ski-status/${first.manifest.reports}`)).toBeDefined();
        expect(objects.get(`ski-status/${first.manifest.forecasts}`)).toBeDefined();
        expect(objects.get('ski-status/manifest.json')).toEqual(previous);
        conflict = true;
        await expect(run()).rejects.toThrow('PreconditionFailed');
        expect(await readFile(join(directory, manifestName))).toEqual(previous);
        expect(objects.get('ski-status/manifest.json')).toEqual(previous);
        expect([...objects.keys()].filter(key => key.startsWith('ski-status/history/'))).toHaveLength(2);

        conflict = false;
        let previousForecasts = first.manifest.forecasts!;
        for (const body of [undefined, Buffer.alloc(0)]) {
            const key = `ski-status/${previousForecasts}`;
            if (body) objects.set(key, body);
            else objects.delete(key);
            const recovered = await run();
            expect(recovered.manifest.forecasts).not.toBe(previousForecasts);
            previousForecasts = recovered.manifest.forecasts!;
            expect(objects.has(`ski-status/${previousForecasts}`)).toBe(true);
        }

        const active = objects.get(`ski-status/${manifestName}`);
        failedRead = `ski-status/${previousForecasts}`;
        await expect(run()).rejects.toThrow('Read failed');
        expect(objects.get(`ski-status/${manifestName}`)).toEqual(active);
        expect(await readFile(join(directory, manifestName))).toEqual(active);
    });
});

describe('Open Data Hub source failures', () => {
    const area = pilotAreas[0];
    const changedAt = '2020-12-24T09:00:00Z';
    const summary = { Items: [{
        RID: area.sourceId, LastUpdate: changedAt,
        openskilift: '2', totalskilift: '3', openskislopes: '3', totalskislopes: '4',
    }] };
    const terrain = { TotalResults: 1, TotalPages: 1, Items: [{
        Id: 'urn:odhactivitypoi:dss:lift:3_296', Source: 'dss', Shortname: 'Col Alto', 'Mapping.dss.regionId': area.dssRegionId,
        LastChange: changedAt, IsOpen: true, LicenseInfo: { License: 'CC0', ClosedData: false }, TagIds: ['lifts'],
    }] };

    function respond(snowReport: unknown, terrainReport: unknown) {
        vi.stubGlobal('fetch', vi.fn(async (url: URL) => {
            const data = url.pathname.endsWith('/SnowReport') ? snowReport : terrainReport;
            return data === null ? new Response(null, { status: 503 }) : Response.json(data);
        }));
    }

    afterEach(() => vi.unstubAllGlobals());

    it('collects named terrain during a summary outage and preserves previous aggregate provenance', async () => {
        respond(null, terrain);
        const warn = vi.fn();
        const initial = await fetchOpenDataHubReport(area, undefined, warn);
        expect(initial).toMatchObject({ areaId: area.areaId, status: 'unknown', terrain: { items: [{ name: 'Col Alto', updatedAt: changedAt }] } });
        expect(initial.lifts).toBeUndefined();
        const previous = { ...report, areaId: area.areaId };
        const preserved = await fetchOpenDataHubReport(area, previous, warn);
        expect(preserved).toMatchObject(previous);
        expect(preserved.terrain?.items[0].name).toBe('Col Alto');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Resort report for alta-badia'));
    });

    it('collects operations during a terrain outage and reports a failure when both requests fail', async () => {
        respond(summary, null);
        const warn = vi.fn();
        expect(await fetchOpenDataHubReport(area, undefined, warn)).toMatchObject({ areaId: area.areaId, status: 'limited', lifts: { open: 2, total: 3 } });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Terrain source for alta-badia'));
        respond(null, null);
        await expect(fetchOpenDataHubReport(area)).rejects.toThrow('Open Data Hub reports failed');
    });

    it('requests only the named inventory when a region has no matching summary feed', async () => {
        const civetta = pilotAreas.find(candidate => candidate.areaId === 'civetta')!;
        const item = {
            ...terrain.Items[0], Id: 'urn:odhactivitypoi:dss:lift:12_1', Shortname: 'Alleghe/Piani di Pezzè',
            'Mapping.dss.regionId': civetta.dssRegionId,
        };
        const fetch = vi.fn(async () => Response.json({ ...terrain, TotalResults: 2, Items: [
            item, { ...item, Id: 'urn:odhactivitypoi:dss:lift:12_2', Shortname: 'Alleghe–Malga Ciapela', TagIds: ['lifts', 'skibus'] },
        ] }));
        vi.stubGlobal('fetch', fetch);
        const result = await fetchOpenDataHubReport(civetta);
        expect(result).toMatchObject({ areaId: civetta.areaId, status: 'unknown', terrain: {
            items: [{ name: 'Alleghe/Piani di Pezzè', status: 'open', updatedAt: changedAt }],
        } });
        expect(result.terrain?.items).toHaveLength(1);
        expect(result.lifts).toBeUndefined();
        expect(fetch).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ pathname: '/v1/ODHActivityPoi' }), expect.objectContaining({
            headers: expect.objectContaining({ referer: 'https://rsmb.tv/projects/ski-status/map' }), redirect: 'error',
        }));
    });

    it('rejects an oversized provider response and keeps the independent terrain records', async () => {
        respond({ ...summary, padding: ' '.repeat(4 * 1024 * 1024) }, terrain);
        const warn = vi.fn();
        const result = await fetchOpenDataHubReport(area, undefined, warn);
        expect(result).toMatchObject({ status: 'unknown', terrain: { items: [{ name: 'Col Alto' }] } });
        expect(result.lifts).toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('exceeds the size limit'));
    });
});
