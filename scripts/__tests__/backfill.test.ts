// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    VALID_PROJECTS,
    VALID_STORAGE,
    backfillBlogs,
    backfillFlights,
    backfillTemperatures,
    backfillTornadoes,
    buildAwsSyncArgs,
    parseArgs,
    printHelp,
    resolveS3BucketSummary,
    resolveTemperatureBucket,
    resolveTornadoBucket,
    run,
    validateArgs,
} from '../backfill.js';

const spawnSyncMock = vi.hoisted(() =>
    vi.fn(() => ({ status: 0, error: null, pid: 1, output: [], signal: null, stderr: null, stdout: null })),
);

vi.mock('child_process', () => ({
    spawnSync: spawnSyncMock,
}));

type SpawnArgs = Parameters<typeof import('child_process').spawnSync>;

function capturedCommands() {
    return spawnSyncMock.mock.calls.map(([cmd, args]: SpawnArgs) => [cmd, ...(args as string[])].join(' '));
}

function spawnArgLists() {
    return spawnSyncMock.mock.calls.map(([, args]: SpawnArgs) => args as string[]);
}

describe('parseArgs', () => {
    it('returns defaults when no arguments are provided', () => {
        const args = parseArgs([]);
        expect(args.projects).toEqual(VALID_PROJECTS);
        expect(args.storage).toEqual(['local']);
        expect(args.bucket).toBeNull();
        expect(args.region).toBeNull();
        expect(args.cdnId).toBeNull();
        expect(args.help).toBe(false);
    });

    it('parses --projects as a list', () => {
        expect(parseArgs(['--projects', 'tornadoes,flights']).projects).toEqual(['tornadoes', 'flights']);
    });

    it('deduplicates repeated project names', () => {
        expect(parseArgs(['--projects', 'flights,flights,tornadoes']).projects).toEqual(['flights', 'tornadoes']);
    });

    it('trims whitespace from project and storage values', () => {
        expect(parseArgs(['--projects', ' temperatures , tornadoes ']).projects).toEqual(['temperatures', 'tornadoes']);
        expect(parseArgs(['--storage', ' local , s3 ']).storage).toEqual(['local', 's3']);
    });

    it('deduplicates repeated storage values', () => {
        expect(parseArgs(['--storage', 's3,s3,local']).storage).toEqual(['s3', 'local']);
    });

    it('parses --bucket, --region, and --cdn-id as strings', () => {
        const args = parseArgs(['--bucket', 'my-bucket', '--region', 'us-west-2', '--cdn-id', 'E1ABC']);
        expect(args.bucket).toBe('my-bucket');
        expect(args.region).toBe('us-west-2');
        expect(args.cdnId).toBe('E1ABC');
    });

    it('sets help=true and returns early when --help is present', () => {
        const args = parseArgs(['--help', '--projects', 'flights']);
        expect(args.help).toBe(true);
        expect(args.projects).toBeNull();
    });

    it('throws when a flag is missing its value', () => {
        expect(() => parseArgs(['--projects'])).toThrow('--projects requires a value');
        expect(() => parseArgs(['--storage'])).toThrow('--storage requires a value');
        expect(() => parseArgs(['--bucket'])).toThrow('--bucket requires a value');
        expect(() => parseArgs(['--region'])).toThrow('--region requires a value');
        expect(() => parseArgs(['--cdn-id'])).toThrow('--cdn-id requires a value');
    });

    it('throws when a flag value is itself a flag', () => {
        expect(() => parseArgs(['--projects', '--storage'])).toThrow('--projects requires a value');
    });

    it('throws on unknown flags', () => {
        expect(() => parseArgs(['--unknown'])).toThrow('Unknown argument: --unknown');
    });

    it('includes a hint to run --help in unknown-flag errors', () => {
        expect(() => parseArgs(['--oops'])).toThrow('--help');
    });
});

