import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { tripManifestSchema } from '../shared/tripManifestSchema.ts';
import { writeAtomically } from './atomic-write.js';

const root = fileURLToPath(new URL('../', import.meta.url));

function heroUrl(source, id) {
    const invalid = () => new Error(`Trip ${id}: use a data.rsmb.tv HTTPS photo URL without credentials, a query, or a fragment.`);
    let url;
    try { url = new URL(source); } catch { throw invalid(); }
    if (url.origin !== 'https://data.rsmb.tv' || url.username || url.password
        || !url.pathname.startsWith(`/trips/${id}/photos/`) || url.search || url.hash) throw invalid();
    return url;
}

/** Bundle small card images; article and gallery photos keep their CDN sources. */
export async function generateTripThumbnails({ repoRoot = root } = {}) {
    const contentRoot = path.join(repoRoot, 'src/content');
    const posts = JSON.parse(await fs.readFile(path.join(contentRoot, 'posts.json'), 'utf8'));
    if (!Array.isArray(posts) || posts.some(post => !post || typeof post !== 'object' || Array.isArray(post))) {
        throw new Error('The post registry must be an array of post objects.');
    }
    const tripIds = new Set(posts.filter(post => post.format === 'trip' && post.development?.published !== false).map(post => post.tripId));
    const imageRoot = await fs.realpath(path.join(repoRoot, 'public/images'));
    const directory = path.join(imageRoot, 'trip-thumbnails');
    await fs.mkdir(directory, { recursive: true });
    if ((await fs.lstat(directory)).isSymbolicLink()) throw new Error('Trip thumbnail output directory must not be a symbolic link.');
    const mediaRoot = tripIds.size ? await fs.realpath(path.join(repoRoot, 'public/data/trips')) : undefined;
    const thumbnails = {};
    const generated = new Set();
    for (const id of [...tripIds].sort()) {
        if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Invalid trip ID: ${id}`);
        const manifest = tripManifestSchema.parse(JSON.parse(await fs.readFile(path.join(contentRoot, 'trips', `${id}.json`), 'utf8')));
        if (manifest.id !== id) throw new Error(`Manifest id must match filename: ${id}`);
        const hero = manifest.photos.find(photo => photo.id === manifest.hero);
        const url = heroUrl(hero.src, id);
        const sourceFile = await fs.realpath(path.join(mediaRoot, url.pathname.slice('/trips/'.length)));
        if (!sourceFile.startsWith(`${mediaRoot}${path.sep}`)) throw new Error('Trip hero must be inside public/data/trips.');
        const input = await fs.readFile(sourceFile);
        const { width } = await sharp(input).metadata();
        if (!width) throw new Error(`Trip hero has no image dimensions: ${hero.src}`);
        const variants = [];
        for (const size of [...new Set([160, 320].map(size => Math.min(size, width)))]) {
            const { data, info } = await sharp(input).resize({ width: size, withoutEnlargement: true }).webp({ quality: 75, effort: 6 }).toBuffer({ resolveWithObject: true });
            const fingerprint = createHash('sha256').update(data).digest('hex').slice(0, 12);
            const filename = `${id}-${size}-${fingerprint}.webp`;
            await writeAtomically(path.join(directory, filename), data);
            generated.add(filename);
            variants.push({ src: `/images/trip-thumbnails/${filename}`, width: info.width, height: info.height });
        }
        thumbnails[hero.src] = {
            ...variants.at(-1),
            srcSet: variants.map(variant => `${variant.src} ${variant.width}w`).join(', '),
        };
    }
    await writeAtomically(path.join(contentRoot, 'trip-thumbnails.json'), `${JSON.stringify(thumbnails, null, 2)}\n`);
    for (const filename of await fs.readdir(directory)) {
        if (/^[a-z0-9-]+-\d+-[a-f0-9]{12}\.webp$/.test(filename) && !generated.has(filename)) await fs.unlink(path.join(directory, filename));
    }
    return { files: generated.size, trips: tripIds.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await generateTripThumbnails();
    console.log(`Generated ${result.files} responsive thumbnails for ${result.trips} trips.`);
}
