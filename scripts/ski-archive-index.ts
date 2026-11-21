import { readdir, stat } from 'node:fs/promises';
import { z } from 'zod';
import { isoTime } from '../src/features/ski-status/schemas.ts';
import { skiArchiveAsset, skiArchiveIconVariant, type SkiArchiveAsset } from '../shared/skiArchive.ts';
import { findSkiAsset, readSkiAsset } from './ski-asset-files.ts';

const manifestSchema = z.object({ version: z.literal(1), archivedAt: isoTime, files: z.array(z.unknown()) });

function ignoreMissingFile(error: NodeJS.ErrnoException) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
}

async function readManifest(root: string, name: string) {
    const bytes = await readSkiAsset(root, `manifests/${name}`).catch(ignoreMissingFile);
    if (!bytes) return;
    let raw: unknown;
    try {
        raw = JSON.parse(bytes.toString('utf8'));
    } catch {
        // A batch can still be writing a new manifest.
        return;
    }
    return manifestSchema.safeParse(raw).data;
}

function archiveKey(asset: SkiArchiveAsset) {
    return asset.kind === 'trail map'
        ? `${asset.areaId}:map:${asset.edition}:${asset.source}`
        : `${asset.areaId}:${skiArchiveIconVariant(asset.relativePath)}`;
}

export async function readSkiArchiveIndex(root: string) {
    const directory = await findSkiAsset(root, 'manifests');
    if (!directory) return [];
    const files = await readdir(directory, { withFileTypes: true }).catch(ignoreMissingFile) ?? [];
    const manifests = (await Promise.all(files.filter(file => file.isFile() && file.name.endsWith('.json'))
        .sort((a, b) => b.name.localeCompare(a.name)).map(file => readManifest(root, file.name))))
        .filter(manifest => manifest !== undefined)
        .sort((a, b) => Date.parse(b.archivedAt) - Date.parse(a.archivedAt));
    const candidates = manifests.flatMap(({ files }) => files.map(file => skiArchiveAsset.safeParse(file).data)
        .filter(file => file !== undefined));
    const available = await Promise.all(candidates.map(async asset => {
        const filename = await findSkiAsset(root, asset.relativePath);
        const stats = filename && await stat(filename).catch(ignoreMissingFile);
        return stats && stats.isFile() && stats.size === asset.byteCount ? asset : undefined;
    }));
    const index = new Map<string, SkiArchiveAsset>();
    for (const asset of available) {
        if (!asset) continue;
        const key = archiveKey(asset);
        if (!index.has(key)) index.set(key, asset);
    }
    return [...index.values()];
}
