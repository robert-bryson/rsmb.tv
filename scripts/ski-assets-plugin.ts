import { createHash } from 'node:crypto';
import { createReadStream, type BigIntStats } from 'node:fs';
import { open, type FileHandle } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname } from 'node:path';
import { buffer } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import type { Connect, Plugin } from 'vite';
import { readResponseBytes } from '../shared/readResponseBytes.ts';
import { skiArchiveIndexUrl, type SkiArchiveAsset } from '../shared/skiArchive.ts';
import { isSkiAssetPathSegment, skiAssetsRoute, skiAssetUrl } from '../shared/skiAssets.ts';
import { readSkiArchiveIndex } from './ski-archive-index.ts';
import { findSkiAsset, skiRuntimeFiles, verifySkiAsset } from './ski-asset-files.ts';

const assetTypes = new Map([
    ['.avif', 'image/avif'], ['.ico', 'image/x-icon'], ['.jpeg', 'image/jpeg'], ['.jpg', 'image/jpeg'],
    ['.pdf', 'application/pdf'], ['.pmtiles', 'application/octet-stream'], ['.png', 'image/png'], ['.webp', 'image/webp'],
]);
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const maxIconBytes = 1024 * 1024;
const maxTerrainBytes = 64 * 1024 * 1024;

function runtimeAssetLimit(file: string) {
    return file.endsWith('.pmtiles') ? maxTerrainBytes : maxIconBytes;
}

function assetFile(path: string) {
    try {
        const parts = path.split('/').map(decodeURIComponent);
        if (parts.every(isSkiAssetPathSegment)) return parts.join('/');
    } catch {
        return undefined;
    }
}

function byteRange(header: string, size: number) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(header);
    if (!match || (!match[1] && !match[2])) return;
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = Math.min(match[1] && match[2] ? Number(match[2]) : size - 1, size - 1);
    if (Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end) return { start, end };
}

type AssetVersion = { sha256: string; localFile: string } | Pick<SkiArchiveAsset, 'sha256' | 'byteCount'>;
type AssetChecks = WeakMap<AssetVersion, { identity: string; valid: Promise<boolean> }>;

function fileIdentity({ dev, ino, size, mtimeNs, ctimeNs }: BigIntStats) {
    return `${dev}:${ino}:${size}:${mtimeNs}:${ctimeNs}`;
}

async function checkChecksum(file: FileHandle, size: number, sha256: string) {
    const hash = createHash('sha256');
    const chunk = Buffer.allocUnsafe(Math.min(1024 * 1024, size));
    let offset = 0;
    while (offset < size) {
        const length = Math.min(chunk.length, size - offset);
        const { bytesRead } = await file.read(chunk, 0, length, offset);
        if (bytesRead === 0) return false;
        hash.update(chunk.subarray(0, bytesRead));
        offset += bytesRead;
    }
    return hash.digest('hex') === sha256;
}

async function verifyFile(file: FileHandle, stats: BigIntStats, version: AssetVersion, checks: AssetChecks) {
    const identity = fileIdentity(stats);
    let check = checks.get(version);
    if (check?.identity !== identity) {
        check = { identity, valid: checkChecksum(file, Number(stats.size), version.sha256) };
        checks.set(version, check);
    }
    try {
        // Check the open file again after the checksum, then serve from the same handle.
        return await check.valid && fileIdentity(await file.stat({ bigint: true })) === identity;
    } catch (error) {
        if (checks.get(version) === check) checks.delete(version);
        throw error;
    }
}

async function serveFile(request: IncomingMessage, response: ServerResponse, path: string, type: string,
    checks: AssetChecks, version: AssetVersion) {
    const file = await open(path, 'r');
    try {
        const stats = await file.stat({ bigint: true });
        const size = Number(stats.size);
        const sizeMatches = 'byteCount' in version ? stats.size === BigInt(version.byteCount)
            : size > 0 && size <= runtimeAssetLimit(version.localFile);
        if (!stats.isFile() || !sizeMatches || !(await verifyFile(file, stats, version, checks))) {
            response.writeHead(404).end();
            return;
        }
        const range = request.headers.range;
        const positions = range ? byteRange(range, size) : undefined;
        if (range && !positions) {
            response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
            return;
        }
        response.setHeader('Content-Type', type);
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Accept-Ranges', 'bytes');
        if (positions) {
            const { start, end } = positions;
            response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
            response.setHeader('Content-Length', end - start + 1);
            response.writeHead(206);
        } else {
            response.writeHead(200, { 'Content-Length': size });
        }
        if (request.method === 'HEAD') response.end();
        else await pipeline(file.createReadStream({ ...positions, autoClose: false }), response);
    } finally {
        await file.close();
    }
}

