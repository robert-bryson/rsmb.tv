#!/usr/bin/env node

import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { featureDistanceKilometers } from '../shared/routeGeometry.ts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';
import { gpx } from '@tmcw/togeojson';
import sharp from 'sharp';
import simplify from 'simplify-js';
import { copyTripAsset } from './copy-trip-asset.js';

const TRIP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PHOTO_EXTENSIONS = new Set(['.avif', '.heic', '.heif', '.jpeg', '.jpg', '.png', '.tif', '.tiff', '.webp']);
const WIDTHS = [480, 960, 1600];
export const WEBP_QUALITY = 84;
export const PHOTO_PIPELINE_VERSION = 2;
export const DEFAULT_ROUTE_SIMPLIFICATION_TOLERANCE_METERS = 5;

export function parseArgs(args) {
    const options = { force: false, routeToleranceMeters: DEFAULT_ROUTE_SIMPLIFICATION_TOLERANCE_METERS };

    let hasRouteTolerance = false;

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
        } else if (argument === '--route-tolerance') {
            if (hasRouteTolerance) throw new Error('--route-tolerance may only be specified once.');
            hasRouteTolerance = true;
            const value = args[++index];
            const routeToleranceMeters = Number(value);
            if (!value?.trim() || !Number.isFinite(routeToleranceMeters) || routeToleranceMeters < 0) {
                throw new Error('--route-tolerance requires a non-negative number of meters.');
            }
            options.routeToleranceMeters = routeToleranceMeters;
        } else if (argument.startsWith('-')) {
            throw new Error(`Unknown option: ${argument}`);
        } else if (!options.tripId) {
            options.tripId = argument;
        } else {
            throw new Error(`Unexpected argument: ${argument}`);
        }
    }

    validateTripId(options.tripId);
    if (!options.source) {
        throw new Error('--source must point to the locally synced Drive trip directory.');
    }

    return options;
}

function validateTripId(tripId) {
    if (typeof tripId !== 'string' || !TRIP_ID_PATTERN.test(tripId)) {
        throw new Error('Trip ID is required and must contain only lowercase letters, numbers, and hyphens.');
    }
}

function parseGpx(xml, filename) {
    try {
        const document = new DOMParser({
            onError: (_level, message) => { throw new Error(message); },
        }).parseFromString(xml, 'application/xml');
        if (document.documentElement?.tagName !== 'gpx') {
            throw new Error('Expected a GPX document root.');
        }
        // The converter uses parseFloat and silently skips invalid points. Check the
        // original attributes first so conversion cannot bridge an invalid point.
        const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
        for (const tag of ['trkpt', 'rtept']) {
            for (const point of Array.from(document.getElementsByTagName(tag))) {
                for (const [attribute, limit] of [['lon', 180], ['lat', 90]]) {
                    const value = point.getAttribute(attribute)?.trim() ?? '';
                    if (!decimal.test(value) || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > limit) {
                        throw new Error(`Invalid coordinate: ${tag} ${attribute}.`);
                    }
                }
            }
        }
        return gpx(document);
    } catch (error) {
        throw new Error(`${filename}: ${error.message}`, { cause: error });
    }
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
            .sort();
    } catch (error) {
        if (error?.code === 'ENOENT') return [];
        throw error;
    }
}

async function removeUnexpectedFiles(directory, expectedFilenames, predicate) {
    const filenames = await listFiles(directory, predicate);
    await Promise.all(filenames
        .filter((filename) => !expectedFilenames.has(filename))
        .map((filename) => fs.rm(path.join(directory, filename))));
}