describe('validateArgs', () => {
    it('accepts all valid projects', () => {
        expect(() => validateArgs({ projects: [...VALID_PROJECTS], storage: ['local'] })).not.toThrow();
    });

    it('accepts all valid storage targets', () => {
        expect(() => validateArgs({ projects: ['flights'], storage: [...VALID_STORAGE] })).not.toThrow();
    });

    it('throws on an unknown project name', () => {
        expect(() => validateArgs({ projects: ['flights', 'weather'], storage: ['local'] }))
            .toThrow('Unknown project "weather"');
    });

    it('includes the list of valid projects in the error message', () => {
        expect(() => validateArgs({ projects: ['nope'], storage: ['local'] }))
            .toThrow(VALID_PROJECTS.join(', '));
    });

    it('throws on an unknown storage target', () => {
        expect(() => validateArgs({ projects: ['flights'], storage: ['disk'] }))
            .toThrow('Unknown storage target "disk"');
    });

    it('includes the list of valid storage targets in the error message', () => {
        expect(() => validateArgs({ projects: ['flights'], storage: ['bad'] }))
            .toThrow(VALID_STORAGE.join(', '));
    });
});

describe('buildAwsSyncArgs', () => {
    it('builds a minimal sync command without optional flags', () => {
        expect(buildAwsSyncArgs('src/', 's3://bucket/', {
            contentType: 'application/json',
            cacheControl: 'public, max-age=3600',
        })).toEqual([
            's3', 'sync', 'src/', 's3://bucket/',
            '--content-type', 'application/json',
            '--cache-control', 'public, max-age=3600',
        ]);
    });

    it('appends --delete when delete option is true', () => {
        const args = buildAwsSyncArgs('src/', 's3://bucket/', {
            contentType: 'application/json',
            cacheControl: 'public, max-age=3600',
            delete: true,
        });
        expect(args).toContain('--delete');
    });

    it('places --exclude before --include to satisfy AWS CLI filter ordering', () => {
        const args = buildAwsSyncArgs('src/', 's3://bucket/', {
            contentType: 'application/geo+json',
            cacheControl: 'public, max-age=3600',
            exclude: '*',
            include: '*.geojson',
        });
        const excludeIdx = args.indexOf('--exclude');
        const includeIdx = args.indexOf('--include');
        expect(excludeIdx).toBeGreaterThan(-1);
        expect(includeIdx).toBeGreaterThan(-1);
        expect(excludeIdx).toBeLessThan(includeIdx);
        expect(args[excludeIdx + 1]).toBe('*');
        expect(args[includeIdx + 1]).toBe('*.geojson');
    });

    it('omits --exclude and --include when not provided', () => {
        const args = buildAwsSyncArgs('src/', 's3://bucket/', {
            contentType: 'application/json',
            cacheControl: 'public, max-age=3600',
        });
        expect(args).not.toContain('--exclude');
        expect(args).not.toContain('--include');
    });

    it('appends --region as the last argument when provided', () => {
        const args = buildAwsSyncArgs('src/', 's3://bucket/', {
            contentType: 'application/json',
            cacheControl: 'no-cache',
            region: 'eu-west-1',
        });
        expect(args.slice(-2)).toEqual(['--region', 'eu-west-1']);
    });

    it('matches the JSON-summary tornadoes workflow step exactly', () => {
        expect(buildAwsSyncArgs(
            'public/data/tornadoes/',
            's3://rsmbtv-temperature-data/tornadoes/',
            { contentType: 'application/json', cacheControl: 'public, max-age=3600', delete: true, exclude: '*.geojson', region: 'us-east-1' },
        )).toEqual([
            's3', 'sync',
            'public/data/tornadoes/',
            's3://rsmbtv-temperature-data/tornadoes/',
            '--content-type', 'application/json',
            '--cache-control', 'public, max-age=3600',
            '--delete',
            '--exclude', '*.geojson',
            '--region', 'us-east-1',
        ]);
    });

    it('matches the GeoJSON tornadoes workflow step exactly', () => {
        expect(buildAwsSyncArgs(
            'public/data/tornadoes/',
            's3://rsmbtv-temperature-data/tornadoes/',
            { contentType: 'application/geo+json', cacheControl: 'public, max-age=3600', exclude: '*', include: '*.geojson', region: 'us-east-1' },
        )).toEqual([
            's3', 'sync',
            'public/data/tornadoes/',
            's3://rsmbtv-temperature-data/tornadoes/',
            '--content-type', 'application/geo+json',
            '--cache-control', 'public, max-age=3600',
            '--exclude', '*',
            '--include', '*.geojson',
            '--region', 'us-east-1',
        ]);
    });
});

