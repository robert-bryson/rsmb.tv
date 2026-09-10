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
export const WEBP_QUALITY = 95;

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
                    .webp({ quality: WEBP_QUALITY })
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

    const expectedFilenames = new Set(photos.flatMap((photo) => (
        photo.derivatives.map((derivative) => derivative.filename)
    )));
    const processedFilenames = await listFiles(
        processedPath,
        (name) => path.extname(name).toLowerCase() === '.webp',
    );
    await Promise.all(processedFilenames
        .filter((filename) => !expectedFilenames.has(filename))
        .map((filename) => fs.rm(path.join(processedPath, filename))));

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

function sanitizeFeature(feature, properties = {}) {
    return {
        type: 'Feature',
        properties,
        geometry: feature.geometry,
    };
}

function trackDate(filename) {
    return path.basename(filename, path.extname(filename)).match(/\d{4}-\d{2}-\d{2}/)?.[0];
}

function lineDistanceKilometers(coordinates) {
    const earthRadiusKilometers = 6371.0088;
    const radians = (degrees) => degrees * Math.PI / 180;
    let distance = 0;

    for (let index = 1; index < coordinates.length; index++) {
        const [previousLongitude, previousLatitude] = coordinates[index - 1];
        const [longitude, latitude] = coordinates[index];
        const latitudeDelta = radians(latitude - previousLatitude);
        const longitudeDelta = radians(longitude - previousLongitude);
        const haversine = Math.sin(latitudeDelta / 2) ** 2
            + Math.cos(radians(previousLatitude)) * Math.cos(radians(latitude))
            * Math.sin(longitudeDelta / 2) ** 2;
        distance += earthRadiusKilometers * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    }

    return distance;
}

function featureDistanceKilometers(feature) {
    const lines = feature.geometry.type === 'LineString'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    return lines.reduce((total, coordinates) => total + lineDistanceKilometers(coordinates), 0);
}

function distanceSummary(distanceKilometers) {
    return {
        distanceKilometers: Math.round(distanceKilometers * 10) / 10,
        distanceMiles: Math.round(distanceKilometers * 0.6213711922),
    };
}

async function removeStaleRouteFiles(processedPath, expectedFilenames) {
    const filenames = await listFiles(
        processedPath,
        (name) => name === 'route.geojson' || (name.startsWith('track-') && name.endsWith('.geojson')),
    );

    await Promise.all(filenames
        .filter((filename) => !expectedFilenames.has(filename))
        .map((filename) => fs.rm(path.join(processedPath, filename))));
}

async function prepareRoute(tripRoot) {
    const originalsPath = path.join(tripRoot, 'gps', 'originals');
    const processedPath = path.join(tripRoot, 'gps', 'processed');
    const filenames = await listFiles(originalsPath, (name) => path.extname(name).toLowerCase() === '.gpx');

    if (filenames.length === 0) {
        await removeStaleRouteFiles(processedPath, new Set());
        return undefined;
    }

    const features = [];
    const tracks = [];
    const trackOutputs = [];
    const seenTrackIds = new Set();
    let totalDistanceKilometers = 0;
    await fs.mkdir(processedPath, { recursive: true });

    for (const [trackOrder, filename] of filenames.entries()) {
        const trackId = photoId(path.basename(filename, path.extname(filename)));
        if (seenTrackIds.has(trackId)) throw new Error(`Multiple GPX files resolve to the track ID "${trackId}".`);
        seenTrackIds.add(trackId);

        const xml = await fs.readFile(path.join(originalsPath, filename), 'utf8');
        const document = new DOMParser().parseFromString(xml, 'application/xml');
        const parsed = gpx(document);
        const date = trackDate(filename);
        const sourceTrackFeatures = parsed.features
            .filter((feature) => feature.geometry?.type === 'LineString' || feature.geometry?.type === 'MultiLineString');
        const trackDistanceKilometers = sourceTrackFeatures.reduce(
            (total, feature) => total + featureDistanceKilometers(feature),
            0,
        );
        totalDistanceKilometers += trackDistanceKilometers;
        const trackFeatures = sourceTrackFeatures
            .map((feature) => sanitizeFeature(feature, {
                trackId,
                trackOrder,
                distanceKilometers: featureDistanceKilometers(feature),
                ...(date ? { date } : {}),
            }));

        if (trackFeatures.length === 0) continue;
        features.push(...trackFeatures);
        const distance = distanceSummary(trackDistanceKilometers);

        const outputFilename = `track-${trackId}.geojson`;
        trackOutputs.push({
            filename: outputFilename,
            content: `${JSON.stringify({ type: 'FeatureCollection', features: trackFeatures })}\n`,
        });
        tracks.push({
            id: trackId,
            filename: outputFilename,
            source: filename,
            featureCount: trackFeatures.length,
            ...distance,
            ...(date ? { date } : {}),
        });
    }

    if (features.length === 0) throw new Error('GPX files did not contain any track or route geometry.');

    await removeStaleRouteFiles(
        processedPath,
        new Set(['route.geojson', ...trackOutputs.map((output) => output.filename)]),
    );
    await Promise.all(trackOutputs.map((output) => fs.writeFile(
        path.join(processedPath, output.filename),
        output.content,
    )));
    const outputPath = path.join(processedPath, 'route.geojson');
    await fs.writeFile(outputPath, `${JSON.stringify({ type: 'FeatureCollection', features })}\n`);
    const distance = distanceSummary(totalDistanceKilometers);
    return { filename: 'route.geojson', sources: filenames, featureCount: features.length, ...distance, tracks };
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
        if (report.route) {
            console.log(`Overall route: ${report.route.distanceMiles} mi / ${report.route.distanceKilometers} km`);
            for (const track of report.route.tracks) {
                console.log(`  ${track.id}: ${track.distanceMiles} mi / ${track.distanceKilometers} km`);
            }
        }
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        console.error(`\n${usage()}`);
        process.exitCode = 1;
    }
}