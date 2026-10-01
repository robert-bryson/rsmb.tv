// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { copyTripAsset } from '../copy-trip-asset.js';

const tempDirs: string[] = [];
async function createRoot() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'copy-trip-'));
    tempDirs.push(root);
    return root;
}

afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(tempDirs.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })));
});

it.each(['EACCES', 'ENOSPC', 'EIO'])('propagates %s without replacing the destination', async (code) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'copy-trip-'));
    tempDirs.push(root);
    const source = path.join(root, 'source.webp');
    const destination = path.join(root, 'destination.webp');
    await fs.writeFile(source, 'new');
    await fs.writeFile(destination, 'old');
    const error = Object.assign(new Error('Copy failed'), { code });
    vi.spyOn(fs, 'copyFile').mockRejectedValue(error);
    await expect(copyTripAsset(source, destination)).rejects.toBe(error);
    expect(await fs.readFile(destination, 'utf8')).toBe('old');
});

it('propagates a failed fallback write', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'copy-trip-'));
    tempDirs.push(root);
    const source = path.join(root, 'source.webp');
    await fs.writeFile(source, 'photo');
    vi.spyOn(fs, 'copyFile').mockRejectedValue(Object.assign(new Error('Copy unsupported'), { code: 'EPERM' }));
    await expect(copyTripAsset(source, path.join(root, 'missing', 'destination.webp')))
        .rejects.toMatchObject({ code: 'ENOENT' });
});

it('copies binary data with the native operation', async () => {
    const root = await createRoot();
    const source = path.join(root, 'source.webp');
    const destination = path.join(root, 'destination.webp');
    const contents = Buffer.from([0, 255, 128, 42]);
    await fs.writeFile(source, contents);
    await copyTripAsset(source, destination);
    expect(await fs.readFile(destination)).toEqual(contents);
});

it.each(['EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS', 'EXDEV'])('copies binary data with the %s fallback', async (code) => {
    const root = await createRoot();
    const source = path.join(root, 'source.webp');
    const destination = path.join(root, 'destination.webp');
    const contents = Buffer.from([0, 255, 128, 42]);
    await fs.writeFile(source, contents);
    await fs.writeFile(destination, 'old');
    vi.spyOn(fs, 'copyFile').mockRejectedValue(Object.assign(new Error('Copy unsupported'), { code }));
    await copyTripAsset(source, destination);
    expect(await fs.readFile(destination)).toEqual(contents);
    expect((await fs.readdir(root)).sort()).toEqual(['destination.webp', 'source.webp']);
});

it('preserves the destination when the fallback cannot read the source', async () => {
    const root = await createRoot();
    const destination = path.join(root, 'destination.webp');
    await fs.writeFile(destination, 'old');
    vi.spyOn(fs, 'copyFile').mockRejectedValue(Object.assign(new Error('Copy unsupported'), { code: 'EPERM' }));
    await expect(copyTripAsset(path.join(root, 'missing.webp'), destination)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(destination, 'utf8')).toBe('old');
    expect(await fs.readdir(root)).toEqual(['destination.webp']);
});

it('does not truncate the source when the fallback copies a file onto itself', async () => {
    const root = await createRoot();
    const source = path.join(root, 'source.webp');
    await fs.writeFile(source, 'photo');
    vi.spyOn(fs, 'copyFile').mockRejectedValue(Object.assign(new Error('Copy unsupported'), { code: 'EPERM' }));
    await copyTripAsset(source, source);
    expect(await fs.readFile(source, 'utf8')).toBe('photo');
    expect(await fs.readdir(root)).toEqual(['source.webp']);
});

it('retains the destination and removes the temporary file when fallback replacement fails', async () => {
    const root = await createRoot();
    const source = path.join(root, 'source.webp');
    const destination = path.join(root, 'destination.webp');
    await fs.writeFile(source, 'new');
    await fs.writeFile(destination, 'old');
    vi.spyOn(fs, 'copyFile').mockRejectedValue(Object.assign(new Error('Copy unsupported'), { code: 'EPERM' }));
    const error = Object.assign(new Error('Replacement failed'), { code: 'EIO' });
    vi.spyOn(fs, 'rename').mockRejectedValue(error);
    await expect(copyTripAsset(source, destination)).rejects.toBe(error);
    expect(await fs.readFile(destination, 'utf8')).toBe('old');
    expect((await fs.readdir(root)).sort()).toEqual(['destination.webp', 'source.webp']);
});
