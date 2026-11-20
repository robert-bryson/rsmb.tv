// @vitest-environment node
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { digest, publishConditions } from '../../projects/ski-status/scripts/conditions-publication';
import { fetchOpenDataHubReport, pilotAreas } from '../../projects/ski-status/scripts/conditions-sources';
import { manifestName, withConditionsStore } from '../../projects/ski-status/scripts/conditions-store';
import { loadConditionsFeed } from '../../src/features/ski-status/conditions-feed';
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
    let files: Map<string, string>;
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

        // An older CDN copy or a conflicting pointer with the same timestamp must not win.
        for (const updatedAt of [retrievedAt, nextTime]) {
            files.set(manifestName, JSON.stringify(manifest({ updatedAt, reports: firstFile.file })));
            expect(await loadConditionsFeed(initial, signal)).toBe(initial);
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

    it('keeps verified operations and their observations when a later poll cannot confirm the ski day', async () => {
        const initial = options();
        const temperature = { valueC: -11, location: 'Upper mountain', measuredAt: retrievedAt };
        initial.fetchReport.mockImplementation(async ({ areaId }) => ({ ...report, areaId, temperature }));
        const first = await publish(initial);
        expect(first.coverage.reportFields.temperature).toBe(2);

        const next = options();
        const nextTime = '2026-12-25T14:00:00Z';
        next.now = () => Date.parse(nextTime);
        next.refreshForecasts = false;
        next.fetchReport.mockImplementation(async ({ areaId }) => ({
            ...report, areaId, retrievedAt: nextTime, reportedAt: undefined, status: 'unknown',
        }));
        const second = await publish(next);
        const history = join(directory, 'history', '2026-12-25');
        const name = (await readdir(history)).sort().at(-1)!;
        const archived = await readFile(join(history, name));
        expect(name).toBe(`2026-12-25T14-00-00.000Z-${digest(archived)}.json`);
        const entry = JSON.parse(archived.toString());
        const snapshot = JSON.parse(await readFile(join(directory, entry.reports), 'utf8'));
        expect(second.coverage.recentReports).toBe(2);
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

    it('rebuilds a corrupt stored snapshot even outside its normal refresh schedule', async () => {
        const first = await publish();
        const file = first.manifest.forecasts!;
        await writeFile(join(directory, file), 'corrupt');
        const secondOptions = options();
        secondOptions.refreshForecasts = false;
        secondOptions.fetchReport.mockImplementation(offline);
        const recovered = await publish(secondOptions);
        expect(secondOptions.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid checksum'));
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
        const aws = vi.fn(async (args: string[]) => {
            const value = (flag: string) => args[args.indexOf(flag) + 1];
            const key = value('--key');
            switch (args[1]) {
                case 'list-objects-v2': {
                    const prefix = value('--prefix');
                    expect(prefix).toMatch(/^ski-status\//);
                    return JSON.stringify({ Contents: objects.has(prefix) ? [{ Key: prefix }] : [] });
                }
                case 'get-object': {
                    const body = objects.get(key);
                    if (!body) throw Error('NoSuchKey');
                    await writeFile(args.at(-1)!, body);
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
        objects.delete(`ski-status/${first.manifest.forecasts}`);
        const recovered = await run();
        expect(recovered.manifest.forecasts).not.toBe(first.manifest.forecasts);
        expect(objects.has(`ski-status/${recovered.manifest.forecasts}`)).toBe(true);
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
});
