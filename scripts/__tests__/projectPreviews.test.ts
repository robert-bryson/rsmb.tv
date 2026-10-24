// @vitest-environment node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateProjectPreviews } from '../generate-project-previews.js';

const roots: string[] = [];
const projectList = [{ slug: 'sample', previewImage: '/images/sample.webp' }];

async function fixture() {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rsmb-preview-test-'));
    roots.push(repoRoot);
    const output = path.join(repoRoot, 'public/images/previews');
    const manifest = path.join(repoRoot, 'src/content/project-previews.json');
    await fs.mkdir(output, { recursive: true });
    await fs.mkdir(path.dirname(manifest), { recursive: true });
    await sharp({ create: { width: 32, height: 16, channels: 3, background: '#336699' } }).webp().toFile(path.join(repoRoot, 'public/images/sample.webp'));
    const previous = path.join(output, 'sample-480-000000000000.webp');
    await fs.writeFile(previous, 'previous preview');
    await fs.writeFile(manifest, JSON.stringify({ previous: path.basename(previous) }));
    return { repoRoot, output, manifest, previous };
}

afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe('project preview publication', () => {
    it('rejects generated previews as sources so pruning cannot delete an original', async () => {
        const { repoRoot, previous } = await fixture();
        await fs.copyFile(path.join(repoRoot, 'public/images/sample.webp'), previous);
        await fs.symlink(previous, path.join(repoRoot, 'public/images/derived-alias.webp'));
        for (const previewImage of [`/images/previews/${path.basename(previous)}`, '/images/derived-alias.webp']) {
            await expect(generateProjectPreviews({ repoRoot, projectList: [{ slug: 'sample', previewImage }] }))
                .rejects.toThrow('cannot be inside the generated directory');
        }
        expect(await fs.readFile(previous)).toEqual(await fs.readFile(path.join(repoRoot, 'public/images/sample.webp')));
    });

    it('does not truncate a published image when regenerating identical content fails', async () => {
        const { repoRoot, manifest, output } = await fixture();
        await generateProjectPreviews({ repoRoot, projectList });
        const previousManifest = await fs.readFile(manifest, 'utf8');
        const entry = JSON.parse(previousManifest)['/images/sample.webp'];
        const published = path.join(repoRoot, 'public', entry.src);
        const previousImage = await fs.readFile(published);
        const write = fs.writeFile.bind(fs);
        vi.spyOn(fs, 'writeFile').mockImplementation(async (filename, ...args) => {
            if (String(filename).includes('.webp')) {
                await write(filename, 'partial write');
                throw Object.assign(new Error('Disk full'), { code: 'ENOSPC' });
            }
            return write(filename, ...args);
        });
        await expect(generateProjectPreviews({ repoRoot, projectList })).rejects.toMatchObject({ code: 'ENOSPC' });
        expect(await fs.readFile(published)).toEqual(previousImage);
        expect(await fs.readFile(manifest, 'utf8')).toBe(previousManifest);
        expect((await fs.readdir(output)).filter(filename => filename.endsWith('.tmp'))).toEqual([]);
    });

    it('retains published files and cleans the temporary manifest when rename fails', async () => {
        const { repoRoot, manifest, previous } = await fixture();
        const original = await fs.readFile(manifest, 'utf8');
        const rename = fs.rename.bind(fs);
        vi.spyOn(fs, 'rename').mockImplementation(async (source, destination) => {
            if (destination === manifest) throw Object.assign(new Error('Rename failed'), { code: 'EIO' });
            return rename(source, destination);
        });
        await expect(generateProjectPreviews({ repoRoot, projectList })).rejects.toMatchObject({ code: 'EIO' });
        expect(await fs.readFile(manifest, 'utf8')).toBe(original);
        expect(await fs.readFile(previous, 'utf8')).toBe('previous preview');
        expect(await fs.readdir(path.dirname(manifest))).toEqual(['project-previews.json']);
    });

    it('rejects a project slug that can escape the generated directory', async () => {
        const { repoRoot } = await fixture();
        await expect(generateProjectPreviews({ repoRoot, projectList: [{ ...projectList[0], slug: '../outside' }] }))
            .rejects.toThrow('Invalid project slug');
    });

    it('rejects sources and symlinks outside the public image directory', async () => {
        const { repoRoot } = await fixture();
        const source = path.join(repoRoot, 'public/images/sample.webp');
        const privateImage = path.join(repoRoot, 'public/private.webp');
        await fs.copyFile(source, privateImage);
        await fs.symlink(privateImage, path.join(repoRoot, 'public/images/escape.webp'));
        for (const previewImage of ['/images/../private.webp', '/images/escape.webp']) {
            await expect(generateProjectPreviews({ repoRoot, projectList: [{ slug: 'sample', previewImage }] }))
                .rejects.toThrow('must be inside public/images');
        }
    });

    it.each(['/other/sample.webp', '/images/sample.webp?size=1', '/images/sample.webp#fragment'])('rejects non-file image URLs: %s', async previewImage => {
        const { repoRoot } = await fixture();
        await expect(generateProjectPreviews({ repoRoot, projectList: [{ slug: 'sample', previewImage }] }))
            .rejects.toThrow('Invalid project preview path');
    });

    it('retains the published manifest and images when writing its replacement fails', async () => {
        const { repoRoot, manifest, previous } = await fixture();
        const original = await fs.readFile(manifest, 'utf8');
        const write = fs.writeFile.bind(fs);
        vi.spyOn(fs, 'writeFile').mockImplementation(async (filename, ...args) => {
            if (String(filename).includes('project-previews.json')) throw Object.assign(new Error('Disk full'), { code: 'ENOSPC' });
            return write(filename, ...args);
        });
        await expect(generateProjectPreviews({ repoRoot, projectList })).rejects.toMatchObject({ code: 'ENOSPC' });
        expect(await fs.readFile(manifest, 'utf8')).toBe(original);
        expect(await fs.readFile(previous, 'utf8')).toBe('previous preview');
    });

    it('writes decodable previews without enlargement and removes obsolete generated files', async () => {
        const { repoRoot, manifest, output, previous } = await fixture();
        await fs.writeFile(path.join(output, 'keep-me.txt'), 'user file');
        expect(await generateProjectPreviews({ repoRoot, projectList })).toEqual({ files: 1, projects: 1 });
        const entry = JSON.parse(await fs.readFile(manifest, 'utf8'))['/images/sample.webp'];
        expect(entry).toMatchObject({ width: 32, height: 16, srcSet: expect.stringMatching(/32w$/) });
        const metadata = await sharp(path.join(repoRoot, 'public', entry.src)).metadata();
        expect(metadata).toMatchObject({ format: 'webp', width: 32, height: 16 });
        await expect(fs.access(previous)).rejects.toMatchObject({ code: 'ENOENT' });
        expect(await fs.readFile(path.join(output, 'keep-me.txt'), 'utf8')).toBe('user file');
    });
});
