#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareTripAssets } from './prepare-trip-assets.js';
import { loadLocalEnvFiles } from './sync-blogs.js';

const TRIP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_TRIP_ASSETS_ROOTS = [
    '/mnt/g/My Drive/projects/rsmb.tv/trips',
];
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function isDirectory(directory) {
    try {
        return (await fs.stat(directory)).isDirectory();
    } catch {
        try {
            await fs.readdir(directory);
            return true;
        } catch {
            return false;
        }
    }
}

function countLabel(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}

export function formatAssetTotals(totals) {
    const failures = totals.failures.length > 0 ? ` ${countLabel(totals.failures.length, 'trip')} incomplete.` : '';
    return `Processed ${countLabel(totals.trips, 'trip')} with ${countLabel(totals.photos, 'photo')} and ${countLabel(totals.geoJsonFiles, 'GeoJSON file')} before dev (${countLabel(totals.webpFiles, 'WebP derivative')}).${failures}`;
}

export async function findTripAssetsRoot(configuredRoot = process.env.TRIP_ASSETS_ROOT) {
    if (configuredRoot) {
        const resolvedRoot = path.resolve(configuredRoot);
        if (!(await isDirectory(resolvedRoot))) {
            throw new Error(`TRIP_ASSETS_ROOT is not a directory: ${resolvedRoot}`);
        }
        return resolvedRoot;
    }

    for (const candidate of DEFAULT_TRIP_ASSETS_ROOTS) {
        if (await isDirectory(candidate)) return candidate;
    }
    return undefined;
}

async function mirrorFiles(source, destination, extension) {
    let filenames = [];
    try {
        filenames = (await fs.readdir(source, { withFileTypes: true }))
            .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === extension)
            .map((entry) => entry.name);
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
    }

    await fs.rm(destination, { recursive: true, force: true });
    await fs.mkdir(destination, { recursive: true });
    await Promise.all(filenames.map((filename) => fs.copyFile(
        path.join(source, filename),
        path.join(destination, filename),
    )));
    return filenames.length;
}

export async function mirrorPreparedTripAssets({ source, tripId, outputRoot }) {
    const tripOutput = path.join(outputRoot, tripId);
    const [webpFiles, geoJsonFiles] = await Promise.all([
        mirrorFiles(path.join(source, 'photos', 'processed'), path.join(tripOutput, 'photos'), '.webp'),
        mirrorFiles(path.join(source, 'gps', 'processed'), path.join(tripOutput, 'geo'), '.geojson'),
    ]);
    return { webpFiles, geoJsonFiles };
}

export async function prepareTripAssetsForDev({
    sourceRoot,
    previewSlug,
    outputRoot = path.join(REPO_ROOT, 'public', 'data', 'trips'),
    prepare = prepareTripAssets,
} = {}) {
    if (!sourceRoot) return undefined;

    const tripIds = previewSlug
        ? [previewSlug]
        : (await fs.readdir(sourceRoot, { withFileTypes: true }))
            .filter((entry) => entry.isDirectory() && TRIP_ID_PATTERN.test(entry.name))
            .map((entry) => entry.name)
            .sort((left, right) => left.localeCompare(right));

    if (tripIds.length === 0) throw new Error(`No trip directories found under ${sourceRoot}.`);

    const totals = { trips: 0, photos: 0, webpFiles: 0, geoJsonFiles: 0, failures: [] };
    for (const tripId of tripIds) {
        const source = path.join(sourceRoot, tripId);
        try {
            if (!(await isDirectory(source))) throw new Error(`Source directory not found: ${source}`);
            const report = await prepare({ tripId, source, force: true });
            const mirrored = await mirrorPreparedTripAssets({ source, tripId, outputRoot });
            totals.trips += 1;
            totals.photos += report.photos.length;
            totals.webpFiles += mirrored.webpFiles;
            totals.geoJsonFiles += mirrored.geoJsonFiles;
        } catch (error) {
            totals.failures.push({ tripId, reason: error.message });
        }
    }

    return totals;
}

export async function runDevTripAssetPreparation() {
    loadLocalEnvFiles();
    if (/^(0|false|no|off)$/i.test(String(process.env.TRIP_ASSETS_ON_DEV ?? ''))) {
        console.log('Skipping trip asset preparation before dev because TRIP_ASSETS_ON_DEV is disabled.');
        return;
    }

    try {
        const sourceRoot = await findTripAssetsRoot();
        if (!sourceRoot) {
            console.log('Skipping trip asset preparation before dev because TRIP_ASSETS_ROOT is not configured.');
        } else {
            const totals = await prepareTripAssetsForDev({
                sourceRoot,
            });
            console.log(formatAssetTotals(totals));
            for (const failure of totals.failures) {
                console.warn(`  Incomplete ${failure.tripId}: ${failure.reason}`);
            }
        }
    } catch (error) {
        console.error(`Trip asset preparation before dev failed: ${error.message}`);
        process.exitCode = 1;
    }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) await runDevTripAssetPreparation();