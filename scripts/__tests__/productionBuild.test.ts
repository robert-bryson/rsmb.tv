// @vitest-environment node
import { SourceMap } from 'node:module';
import { gzipSync } from 'node:zlib';
import fs from 'node:fs';
import { build, type InlineConfig } from 'vite';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllEnvs());

async function checkedBuild(config: InlineConfig) {
    const warnings: unknown[] = [];
    const result = await build({
        ...config, logLevel: 'silent',
        build: {
            ...config.build,
            write: false,
            rolldownOptions: {
                ...config.build?.rolldownOptions,
                onwarn(warning) {
                    // Host-load timing hints vary when the coverage workers run concurrently.
                    if (warning.code !== 'PLUGIN_TIMINGS') warnings.push(warning);
                },
            },
        },
    });
    if (warnings.length) throw new Error(`Production build emitted unexpected warnings: ${JSON.stringify(warnings)}`);
    return result;
}

it('rejects actual source-map diagnostics, including their pluginCode field', async () => {
    await expect(checkedBuild({
        configFile: false,
        plugins: [{
            name: 'source-map-warning-fixture',
            resolveId(id) { if (id === 'virtual:warning') return '\0virtual:warning'; },
            load(id) { if (id === '\0virtual:warning') return 'export default 1;'; },
            transform(_code, id) {
                if (id === '\0virtual:warning') this.warn({ code: 'SOURCEMAP_BROKEN', message: 'Sourcemap is likely to be incorrect: fixture' });
            },
        }],
        build: { rolldownOptions: { input: 'virtual:warning' } },
    })).rejects.toThrow(/SOURCEMAP_BROKEN/);
});

it('keeps the WebGL build within budget and maps production errors to the original source', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const result = await checkedBuild({ mode: 'trip-test' });
    if (Array.isArray(result) || !('output' in result)) throw new Error('Expected one application bundle');
    const chunks = result.output.filter(item => item.type === 'chunk');
    const flights = chunks.find(chunk => chunk.name === 'FlightsMap');
    expect(flights).toBeDefined();
    expect(Buffer.byteLength(flights!.code, 'utf8')).toBeLessThan(1_400_000);
    expect(gzipSync(flights!.code, { level: 6 }).length).toBeLessThan(400_000);
    expect(chunks.flatMap(chunk => Object.keys(chunk.modules)).filter(id => /three\.(webgpu|tsl)\.js$/.test(id))).toEqual([]);

    // globe.gl currently exposes only the WebGL renderer. An upstream change requires adapter review.
    expect(fs.readFileSync('node_modules/globe.gl/dist/globe.gl.mjs', 'utf8')).not.toContain('useWebGPU');
    const message = 'Route request timed out. Please try again.';
    const route = chunks.find(chunk => chunk.code.includes(message));
    expect(route).toBeDefined();
    const mapAsset = result.output.find(item => item.type === 'asset' && item.fileName === `${route!.fileName}.map`);
    if (!mapAsset || mapAsset.type !== 'asset') throw new Error('Missing production source map');
    const offset = route!.code.indexOf(message);
    const prefix = route!.code.slice(0, offset);
    const entry = new SourceMap(JSON.parse(String(mapAsset.source))).findEntry(prefix.split('\n').length - 1, offset - prefix.lastIndexOf('\n') - 1);
    expect(entry.originalSource).toMatch(/useTripRoute\.ts$/);
    const original = fs.readFileSync('src/features/trips/useTripRoute.ts', 'utf8').split('\n')[entry.originalLine];
    expect(original).toContain(message);
}, 30_000);
