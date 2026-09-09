#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';
import { gpx } from '@tmcw/togeojson';
import sharp from 'sharp';

const TRIP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PHOTO_EXTENSIONS = new Set(['.avif', '.heic', '.heif', '.jpeg', '.jpg', '.png', '.tif', '.tiff', '.webp']);
const WIDTHS = [480, 960, 1600];

export function parseArgs(args) {
    const options = { force: false };

    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === '--force') {
            options.force = true;
        } else if (argument === '--source') {
            const source = args[++index];
            if (!source || source.startsWith('-')) {
                throw new Error('--source requires a directory path.');
            }
            if (options.source) throw new Error('--source may only be specified once.');
            options.source = source;
        } else if (argument.startsWith('-')) {
            throw new Error(`Unknown option: ${argument}`);
        } else if (!options.tripId) {
            options.tripId = argument;
        } else {
            throw new Error(`Unexpected argument: ${argument}`);
        }
    }

    if (!options.tripId || !TRIP_ID_PATTERN.test(options.tripId)) {
        throw new Error('Trip ID is required and must contain only lowercase letters, numbers, and hyphens.');
    }
    if (!options.source) {
        throw new Error('--source must point to the locally synced Drive trip directory.');
    }

    return options;
}

export function photoId(filename) {
    const id = path.basename(filename, path.extname(filename))
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    if (!id) throw new Error(`Cannot create a photo ID from ${filename}.`);
    return id;
}

async function listFiles(directory, predicate) {
    try {
        return (await fs.readdir(directory, { withFileTypes: true }))
            .filter((entry) => entry.isFile() && predicate(entry.name))
            .map((entry) => entry.name)
            .sort((left, right) => left.localeCompare(right));
    } catch (error) {
        if (error?.code === 'ENOENT') return [];
        throw error;
    }
}

async function preparePhotos(tripRoot, force) {
    const selectsPath = path.join(tripRoot, 'photos', 'selects');
    const processedPath = path.join(tripRoot, 'photos', 'processed');
    const filenames = await listFiles(selectsPath, (name) => PHOTO_EXTENSIONS.has(path.extname(name).toLowerCase()));
    const seenIds = new Set();
    const photos = [];

    await fs.mkdir(processedPath, { recursive: true });

    for (const filename of filenames) {
        const id = photoId(filename);
        if (seenIds.has(id)) throw new Error(`Multiple selected photos resolve to the ID "${id}".`);
        seenIds.add(id);

        const inputPath = path.join(selectsPath, filename);
        const source = sharp(inputPath, { failOn: 'warning' }).rotate();
        const metadata = await source.metadata();
        const orientedWidth = metadata.autoOrient?.width ?? metadata.width;
        if (!orientedWidth) throw new Error(`Could not read dimensions for ${filename}.`);

        const derivatives = [];
        for (const width of WIDTHS.filter((candidate) => candidate < orientedWidth).concat(orientedWidth)) {
            const outputWidth = Math.min(width, 1600);
            if (derivatives.some((item) => item.width === outputWidth)) continue;

            const outputName = `${id}-${outputWidth}.webp`;
            const outputPath = path.join(processedPath, outputName);
            if (force || !(await exists(outputPath))) {
                await sharp(inputPath)
                    .rotate()
                    .resize({ width: outputWidth, withoutEnlargement: true })
                    .webp({ quality: outputWidth === 1600 ? 84 : 82 })
                    .toFile(outputPath);
            }

            const outputMetadata = await sharp(outputPath).metadata();
            derivatives.push({
                filename: outputName,
                width: outputMetadata.width,
                height: outputMetadata.height,
            });
        }

        photos.push({ id, source: filename, derivatives });
    }

    return photos;
}

async function exists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function sanitizeFeature(feature) {
    return {
        type: 'Feature',
        properties: {},
        geometry: feature.geometry,
    };
}

async function prepareRoute(tripRoot) {
    const originalsPath = path.join(tripRoot, 'gps', 'originals');
    const processedPath = path.join(tripRoot, 'gps', 'processed');
    const filenames = await listFiles(originalsPath, (name) => path.extname(name).toLowerCase() === '.gpx');

    if (filenames.length === 0) return undefined;

    const features = [];
    for (const filename of filenames) {
        const xml = await fs.readFile(path.join(originalsPath, filename), 'utf8');
        const document = new DOMParser().parseFromString(xml, 'application/xml');
        const parsed = gpx(document);
        features.push(...parsed.features
            .filter((feature) => feature.geometry?.type === 'LineString' || feature.geometry?.type === 'MultiLineString')
            .map(sanitizeFeature));
    }

    if (features.length === 0) throw new Error('GPX files did not contain any track or route geometry.');

    await fs.mkdir(processedPath, { recursive: true });
    const outputPath = path.join(processedPath, 'route.geojson');
    await fs.writeFile(outputPath, `${JSON.stringify({ type: 'FeatureCollection', features })}\n`);
    return { filename: 'route.geojson', sources: filenames, featureCount: features.length };
}

export async function prepareTripAssets({ tripId, source, force = false }) {
    const tripRoot = path.resolve(source);
    const [photos, route] = await Promise.all([
        preparePhotos(tripRoot, force),
        prepareRoute(tripRoot),
    ]);

    if (photos.length === 0 && !route) {
        throw new Error(`No selected photos or original GPX files found under ${tripRoot}.`);
    }

    const report = {
        tripId,
        generatedAt: new Date().toISOString(),
        photos,
        route,
    };
    const reportPath = path.join(tripRoot, 'asset-metadata.json');
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return report;
}

function usage() {
    return [
        'Usage: npm run prepare-trip-assets -- <trip-id> --source <local-trip-directory> [--force]',
        '',
        'Reads photos/selects and gps/originals, then writes publishable files to',
        'photos/processed and gps/processed. Existing image derivatives are reused',
        'unless --force is supplied.',
    ].join('\n');
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
    try {
        const options = parseArgs(process.argv.slice(2));
        const report = await prepareTripAssets(options);
        console.log(`Prepared ${report.photos.length} photo(s) and ${report.route ? 1 : 0} route for ${options.tripId}.`);
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        console.error(`\n${usage()}`);
        process.exitCode = 1;
    }
}