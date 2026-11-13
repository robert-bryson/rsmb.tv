// @vitest-environment node
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
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
        else {
            expect(result.code).toContain('new (three.WebGLRenderer)');
            expect(result.code).toContain('new OrbitControls(state.camera, state.renderer.domElement)');
            expect(result.code).not.toContain('TrackballControls');
            expect(result.code).not.toContain('ArcballControls');
            expect(result.code).not.toContain('FlyControls');
        }
    });

    it.each(['three-globe', 'three-render-objects'])('rejects changed %s code even when all old markers remain', dependency => {
        const id = `${process.cwd()}/node_modules/${dependency}/dist/${dependency}.mjs`;
        const changed = `${fs.readFileSync(id, 'utf8')}\n// Upstream implementation changed.\n`;
        expect(() => specializeGlobeSource(changed, id)).toThrow(`Unreviewed ${dependency} source`);
    });

    it.each([
        { name: 'orbit', controlType: 'orbit' },
        { name: 'trackball', controlType: 'trackball' },
        { name: 'arcball', controlType: 'arcball' },
        { name: 'fly', controlType: 'fly' },
        { name: 'custom class', controlType: class CustomControls {} },
    ])('initializes only supported $name controls without substituting camera behavior', ({ controlType }) => {
        const id = `${process.cwd()}/node_modules/three-render-objects/dist/three-render-objects.mjs`;
        const result = specializeGlobeSource(fs.readFileSync(id, 'utf8'), id)!;
        const setup = result.code.slice(result.code.indexOf('// configure controls'), result.code.indexOf("if (controlType === 'fly')"));
        class OrbitControls {
            constructor(public camera: object, public element: object) {}
        }
        const state: { camera: object; renderer: { domElement: object }; controls?: OrbitControls } = {
            camera: {}, renderer: { domElement: {} },
        };
        const initialize = () => runInNewContext(setup, { state, controlType, OrbitControls });
        if (controlType === 'orbit') {
            initialize();
            expect(state.controls).toBeInstanceOf(OrbitControls);
            expect(state.controls?.camera).toBe(state.camera);
            expect(state.controls?.element).toBe(state.renderer.domElement);
        } else {
            expect(initialize).toThrow('The Flights renderer supports only orbit controls');
            expect(state.controls).toBeUndefined();
        }
    });

    it('handles normalized Windows paths and ignores unrelated modules', () => {
        const id = `${process.cwd()}/node_modules/three-globe/dist/three-globe.mjs`;
        expect(specializeGlobeSource(fs.readFileSync(id, 'utf8'), id.replaceAll('/', '\\'))).not.toBeNull();
        expect(specializeGlobeSource('export default 1', '/other/three-globe.mjs')).toBeNull();
    });
});
