// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cache = await vi.hoisted(async () => {
    const fs = await import('node:fs/promises');
    const os = await import('node:os');
    const directory = await fs.mkdtemp(`${os.tmpdir()}/temperature-repair-test-`);
    vi.stubEnv('TEMP_DATA_DIR', directory);
    vi.stubEnv('TEMPERATURE_DATA_BUCKET', '');
    return directory;
});
import { repairTemperatureArchives } from '../repair-temperature-archives.js';
beforeEach(() => { vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network request')); });
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await fs.rm(cache, { recursive: true, force: true }); vi.unstubAllEnvs(); });

async function fixture() {
    const directory = await fs.mkdtemp(path.join(cache, 'fixture-'));
    const sourceDirectory = path.join(directory, 'source');
    const outputDirectory = path.join(directory, 'daily');
    const archive = { date: '2026-11-03', observations: [{ uid: 1, maxt: 83, mint: 3, rh: 80, rl: 5, mh: 100, ml: -28 }] };
    await fs.mkdir(path.join(sourceDirectory, '2026/11'), { recursive: true });
    const input = path.join(sourceDirectory, '2026/11/2026-11-03.json');
    await fs.writeFile(input, JSON.stringify(archive));
    return { sourceDirectory, outputDirectory, input, archive };
}