describe('S3 destination resolution', () => {
    afterEach(() => {
        delete process.env.TEMPERATURE_DATA_BUCKET;
        delete process.env.TORNADO_DATA_BUCKET;
    });

    it('uses the shared default bucket when no overrides are set', () => {
        expect(resolveTemperatureBucket(null)).toBe('rsmbtv-temperature-data');
        expect(resolveTornadoBucket(null)).toBe('rsmbtv-temperature-data');
    });

    it('prefers TORNADO_DATA_BUCKET for tornado uploads', () => {
        process.env.TEMPERATURE_DATA_BUCKET = 'temperature-bucket';
        process.env.TORNADO_DATA_BUCKET = 'tornado-bucket';
        expect(resolveTornadoBucket('arg-bucket')).toBe('tornado-bucket');
    });

    it('falls back to TEMPERATURE_DATA_BUCKET for tornado uploads', () => {
        process.env.TEMPERATURE_DATA_BUCKET = 'shared-env-bucket';
        expect(resolveTornadoBucket('arg-bucket')).toBe('shared-env-bucket');
    });

    it('summarizes different temperature and tornado buckets explicitly', () => {
        process.env.TEMPERATURE_DATA_BUCKET = 'temperature-bucket';
        process.env.TORNADO_DATA_BUCKET = 'tornado-bucket';
        expect(resolveS3BucketSummary(['temperatures', 'tornadoes'], 'arg-bucket'))
            .toBe('temperatures=temperature-bucket, tornadoes=tornado-bucket');
    });

    it('returns null when selected projects do not upload to S3', () => {
        expect(resolveS3BucketSummary(['flights'], 'arg-bucket')).toBeNull();
    });
});

describe('backfillFlights', () => {
    beforeEach(() => {
        spawnSyncMock.mockClear();
        delete process.env.GOOGLE_SHEET_ID;
    });

    afterEach(() => {
        delete process.env.GOOGLE_SHEET_ID;
    });

    it('skips Google Sheets sync when GOOGLE_SHEET_ID is not set', () => {
        backfillFlights();
        expect(capturedCommands().some(c => c.includes('sync-flights.js'))).toBe(false);
    });

    it('runs Google Sheets sync when GOOGLE_SHEET_ID is set', () => {
        process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
        backfillFlights();
        expect(capturedCommands().some(c => c.includes('sync-flights.js'))).toBe(true);
    });

    it('always runs all three GeoJSON build scripts', () => {
        backfillFlights();
        const cmds = capturedCommands();
        expect(cmds.some(c => c.includes('convertFlights.js'))).toBe(true);
        expect(cmds.some(c => c.includes('generateAllAirports.js'))).toBe(true);
        expect(cmds.some(c => c.includes('generateUSStates.js'))).toBe(true);
    });
});

describe('backfillBlogs', () => {
    beforeEach(() => {
        spawnSyncMock.mockClear();
        delete process.env.GOOGLE_BLOG_SHEET_ID;
    });

    afterEach(() => {
        delete process.env.GOOGLE_BLOG_SHEET_ID;
    });

    it('skips Google blog sync when GOOGLE_BLOG_SHEET_ID is not set', () => {
        backfillBlogs();
        expect(capturedCommands().some(c => c.includes('sync-blogs.js'))).toBe(false);
    });

    it('runs Google blog sync when GOOGLE_BLOG_SHEET_ID is set', () => {
        process.env.GOOGLE_BLOG_SHEET_ID = 'test-blog-sheet-id';
        backfillBlogs();
        expect(capturedCommands().some(c => c.includes('sync-blogs.js'))).toBe(true);
    });

    it('always rebuilds generated blog metadata artifacts', () => {
        backfillBlogs();
        const cmds = capturedCommands();
        expect(cmds.some(c => c.includes('generate-og-images.js'))).toBe(true);
        expect(cmds.some(c => c.includes('generate-rss.js'))).toBe(true);
        expect(cmds.some(c => c.includes('generate-sitemap.js'))).toBe(true);
    });
});

