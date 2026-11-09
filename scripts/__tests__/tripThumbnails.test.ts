// @vitest-environment node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateTripThumbnails } from '../generate-trip-thumbnails.js';
import fixtureManifest from '../../tests/fixtures/trip-content/trips/coastal-test.json';

const roots: string[] = [];
afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

async function fixture(width = 960) {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'trip-thumbnails-test-'));
    roots.push(repoRoot);
    const manifest = structuredClone(fixtureManifest);
    const hero = manifest.photos.find(photo => photo.id === manifest.hero)!;
    hero.src = `https://data.rsmb.tv/trips/${manifest.id}/photos/hero.webp`;
    const source = path.join(repoRoot, 'public/data/trips', manifest.id, 'photos/hero.webp');
    const content = path.join(repoRoot, 'src/content');
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.mkdir(path.join(repoRoot, 'public/images'), { recursive: true });
    await fs.mkdir(path.join(content, 'trips'), { recursive: true });
    await sharp({ create: { width, height: width / 2, channels: 3, background: '#336699' } }).webp().toFile(source);
    const manifestPath = path.join(content, 'trips', `${manifest.id}.json`);
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    await fs.writeFile(path.join(content, 'posts.json'), JSON.stringify([
        { format: 'trip', tripId: manifest.id },
        { format: 'trip', tripId: 'unpublished', development: { published: false } },
    ]));
    return { repoRoot, source, hero, manifest, manifestPath, registry: path.join(content, 'trip-thumbnails.json'), output: path.join(repoRoot, 'public/images/trip-thumbnails') };
}

