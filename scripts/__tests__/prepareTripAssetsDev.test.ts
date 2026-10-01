// @vitest-environment node
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import sharp from 'sharp';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatAssetTotals, mirrorPreparedTripAssets, prepareTripAssetsForDev } from '../prepare-trip-assets-dev.js';

const tempDirs: string[] = [];

afterEach(() => {
    vi.restoreAllMocks();
    for (const directory of tempDirs.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

describe('prepare trip assets before dev', () => {
    it.each(['../outside', '/tmp/outside', 'Invalid_ID'])('rejects unsafe preview IDs: %s', async previewSlug => {
        const prepare = vi.fn();
        await expect(prepareTripAssetsForDev({ sourceRoot: '/tmp/trips', previewSlug, prepare }))
            .rejects.toThrow('Invalid trip ID');
        expect(prepare).not.toHaveBeenCalled();
        await expect(mirrorPreparedTripAssets({ source: '/tmp/trips', tripId: previewSlug, outputRoot: '/tmp/output' }))
            .rejects.toThrow('Invalid trip ID');
    });

    it('retains the whole preview and removes staging files when copying fails', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-assets-dev-'));
        tempDirs.push(root);
        const source = path.join(root, 'source');
        const outputRoot = path.join(root, 'output');
        const photos = path.join(outputRoot, 'test-trip', 'photos', 'old.webp');
        const route = path.join(outputRoot, 'test-trip', 'geo', 'old.geojson');
        for (const filename of [photos, route, path.join(source, 'photos', 'processed', 'new.webp')]) {
            fs.mkdirSync(path.dirname(filename), { recursive: true });
            fs.writeFileSync(filename, 'original');
        }
        vi.spyOn(fsPromises, 'copyFile').mockRejectedValue(Object.assign(new Error('Disk full'), { code: 'ENOSPC' }));
        await expect(mirrorPreparedTripAssets({ source, tripId: 'test-trip', outputRoot }))
            .rejects.toMatchObject({ code: 'ENOSPC' });
        expect(fs.readFileSync(photos, 'utf8')).toBe('original');
        expect(fs.readFileSync(route, 'utf8')).toBe('original');
        expect(fs.readdirSync(outputRoot)).toEqual(['test-trip']);
    });

    it('restores the preview when its staged replacement cannot be installed', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-assets-dev-'));
        tempDirs.push(root);
        const outputRoot = path.join(root, 'output');
        const photo = path.join(outputRoot, 'test-trip', 'photos', 'old.webp');
        fs.mkdirSync(path.dirname(photo), { recursive: true });
        fs.writeFileSync(photo, 'original');
        const rename = fsPromises.rename.bind(fsPromises);
        vi.spyOn(fsPromises, 'rename').mockImplementation(async (source, destination) => {
            if (path.basename(String(source)) === 'staged') throw Object.assign(new Error('Rename failed'), { code: 'EIO' });
            return rename(source, destination);
        });
        await expect(mirrorPreparedTripAssets({ source: path.join(root, 'source'), tripId: 'test-trip', outputRoot }))
            .rejects.toMatchObject({ code: 'EIO' });
        expect(fs.readFileSync(photo, 'utf8')).toBe('original');
        expect(fs.readdirSync(outputRoot)).toEqual(['test-trip']);
    });

    it('retains the backup and reports both errors when installation and restoration fail', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-assets-dev-'));
        tempDirs.push(root);
        const outputRoot = path.join(root, 'output');
        const photo = path.join(outputRoot, 'test-trip', 'photos', 'old.webp');
        fs.mkdirSync(path.dirname(photo), { recursive: true });
        fs.writeFileSync(photo, 'original');
        const rename = fsPromises.rename.bind(fsPromises);
        const installError = new Error('Installation failed');
        const restoreError = new Error('Restoration failed');
        vi.spyOn(fsPromises, 'rename').mockImplementation(async (source, destination) => {
            if (path.basename(String(source)) === 'staged') throw installError;
            if (path.basename(String(source)) === 'previous') throw restoreError;
            return rename(source, destination);
        });
        await expect(mirrorPreparedTripAssets({ source: path.join(root, 'source'), tripId: 'test-trip', outputRoot }))
            .rejects.toMatchObject({ errors: [installError, restoreError], message: expect.stringContaining('Previous preview retained at') });
        const [backupDirectory] = fs.readdirSync(outputRoot);
        expect(backupDirectory).toMatch(/^\.test-trip-/);
        expect(fs.readFileSync(path.join(outputRoot, backupDirectory, 'previous', 'photos', 'old.webp'), 'utf8')).toBe('original');
    });

    it('incrementally processes only the preview trip and reports generated asset totals', async () => {
        const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-assets-dev-'));
        tempDirs.push(sourceRoot);
        fs.mkdirSync(path.join(sourceRoot, 'coastal-loop'));
        fs.mkdirSync(path.join(sourceRoot, 'mountain-loop'));
        fs.mkdirSync(path.join(sourceRoot, 'coastal-loop', 'photos', 'processed'), { recursive: true });
        fs.mkdirSync(path.join(sourceRoot, 'coastal-loop', 'gps', 'processed'), { recursive: true });
        for (const filename of ['photo-480.webp', 'photo-960.webp', 'photo-1600.webp', 'other-480.webp', 'other-960.webp']) {
            fs.writeFileSync(path.join(sourceRoot, 'coastal-loop', 'photos', 'processed', filename), filename);
        }
        for (const filename of ['route.geojson', 'track-outbound.geojson', 'track-return.geojson']) {
            fs.writeFileSync(path.join(sourceRoot, 'coastal-loop', 'gps', 'processed', filename), filename);
        }
        const outputRoot = path.join(sourceRoot, 'public-trips');
        fs.mkdirSync(path.join(outputRoot, 'coastal-loop'), { recursive: true });
        fs.symlinkSync('/missing/old/photos', path.join(outputRoot, 'coastal-loop', 'photos'));
        const prepare = vi.fn().mockResolvedValue({
            photos: [
                { derivatives: [{}, {}, {}] },
                { derivatives: [{}, {}] },
            ],
            route: { tracks: [{}, {}] },
        });

        const totals = await prepareTripAssetsForDev({
            sourceRoot,
            previewSlug: 'coastal-loop',
            outputRoot,
            prepare,
        });

        expect(prepare).toHaveBeenCalledOnce();
        expect(prepare).toHaveBeenCalledWith({
            tripId: 'coastal-loop',
            source: path.join(sourceRoot, 'coastal-loop'),
        });
        expect(totals).toEqual({ trips: 1, photos: 2, webpFiles: 5, geoJsonFiles: 3, failures: [], skipped: [] });
        expect(formatAssetTotals(totals)).toBe(
            'Processed 1 trip with 2 photos and 3 GeoJSON files before dev (5 WebP derivatives).',
        );
        expect(fs.readdirSync(path.join(outputRoot, 'coastal-loop', 'photos'))).toHaveLength(5);
        expect(fs.readdirSync(path.join(outputRoot, 'coastal-loop', 'geo'))).toEqual([
            'route.geojson',
            'track-outbound.geojson',
            'track-return.geojson',
        ]);
        expect(fs.lstatSync(path.join(outputRoot, 'coastal-loop', 'photos')).isSymbolicLink()).toBe(false);
    });

    it('continues after an incomplete trip fails', async () => {
        const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-assets-dev-'));
        tempDirs.push(sourceRoot);
        fs.mkdirSync(path.join(sourceRoot, 'complete-trip'));
        fs.mkdirSync(path.join(sourceRoot, 'future-trip'));
        const prepare = vi.fn()
            .mockResolvedValueOnce({ photos: [], route: undefined })
            .mockRejectedValueOnce(new Error('No selected photos or original GPX files found.'));

        const totals = await prepareTripAssetsForDev({ sourceRoot, outputRoot: path.join(sourceRoot, 'output'), prepare });

        expect(prepare).toHaveBeenCalledTimes(2);
        expect(totals.trips).toBe(1);
        expect(totals.failures).toEqual([{
            tripId: 'future-trip',
            reason: 'No selected photos or original GPX files found.',
        }]);
        expect(formatAssetTotals(totals)).toContain('1 trip incomplete');
    });

    it('prepares and mirrors photos and routes when native copying is unsupported', async () => {
        const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-assets-dev-'));
        tempDirs.push(sourceRoot);
        const source = path.join(sourceRoot, 'test-trip');
        const outputRoot = path.join(sourceRoot, 'output');
        fs.mkdirSync(path.join(source, 'photos', 'selects'), { recursive: true });
        fs.mkdirSync(path.join(source, 'gps', 'originals'), { recursive: true });
        await sharp({ create: { width: 600, height: 400, channels: 3, background: '#c84b31' } })
            .jpeg().toFile(path.join(source, 'photos', 'selects', 'camp.jpg'));
        fs.writeFileSync(path.join(source, 'gps', 'originals', 'ride.gpx'),
            '<gpx><trk><trkseg><trkpt lat="0" lon="0"/><trkpt lat="1" lon="1"/></trkseg></trk></gpx>');
        const nativeCopy = vi.spyOn(fsPromises, 'copyFile')
            .mockRejectedValue(Object.assign(new Error('Native copy unsupported'), { code: 'EPERM' }));

        for (let run = 0; run < 2; run++) {
            const totals = await prepareTripAssetsForDev({ sourceRoot, previewSlug: 'test-trip', outputRoot });
            expect(totals).toEqual({ trips: 1, photos: 1, webpFiles: 4, geoJsonFiles: 2, failures: [], skipped: [] });
            const report = JSON.parse(fs.readFileSync(path.join(source, 'asset-metadata.json'), 'utf8'));
            for (const derivative of report.photos[0].derivatives) {
                const bytes = fs.readFileSync(path.join(source, 'photos', 'processed', derivative.filename));
                for (const filename of [derivative.filename, derivative.legacyFilename]) {
                    expect(fs.readFileSync(path.join(outputRoot, 'test-trip', 'photos', filename))).toEqual(bytes);
                }
            }
            expect(JSON.parse(fs.readFileSync(path.join(outputRoot, 'test-trip', 'geo', 'route.geojson'), 'utf8'))
                .features).toHaveLength(1);
        }
        expect(nativeCopy).toHaveBeenCalled();
    });

    it('skips empty trips without deleting existing processed or preview assets', async () => {
        const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-assets-dev-'));
        tempDirs.push(sourceRoot);
        const source = path.join(sourceRoot, 'empty-trip');
        const outputRoot = path.join(sourceRoot, 'output');
        const files = [
            path.join(source, 'photos', 'processed', 'camp-480.webp'),
            path.join(source, 'gps', 'processed', 'route.geojson'),
            path.join(outputRoot, 'empty-trip', 'photos', 'camp-480.webp'),
        ];
        for (const filename of files) {
            fs.mkdirSync(path.dirname(filename), { recursive: true });
            fs.writeFileSync(filename, 'previous output');
        }
        const totals = await prepareTripAssetsForDev({ sourceRoot, previewSlug: 'empty-trip', outputRoot });
        expect(totals).toMatchObject({ trips: 0, failures: [], skipped: [{ tripId: 'empty-trip' }] });
        expect(formatAssetTotals(totals)).toContain('Skipped 1 empty trip.');
        for (const filename of files) expect(fs.readFileSync(filename, 'utf8')).toBe('previous output');
    });

});