describe('temperature archive migration', () => {
    it.each(['equal', 'alias', 'nested', 'ancestor'] as const)('rejects unsafe %s output paths inside the exported function', async relationship => {
        const options = await fixture();
        await fs.writeFile(options.input, JSON.stringify({ ...options.archive, monthlyThresholdVersion: 2 }));
        let outputDirectory = options.sourceDirectory;
        if (relationship === 'alias') {
            outputDirectory = path.join(path.dirname(options.sourceDirectory), 'source-alias');
            await fs.symlink(options.sourceDirectory, outputDirectory, 'dir');
        } else if (relationship === 'nested') outputDirectory = path.join(options.sourceDirectory, 'staged/daily');
        else if (relationship === 'ancestor') outputDirectory = path.dirname(options.sourceDirectory);
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        await expect(repairTemperatureArchives({ ...options, outputDirectory, stationIndex: new Map() })).rejects.toThrow('disjoint');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(JSON.parse(await fs.readFile(options.input, 'utf8'))).toMatchObject({ monthlyThresholdVersion: 2 });
    });

    it('rejects a destination that would overwrite the source station catalog, including a symlink alias', async () => {
        const options = await fixture();
        const sourceStationsFile = path.join(path.dirname(options.outputDirectory), 'stations.json');
        const original = JSON.stringify({ stations: [{ uid: 1, state: 'NY' }] });
        await fs.writeFile(sourceStationsFile, original);
        const alias = path.join(options.sourceDirectory, 'catalog.json');
        await fs.symlink(sourceStationsFile, alias);
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        await expect(repairTemperatureArchives({ ...options, sourceStationsFile: alias, stationIndex: new Map() })).rejects.toThrow('source station catalog');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(await fs.readFile(sourceStationsFile, 'utf8')).toBe(original);
    });

    it('rejects existing output subdirectories that redirect an archive into the source', async () => {
        const options = await fixture();
        await fs.mkdir(options.outputDirectory);
        await fs.symlink(path.join(options.sourceDirectory, '2026'), path.join(options.outputDirectory, '2026'), 'dir');
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        await expect(repairTemperatureArchives({ ...options, stationIndex: new Map() })).rejects.toThrow('destination');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(JSON.parse(await fs.readFile(options.input, 'utf8'))).toEqual(options.archive);
    });

    it('protects the source directory when an output alias would place station metadata inside it', async () => {
        const options = await fixture();
        await fs.mkdir(options.outputDirectory);
        const outputAlias = path.join(options.sourceDirectory, 'staging-alias');
        await fs.symlink(options.outputDirectory, outputAlias, 'dir');
        await expect(repairTemperatureArchives({ ...options, outputDirectory: outputAlias, stationIndex: new Map() })).rejects.toThrow('Station destination');
        expect(fetch).not.toHaveBeenCalled();
        await expect(fs.stat(path.join(options.sourceDirectory, 'stations.json'))).rejects.toThrow();
    });

    it.each([
        ['invalid calendar date', '2026-02-30.json', { date: '2026-02-30', observations: [{ uid: 1, maxt: 83 }] }],
        ['invalid filename', '2026-2-03.json', { date: '2026-02-03', observations: [{ uid: 1, maxt: 83 }] }],
        ['mismatched date', '2026-11-04.json', { date: '2026-11-03', observations: [{ uid: 1, maxt: 83 }] }],
        ['missing observations', '2026-11-04.json', { date: '2026-11-04' }],
        ['empty observations', '2026-11-04.json', { date: '2026-11-04', observations: [] }],
        ['null observation', '2026-11-04.json', { date: '2026-11-04', observations: [null] }],
        ['invalid station UID', '2026-11-04.json', { date: '2026-11-04', observations: [{ uid: '', maxt: 83 }] }],
        ['missing observed temperatures', '2026-11-04.json', { date: '2026-11-04', observations: [{ uid: 1 }] }],
        ['malformed observed temperature', '2026-11-04.json', { date: '2026-11-04', observations: [{ uid: 1, maxt: '83' }] }],
    ])('rejects %s before metadata recovery or staged writes', async (_label, filename, archive) => {
        const options = await fixture();
        await fs.writeFile(path.join(options.sourceDirectory, filename), JSON.stringify(archive));
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        await expect(repairTemperatureArchives({ ...options, stationIndex: new Map() })).rejects.toThrow('Invalid archive');
        expect(fetchMock).not.toHaveBeenCalled();
        await expect(fs.stat(options.outputDirectory)).rejects.toThrow();
        await expect(fs.stat(path.join(options.outputDirectory, '../stations.json'))).rejects.toThrow();
    });

    it('rejects an empty inventory before requests or staged writes', async () => {
        const options = await fixture();
        await fs.rm(options.input);
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        await expect(repairTemperatureArchives({ ...options, stationIndex: new Map() })).rejects.toThrow('No daily archives');
        expect(fetchMock).not.toHaveBeenCalled();
        await expect(fs.stat(options.outputDirectory)).rejects.toThrow();
    });

    it('rejects malformed archive JSON before requests or staged writes', async () => {
        const options = await fixture();
        await fs.writeFile(options.input, '{');
        await expect(repairTemperatureArchives({ ...options, stationIndex: new Map() })).rejects.toThrow('Invalid archive 2026-11-03');
        expect(fetch).not.toHaveBeenCalled();
        await expect(fs.stat(options.outputDirectory)).rejects.toThrow();
    });

    it('rejects duplicate archive dates before requests or staged writes', async () => {
        const options = await fixture();
        await fs.writeFile(path.join(options.sourceDirectory, '2026-11-03.json'), JSON.stringify(options.archive));
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        await expect(repairTemperatureArchives({ ...options, stationIndex: new Map() })).rejects.toThrow('Duplicate archive date');
        expect(fetchMock).not.toHaveBeenCalled();
        await expect(fs.stat(options.outputDirectory)).rejects.toThrow();
    });

    it('recovers missing metadata and stages corrected thresholds without altering observations or source archives', async () => {
        const options = await fixture();
        const stationIndex = new Map();
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, request) => {
            const params = JSON.parse(String(request?.body));
            if (String(url).endsWith('/StnMeta')) {
                expect(JSON.parse(String(request?.body))).toMatchObject({ sdate: '2026-11-03', edate: '2026-11-03' });
                return new Response(JSON.stringify({ meta: [{ uid: 1, state: 'NY', name: 'Test', ll: [-73, 42] }] }));
            }
            if (params.elems[0] === 'maxt') return new Response(JSON.stringify({ data: [{ meta: { uid: 1 }, data: Array.from({ length: Number(params.edate.slice(8)) }, () => ['M', 'M']) }] }));
            if (params.elems[0].interval === 'mly') {
                const rows = Array.from({ length: 912 }, () => [['M', 'M'], ['M', 'M']]);
                rows[10] = [['82', '1950-11-02'], ['4', '2018-11-23']];
                return new Response(JSON.stringify({ data: [{ meta: { uid: 1 }, data: rows }] }));
            }
            return new Response(JSON.stringify({ data: [{ meta: { uid: 1 }, smry: [['82', '1950-11-02'], ['4', '2018-11-23']] }] }));
        });
        expect(await repairTemperatureArchives({ ...options, stationIndex })).toEqual({ repaired: 1, current: 0, monthlyThresholdVersion: 2 });
        const repaired = JSON.parse(await fs.readFile(path.join(options.outputDirectory, '2026/11/2026-11-03.json'), 'utf8'));
        expect(repaired).toMatchObject({ monthlyThresholdVersion: 2, observations: [{ uid: 1, maxt: 83, mint: 3, rh: 80, rl: 5, mh: 82, ml: 4 }] });
        expect(JSON.parse(await fs.readFile(options.input, 'utf8'))).toEqual(options.archive);
        const stations = JSON.parse(await fs.readFile(path.join(options.outputDirectory, '../stations.json'), 'utf8'));
        expect(stations.stations).toEqual([expect.objectContaining({ uid: 1, state: 'NY' })]);
        vi.mocked(fetch).mockClear();
        // An interrupted migration can replay already validated local responses.
        await repairTemperatureArchives({ ...options, stationIndex });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('fails before staging an archive if station metadata cannot be recovered', async () => {
        const options = await fixture();
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ meta: [{ uid: 2, state: 'NY' }] })));
        await expect(repairTemperatureArchives({ ...options, stationIndex: new Map() })).rejects.toThrow('Cannot recover metadata for archived station 1');
        await expect(fs.stat(options.outputDirectory)).rejects.toThrow();
    });

    it('collects files once and repairs in date order regardless of directory order', async () => {
        const options = await fixture();
        await fs.rm(path.join(options.sourceDirectory, '2026'), { recursive: true });
        for (const [directory, date] of [['a', '2026-11-05'], ['z', '2026-11-03']]) {
            await fs.mkdir(path.join(options.sourceDirectory, directory));
            await fs.writeFile(path.join(options.sourceDirectory, directory, `${date}.json`), JSON.stringify({ ...options.archive, date }));
        }
        const readdir = vi.spyOn(fs, 'readdir');
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, request) => {
            const params = JSON.parse(String(request?.body));
            const rows = params.elems[0] === 'maxt'
                ? Array.from({ length: Number(params.edate.slice(8)) }, () => ['M', 'M'])
                : Array.from({ length: 912 }, () => [['M', 'M'], ['M', 'M']]);
            if (params.elems[0] !== 'maxt') rows[10] = [['82', '1950-11-02'], ['4', '1950-11-23']];
            return new Response(JSON.stringify({ data: [{ meta: { uid: 1 }, data: rows }] }));
        });
        expect(await repairTemperatureArchives({ ...options, stationIndex: new Map([[1, { uid: 1, state: 'SD' }]]) })).toMatchObject({ repaired: 2 });
        expect(log.mock.calls.map(([message]) => message).filter(message => String(message).startsWith('Repaired '))).toEqual([
            'Repaired 2026-11-03: 1 observations', 'Repaired 2026-11-05: 1 observations',
        ]);
        expect(readdir).toHaveBeenCalledTimes(3);
    });
});

