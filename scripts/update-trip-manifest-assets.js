#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tripManifestSchema } from '../shared/tripManifestSchema.ts';
import { hasMatchingImageAspectRatio } from '../shared/responsiveImage.ts';

function isPreparedImage(image) {
    return image !== null && typeof image === 'object' && typeof image.filename === 'string'
        && Number.isSafeInteger(image.width) && image.width > 0
        && Number.isSafeInteger(image.height) && image.height > 0
        && (image.bytes === undefined || Number.isSafeInteger(image.bytes) && image.bytes > 0);
}

function sortedPreparedImages(images, message) {
    if (!Array.isArray(images) || !images.every(isPreparedImage)) throw new Error(message);
    return [...images].sort((a, b) => a.width - b.width);
}

export function updateManifestAssets(manifest, report) {
    if (manifest.id !== report.tripId) throw new Error('Asset report and manifest trip IDs must match.');
    const authored = tripManifestSchema.parse(manifest);
    if (!Array.isArray(report.photos)) throw new Error('Invalid prepared photo report: photos must be an array.');
    const preparedPhotos = new Map();
    for (const photo of report.photos) {
        if (!photo || typeof photo.id !== 'string') throw new Error('Invalid prepared photo report: each photo needs an ID.');
        if (preparedPhotos.has(photo.id)) throw new Error(`Duplicate prepared photo: ${photo.id}.`);
        preparedPhotos.set(photo.id, photo);
    }
    const photos = authored.photos.map(photo => {
        const prepared = preparedPhotos.get(photo.id);
        if (!prepared || Array.isArray(prepared.derivatives) && prepared.derivatives.length === 0) throw new Error(`Missing prepared photo: ${photo.id}`);
        const derivativeError = `Invalid prepared derivative for photo: ${photo.id}. Prepare assets with the current pipeline before updating the manifest.`;
        const derivatives = sortedPreparedImages(prepared.derivatives, derivativeError);
        const widths = new Set();
        let fingerprint;
        for (const image of derivatives) {
            const match = image.filename.match(new RegExp(`^${photo.id}-([a-f0-9]{12})-${image.width}\\.webp$`));
            if (widths.has(image.width)
                || !match || (fingerprint !== undefined && match[1] !== fingerprint)) {
                throw new Error(derivativeError);
            }
            widths.add(image.width);
            fingerprint = match[1];
        }
        const base = `https://data.rsmb.tv/trips/${manifest.id}/photos/`;
        const largest = derivatives.at(-1);
        if (derivatives.some(image => !hasMatchingImageAspectRatio(image, largest))) throw new Error(derivativeError);
        const full = prepared.full;
        if (full && (!isPreparedImage(full) || !new RegExp(`^${photo.id}-${fingerprint}-full\\.(?:jpg|png)$`).test(full.filename)
            || full.width < largest.width || full.height < largest.height || !hasMatchingImageAspectRatio(largest, full))) {
            throw new Error(`Invalid prepared full-resolution photo: ${photo.id}.`);
        }
        if (report.photoPipelineVersion >= 3 && !full) throw new Error(`Missing prepared full-resolution photo: ${photo.id}.`);
        let viewerSrcSet;
        if (full?.derivatives !== undefined || report.photoPipelineVersion >= 4) {
            if (!Array.isArray(full?.derivatives)) throw new Error(`Missing prepared viewer derivatives for photo: ${photo.id}.`);
            const viewerError = `Invalid prepared viewer derivative for photo: ${photo.id}.`;
            const viewerImages = sortedPreparedImages(full.derivatives, viewerError);
            const viewerWidths = new Set();
            const extension = path.extname(full.filename);
            for (const image of viewerImages) {
                if (image.width >= full.width || image.height > full.height
                    || !hasMatchingImageAspectRatio(image, full)
                    || viewerWidths.has(image.width)
                    || image.filename !== `${photo.id}-${fingerprint}-view-${image.width}${extension}`) {
                    throw new Error(viewerError);
                }
                viewerWidths.add(image.width);
            }
            // A larger native image can compress better than a resized version.
            // Offer it directly when resizing provides no download savings.
            const usefulImages = viewerImages.filter(image => image.bytes === undefined || full.bytes === undefined || image.bytes < full.bytes);
            viewerSrcSet = [...usefulImages, full].map(image => `${base}${image.filename} ${image.width}w`).join(', ');
        }
        // A legacy report must not retain a full image from a different revision.
        const authoredPhoto = { ...photo };
        delete authoredPhoto.full;
        return { ...authoredPhoto, src: base + largest.filename, width: largest.width, height: largest.height,
            srcSet: derivatives.map(image => `${base}${image.filename} ${image.width}w`).join(', '),
            ...(full ? { full: { src: base + full.filename, width: full.width, height: full.height,
                ...(viewerSrcSet ? { srcSet: viewerSrcSet } : {}) } } : {}) };
    });
    return tripManifestSchema.parse({ ...authored, photos });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const [tripId, flag, source] = args;
    if (args.length !== 3 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tripId ?? '')
        || flag !== '--source' || !source || source.startsWith('-')) {
        throw new Error('Usage: node scripts/update-trip-manifest-assets.js <trip-id> --source <prepared-trip-directory>');
    }
    const manifestPath = path.resolve('src/content/trips', `${tripId}.json`);
    const updated = updateManifestAssets(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), JSON.parse(fs.readFileSync(path.join(source, 'asset-metadata.json'), 'utf8')));
    fs.writeFileSync(manifestPath, `${JSON.stringify(updated, null, 2)}\n`);
    console.log(`Updated ${updated.photos.length} photo URLs in ${manifestPath}. Publish the prepared assets before deploying the manifest.`);
}
