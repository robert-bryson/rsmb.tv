// @vitest-environment node
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { specializeGlobeSource } from '../globe-webgl-plugin';

describe('reviewed WebGL build adapter', () => {
    it.each(['three-globe', 'three-render-objects'])('specializes the reviewed %s implementation and retains source content', dependency => {
        const id = `${process.cwd()}/node_modules/${dependency}/dist/${dependency}.mjs`;
        const original = fs.readFileSync(id, 'utf8');
        const result = specializeGlobeSource(original, id)!;
        expect(result.code).not.toContain("from 'three/webgpu'");
        expect(result.code).not.toContain("from 'three/tsl'");
        expect(result.map.sourcesContent).toEqual([original]);
        expect(result.map.mappings).not.toBe('');
        if (dependency === 'three-globe') expect(result.code).toContain('coords.map(point => getGeoKDE(point, data, options))');
        else expect(result.code).toContain('new (three.WebGLRenderer)');
    });

    it.each(['three-globe', 'three-render-objects'])('rejects changed %s code even when all old markers remain', dependency => {
        const id = `${process.cwd()}/node_modules/${dependency}/dist/${dependency}.mjs`;
        const changed = `${fs.readFileSync(id, 'utf8')}\n// Upstream implementation changed.\n`;
        expect(() => specializeGlobeSource(changed, id)).toThrow(`Unreviewed ${dependency} source`);
    });

    it('handles normalized Windows paths and ignores unrelated modules', () => {
        const id = `${process.cwd()}/node_modules/three-globe/dist/three-globe.mjs`;
        expect(specializeGlobeSource(fs.readFileSync(id, 'utf8'), id.replaceAll('/', '\\'))).not.toBeNull();
        expect(specializeGlobeSource('export default 1', '/other/three-globe.mjs')).toBeNull();
    });
});
