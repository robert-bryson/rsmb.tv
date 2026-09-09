// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildUploadCommands, parseArgs, publishTripAssets } from '../publish-trip-assets.js';

const tempDirs: string[] = [];

function createTripDirectory() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-assets-'));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, 'photos', 'processed'), { recursive: true });
    fs.mkdirSync(path.join(root, 'photos', 'originals'), { recursive: true });
    fs.mkdirSync(path.join(root, 'gps', 'processed'), { recursive: true });
    fs.mkdirSync(path.join(root, 'gps', 'originals'), { recursive: true });
    return root;
}

afterEach(() => {
    for (const directory of tempDirs.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

describe('publish trip assets', () => {
    it('requires a canonical trip ID and explicit source directory', () => {
        expect(() => parseArgs(['Ozarks 2012', '--source', '/tmp/trip'])).toThrow(/Trip ID/);
        expect(() => parseArgs(['ozarks-2012'])).toThrow(/--source/);
        expect(() => parseArgs(['ozarks-2012', '--source', '--dry-run'])).toThrow(/requires a directory/);
        expect(() => parseArgs(['ozarks-2012', '--unknown'])).toThrow(/Unknown option/);
        expect(parseArgs(['ozarks-2012', '--source', '/tmp/trip', '--dry-run'])).toEqual({
            tripId: 'ozarks-2012',
            source: '/tmp/trip',
            dryRun: true,
        });
    });

    it('archives originals privately and uploads processed outputs to stable CDN prefixes', () => {
        const source = createTripDirectory();
        const commands = buildUploadCommands({
            tripId: 'ozarks-2012',
            source,
            sourceBucket: 'rsmb-sources',
            publicBucket: 'rsmb-assets',
            cdnId: 'DIST123',
        });

        expect(commands).toHaveLength(5);
        expect(commands[0].args).toContain('s3://rsmb-sources/trips/ozarks-2012/photos/originals/');
        expect(commands[1].args).toContain('s3://rsmb-sources/trips/ozarks-2012/gps/originals/');
        expect(commands[2].args).toContain('s3://rsmb-assets/trips/ozarks-2012/photos/');
        expect(commands[2].args).toContain('*.webp');
        expect(commands[3].args).toContain('s3://rsmb-assets/trips/ozarks-2012/geo/');
        expect(commands[3].args).toContain('*.geojson');
        expect(commands[4].args).toContain('/trips/ozarks-2012/*');
    });

    it('uses AWS argument arrays and skips invalidation for dry runs', () => {
        const source = createTripDirectory();
        const run = vi.fn().mockReturnValue({ status: 0 });

        publishTripAssets(
            { tripId: 'ozarks-2012', source, dryRun: true },
            {
                sourceBucket: 'rsmb-sources',
                publicBucket: 'rsmb-assets',
                cdnId: 'DIST123',
                run,
            },
        );

        expect(run).toHaveBeenCalledTimes(4);
        expect(run.mock.calls[0][0]).toBe('aws');
        expect(run.mock.calls[0][1]).toContain('--dryrun');
        expect(run.mock.calls.flatMap((call) => call[1])).not.toContain('create-invalidation');
    });

    it('reports the failed AWS operation with its full argument list', () => {
        const source = createTripDirectory();
        const run = vi.fn().mockReturnValue({ status: 2 });

        expect(() => publishTripAssets(
            { tripId: 'ozarks-2012', source, dryRun: true },
            { sourceBucket: 'rsmb-sources', publicBucket: 'rsmb-assets', run },
        )).toThrow(/aws s3 sync .*photos\/originals\/ --dryrun failed with status 2/);
    });
});