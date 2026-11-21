import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import icons from '../projects/ski-status/data/runtime-icons.json' with { type: 'json' };
import terrain from '../projects/ski-status/data/resort-terrain.json' with { type: 'json' };
import { skiRuntimeIconFile, skiTerrainFile } from '../shared/skiAssets.ts';

export const skiTerrainAsset = skiTerrainFile(terrain.archiveSha256);
export const skiRuntimeFiles = new Map([
    ...Object.entries(icons).map(([file, checksum]) => [skiRuntimeIconFile(file, checksum), {
        localFile: `runtime/${file}`, checksum,
    }] as const),
    [skiTerrainAsset, { localFile: skiTerrainAsset, checksum: terrain.archiveSha256 }] as const,
]);

export function skiAssetsRoot(configured = process.env.SKI_ASSETS_ROOT) {
    const nas = process.platform === 'win32' ? 'N:/projects/ski-status/assets' : '/mnt/n/projects/ski-status/assets';
    return resolve(configured?.trim() || nas);
}

export function hasSkiAsset(file: string) {
    return existsSync(resolve(skiAssetsRoot(), file));
}

export function verifySkiAsset(file: string, bytes: Buffer, digest: string) {
    if (createHash('sha256').update(bytes).digest('hex') !== digest) {
        throw new Error(`SHA-256 mismatch for ski-status asset ${file}.`);
    }
    return bytes;
}

export async function findSkiAsset(root: string, file: string) {
    try {
        const directory = await realpath(root);
        const target = await realpath(resolve(directory, file));
        const subpath = relative(directory, target);
        if (subpath && !isAbsolute(subpath) && subpath !== '..' && !subpath.startsWith(`..${sep}`)) return target;
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
    }
}

export async function readSkiAsset(root: string, file: string) {
    const path = await findSkiAsset(root, file);
    return path ? readFile(path) : undefined;
}
