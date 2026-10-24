import MagicString from 'magic-string';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

const reviewedSources = {
    'three-globe': 'b33b85fa0065a9bfa0e465bc2f773dc1a5a6496981b0818fd8517707a7b92501',
    'three-render-objects': '4cb4d816ed01f12cc02d9cbc8a93e17c4f762d2f7576c90dbbdc6ce2cad9da48',
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
    }
    return { code: output.toString(), map: output.generateMap({ source: id, includeContent: true, hires: true }) };
}

/** Use WebGL rendering and the existing CPU heatmap fallback. This site does not use GPU heatmaps. */
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
