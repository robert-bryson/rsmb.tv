// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { build } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { skiAssetUrl } from '../../shared/skiAssets.ts';
import { skiRuntimeFiles } from '../ski-asset-files.ts';
import { skiAssetsPlugin } from '../ski-assets-plugin.ts';

const { bytes } = vi.hoisted(() => ({ bytes: 'runtime icon test fixture' }));
vi.mock(import('../ski-asset-files.ts'), async original => {
    const { createHash } = await import('node:crypto');
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const localFile = 'runtime/pass-icons/ikon.png';
    return {
        ...await original(),
        skiRuntimeFiles: new Map([[`runtime/pass-icons/${checksum}/ikon.png`, { localFile, sha256: checksum }]]),
    };
});

const [[publicFile, { localFile }]] = skiRuntimeFiles;
const outputName = skiAssetUrl(publicFile).slice(1);
let root: string;

beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'ski-asset-build-')); });
afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(root, { recursive: true, force: true });
});

async function buildAssets(releaseUrl?: string, includeInBuild = true) {
    const result = await build({
        configFile: false,
        logLevel: 'silent',
        plugins: [skiAssetsPlugin({ root, releaseUrl, includeInBuild }), {
            name: 'ski-assets-build-fixture',
            resolveId(id) { if (id === 'entry') return id; },
            load(id) { if (id === 'entry') return 'console.log("ski assets");'; },
        }],
        build: { write: false, copyPublicDir: false, rolldownOptions: { input: 'entry' } },
    });
    if (Array.isArray(result) || !('output' in result)) throw new Error('Expected one fixture build');
    return result.output.filter(item => item.type === 'asset');
}

describe('ski-status release asset packaging', () => {
    it('publishes only indexed local assets under their versioned URLs', async () => {
        const path = join(root, localFile);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, bytes);
        await writeFile(join(dirname(path), 'unlisted.png'), 'exclude this file');
        const files = await buildAssets();
        expect(files.map(file => [file.fileName, Buffer.from(file.source).toString()])).toEqual([[outputName, bytes]]);
    });

    it('uses the same versioned path on the HTTPS mirror and emits the verified bytes', async () => {
        const fetch = vi.fn(async () => new Response(bytes));
        vi.stubGlobal('fetch', fetch);
        const files = await buildAssets('https://example.test/ski/releases');
        expect(fetch).toHaveBeenCalledExactlyOnceWith(new URL(publicFile, 'https://example.test/ski/releases/'), {
            redirect: 'error', signal: expect.any(AbortSignal),
        });
        expect(files.map(file => [file.fileName, Buffer.from(file.source).toString()])).toEqual([[outputName, bytes]]);
    });

    it('cancels an oversized mirror response before it finishes', async () => {
        const cancel = vi.fn();
        let chunks = 0;
        const body = new ReadableStream<Uint8Array>({
            pull(controller) {
                if (chunks === 2) controller.close();
                else controller.enqueue(new Uint8Array(chunks++ === 0 ? 1024 * 1024 : 1));
            },
            cancel,
        }, { highWaterMark: 0 });
        vi.stubGlobal('fetch', vi.fn(async () => new Response(body)));
        await expect(buildAssets('https://example.test/ski/')).rejects.toThrow('response exceeds the size limit');
        expect(cancel).toHaveBeenCalledOnce();
    });

    it('applies the same size budget to indexed local assets', async () => {
        const path = join(root, localFile);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, Buffer.alloc(1024 * 1024 + 1));
        await expect(buildAssets()).rejects.toThrow('exceeds the size limit');
    });

    it('allows the terrain archive to exceed the icon size budget', async () => {
        const terrainBytes = Buffer.alloc(1024 * 1024 + 1);
        const checksum = createHash('sha256').update(terrainBytes).digest('hex');
        const file = `runtime/terrain/${checksum}/resort-terrain.pmtiles`;
        skiRuntimeFiles.set(file, { localFile: file, sha256: checksum });
        try {
            vi.stubGlobal('fetch', vi.fn(async (url: URL) => new Response(url.pathname.endsWith(`/${file}`) ? terrainBytes : bytes)));
            const assets = await buildAssets('https://example.test/ski/');
            const terrain = assets.find(asset => asset.fileName === skiAssetUrl(file).slice(1));
            expect(terrain && Buffer.from(terrain.source).equals(terrainBytes)).toBe(true);
        } finally {
            skiRuntimeFiles.delete(file);
        }
    });

    it('rejects missing and corrupt input in a release build and skips fixture builds', async () => {
        await expect(buildAssets()).rejects.toThrow('Missing ski-status asset');
        await expect(buildAssets(undefined, false)).resolves.toEqual([]);
        const fetch = vi.fn(async () => new Response('changed bytes'));
        vi.stubGlobal('fetch', fetch);
        await expect(buildAssets('not a URL')).rejects.toThrow('must be an HTTPS folder URL');
        await expect(buildAssets('http://example.test/ski/')).rejects.toThrow('must be an HTTPS folder URL');
        await expect(buildAssets('https://example.test/ski/?token=test')).rejects.toThrow('must be an HTTPS folder URL');
        expect(fetch).not.toHaveBeenCalled();
        await expect(buildAssets('https://example.test/ski/')).rejects.toThrow('SHA-256 mismatch');
        fetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
        await expect(buildAssets('https://example.test/ski/')).rejects.toThrow('HTTP 404');
    });
});
