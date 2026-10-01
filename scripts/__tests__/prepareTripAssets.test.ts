// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
    DEFAULT_ROUTE_SIMPLIFICATION_TOLERANCE_METERS,
    parseArgs,
    photoId,
    prepareTripAssets,
    WEBP_QUALITY,
} from '../prepare-trip-assets.js';

const tempDirs: string[] = [];

function createTripDirectory() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-trip-'));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, 'photos', 'selects'), { recursive: true });
    fs.mkdirSync(path.join(root, 'gps', 'originals'), { recursive: true });
    return root;
}

function writeTrack(root: string, segments: number[][][], filename = 'route.gpx') {
    const body = segments.map((coordinates) => `<trkseg>${coordinates.map(([lon, lat]) => (
        `<trkpt lat="${lat}" lon="${lon}" />`
    )).join('')}</trkseg>`).join('');
    fs.writeFileSync(path.join(root, 'gps', 'originals', filename), `<gpx version="1.1"><trk>${body}</trk></gpx>`);
}

function readRoute(root: string) {
    return JSON.parse(fs.readFileSync(path.join(root, 'gps', 'processed', 'route.geojson'), 'utf8'));
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
            routeToleranceMeters: 5,
        });
        expect(parseArgs(['ozarks-2012', '--source', '/tmp/trip', '--route-tolerance', '10']))
            .toMatchObject({ routeToleranceMeters: 10 });
        expect(() => parseArgs(['ozarks-2012', '--source', '/tmp/trip', '--route-tolerance', '-1']))
            .toThrow(/non-negative number/);
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
        expect(WEBP_QUALITY).toBe(84);
        expect(DEFAULT_ROUTE_SIMPLIFICATION_TOLERANCE_METERS).toBe(5);
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
            originalPointCount: 2,
            outputPointCount: 2,
            distanceKilometers: 14.4,
            distanceMiles: 9,
            date: '2026-01-01',
        }]);
        expect(metadata.route).toMatchObject({ distanceKilometers: 14.4, distanceMiles: 9 });
    });

    it('reuses unchanged derivatives and versions changed sources without deleting published files', async () => {
        const root = createTripDirectory();
        const source = path.join(root, 'photos', 'selects', 'camp.jpg');
        const writePhoto = (background: string) => sharp({ create: { width: 600, height: 400, channels: 3, background } }).jpeg().toFile(source);
        await writePhoto('#c84b31');
        const first = await prepareTripAssets({ tripId: 'test-trip', source: root });
        const original = first.photos[0].derivatives[0].filename;
        const originalPath = path.join(root, 'photos', 'processed', original);
        fs.utimesSync(originalPath, 1000, 1000);
        const repeated = await prepareTripAssets({ tripId: 'test-trip', source: root });
        expect(repeated.photos[0].fingerprint).toBe(first.photos[0].fingerprint);
        expect(fs.statSync(originalPath).mtimeMs).toBe(1_000_000);
        await writePhoto('#314bc8');
        const changed = await prepareTripAssets({ tripId: 'test-trip', source: root });
        expect(changed.photos[0].fingerprint).not.toBe(first.photos[0].fingerprint);
        expect(fs.existsSync(originalPath)).toBe(true);
        const derivative = changed.photos[0].derivatives[0];
        expect(fs.readFileSync(path.join(root, 'photos', 'processed', derivative.legacyFilename)))
            .toEqual(fs.readFileSync(path.join(root, 'photos', 'processed', derivative.filename)));
        expect(derivative.bytes).toBeGreaterThan(0);
    });

    it('cleans and simplifies route geometry with a five-meter default tolerance', async () => {
        const root = createTripDirectory();
        fs.writeFileSync(path.join(root, 'gps', 'originals', 'curving-route.gpx'), `<?xml version="1.0"?>
            <gpx version="1.1" creator="test"><trk><trkseg>
                <trkpt lat="47" lon="-122"><ele>10</ele></trkpt>
                <trkpt lat="47" lon="-122"><ele>10</ele></trkpt>
                <trkpt lat="47.00001" lon="-121.9999"><ele>11</ele></trkpt>
                <trkpt lat="47.0001" lon="-121.9998"><ele>12</ele></trkpt>
                <trkpt lat="47.00001" lon="-121.9997"><ele>13</ele></trkpt>
                <trkpt lat="47" lon="-121.9996"><ele>14</ele></trkpt>
            </trkseg></trk></gpx>`);

        const report = await prepareTripAssets({ tripId: 'test-trip', source: root });
        const route = JSON.parse(fs.readFileSync(path.join(root, 'gps', 'processed', 'route.geojson'), 'utf8'));
        const coordinates = route.features[0].geometry.coordinates;

        expect(coordinates).toEqual([
            [-122, 47],
            [-121.9998, 47.0001],
            [-121.9996, 47],
        ]);
        expect(coordinates.every((position: number[]) => position.length === 2)).toBe(true);
        expect(report.route).toMatchObject({
            originalPointCount: 6,
            outputPointCount: 3,
            simplificationToleranceMeters: 5,
        });
        expect(report.route?.tracks[0]).toMatchObject({ originalPointCount: 6, outputPointCount: 3 });
    });

    it.each(['', ' ', 'NaN', 'Infinity', '-1', 'oops'])('rejects invalid tolerance %j', (value) => {
        expect(() => parseArgs(['test-trip', '--source', '/tmp/trip', '--route-tolerance', value]))
            .toThrow(/non-negative number/);
    });

    it('rejects repeated tolerance options', () => {
        expect(() => parseArgs(['test-trip', '--source', '/tmp/trip', '--route-tolerance', '5', '--route-tolerance', '0']))
            .toThrow(/only be specified once/);
    });

    it.each([NaN, Infinity, -1])('rejects invalid programmatic tolerance %s before writing', async (routeToleranceMeters) => {
        const root = createTripDirectory();
        await expect(prepareTripAssets({ tripId: 'test-trip', source: root, routeToleranceMeters }))
            .rejects.toThrow(/non-negative number/);
        expect(fs.existsSync(path.join(root, 'photos', 'processed'))).toBe(false);
    });

    it.each(['', '../outside', 'UPPER'])('rejects invalid programmatic trip ID %j', async (tripId) => {
        const root = createTripDirectory();
        await expect(prepareTripAssets({ tripId, source: root })).rejects.toThrow(/Trip ID/);
        expect(fs.existsSync(path.join(root, 'photos', 'processed'))).toBe(false);
    });

    it.each([undefined, null, ''])('rejects invalid programmatic source %j', async (source) => {
        await expect(prepareTripAssets({ tripId: 'test-trip', source: source as string }))
            .rejects.toThrow(/Source must be a directory path/);
    });

    it.each([
        'lat="NaN" lon="0"', 'lat="47oops" lon="0"', 'lat=" " lon="0"',
        'lon="0"', 'lat="91" lon="0"', 'lat="0" lon="181"',
        'lat="0" lon="Infinity"', 'lat="0x10" lon="0"',
    ])('rejects invalid source coordinates before conversion: %s', async (attributes) => {
        const root = createTripDirectory();
        const processed = path.join(root, 'photos', 'processed');
        fs.mkdirSync(processed);
        fs.writeFileSync(path.join(processed, 'previous-480.webp'), 'previous output');
        fs.writeFileSync(path.join(root, 'gps', 'originals', 'broken.gpx'),
            `<gpx><trk><trkseg><trkpt lat="0" lon="0"/><trkpt ${attributes}/><trkpt lat="1" lon="1"/></trkseg></trk></gpx>`);
        await expect(prepareTripAssets({ tripId: 'test-trip', source: root }))
            .rejects.toThrow(/broken.gpx.*invalid coordinate/i);
        expect(fs.readFileSync(path.join(processed, 'previous-480.webp'), 'utf8')).toBe('previous output');
        expect(fs.existsSync(path.join(root, 'gps', 'processed', 'route.geojson'))).toBe(false);
    });

    it.each([
        '<gpx><trk><trkseg><trkpt lat=0 lon="0"/><trkpt lat="1" lon="1"/></trkseg></trk></gpx>',
        '<other><trk><trkseg><trkpt lat="0" lon="0"/><trkpt lat="1" lon="1"/></trkseg></trk></other>',
    ])('rejects malformed or non-GPX input', async (xml) => {
        const root = createTripDirectory();
        fs.writeFileSync(path.join(root, 'gps', 'originals', 'broken.gpx'), xml);
        await expect(prepareTripAssets({ tripId: 'test-trip', source: root })).rejects.toThrow(/broken.gpx/);
    });

    it('retains collinear vertices at zero tolerance', async () => {
        const root = createTripDirectory();
        const coordinates = [[0, 0], [0.001, 0], [0.002, 0]];
        writeTrack(root, [coordinates]);
        await prepareTripAssets({ tripId: 'test-trip', source: root, routeToleranceMeters: 0 });
        expect(readRoute(root).features[0].geometry.coordinates).toEqual(coordinates);
    });

    it('simplifies across the date line using the short longitude interval', async () => {
        const root = createTripDirectory();
        writeTrack(root, [[[179.9998, 0], [179.9999, 0.00001], [-179.9999, 0.00001], [-179.9998, 0]]]);
        await prepareTripAssets({ tripId: 'test-trip', source: root });
        expect(readRoute(root).features[0].geometry.coordinates).toEqual([[179.9998, 0], [-179.9998, 0]]);
    });

    it('retains a closed route when the tolerance would collapse it', async () => {
        const root = createTripDirectory();
        const coordinates = [[0, 0], [0.001, 0], [0, 0.001], [0, 0]];
        writeTrack(root, [coordinates]);
        await prepareTripAssets({ tripId: 'test-trip', source: root, routeToleranceMeters: 1000 });
        expect(readRoute(root).features[0].geometry.coordinates).toEqual(coordinates);
    });

    it('keeps segment boundaries and calculates distance before simplification', async () => {
        const root = createTripDirectory();
        writeTrack(root, [
            [[0, 0], [0.001, 0.001], [0.002, 0]],
            [[10, 0], [10.001, 0], [10.002, 0]],
        ]);
        const original = await prepareTripAssets({ tripId: 'test-trip', source: root, routeToleranceMeters: 0 });
        const originalDistance = readRoute(root).features[0].properties.distanceKilometers;
        const simplified = await prepareTripAssets({ tripId: 'test-trip', source: root, routeToleranceMeters: 1000 });
        expect(readRoute(root).features[0]).toMatchObject({
            geometry: { type: 'MultiLineString', coordinates: [[[0, 0], [0.002, 0]], [[10, 0], [10.002, 0]]] },
            properties: { distanceKilometers: originalDistance },
        });
        expect(simplified.route?.distanceKilometers).toBe(original.route?.distanceKilometers);
        expect(originalDistance).toBeCloseTo(0.537, 3);
        expect(simplified.route).toMatchObject({ originalPointCount: 6, outputPointCount: 4 });
    });

    it('keeps the antipodal distance finite', async () => {
        const root = createTripDirectory();
        writeTrack(root, [[[0, 0.08], [180, -0.08]]]);
        const report = await prepareTripAssets({ tripId: 'test-trip', source: root });
        expect(report.route?.distanceKilometers).toBeCloseTo(20015.1, 1);
        expect(readRoute(root).features[0].properties.distanceKilometers).toBeCloseTo(20015.114, 2);
    });

    it('does not create a source directory for a misspelled path', async () => {
        const root = createTripDirectory();
        const source = path.join(root, 'missing');
        await expect(prepareTripAssets({ tripId: 'test-trip', source })).rejects.toThrow();
        expect(fs.existsSync(source)).toBe(false);
    });

    it('rejects photo filename collisions', async () => {
        const root = createTripDirectory();
        const processedPath = path.join(root, 'photos', 'processed');
        fs.mkdirSync(processedPath);
        fs.writeFileSync(path.join(processedPath, 'existing-480.webp'), 'existing output');
        const image = sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).png();
        await image.clone().toFile(path.join(root, 'photos', 'selects', 'Camp.jpg'));
        await image.clone().toFile(path.join(root, 'photos', 'selects', 'camp.png'));

        await expect(prepareTripAssets({ tripId: 'test-trip', source: root })).rejects.toThrow(/resolve to the ID/);
        expect(fs.readdirSync(processedPath)).toEqual(['existing-480.webp']);
        expect(fs.readFileSync(path.join(processedPath, 'existing-480.webp'), 'utf8')).toBe('existing output');
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