function serveSkiAssets(root: string): Connect.NextHandleFunction {
    let archiveRequest: ReturnType<typeof readSkiArchiveIndex> | undefined;
    let archiveFiles = new Map<string, SkiArchiveAsset>();
    const checks: AssetChecks = new WeakMap();
    function refreshArchive() {
        archiveRequest ??= readSkiArchiveIndex(root).then(index => {
            archiveFiles = new Map(index.map(asset => [`${asset.relativePath}:${asset.sha256}`, asset]));
            return index;
        }).finally(() => { archiveRequest = undefined; });
        return archiveRequest;
    }
    return (request, response, next) => {
        const [path, query] = (request.url ?? '').split('?', 2);
        if (!path.startsWith(skiAssetsRoute)) return next();
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { Allow: 'GET, HEAD' }).end();
            return;
        }
        const site = request.headers['sec-fetch-site'];
        const local = loopback.has(request.socket.remoteAddress ?? '') && site !== 'cross-site' && site !== 'same-site';
        if (path === skiArchiveIndexUrl && local) {
            void refreshArchive().then(index => {
                response.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
                    'Cross-Origin-Resource-Policy': 'same-origin',
                }).end(request.method === 'HEAD' ? undefined : JSON.stringify(index));
            }).catch(next);
            return;
        }
        const file = assetFile(path.slice(skiAssetsRoute.length));
        const type = file && assetTypes.get(extname(file).toLowerCase());
        const runtime = file ? skiRuntimeFiles.get(file) : undefined;
        const version = local ? new URLSearchParams(query).get('v') : null;
        const archiveKey = file && version && /^[a-f0-9]{64}$/.test(version) && /^(?:trail-maps|resort-icons)\//.test(file)
            ? `${file}:${version}` : undefined;
        if (!file || !type || (!runtime && !archiveKey)) {
            response.writeHead(404).end();
            return;
        }
        void (async () => {
            if (archiveKey && !archiveFiles.has(archiveKey)) await refreshArchive();
            const asset = runtime ?? (archiveKey ? archiveFiles.get(archiveKey) : undefined);
            const path = asset && await findSkiAsset(root, runtime?.localFile ?? file);
            if (path && asset) await serveFile(request, response, path, type, checks, asset);
            else response.writeHead(404).end();
        })().catch(error => {
            if (response.destroyed) return;
            if (response.headersSent) response.destroy(error);
            else if ((error as NodeJS.ErrnoException).code === 'ENOENT') response.writeHead(404).end();
            else next(error);
        });
    };
}

function releaseAssetBase(configured: string | undefined) {
    if (!configured?.trim()) return;
    const url = URL.parse(configured.trim());
    if (url?.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
        throw new Error('SKI_ASSETS_BASE_URL must be an HTTPS folder URL without credentials, a query, or a fragment.');
    }
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url;
}

async function loadReleaseAsset(root: string, base: URL | undefined, file: string, localFile: string) {
    const limit = runtimeAssetLimit(file);
    const label = `Ski-status asset ${file}`;
    const path = await findSkiAsset(root, localFile);
    if (path) {
        // The end offset is inclusive. Read one extra byte to detect overflow.
        const bytes = await buffer(createReadStream(path, { end: limit }));
        if (bytes.length > limit) throw new Error(`${label} exceeds the size limit`);
        return bytes;
    }
    if (!base) {
        throw new Error(`Missing ski-status asset ${localFile}. Mount the NAS, set SKI_ASSETS_ROOT, or configure SKI_ASSETS_BASE_URL for this build.`);
    }
    const response = await fetch(new URL(file, base), { redirect: 'error', signal: AbortSignal.timeout(30_000) });
    const bytes = await readResponseBytes(response, limit, label);
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function skiAssetsPlugin({ root, releaseUrl, includeInBuild }: { root: string; releaseUrl?: string; includeInBuild: boolean }): Plugin {
    return {
        name: 'ski-status-assets',
        configureServer(server) {
            server.middlewares.use(serveSkiAssets(root));
        },
        async buildStart() {
            if (!includeInBuild) return;
            const base = releaseAssetBase(releaseUrl);
            await Promise.all([...skiRuntimeFiles].map(async ([file, { localFile, sha256 }]) => {
                const source = verifySkiAsset(file, await loadReleaseAsset(root, base, file, localFile), sha256);
                this.emitFile({ type: 'asset', fileName: skiAssetUrl(file).slice(1), source });
            }));
        },
    };
}
