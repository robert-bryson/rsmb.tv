#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tripManifestSchema } from '../shared/tripManifestSchema.ts';

export function updateManifestAssets(manifest, report) {
    if (manifest.id !== report.tripId) throw new Error('Asset report and manifest trip IDs must match.');
    const photos = manifest.photos.map(photo => {
        const prepared = report.photos.find(candidate => candidate.id === photo.id);
        if (!prepared?.derivatives?.length) throw new Error(`Missing prepared photo: ${photo.id}`);
        const derivatives = [...prepared.derivatives].sort((a, b) => a.width - b.width);
        const widths = new Set();
        for (const image of derivatives) {
            if (!Number.isInteger(image.width) || image.width <= 0
                || !Number.isInteger(image.height) || image.height <= 0
                || widths.has(image.width)
                || typeof image.filename !== 'string'
                || !new RegExp(`^${photo.id}-[a-f0-9]{12}-${image.width}\\.webp$`).test(image.filename)) {
                throw new Error(`Invalid prepared derivative for photo: ${photo.id}. Prepare assets with the current pipeline before updating the manifest.`);
            }
            widths.add(image.width);
        }
        const base = `https://data.rsmb.tv/trips/${manifest.id}/photos/`;
        const largest = derivatives.at(-1);
        return { ...photo, src: base + largest.filename, width: largest.width, height: largest.height,
            srcSet: derivatives.map(image => `${base}${image.filename} ${image.width}w`).join(', ') };
    });
    return tripManifestSchema.parse({ ...manifest, photos });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [tripId, flag, source] = process.argv.slice(2);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tripId ?? '') || flag !== '--source' || !source) throw new Error('Usage: node scripts/update-trip-manifest-assets.js <trip-id> --source <prepared-trip-directory>');
    const manifestPath = path.resolve('src/content/trips', `${tripId}.json`);
    const updated = updateManifestAssets(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), JSON.parse(fs.readFileSync(path.join(source, 'asset-metadata.json'), 'utf8')));
    fs.writeFileSync(manifestPath, `${JSON.stringify(updated, null, 2)}\n`);
    console.log(`Updated ${updated.photos.length} photo URLs in ${manifestPath}. Publish the prepared assets before deploying the manifest.`);
}
