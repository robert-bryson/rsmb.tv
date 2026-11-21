// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Connect, ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { skiArchiveAssetUrl, skiArchiveIndexUrl, type SkiArchiveTrailMap } from '../../shared/skiArchive.ts';
import { skiAssetsRoute, skiAssetUrl } from '../../shared/skiAssets.ts';
import { passIconUrls } from '../../src/features/ski-status/passIcons.ts';
import { skiRuntimeFiles, skiTerrainAsset, verifySkiAsset } from '../ski-asset-files.ts';
import { skiAssetsPlugin } from '../ski-assets-plugin.ts';

const archive = Buffer.from('0123456789');
const pdf = Buffer.from('%PDF-1.7');
const trailMap = 'trail-maps/test-area/undated/Trail Map.pdf';
const fields = {
    areaId: 'test-area', source: 'https://example.test/map.pdf', checkedOn: '2026-11-21',
    sha256: createHash('sha256').update(pdf).digest('hex'), byteCount: pdf.length,
};
const map = { ...fields, kind: 'trail map', relativePath: trailMap, edition: 'undated', coverage: 'Downhill runs' } satisfies SkiArchiveTrailMap;
let directory: string;
let assetsRoot: string;
let server: Server;
let origin: string;

beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ski-assets-test-'));
    assetsRoot = join(directory, 'nas');
    for (const [name, bytes] of [[skiTerrainAsset, archive], [trailMap, pdf], ['trail-maps/test-area/undated/Unlisted.pdf', pdf],
        ['manifests/private.json', '{}'], ['runtime/resort-icons/unlisted.png', 'unlisted']] as const) {
        const file = join(assetsRoot, name);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, bytes);
    }
    await writeFile(join(directory, 'outside.pdf'), pdf);
    await symlink(directory, join(assetsRoot, 'trail-maps', 'outside'), 'junction');
    let middleware: Connect.NextHandleFunction | undefined;
    const plugin = skiAssetsPlugin({ root: assetsRoot, includeInBuild: false });
    const configure = plugin.configureServer;
    if (typeof configure !== 'function') throw new Error('Ski asset middleware is unavailable.');
    await configure({ middlewares: { use: (handler: Connect.NextHandleFunction) => { middleware = handler; } } } as ViteDevServer);
    const handle = middleware;
    if (!handle) throw new Error('Ski asset middleware was not registered.');
    server = createServer((request, response) => handle(request, response, error => response.writeHead(error ? 500 : 404).end()));
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Ski asset server did not bind a port.');
    origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
    if (server?.listening) {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
    if (directory) await rm(directory, { recursive: true, force: true });
});

