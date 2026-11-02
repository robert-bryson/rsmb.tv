// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atlasGeometryBounds, generateAtlasGeographyBounds } from '../generate-atlas-geography-bounds.js';

let directory: string;
beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rsmb-atlas-geography-')); });
afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });

function polygon(coordinates: number[][]) {
    return { type: 'Polygon', coordinates: [coordinates] };
}
const geometry = polygon([[-125, 45], [-117, 45], [-117, 49], [-125, 45]]);

describe('atlas geographic bounds generation', () => {
    it('frames disconnected polygons across the date line with a short longitude interval', () => {
        expect(atlasGeometryBounds({ type: 'MultiPolygon', coordinates: [
            [[[178, 50], [179, 51], [178, 50]]],
            [[[-179, 52], [-178, 53], [-179, 52]]],
        ] })).toEqual([-182, 50, -178, 53]);
        expect(atlasGeometryBounds(geometry)).toEqual([-125, 45, -117, 49]);
    });

    it('handles large coastlines without spreading coordinates onto the call stack', () => {
        const coordinates = Array.from({ length: 200_000 }, (_, index) => [-125 + index % 9, 45 + index % 5]);
        expect(atlasGeometryBounds(polygon(coordinates))).toEqual([-125, 45, -117, 49]);
    });

    it.each([
        null,
        { type: 'Point', coordinates: [-125, 45] },
        polygon([]),
        polygon([[NaN, 45]]),
        polygon([[-125, Infinity]]),
        polygon([[-125, 91]]),
    ])('rejects unusable geometry before it can produce corrupt bounds: %j', value => {
        expect(() => atlasGeometryBounds(value)).toThrow(/Geographic bounds require/);
    });

    it('writes sorted country bounds and qualified US/Canadian region aliases from the pinned datasets', async () => {
        const outputPath = path.join(directory, 'bounds.json');
        const feature = (properties: Record<string, string>) => ({ properties, geometry });
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ features: [
                feature({ ISO_A2_EH: 'US' }), feature({ ISO_A2: 'CA' }), feature({ ISO_A2: '-99' }),
            ] }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ features: [
                feature({ iso_a2: 'US', name: 'Washington', name_en: 'Washington' }),
                feature({ iso_a2: 'CA', name: ' Québec ', name_en: 'Quebec' }),
                feature({ iso_a2: 'FR', name: 'Paris' }),
            ] }) });
        const data = await generateAtlasGeographyBounds({ fetchImpl, outputPath });
        expect(Object.keys(data.countries)).toEqual(['CA', 'US']);
        expect(data.regions).toEqual({ 'CA/quebec': [-125, 45, -117, 49], 'US/washington': [-125, 45, -117, 49] });
        expect(await fs.readFile(outputPath, 'utf8')).toBe(`${JSON.stringify(data, null, 2)}\n`);
        expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
            'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson',
            'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_1_states_provinces.geojson',
        ]);
    });

    it('preserves the existing lookup when a source request fails', async () => {
        const outputPath = path.join(directory, 'bounds.json');
        await fs.writeFile(outputPath, 'previous lookup\n');
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ features: [] }) })
            .mockResolvedValueOnce({ ok: false, status: 503 });
        await expect(generateAtlasGeographyBounds({ fetchImpl, outputPath })).rejects.toThrow('ne_50m_admin_1_states_provinces: HTTP 503');
        expect(await fs.readFile(outputPath, 'utf8')).toBe('previous lookup\n');
    });

    it('aborts a stalled response body without changing the existing lookup', async () => {
        const outputPath = path.join(directory, 'bounds.json');
        await fs.writeFile(outputPath, 'previous lookup\n');
        const fetchImpl = vi.fn(async (_url: string, { signal }: RequestInit) => ({
            ok: true,
            json: () => new Promise((_resolve, reject) => {
                signal!.addEventListener('abort', () => reject(signal!.reason), { once: true });
            }),
        }));
        await expect(generateAtlasGeographyBounds({ fetchImpl, outputPath, timeoutMs: 5 })).rejects.toMatchObject({ name: 'TimeoutError' });
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(await fs.readFile(outputPath, 'utf8')).toBe('previous lookup\n');
    });
});
