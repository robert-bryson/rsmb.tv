// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { parseArgs, photoId, prepareTripAssets } from '../prepare-trip-assets.js';

const tempDirs: string[] = [];

function createTripDirectory() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-trip-'));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, 'photos', 'selects'), { recursive: true });
    fs.mkdirSync(path.join(root, 'gps', 'originals'), { recursive: true });
    return root;
}

afterEach(() => {
    for (const directory of tempDirs.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

describe('prepare trip assets', () => {
    it('parses explicit source and force options', () => {
        expect(parseArgs(['ozarks-2012', '--source', '/tmp/trip', '--force'])).toEqual({
            tripId: 'ozarks-2012',
            source: '/tmp/trip',
            force: true,
        });
        expect(() => parseArgs(['Ozarks 2012', '--source', '/tmp/trip'])).toThrow(/Trip ID/);
        expect(() => parseArgs(['ozarks-2012', '--source', '--force'])).toThrow(/requires a directory/);
        expect(() => parseArgs(['ozarks-2012', '--unknown'])).toThrow(/Unknown option/);
        expect(() => parseArgs(['ozarks-2012', '--source', '/tmp/one', '--source', '/tmp/two'])).toThrow(
            /only be specified once/,
        );
    });

    it('creates stable URL-safe photo IDs', () => {
        expect(photoId('Camp at Dusk.JPG')).toBe('camp-at-dusk');
        expect(photoId('Café-stop.jpeg')).toBe('cafe-stop');
    });

    it('creates responsive WebP files and geometry-only GeoJSON', async () => {
        const root = createTripDirectory();
        await sharp({
            create: { width: 1200, height: 800, channels: 3, background: '#c84b31' },
        }).jpeg().toFile(path.join(root, 'photos', 'selects', 'Camp at Dusk.jpg'));
        fs.writeFileSync(path.join(root, 'gps', 'originals', 'track.gpx'), `<?xml version="1.0"?>
            <gpx version="1.1" creator="device">
                <trk><name>Private ride name</name><trkseg>
                    <trkpt lat="35.1" lon="-92.1"><time>2026-01-01T12:00:00Z</time></trkpt>
                    <trkpt lat="35.2" lon="-92.2"><time>2026-01-01T12:05:00Z</time></trkpt>
                </trkseg></trk>
            </gpx>`);

        const report = await prepareTripAssets({ tripId: 'ozarks-2012', source: root });

        expect(report.photos[0].derivatives.map((item) => item.width)).toEqual([480, 960, 1200]);
        expect(fs.existsSync(path.join(root, 'photos', 'processed', 'camp-at-dusk-480.webp'))).toBe(true);
        const route = JSON.parse(fs.readFileSync(path.join(root, 'gps', 'processed', 'route.geojson'), 'utf8'));
        expect(route.features[0].properties).toEqual({});
        expect(JSON.stringify(route)).not.toContain('2026-01-01');
        expect(JSON.parse(fs.readFileSync(path.join(root, 'asset-metadata.json'), 'utf8')).tripId).toBe('ozarks-2012');
    });

    it('rejects photo filename collisions', async () => {
        const root = createTripDirectory();
        const image = sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).png();
        await image.clone().toFile(path.join(root, 'photos', 'selects', 'Camp.jpg'));
        await image.clone().toFile(path.join(root, 'photos', 'selects', 'camp.png'));

        await expect(prepareTripAssets({ tripId: 'test-trip', source: root })).rejects.toThrow(/resolve to the ID/);
    });
});