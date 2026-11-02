import { describe, expect, it } from 'vitest';
import { cartoRasterUrl, cartoVectorStyle } from '../maps/cartoBasemaps';

describe('CARTO authentication', () => {
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
});