async function preparePhotos(tripRoot, force, filenames) {
    const selectsPath = path.join(tripRoot, 'photos', 'selects');
    const processedPath = path.join(tripRoot, 'photos', 'processed');
    const seenIds = new Set();
    const selectedPhotos = [];
    const photos = [];

    for (const filename of filenames) {
        const id = photoId(filename);
        if (seenIds.has(id)) throw new Error(`Multiple selected photos resolve to the ID "${id}".`);
        seenIds.add(id);
        selectedPhotos.push({ filename, id });
    }

    await fs.mkdir(processedPath, { recursive: true });

    for (const { filename, id } of selectedPhotos) {
        const inputPath = path.join(selectsPath, filename);
        const fingerprint = createHash('sha256').update(await fs.readFile(inputPath)).update(JSON.stringify({ version: PHOTO_PIPELINE_VERSION, quality: WEBP_QUALITY, widths: WIDTHS, sharp: sharp.versions.sharp })).digest('hex').slice(0, 12);
        const source = sharp(inputPath, { failOn: 'warning' }).rotate();
        const metadata = await source.metadata();
        const orientedWidth = metadata.autoOrient?.width ?? metadata.width;
        if (!orientedWidth) throw new Error(`Could not read dimensions for ${filename}.`);

        const derivatives = [];
        for (const width of WIDTHS.filter((candidate) => candidate < orientedWidth).concat(orientedWidth)) {
            const outputWidth = Math.min(width, 1600);
            if (derivatives.some((item) => item.width === outputWidth)) continue;

            const outputName = `${id}-${fingerprint}-${outputWidth}.webp`;
            const legacyFilename = `${id}-${outputWidth}.webp`;
            const outputPath = path.join(processedPath, outputName);
            if (force || !(await exists(outputPath))) {
                await sharp(inputPath)
                    .rotate()
                    .resize({ width: outputWidth, withoutEnlargement: true })
                    .webp({ quality: WEBP_QUALITY })
                    .toFile(outputPath);
            }

            // Compatibility alias for existing manifests; versioned names are used by the manifest update command.
            await copyTripAsset(outputPath, path.join(processedPath, legacyFilename));
            const outputMetadata = await sharp(outputPath).metadata();
            derivatives.push({
                filename: outputName,
                legacyFilename,
                bytes: (await fs.stat(outputPath)).size,
                width: outputMetadata.width,
                height: outputMetadata.height,
            });
        }

        photos.push({ id, source: filename, fingerprint, derivatives });
    }

    const expectedFilenames = new Set(photos.flatMap((photo) => (
        photo.derivatives.flatMap((derivative) => [derivative.filename, derivative.legacyFilename])
    )));
    await removeUnexpectedFiles(
        processedPath,
        expectedFilenames,
        (name) => path.extname(name).toLowerCase() === '.webp' && !/-[a-f0-9]{12}-\d+\.webp$/.test(name),
    );

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

function cleanLine(coordinates) {
    const cleaned = [];
    for (const position of coordinates) {
        if (!Array.isArray(position)) throw new Error('GPX route contains an invalid coordinate.');
        const [longitude, latitude] = position;
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)
            || longitude < -180 || longitude > 180
            || latitude < -90 || latitude > 90) {
            throw new Error('GPX route contains an invalid coordinate.');
        }
        const previous = cleaned.at(-1);
        if (!previous || previous[0] !== longitude || previous[1] !== latitude) {
            cleaned.push([longitude, latitude]);
        }
    }
    if (cleaned.length < 2) throw new Error('GPX route segment must contain at least two distinct coordinates.');
    return cleaned;
}

function cleanFeature(feature) {
    return {
        ...feature,
        geometry: feature.geometry.type === 'LineString'
            ? { type: 'LineString', coordinates: cleanLine(feature.geometry.coordinates) }
            : { type: 'MultiLineString', coordinates: feature.geometry.coordinates.map(cleanLine) },
    };
}

function simplifyLine(coordinates, toleranceMeters) {
    const referenceLatitude = coordinates.reduce((total, [, latitude]) => total + latitude, 0) / coordinates.length;
    const latitudeScale = Math.cos(referenceLatitude * Math.PI / 180);
    const earthRadiusMeters = 6378137;
    let previousLongitude = coordinates[0][0];
    let unwrappedLongitude = previousLongitude;
    const projected = coordinates.map((position) => {
        const delta = position[0] - previousLongitude;
        // Keep adjacent points near each other across +180/-180 degrees.
        unwrappedLongitude += delta > 180 ? delta - 360 : delta < -180 ? delta + 360 : delta;
        previousLongitude = position[0];
        return {
            x: earthRadiusMeters * unwrappedLongitude * Math.PI / 180 * latitudeScale,
            y: earthRadiusMeters * position[1] * Math.PI / 180,
            position,
        };
    });
    const positions = toleranceMeters === 0
        ? coordinates
        : simplify(projected, toleranceMeters, true).map(({ position }) => position);
    const rounded = roundLine(positions);
    // A large tolerance can reduce a closed loop to its identical endpoints.
    // Retain the original line if simplification would destroy its geometry.
    const output = rounded.length >= 2 ? rounded : roundLine(coordinates);
    if (output.length < 2) throw new Error('GPX route segment is too short after coordinate rounding.');
    return output;
}