describe('NAS ski-status assets', () => {
    it('keeps all pass images in the runtime index and verifies release bytes', () => {
        for (const url of Object.values(passIconUrls)) {
            const entry = skiRuntimeFiles.get(url.slice(skiAssetsRoute.length));
            expect(entry?.checksum).toMatch(/^[a-f0-9]{64}$/);
            expect(url).toContain(`/${entry?.checksum}/`);
        }
        const checksum = createHash('sha256').update(archive).digest('hex');
        expect(verifySkiAsset(skiTerrainAsset, archive, checksum)).toBe(archive);
        expect(() => verifySkiAsset(skiTerrainAsset, pdf, checksum)).toThrow('SHA-256 mismatch');
    });

    it('discovers new manifest files and selects the newest available icon for each use', async () => {
        const url = origin + skiArchiveIndexUrl;
        const read = async () => {
            const response = await fetch(url);
            expect(response.status).toBe(200);
            expect(response.headers.get('cache-control')).toBe('no-store');
            return response.json();
        };
        expect(await read()).toEqual([]);
        const pdfUrl = origin + skiArchiveAssetUrl(map);
        expect((await fetch(pdfUrl)).status).toBe(404);
        const icon = (kind: 'map icon' | 'icon variant', sourceSha256: string) => ({
            ...fields, kind, sourceSha256, relativePath: `resort-icons/test-area/${sourceSha256}/map-40.png`,
        });
        const original = icon('map icon', 'a'.repeat(64));
        const replacement = icon('icon variant', 'b'.repeat(64));
        for (const variant of [original, replacement]) {
            const path = join(assetsRoot, variant.relativePath);
            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, pdf);
        }
        const writeManifest = (hour: string, files: unknown[]) => writeFile(join(assetsRoot, 'manifests', `run-${hour}.json`),
            JSON.stringify({ version: 1, archivedAt: `2026-11-21T${hour}:00:00Z`, files, location: 'private archive location' }));
        await writeManifest('12', [map, original]);
        expect(await read()).toEqual([map, original]);
        const response = await fetch(pdfUrl);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('application/pdf');
        expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(Buffer.from(await response.arrayBuffer())).toEqual(pdf);
        const head = await fetch(pdfUrl, { method: 'HEAD' });
        expect(head.headers.get('content-length')).toBe(String(pdf.length));
        expect(await head.text()).toBe('');
        await writeManifest('13', [
            { ...replacement, review: 'private review note' },
            { ...map, areaId: 'wrong-area' },
            { ...map, edition: '2026/27' },
            { ...map, source: 'https://example.test/unavailable.pdf', relativePath: 'trail-maps/test-area/undated/missing.pdf' },
            { ...map, source: 'https://example.test/incomplete.pdf', byteCount: pdf.length + 1 },
            { ...map, relativePath: 'trail-maps/test-area/../outside.pdf' },
        ]);
        expect(await read()).toEqual([replacement, map]);
        await rm(join(assetsRoot, replacement.relativePath));
        expect(await read()).toEqual([map, original]);
    });

    it('limits archive access to the indexed version on the local origin', async () => {
        const pdfUrl = origin + skiArchiveAssetUrl(map);
        for (const site of ['same-site', 'cross-site']) {
            for (const url of [origin + skiArchiveIndexUrl, pdfUrl]) {
                const rejected = await fetch(url, { headers: { 'Sec-Fetch-Site': site } });
                expect(rejected.status).toBe(404);
            }
        }
        for (const path of [
            skiAssetUrl(trailMap), skiArchiveAssetUrl({ ...map, sha256: 'c'.repeat(64) }),
            skiArchiveAssetUrl({ ...map, relativePath: 'trail-maps/test-area/undated/Unlisted.pdf' }),
        ]) {
            expect((await fetch(origin + path)).status, path).toBe(404);
        }
        const unsupported = await fetch(pdfUrl, { method: 'POST' });
        expect(unsupported.status).toBe(405);
        expect(unsupported.headers.get('allow')).toBe('GET, HEAD');
    });

    it.each([
        ['bytes=0-0', 'bytes 0-0/10', '0'],
        ['bytes=3-99', 'bytes 3-9/10', '3456789'],
        ['bytes=7-', 'bytes 7-9/10', '789'],
        ['bytes=-2', 'bytes 8-9/10', '89'],
    ])('serves %s from the terrain archive', async (range, contentRange, bytes) => {
        const response = await fetch(origin + skiAssetUrl(skiTerrainAsset) + '?retry=1', { headers: { Range: range } });
        expect(response.status).toBe(206);
        expect(response.headers.get('content-range')).toBe(contentRange);
        expect(response.headers.get('accept-ranges')).toBe('bytes');
        expect(await response.text()).toBe(bytes);
    });

    it('rejects an unsatisfiable range and keeps unrelated and escaped files private', async () => {
        const range = await fetch(origin + skiAssetUrl(skiTerrainAsset), { headers: { Range: 'bytes=20-25' } });
        expect(range.status).toBe(416);
        expect(range.headers.get('content-range')).toBe('bytes */10');
        for (const path of [
            skiAssetUrl('runtime/resort-icons/unlisted.png'),
            skiAssetUrl('manifests/private.json'),
            skiAssetUrl('trail-maps/outside/outside.pdf'),
            `${skiAssetsRoute}trail-maps/..%2Foutside.pdf`,
        ]) {
            expect((await fetch(origin + path)).status, path).toBe(404);
        }
    });
});