describe('archive repair command', () => {
    const script = fileURLToPath(new URL('../repair-temperature-archives.js', import.meta.url));
    const networkGuard = `data:text/javascript,${encodeURIComponent("globalThis.fetch = async () => { throw new Error('Unexpected network request'); };")}`;
    function run(args: string[]) {
        return spawnSync(process.execPath, ['--import', networkGuard, script, ...args], {
            encoding: 'utf8', timeout: 10_000,
            env: { ...process.env, TEMP_DATA_DIR: '', TEMPERATURE_DATA_BUCKET: '' },
        });
    }

    it('does not change process environment when imported', () => {
        const result = spawnSync(process.execPath, ['--import', networkGuard, '--input-type=module', '-e', `
            delete process.env.TEMP_DATA_DIR;
            await import(process.argv[1]);
            if ('TEMP_DATA_DIR' in process.env) throw new Error('Import changed TEMP_DATA_DIR');
        `, new URL('../repair-temperature-archives.js', import.meta.url).href], { encoding: 'utf8', timeout: 10_000 });
        expect(result.status, result.stderr).toBe(0);
    });

    it.each([
        [[], 'Set TEMPERATURE_DATA_BUCKET or supply --source and --stations.'],
        [['--source', '/unused/source'], '--stations is required with --source.'],
        [['--unknown'], 'Unknown option'],
    ])('rejects incomplete or invalid arguments %j', (args, message) => {
        const result = run(args);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain(message);
    });

    it('rejects a malformed station catalog with a useful error', async () => {
        const options = await fixture();
        const stationsFile = path.join(path.dirname(options.sourceDirectory), 'source-stations.json');
        await fs.writeFile(stationsFile, JSON.stringify({ stations: {} }));
        const result = run(['--source', options.sourceDirectory, '--stations', stationsFile, '--out', options.outputDirectory]);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Invalid station catalog');
        await expect(fs.stat(options.outputDirectory)).rejects.toThrow();
    });

    it('passes the source catalog path to the output safety check', async () => {
        const options = await fixture();
        const stationsFile = path.join(path.dirname(options.outputDirectory), 'stations.json');
        const original = JSON.stringify({ stations: [{ uid: 1, state: 'NY' }] });
        await fs.writeFile(stationsFile, original);
        const result = run(['--source', options.sourceDirectory, '--stations', stationsFile, '--out', options.outputDirectory]);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('source station catalog');
        expect(await fs.readFile(stationsFile, 'utf8')).toBe(original);
        await expect(fs.stat(options.outputDirectory)).rejects.toThrow();
    });

    it('accepts explicit disjoint local paths without downloading current archives again', async () => {
        const options = await fixture();
        await fs.writeFile(options.input, JSON.stringify({ ...options.archive, monthlyThresholdVersion: 2 }));
        const stationsFile = path.join(options.sourceDirectory, 'station-catalog.txt');
        await fs.writeFile(stationsFile, JSON.stringify({ stations: [{ uid: 1, state: 'NY' }] }));
        const result = run(['--source', options.sourceDirectory, '--stations', stationsFile, '--out', options.outputDirectory]);
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toContain('current: 1');
        await expect(fs.stat(options.outputDirectory)).rejects.toThrow();
    });
});