function roundLine(coordinates) {
    const rounded = [];
    for (const position of coordinates) {
        const coordinate = position.map((value) => Number(value.toFixed(6)));
        const previous = rounded.at(-1);
        if (!previous || previous[0] !== coordinate[0] || previous[1] !== coordinate[1]) {
            rounded.push(coordinate);
        }
    }
    return rounded;
}

function simplifyGeometry(geometry, toleranceMeters) {
    return geometry.type === 'LineString'
        ? { type: 'LineString', coordinates: simplifyLine(geometry.coordinates, toleranceMeters) }
        : { type: 'MultiLineString', coordinates: geometry.coordinates.map((line) => simplifyLine(line, toleranceMeters)) };
}

function geometryPointCount(geometry) {
    return geometry.type === 'LineString'
        ? geometry.coordinates.length
        : geometry.coordinates.reduce((total, line) => total + line.length, 0);
}

function sanitizeFeature(feature, properties = {}, toleranceMeters = DEFAULT_ROUTE_SIMPLIFICATION_TOLERANCE_METERS) {
    return {
        type: 'Feature',
        properties,
        geometry: simplifyGeometry(feature.geometry, toleranceMeters),
    };
}

function trackDate(filename) {
    return path.basename(filename, path.extname(filename)).match(/\d{4}-\d{2}-\d{2}/)?.[0];
}

function distanceSummary(distanceKilometers) {
    return {
        distanceKilometers: Math.round(distanceKilometers * 10) / 10,
        distanceMiles: Math.round(distanceKilometers * 0.6213711922),
    };
}

async function removeStaleRouteFiles(processedPath, expectedFilenames) {
    await removeUnexpectedFiles(
        processedPath,
        expectedFilenames,
        (name) => name === 'route.geojson' || (name.startsWith('track-') && name.endsWith('.geojson')),
    );
}

async function buildRoute(tripRoot, routeToleranceMeters) {
    const originalsPath = path.join(tripRoot, 'gps', 'originals');
    const filenames = await listFiles(originalsPath, (name) => path.extname(name).toLowerCase() === '.gpx');

    if (filenames.length === 0) {
        return { route: undefined, outputs: [] };
    }

    const features = [];
    const tracks = [];
    const trackOutputs = [];
    const seenTrackIds = new Set();
    let totalDistanceKilometers = 0;
    let originalPointCount = 0;
    let outputPointCount = 0;
    for (const [trackOrder, filename] of filenames.entries()) {
        const trackId = photoId(path.basename(filename, path.extname(filename)));
        if (seenTrackIds.has(trackId)) throw new Error(`Multiple GPX files resolve to the track ID "${trackId}".`);
        seenTrackIds.add(trackId);

        const xml = await fs.readFile(path.join(originalsPath, filename), 'utf8');
        const parsed = parseGpx(xml, filename);
        const date = trackDate(filename);
        const parsedTrackFeatures = parsed.features
            .filter((feature) => feature.geometry?.type === 'LineString' || feature.geometry?.type === 'MultiLineString');
        const trackOriginalPointCount = parsedTrackFeatures.reduce(
            (total, feature) => total + geometryPointCount(feature.geometry),
            0,
        );
        const sourceTrackFeatures = parsedTrackFeatures.map(cleanFeature);
        const trackDistanceKilometers = sourceTrackFeatures.reduce(
            (total, feature) => total + featureDistanceKilometers(feature),
            0,
        );
        totalDistanceKilometers += trackDistanceKilometers;
        originalPointCount += trackOriginalPointCount;
        const trackFeatures = sourceTrackFeatures
            .map((feature) => sanitizeFeature(feature, {
                trackId,
                trackOrder,
                distanceKilometers: featureDistanceKilometers(feature),
                ...(date ? { date } : {}),
            }, routeToleranceMeters));

        if (trackFeatures.length === 0) throw new Error(`${filename}: GPX file did not contain any track or route geometry.`);
        features.push(...trackFeatures);
        const trackOutputPointCount = trackFeatures.reduce(
            (total, feature) => total + geometryPointCount(feature.geometry),
            0,
        );
        outputPointCount += trackOutputPointCount;
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
            originalPointCount: trackOriginalPointCount,
            outputPointCount: trackOutputPointCount,
            ...distance,
            ...(date ? { date } : {}),
        });
    }

    const distance = distanceSummary(totalDistanceKilometers);
    const route = {
        filename: 'route.geojson',
        sources: filenames,
        featureCount: features.length,
        originalPointCount,
        outputPointCount,
        simplificationToleranceMeters: routeToleranceMeters,
        ...distance,
        tracks,
    };
    return {
        route,
        outputs: [...trackOutputs, {
            filename: 'route.geojson',
            content: `${JSON.stringify({ type: 'FeatureCollection', features })}\n`,
        }],
    };
}