describe('backfillTornadoes', () => {
    beforeEach(() => {
        spawnSyncMock.mockClear();
    });

    it('runs syncTornadoes.js', () => {
        backfillTornadoes({ storage: ['local'], bucket: null, region: null, cdnId: null });
        expect(capturedCommands().some(c => c.includes('syncTornadoes.js'))).toBe(true);
    });

    it('does not invoke aws when storage is local only', () => {
        backfillTornadoes({ storage: ['local'], bucket: null, region: null, cdnId: null });
        expect(capturedCommands().some(c => c.startsWith('aws'))).toBe(false);
    });

    it('invokes aws s3 sync exactly twice when storage includes s3', () => {
        backfillTornadoes({ storage: ['local', 's3'], bucket: 'my-bucket', region: 'us-east-1', cdnId: null });
        expect(capturedCommands().filter(c => c.startsWith('aws s3 sync'))).toHaveLength(2);
    });

    it('uses the correct S3 destination prefix for tornado data', () => {
        backfillTornadoes({ storage: ['s3'], bucket: 'my-bucket', region: 'us-east-1', cdnId: null });
        const syncCalls = capturedCommands().filter(c => c.includes('s3 sync'));
        expect(syncCalls.every(c => c.includes('s3://my-bucket/tornadoes/'))).toBe(true);
    });

    it('first S3 sync uses --delete and --exclude *.geojson with no --include', () => {
        backfillTornadoes({ storage: ['s3'], bucket: 'b', region: 'us-east-1', cdnId: null });
        const firstSync = spawnArgLists().filter(a => a[0] === 's3' && a[1] === 'sync')[0];
        expect(firstSync).toContain('--delete');
        expect(firstSync).toContain('--exclude');
        expect(firstSync).toContain('*.geojson');
        expect(firstSync).not.toContain('--include');
    });

    it('second S3 sync uses --exclude * before --include *.geojson', () => {
        backfillTornadoes({ storage: ['s3'], bucket: 'b', region: 'us-east-1', cdnId: null });
        const secondSync = spawnArgLists().filter(a => a[0] === 's3' && a[1] === 'sync')[1];
        const excludeIdx = secondSync.indexOf('--exclude');
        const includeIdx = secondSync.indexOf('--include');
        expect(excludeIdx).toBeLessThan(includeIdx);
        expect(secondSync[excludeIdx + 1]).toBe('*');
        expect(secondSync[includeIdx + 1]).toBe('*.geojson');
    });

    it('invalidates CloudFront when cdnId is provided', () => {
        backfillTornadoes({ storage: ['s3'], bucket: 'b', region: 'us-east-1', cdnId: 'E1XYZ' });
        expect(capturedCommands().some(c => c.includes('create-invalidation') && c.includes('E1XYZ'))).toBe(true);
    });

    it('does not invoke CloudFront when cdnId is null', () => {
        backfillTornadoes({ storage: ['s3'], bucket: 'b', region: 'us-east-1', cdnId: null });
        expect(capturedCommands().some(c => c.includes('create-invalidation'))).toBe(false);
    });

    it('prefers TORNADO_DATA_BUCKET env var over the bucket argument', () => {
        process.env.TORNADO_DATA_BUCKET = 'env-tornado-bucket';
        try {
            backfillTornadoes({ storage: ['s3'], bucket: 'arg-bucket', region: 'us-east-1', cdnId: null });
            const syncCalls = capturedCommands().filter(c => c.includes('s3 sync'));
            expect(syncCalls.every(c => c.includes('env-tornado-bucket'))).toBe(true);
            expect(syncCalls.some(c => c.includes('arg-bucket'))).toBe(false);
        } finally {
            delete process.env.TORNADO_DATA_BUCKET;
        }
    });
});

