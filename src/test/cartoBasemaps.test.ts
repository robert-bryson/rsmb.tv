import { afterEach, describe, expect, it, vi } from 'vitest';
import { cartoRasterStyle, cartoRasterUrl, cartoVectorStyle, cartoVectorStyleUrl } from '../maps/cartoBasemaps';

describe('CARTO authentication', () => {
    it('supports the public Dark Matter vector style and encodes configured keys', () => {
        expect(cartoVectorStyleUrl('dark-matter', '')).toBe('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json');
        expect(cartoVectorStyleUrl('dark-matter', ' \t ')).toBe(cartoVectorStyleUrl('dark-matter', ''));
        expect(cartoVectorStyleUrl('dark-matter', ' fixture key/+& '))
            .toBe('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json?key=fixture%20key%2F%2B%26');
    });
    it('encodes only the key and preserves tile placeholders', () => {
        const url = cartoRasterUrl('voyager', 'test key/+&');
        expect(url).toBe('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=test%20key%2F%2B%26');
        expect(cartoRasterUrl('positron-nolabels', 'fixture')).toContain('/light_nolabels/{z}/{x}/{y}.png?key=fixture');
    });
    it('authenticates the hosted vector style and avoids unauthenticated provider requests', () => {
        expect(cartoVectorStyle('dark-matter', 'fixture')).toBe('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json?key=fixture');
        expect(cartoRasterUrl('dark', '')).toMatch(/^data:image\/png;base64,/);
        expect(cartoVectorStyle('dark-matter', '')).toMatchObject({ version: 8 });
    });

    it('builds the default raster style with an authenticated source and both provider links', () => {
        const style = cartoRasterStyle(undefined, ' fixture key/+& ');
        const source = style.sources['carto-basemap'];
        expect(source).toMatchObject({
            type: 'raster',
            tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=fixture%20key%2F%2B%26'],
        });
        if (source.type !== 'raster') throw new Error('Expected a CARTO raster source');
        const attribution = document.createElement('div');
        attribution.innerHTML = source.attribution ?? '';
        expect(attribution.querySelector('a[href="https://carto.com/attribution/"]')).toHaveTextContent('CARTO');
        expect(attribution.querySelector('a[href="https://www.openstreetmap.org/copyright"]')).toHaveTextContent('OpenStreetMap');
        expect(attribution).not.toHaveTextContent('Basemap unavailable');
    });

    it.each(['', ' \t '])('uses neutral raster and vector styles when the browser key is %j', key => {
        const raster = cartoRasterStyle('dark', key);
        expect(raster.sources['carto-basemap']).toMatchObject({
            tiles: [expect.stringMatching(/^data:image\/png;base64,/)],
            attribution: expect.stringContaining('Basemap unavailable'),
        });
        expect(JSON.stringify(raster)).not.toContain('https://basemaps.cartocdn.com');
        expect(cartoVectorStyle('dark-matter', key)).toEqual(raster);
    });
});

describe('configured CARTO browser key', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it.each([undefined, '', ' \t '])('avoids provider requests when the configured key is %j', async key => {
        vi.stubEnv('VITE_CARTO_API_KEY', key);
        vi.resetModules();
        const basemaps = await import('../maps/cartoBasemaps');

        expect(basemaps.CARTO_API_KEY).toBe('');
        expect(basemaps.BASEMAP_ATTRIBUTION).toContain('Basemap unavailable');
        expect(basemaps.cartoRasterUrl('positron-nolabels')).toMatch(/^data:image\/png;base64,/);
        const raster = basemaps.cartoRasterStyle();
        expect(JSON.stringify(raster)).not.toContain('https://basemaps.cartocdn.com');
        expect(raster.sources['carto-basemap']).toMatchObject({ attribution: basemaps.BASEMAP_ATTRIBUTION });
        expect(basemaps.cartoVectorStyle()).toEqual(raster);
    });

    it('uses the trimmed configured key for default raster and vector requests', async () => {
        vi.stubEnv('VITE_CARTO_API_KEY', ' fixture key/+& ');
        vi.resetModules();
        const basemaps = await import('../maps/cartoBasemaps');

        expect(basemaps.CARTO_API_KEY).toBe('fixture key/+&');
        expect(basemaps.BASEMAP_ATTRIBUTION).toBe(basemaps.CARTO_ATTRIBUTION);
        expect(basemaps.cartoRasterUrl('positron-nolabels')).toBe(
            'https://basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png?key=fixture%20key%2F%2B%26',
        );
        expect(basemaps.cartoRasterStyle().sources['carto-basemap']).toMatchObject({
            tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=fixture%20key%2F%2B%26'],
            attribution: basemaps.CARTO_ATTRIBUTION,
        });
        expect(basemaps.cartoVectorStyle()).toBe(
            'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json?key=fixture%20key%2F%2B%26',
        );
    });
});