async function writeRoute(tripRoot, outputs) {
    const processedPath = path.join(tripRoot, 'gps', 'processed');
    await fs.mkdir(processedPath, { recursive: true });
    for (const { filename, content } of outputs) {
        await fs.writeFile(path.join(processedPath, filename), content);
    }
    await removeStaleRouteFiles(processedPath, new Set(outputs.map(({ filename }) => filename)));
}

export async function prepareTripAssets({
    tripId,
    source,
    force = false,
    routeToleranceMeters = DEFAULT_ROUTE_SIMPLIFICATION_TOLERANCE_METERS,
}) {
    validateTripId(tripId);
    if (!Number.isFinite(routeToleranceMeters) || routeToleranceMeters < 0) {
        throw new Error('Route simplification tolerance must be a non-negative number of meters.');
    }
    if (typeof source !== 'string' || source.trim() === '') {
        throw new Error('Source must be a directory path.');
    }
    const tripRoot = path.resolve(source);
    if (!(await fs.stat(tripRoot)).isDirectory()) throw new Error(`Source is not a directory: ${tripRoot}`);
    // Validate all routes before photos can change. Do not leave a concurrent
    // writer running after this function has rejected.
    const { route, outputs } = await buildRoute(tripRoot, routeToleranceMeters);
    const filenames = await listFiles(path.join(tripRoot, 'photos', 'selects'), (name) => PHOTO_EXTENSIONS.has(path.extname(name).toLowerCase()));
    if (filenames.length === 0 && !route) {
        const error = new Error(`No selected photos or original GPX files found under ${tripRoot}.`);
        error.code = 'NO_TRIP_ASSETS';
        throw error;
    }
    const photos = await preparePhotos(tripRoot, force, filenames);
    await writeRoute(tripRoot, outputs);

    const report = {
        tripId,
        generatedAt: new Date().toISOString(),
        photoPipelineVersion: PHOTO_PIPELINE_VERSION,
        webpQuality: WEBP_QUALITY,
        warnings: photos.flatMap(photo => photo.derivatives.filter(image => image.bytes > (image.width <= 480 ? 100_000 : image.width <= 960 ? 300_000 : 800_000)).map(image => `${image.filename} exceeds the suggested image budget (${image.bytes} bytes).`)),
        photos,
        route,
    };
    const reportPath = path.join(tripRoot, 'asset-metadata.json');
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return report;
}

function usage() {
    return [
        'Usage: npm run prepare-trip-assets -- <trip-id> --source <local-trip-directory> [--force] [--route-tolerance <meters>]',
        '',
        'Reads photos/selects and gps/originals, then writes publishable files to',
        'photos/processed and gps/processed. Existing image derivatives are reused',
        `unless --force is supplied. Route simplification defaults to ${DEFAULT_ROUTE_SIMPLIFICATION_TOLERANCE_METERS} meters.`,
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
