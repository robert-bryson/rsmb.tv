// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { parseArgs, photoId, prepareTripAssets, WEBP_QUALITY } from '../prepare-trip-assets.js';

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
        expect(WEBP_QUALITY).toBe(95);
    });

    it('creates responsive WebP files and sanitized aggregate and individual GeoJSON', async () => {
        const root = createTripDirectory();
        await sharp({
            create: { width: 1200, height: 800, channels: 3, background: '#c84b31' },
        }).jpeg().toFile(path.join(root, 'photos', 'selects', 'Camp at Dusk.jpg'));
        fs.writeFileSync(path.join(root, 'gps', 'originals', '2026-01-01 outbound.gpx'), `<?xml version="1.0"?>
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
        expect(route.features[0].properties).toEqual({
            trackId: '2026-01-01-outbound',
            trackOrder: 0,
            distanceKilometers: expect.closeTo(14.3636, 3),
            date: '2026-01-01',
        });
        expect(JSON.stringify(route)).not.toContain('Private ride name');

        const trackPath = path.join(root, 'gps', 'processed', 'track-2026-01-01-outbound.geojson');
        expect(JSON.parse(fs.readFileSync(trackPath, 'utf8')).features).toEqual(route.features);
        const metadata = JSON.parse(fs.readFileSync(path.join(root, 'asset-metadata.json'), 'utf8'));
        expect(metadata.route.tracks).toEqual([{
            id: '2026-01-01-outbound',
            filename: 'track-2026-01-01-outbound.geojson',
            source: '2026-01-01 outbound.gpx',
            featureCount: 1,
            distanceKilometers: 14.4,
            distanceMiles: 9,
            date: '2026-01-01',
        }]);
        expect(metadata.route).toMatchObject({ distanceKilometers: 14.4, distanceMiles: 9 });
    });

    it('rejects photo filename collisions', async () => {
        const root = createTripDirectory();
        const image = sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).png();
        await image.clone().toFile(path.join(root, 'photos', 'selects', 'Camp.jpg'));
        await image.clone().toFile(path.join(root, 'photos', 'selects', 'camp.png'));

        await expect(prepareTripAssets({ tripId: 'test-trip', source: root })).rejects.toThrow(/resolve to the ID/);
    });

    it('removes generated track files that no longer have a GPX source', async () => {
        const root = createTripDirectory();
        const processedPath = path.join(root, 'gps', 'processed');
        fs.mkdirSync(processedPath, { recursive: true });
        fs.writeFileSync(path.join(processedPath, 'track-old-route.geojson'), '{}\n');
        fs.writeFileSync(path.join(processedPath, 'route-fallback.geojson'), '{}\n');
        fs.writeFileSync(path.join(root, 'gps', 'originals', 'new-route.gpx'), `<?xml version="1.0"?>
            <gpx version="1.1" creator="test"><trk><trkseg>
                <trkpt lat="35.1" lon="-92.1" />
                <trkpt lat="35.2" lon="-92.2" />
            </trkseg></trk></gpx>`);

        await prepareTripAssets({ tripId: 'test-trip', source: root });

        expect(fs.existsSync(path.join(processedPath, 'track-old-route.geojson'))).toBe(false);
        expect(fs.existsSync(path.join(processedPath, 'track-new-route.geojson'))).toBe(true);
        expect(fs.existsSync(path.join(processedPath, 'route-fallback.geojson'))).toBe(true);
    });

    it('removes obsolete generated files when source assets are removed', async () => {
        const root = createTripDirectory();
        const photoProcessedPath = path.join(root, 'photos', 'processed');
        const routeProcessedPath = path.join(root, 'gps', 'processed');
        fs.mkdirSync(photoProcessedPath, { recursive: true });
        fs.mkdirSync(routeProcessedPath, { recursive: true });
        fs.writeFileSync(path.join(photoProcessedPath, 'old-photo-480.webp'), 'old');
        fs.writeFileSync(path.join(routeProcessedPath, 'route.geojson'), '{}\n');
        fs.writeFileSync(path.join(routeProcessedPath, 'track-old-route.geojson'), '{}\n');
        await sharp({
            create: { width: 10, height: 10, channels: 3, background: '#000' },
        }).png().toFile(path.join(root, 'photos', 'selects', 'New Photo.png'));

        await prepareTripAssets({ tripId: 'test-trip', source: root });

        expect(fs.existsSync(path.join(photoProcessedPath, 'old-photo-480.webp'))).toBe(false);
        expect(fs.existsSync(path.join(photoProcessedPath, 'new-photo-10.webp'))).toBe(true);
        expect(fs.existsSync(path.join(routeProcessedPath, 'route.geojson'))).toBe(false);
        expect(fs.existsSync(path.join(routeProcessedPath, 'track-old-route.geojson'))).toBe(false);
    });
});