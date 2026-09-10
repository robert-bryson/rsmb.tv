// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatAssetTotals, prepareTripAssetsForDev } from '../prepare-trip-assets-dev.js';

const tempDirs: string[] = [];

afterEach(() => {
    for (const directory of tempDirs.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

describe('prepare trip assets before dev', () => {
    it('force-processes only the preview trip and reports generated asset totals', async () => {
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
            force: true,
        });
        expect(totals).toEqual({ trips: 1, photos: 2, webpFiles: 5, geoJsonFiles: 3, failures: [] });
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
});