// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PMTiles, TileType, type Source } from 'pmtiles';
import { describe, expect, it } from 'vitest';
import locations from '../../projects/ski-status/data/locations.json';
import bases from '../../projects/ski-status/data/resort-bases.json';
import manifest from '../../projects/ski-status/data/resort-terrain.json';

describe('ski-status terrain archive', () => {
    it('indexes terrain for catalog areas and keeps it under the location data license', () => {
        const catalogIds = new Set(locations.locations.map(location => location.id));
        expect(manifest.license).toBe(locations.license);
        expect(bases.license).toBe(manifest.license);
        expect(bases.buildTime).toBe(manifest.buildTime);
        expect(manifest.minZoom).toBeLessThan(manifest.detailMinZoom);
        expect(manifest.detailMinZoom).toBeLessThan(manifest.stationMinZoom);
        expect(manifest.stationMinZoom).toBeLessThanOrEqual(manifest.maxZoom);
        for (const id of Object.keys(bases.bases)) expect(catalogIds.has(id)).toBe(true);
        expect(Object.keys(manifest.groupsByArea).length).toBeGreaterThan(500);
        for (const [area, groups] of Object.entries(manifest.groupsByArea)) {
            expect(catalogIds.has(area)).toBe(true);
            expect(groups.length).toBeGreaterThan(0);
            expect(new Set(groups).size).toBe(groups.length);
            expect(groups.every(group => Number.isInteger(group) && group > 0)).toBe(true);
        }
        expect(manifest.groupsByArea.heavenly.length).toBeGreaterThan(0);
    });

    it('ships the indexed PMTiles archive with tiles for Heavenly', async () => {
        const bytes = await readFile(new URL('../../projects/ski-status/data/resort-terrain.pmtiles', import.meta.url));
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.archiveSha256);
        const source: Source = {
            getKey: () => manifest.archiveSha256,
            getBytes: async (offset, length) => ({ data: Uint8Array.from(bytes.subarray(offset, offset + length)).buffer }),
        };
        const tiles = new PMTiles(source);
        const header = await tiles.getHeader();
        expect(header).toMatchObject({ minZoom: manifest.minZoom, maxZoom: manifest.maxZoom, tileType: TileType.Mvt });
        const result = await tiles.getZxy(13, 1367, 3132);
        expect(result?.data.byteLength).toBeGreaterThan(0);
    });
});
