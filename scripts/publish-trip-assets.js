#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TRIP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseArgs(args) {
    const options = { dryRun: false };

    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === '--dry-run') {
            options.dryRun = true;
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

export function buildUploadCommands({ tripId, source, sourceBucket, publicBucket, cdnId, dryRun = false }) {
    if (!sourceBucket) throw new Error('TRIP_SOURCE_BUCKET is required.');
    if (!publicBucket) throw new Error('TRIP_ASSET_BUCKET is required.');

    const tripRoot = path.resolve(source);
    const originalPhotosPath = path.join(tripRoot, 'photos', 'originals');
    const originalGpsPath = path.join(tripRoot, 'gps', 'originals');
    const photosPath = path.join(tripRoot, 'photos', 'processed');
    const gpsPath = path.join(tripRoot, 'gps', 'processed');
    const commands = [];

    for (const [localPath, remotePath] of [
        [originalPhotosPath, `s3://${sourceBucket}/trips/${tripId}/photos/originals/`],
        [originalGpsPath, `s3://${sourceBucket}/trips/${tripId}/gps/originals/`],
    ]) {
        if (fs.existsSync(localPath)) {
            commands.push({
                command: 'aws',
                args: ['s3', 'sync', localPath, remotePath, ...(dryRun ? ['--dryrun'] : [])],
            });
        }
    }

    if (fs.existsSync(photosPath)) {
        commands.push({
            command: 'aws',
            args: [
                's3', 'sync', photosPath, `s3://${publicBucket}/trips/${tripId}/photos/`,
                '--exclude', '*', '--include', '*.webp',
                '--cache-control', 'public,max-age=31536000,immutable',
                ...(dryRun ? ['--dryrun'] : []),
            ],
        });
    }

    if (fs.existsSync(gpsPath)) {
        commands.push({
            command: 'aws',
            args: [
                's3', 'sync', gpsPath, `s3://${publicBucket}/trips/${tripId}/geo/`,
                '--exclude', '*', '--include', '*.geojson', '--include', '*.webp',
                '--cache-control', 'public,max-age=3600',
                ...(dryRun ? ['--dryrun'] : []),
            ],
        });
    }

    if (commands.length === 0) {
        throw new Error(`No trip asset directories found under ${tripRoot}.`);
    }

    if (cdnId && !dryRun) {
        commands.push({
            command: 'aws',
            args: [
                'cloudfront', 'create-invalidation',
                '--distribution-id', cdnId,
                '--paths', `/trips/${tripId}/*`,
            ],
        });
    }

    return commands;
}

export function publishTripAssets(options, {
    sourceBucket = process.env.TRIP_SOURCE_BUCKET,
    publicBucket = process.env.TRIP_ASSET_BUCKET,
    cdnId = process.env.TRIP_ASSET_CDN_ID,
    run = spawnSync,
} = {}) {
    const commands = buildUploadCommands({ ...options, sourceBucket, publicBucket, cdnId });

    for (const { command, args } of commands) {
        const result = run(command, args, { stdio: 'inherit' });
        if (result.error) throw result.error;
        if (result.status !== 0) {
            throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}.`);
        }
    }

    return commands.length;
}

function usage() {
    return [
        'Usage: npm run publish-trip-assets -- <trip-id> --source <local-trip-directory> [--dry-run]',
        '',
        'Required environment:',
        '  TRIP_SOURCE_BUCKET  Private S3 bucket for untouched originals',
        '  TRIP_ASSET_BUCKET   Public S3 bucket served by data.rsmb.tv',
        '',
        'Optional environment:',
        '  TRIP_ASSET_CDN_ID   CloudFront distribution to invalidate after upload',
    ].join('\n');
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
    try {
        const options = parseArgs(process.argv.slice(2));
        const count = publishTripAssets(options);
        console.log(`Published ${options.tripId} assets with ${count} AWS operation(s).`);
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        console.error(`\n${usage()}`);
        process.exitCode = 1;
    }
}