describe('trip card thumbnails', () => {
    it('publishes an empty registry without requiring a local media cache', async () => {
        const { repoRoot, registry } = await fixture();
        await fs.writeFile(path.join(repoRoot, 'src/content/posts.json'), '[]');
        await fs.rm(path.join(repoRoot, 'public/data'), { recursive: true });
        expect(await generateTripThumbnails({ repoRoot })).toEqual({ files: 0, trips: 0 });
        expect(JSON.parse(await fs.readFile(registry, 'utf8'))).toEqual({});
    });
    it('publishes decodable small responsive images and omits unpublished trips', async () => {
        const { repoRoot, hero, registry } = await fixture();
        expect(await generateTripThumbnails({ repoRoot })).toEqual({ files: 2, trips: 1 });
        const images = JSON.parse(await fs.readFile(registry, 'utf8'));
        expect(Object.keys(images)).toEqual([hero.src]);
        const image = images[hero.src];
        expect(image).toMatchObject({ width: 320, height: 160 });
        const variants = image.srcSet.split(', ');
        expect(variants.map((variant: string) => variant.split(' ')[1])).toEqual(['160w', '320w']);
        for (const [index, variant] of variants.entries()) {
            const metadata = await sharp(path.join(repoRoot, 'public', variant.split(' ')[0])).metadata();
            expect(metadata).toMatchObject({ format: 'webp', width: [160, 320][index] });
        }
        const previous = await fs.readFile(registry, 'utf8');
        await generateTripThumbnails({ repoRoot });
        expect(await fs.readFile(registry, 'utf8')).toBe(previous);
    });

    it('does not enlarge small originals and creates new URLs when their content changes', async () => {
        const { repoRoot, source, hero, registry } = await fixture(64);
        expect(await generateTripThumbnails({ repoRoot })).toEqual({ files: 1, trips: 1 });
        const before = JSON.parse(await fs.readFile(registry, 'utf8'))[hero.src];
        expect(before).toMatchObject({ width: 64, height: 32 });
        await sharp({ create: { width: 64, height: 32, channels: 3, background: '#993366' } }).webp().toFile(source);
        await generateTripThumbnails({ repoRoot });
        const after = JSON.parse(await fs.readFile(registry, 'utf8'))[hero.src];
        expect(after.src).not.toBe(before.src);
        await expect(fs.access(path.join(repoRoot, 'public', before.src))).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('retains the published registry and image when a source is missing', async () => {
        const { repoRoot, source, hero, registry } = await fixture();
        await generateTripThumbnails({ repoRoot });
        const before = await fs.readFile(registry, 'utf8');
        const image = path.join(repoRoot, 'public', JSON.parse(before)[hero.src].src);
        const bytes = await fs.readFile(image);
        await fs.unlink(source);
        await expect(generateTripThumbnails({ repoRoot })).rejects.toMatchObject({ code: 'ENOENT' });
        expect(await fs.readFile(registry, 'utf8')).toBe(before);
        expect(await fs.readFile(image)).toEqual(bytes);
    });

    it.each([null, {}, [null], ['invalid'], [[]]])('rejects malformed post registries without replacing published references: %j', async posts => {
        const { repoRoot, registry } = await fixture();
        await generateTripThumbnails({ repoRoot });
        const previous = await fs.readFile(registry, 'utf8');
        await fs.writeFile(path.join(repoRoot, 'src/content/posts.json'), JSON.stringify(posts));
        await expect(generateTripThumbnails({ repoRoot })).rejects.toThrow('The post registry must be an array of post objects.');
        expect(await fs.readFile(registry, 'utf8')).toBe(previous);
    });

    it.each([undefined, '../private'])('rejects missing or unsafe trip IDs before reading their manifests: %s', async tripId => {
        const { repoRoot } = await fixture();
        await fs.writeFile(path.join(repoRoot, 'src/content/posts.json'), JSON.stringify([{ format: 'trip', tripId }]));
        await expect(generateTripThumbnails({ repoRoot })).rejects.toThrow('Invalid trip ID');
    });

    it('rejects a manifest with an ID that differs from its filename', async () => {
        const { repoRoot, manifest, manifestPath } = await fixture();
        manifest.id = 'another-trip';
        await fs.writeFile(manifestPath, JSON.stringify(manifest));
        await expect(generateTripThumbnails({ repoRoot })).rejects.toThrow('Manifest id must match filename');
    });

    it.each([
        'not a URL',
        'https://other.example/trips/coastal-test/photos/hero.webp',
        'https://data.rsmb.tv/trips/another-trip/photos/hero.webp',
        'https://data.rsmb.tv/trips/coastal-test/photos/hero.webp?token=private-value',
        'https://data.rsmb.tv/trips/coastal-test/photos/hero.webp#fragment',
        'https://user:private-value@data.rsmb.tv/trips/coastal-test/photos/hero.webp',
    ])('rejects noncanonical source URLs without logging credentials or query values: %s', async src => {
        const { repoRoot, hero, manifest, manifestPath } = await fixture();
        hero.src = src;
        await fs.writeFile(manifestPath, JSON.stringify(manifest));
        const error = await generateTripThumbnails({ repoRoot }).catch(error => error as Error);
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('use a data.rsmb.tv HTTPS photo URL');
        expect(error.message).not.toContain('private-value');
    });

    it('rejects source symlinks that escape the media directory', async () => {
        const { repoRoot, source } = await fixture();
        const outside = path.join(repoRoot, 'private.webp');
        await fs.rename(source, outside);
        await fs.symlink(outside, source);
        await expect(generateTripThumbnails({ repoRoot })).rejects.toThrow('Trip hero must be inside public/data/trips.');
        expect(await sharp(outside).metadata()).toMatchObject({ width: 960 });
    });

    it('rejects an output symlink before writing or removing files', async () => {
        const { repoRoot, output, registry } = await fixture();
        await generateTripThumbnails({ repoRoot });
        const before = await fs.readFile(registry, 'utf8');
        const outside = path.join(repoRoot, 'preserved-images');
        await fs.rename(output, outside);
        await fs.symlink(outside, output);
        const files = await fs.readdir(outside);
        await expect(generateTripThumbnails({ repoRoot })).rejects.toThrow('output directory must not be a symbolic link');
        expect(await fs.readdir(outside)).toEqual(files);
        expect(await fs.readFile(registry, 'utf8')).toBe(before);
    });

    it('removes obsolete generated files after publication and retains unrelated files', async () => {
        const { repoRoot, output } = await fixture();
        await generateTripThumbnails({ repoRoot });
        const obsolete = path.join(output, 'coastal-test-160-000000000000.webp');
        await fs.writeFile(obsolete, 'obsolete');
        await fs.writeFile(path.join(output, 'keep.txt'), 'keep');
        await generateTripThumbnails({ repoRoot });
        await expect(fs.access(obsolete)).rejects.toMatchObject({ code: 'ENOENT' });
        expect(await fs.readFile(path.join(output, 'keep.txt'), 'utf8')).toBe('keep');
    });

    it('retains published images and cleans temporary files after a failed image write', async () => {
        const { repoRoot, registry, output, hero } = await fixture();
        await generateTripThumbnails({ repoRoot });
        const before = await fs.readFile(registry, 'utf8');
        const image = path.join(repoRoot, 'public', JSON.parse(before)[hero.src].src);
        const bytes = await fs.readFile(image);
        const write = fs.writeFile.bind(fs);
        vi.spyOn(fs, 'writeFile').mockImplementation(async (filename, ...args) => {
            if (String(filename).includes('.webp')) {
                await write(filename, 'partial image');
                throw Object.assign(new Error('Disk full'), { code: 'ENOSPC' });
            }
            return write(filename, ...args);
        });
        await expect(generateTripThumbnails({ repoRoot })).rejects.toMatchObject({ code: 'ENOSPC' });
        expect(await fs.readFile(registry, 'utf8')).toBe(before);
        expect(await fs.readFile(image)).toEqual(bytes);
        expect((await fs.readdir(output)).some(name => name.endsWith('.tmp'))).toBe(false);
    });

    it('retains the previous registry and obsolete images when the registry rename fails', async () => {
        const { repoRoot, registry, output } = await fixture();
        await generateTripThumbnails({ repoRoot });
        const before = await fs.readFile(registry, 'utf8');
        const obsolete = path.join(output, 'coastal-test-160-000000000000.webp');
        await fs.writeFile(obsolete, 'previous image');
        const rename = fs.rename.bind(fs);
        vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
            if (to === registry) throw Object.assign(new Error('Rename failed'), { code: 'EIO' });
            return rename(from, to);
        });
        await expect(generateTripThumbnails({ repoRoot })).rejects.toMatchObject({ code: 'EIO' });
        expect(await fs.readFile(registry, 'utf8')).toBe(before);
        expect(await fs.readFile(obsolete, 'utf8')).toBe('previous image');
        expect((await fs.readdir(path.dirname(registry))).some(name => name.endsWith('.tmp'))).toBe(false);
    });
});
