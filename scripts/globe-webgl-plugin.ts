import MagicString from 'magic-string';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

const reviewedSources = {
    'three-globe': 'b33b85fa0065a9bfa0e465bc2f773dc1a5a6496981b0818fd8517707a7b92501',
    'three-render-objects': '72ffcdc853ea1b5a150e960c1c766d6581341b1441d50203a53a4028c0475e91',
} as const;

export function specializeGlobeSource(code: string, id: string) {
    const normalizedId = id.replaceAll('\\', '/');
    const dependency = (Object.keys(reviewedSources) as Array<keyof typeof reviewedSources>)
        .find(name => normalizedId.endsWith(`/${name}/dist/${name}.mjs`));
    if (!dependency) return null;
    // Marker matches alone cannot detect a changed algorithm behind the same interface.
    if (createHash('sha256').update(code).digest('hex') !== reviewedSources[dependency]) {
        throw new Error(`Unreviewed ${dependency} source. Review the upstream changes and WebGL adapter before updating its approved hash.`);
    }
    const output = new MagicString(code);
    if (dependency === 'three-globe') {
        const kernelStart = code.indexOf('const computeGeoKde = async ');
        const kernelEnd = code.indexOf('  return kdeVals;\n};', kernelStart);
        output.overwrite(kernelStart, kernelEnd + '  return kdeVals;\n};'.length,
            'const computeGeoKde = async (coords, data = [], options = {}) => coords.map(point => getGeoKDE(point, data, options));');
        for (const statement of [
            "import { StorageInstancedBufferAttribute, WebGPURenderer } from 'three/webgpu';",
            "import * as tsl from 'three/tsl';",
        ]) {
            const start = code.indexOf(statement);
            output.remove(start, start + statement.length);
        }
    } else {
        const selection = 'useWebGPU ? WebGPURenderer : three.WebGLRenderer';
        const gpuImport = "import { WebGPURenderer } from 'three/webgpu';";
        const start = code.indexOf(selection);
        const importStart = code.indexOf(gpuImport);
        output.overwrite(start, start + selection.length, 'three.WebGLRenderer');
        output.remove(importStart, importStart + gpuImport.length);
        const controls = `state.controls = new (isClass(controlType) ? controlType : {
      trackball: TrackballControls,
      arcball: ArcballControls,
      orbit: OrbitControls,
      fly: FlyControls
    }[controlType])`;
        const controlsStart = code.indexOf(controls);
        output.overwrite(controlsStart, controlsStart + controls.length,
            `if (controlType !== 'orbit') throw new Error('The Flights renderer supports only orbit controls');
    state.controls = new OrbitControls`);
        for (const control of ['Trackball', 'Arcball', 'Fly']) {
            const statement = `import { ${control}Controls } from 'three/addons/controls/${control}Controls.js';`;
            const controlImportStart = code.indexOf(statement);
            output.remove(controlImportStart, controlImportStart + statement.length);
        }
    }
    return { code: output.toString(), map: output.generateMap({ source: id, includeContent: true, hires: true }) };
}

/** Use WebGL, orbit controls, and the CPU heatmap fallback required by this site. */
export function globeWebglPlugin(): Plugin {
    return {
        name: 'globe-webgl',
        transform: {
            filter: { id: /\/(?:three-render-objects\/dist\/three-render-objects|three-globe\/dist\/three-globe)\.mjs$/ },
            handler(code, id) {
                return specializeGlobeSource(code, id);
            },
        },
    };
}