describe('backfillTemperatures', () => {
    beforeEach(() => {
        spawnSyncMock.mockClear();
    });

    it('runs sync-temperatures.js', () => {
        backfillTemperatures({ storage: ['local'], bucket: null, region: null, cdnId: null });
        expect(capturedCommands().some(c => c.includes('sync-temperatures.js'))).toBe(true);
    });

    it('does not invoke aws when storage is local only', () => {
        backfillTemperatures({ storage: ['local'], bucket: null, region: null, cdnId: null });
        expect(capturedCommands().some(c => c.startsWith('aws'))).toBe(false);
    });

    it('invokes aws s3 sync exactly twice when storage includes s3', () => {
        backfillTemperatures({ storage: ['s3'], bucket: 'b', region: 'us-east-1', cdnId: null });
        expect(capturedCommands().filter(c => c.startsWith('aws s3 sync'))).toHaveLength(2);
    });

    it('first S3 sync sources public/data/temperatures/ with --exclude * --include *.json', () => {
        backfillTemperatures({ storage: ['s3'], bucket: 'b', region: 'us-east-1', cdnId: null });
        const firstSync = spawnArgLists().filter(a => a[0] === 's3' && a[1] === 'sync')[0];
        expect(firstSync[2]).toBe('public/data/temperatures/');
        expect(firstSync).toContain('--exclude');
        expect(firstSync).toContain('--include');
    });

    it('invalidates all temperature CloudFront paths when cdnId is provided', () => {
        backfillTemperatures({ storage: ['s3'], bucket: 'b', region: 'us-east-1', cdnId: 'E2ABC' });
        const invalidationArgs = spawnArgLists().find(a => a.includes('create-invalidation'));
        expect(invalidationArgs).toBeDefined();
        expect(invalidationArgs).toContain('E2ABC');
        for (const path of ['/stateRecords.json', '/countyRecords.json', '/climateTrends.json', '/summary.json', '/recentRecords.json', '/stations.json']) {
            expect(invalidationArgs).toContain(path);
        }
    });

    it('does not invoke CloudFront when cdnId is null', () => {
        backfillTemperatures({ storage: ['s3'], bucket: 'b', region: 'us-east-1', cdnId: null });
        expect(capturedCommands().some(c => c.includes('create-invalidation'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// printHelp
// ---------------------------------------------------------------------------

describe('printHelp', () => {
    it('logs usage text without throwing', () => {
        expect(() => printHelp()).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// run — error paths
// ---------------------------------------------------------------------------

describe('run', () => {
    beforeEach(() => { spawnSyncMock.mockClear(); });

    it('throws when the command exits with a non-zero status', () => {
        spawnSyncMock.mockReturnValueOnce({ status: 1, error: null, pid: 1, output: [], signal: null, stderr: null, stdout: null });
        expect(() => run('node', ['--bad-flag'])).toThrow('exited with status 1');
    });

    it('error message includes the command and arguments', () => {
        spawnSyncMock.mockReturnValueOnce({ status: 2, error: null, pid: 1, output: [], signal: null, stderr: null, stdout: null });
        expect(() => run('node', ['script.js', '--flag'])).toThrow('node script.js --flag');
    });

    it('rethrows the spawn error when the process cannot start', () => {
        const spawnError = new Error('ENOENT: no such file or directory');
        spawnSyncMock.mockReturnValueOnce({ status: null, error: spawnError, pid: 0, output: [], signal: null, stderr: null, stdout: null });
        expect(() => run('nonexistent-binary')).toThrow('ENOENT');
    });

    it('does not throw when the command exits with status 0', () => {
        spawnSyncMock.mockReturnValueOnce({ status: 0, error: null, pid: 1, output: [], signal: null, stderr: null, stdout: null });
        expect(() => run('node', ['--version'])).not.toThrow();
    });
});
