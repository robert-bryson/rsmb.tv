#!/usr/bin/env node

/**
 * backfill.js
 * ===========
 * Run locally to populate all project data from scratch.
 * Executes each project's sync script and optionally uploads results to S3.
 *
 * USAGE
 * -----
 *   node scripts/backfill.js
 *   node scripts/backfill.js --projects temperatures,tornadoes,flights,blogs
 *   node scripts/backfill.js --storage local,s3
 *   node scripts/backfill.js --projects temperatures --storage local,s3
 *
 * OPTIONS
 * -------
 *   --projects <list>   Comma-separated projects to backfill (default: all projects)
 *                       Valid values: temperatures, tornadoes, flights, blogs
 *   --storage <list>    Comma-separated storage targets (default: local)
 *                       Valid values: local, s3
 *   --bucket <name>     S3 bucket name (default: rsmbtv-temperature-data)
 *   --region <name>     AWS region     (default: us-east-1)
 *   --cdn-id <id>       CloudFront distribution ID for cache invalidation after S3 upload
 *   --help              Show this help message
 *
 * ENVIRONMENT VARIABLES
 * ---------------------
 *   TEMPERATURE_DATA_BUCKET   S3 bucket for temperature data; fallback bucket for tornadoes
 *   TEMPERATURE_DATA_CDN_ID   CloudFront distribution ID; fallback CDN ID for tornadoes
 *   TORNADO_DATA_BUCKET       S3 bucket for tornado data              (overrides --bucket)
 *   TORNADO_DATA_CDN_ID       CloudFront distribution ID              (overrides --cdn-id)
 *   TEMP_DATA_DIR             Temperature intermediary data dir        (default: .temp/temperatures)
 *   GOOGLE_SHEET_ID           Required for flights sync from Google Sheets
 *   GOOGLE_SHEET_NAME         Flights sheet tab name                   (default: Flights)
 *   GOOGLE_BLOG_SHEET_ID      Required for blog sync from Google Sheets
 *   GOOGLE_BLOG_SHEET_NAME    Blog sheet tab name                      (default: Blog Posts)
 *   GOOGLE_BLOG_REPLACE_ALL   Replace posts.json entirely from the blog sheet when true
 *   AWS_REGION                AWS region                               (overrides --region)
 *   AWS_ACCESS_KEY_ID         AWS credentials
 *   AWS_SECRET_ACCESS_KEY     AWS credentials
 *
 * STORAGE MODES
 * -------------
 *   local  — Writes generated files to public/data/<project>/ only.
 *            Temperature intermediary data (ACIS cache, daily observations,
 *            station index) are written to TEMP_DATA_DIR for later use.
 *            The sync-temperatures.js subprocess still reads from S3 when
 *            TEMPERATURE_DATA_BUCKET is set — this is intentional so that
 *            the ACIS response cache accumulated by previous CI runs is
 *            reused, avoiding redundant API calls.
 *
 *   s3     — After generating files locally, uploads them to S3.
 *            Temperatures: public/data/temperatures/*.json and TEMP_DATA_DIR/
 *            Tornadoes:    public/data/tornadoes/ → s3://<bucket>/tornadoes/
 *            Flights do not use S3 (data is committed to the repository).
 *            Optionally invalidates a CloudFront distribution when --cdn-id
 *            (or the project-specific CDN ID environment variable) is provided.
 *
 * PROJECT NOTES
 * -------------
 *   temperatures  Full sync: state records (SCEC), county all-time records (ACIS),
 *                 climate trends, and the last 7 days of broken-record observations.
 *                 This is the slow one — expect 30-60 minutes on a fresh run.
 *
 *   tornadoes     Downloads all StormEvents CSV files (1950-present) from NOAA/NCEI,
 *                 parses tornado events, and writes per-year GeoJSON + summary files.
 *                 CSVs are cached in .cache/tornado-tracks to speed up reruns.
 *
 *   flights       Syncs flights.csv from Google Sheets (requires GOOGLE_SHEET_ID),
 *                 then rebuilds flights.geojson, visitedAirports.geojson,
 *                 allAirports.geojson, and usStates.geojson under public/data/flights/.
 *                 If GOOGLE_SHEET_ID is not set the sync step is skipped and the
 *                 GeoJSON files are rebuilt from the existing flights.csv.
 *
 *   blogs         Syncs Google-authored blog posts (requires GOOGLE_BLOG_SHEET_ID),
 *                 then rebuilds generated OG images, RSS, and sitemap files.
 *                 If GOOGLE_BLOG_SHEET_ID is not set the sync step is skipped and
 *                 generated metadata is rebuilt from the existing local posts.
 */

import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const VALID_PROJECTS = ['temperatures', 'tornadoes', 'flights', 'blogs'];
export const VALID_STORAGE = ['local', 's3'];

const DEFAULT_BUCKET = 'rsmbtv-temperature-data';
const DEFAULT_REGION = 'us-east-1';

// ─── Argument parsing ─────────────────────────────────────────────────

export function printHelp() {
    console.log(`
Usage: node scripts/backfill.js [options]

Options:
  --projects <list>   Comma-separated projects: ${VALID_PROJECTS.join(', ')}
                      Default: all projects
  --storage <list>    Comma-separated storage targets: ${VALID_STORAGE.join(', ')}
                      Default: local
  --bucket <name>     S3 bucket name (default: ${DEFAULT_BUCKET})
  --region <name>     AWS region     (default: ${DEFAULT_REGION})
  --cdn-id <id>       CloudFront distribution ID for cache invalidation
  --help              Show this help message

Examples:
  node scripts/backfill.js
  node scripts/backfill.js --projects temperatures,tornadoes --storage local,s3
  node scripts/backfill.js --projects flights
  GOOGLE_SHEET_ID=<id> node scripts/backfill.js --projects flights
  GOOGLE_BLOG_SHEET_ID=<id> node scripts/backfill.js --projects blogs

Environment:
  TEMPERATURE_DATA_BUCKET / TEMPERATURE_DATA_CDN_ID
  TORNADO_DATA_BUCKET / TORNADO_DATA_CDN_ID
`.trim());
}

export function resolveTemperatureBucket(bucket) {
    return process.env.TEMPERATURE_DATA_BUCKET || bucket || DEFAULT_BUCKET;
}

export function resolveTornadoBucket(bucket) {
    return process.env.TORNADO_DATA_BUCKET
        || process.env.TEMPERATURE_DATA_BUCKET
        || bucket
        || DEFAULT_BUCKET;
}

function resolveTemperatureCdnId(cdnId) {
    return process.env.TEMPERATURE_DATA_CDN_ID || cdnId;
}

function resolveTornadoCdnId(cdnId) {
    return process.env.TORNADO_DATA_CDN_ID
        || process.env.TEMPERATURE_DATA_CDN_ID
        || cdnId;
}

function resolveRegion(region) {
    return process.env.AWS_REGION || region || DEFAULT_REGION;
}

export function resolveS3BucketSummary(projects, bucket) {
    const entries = [];
    if (projects.includes('temperatures')) entries.push(['temperatures', resolveTemperatureBucket(bucket)]);
    if (projects.includes('tornadoes')) entries.push(['tornadoes', resolveTornadoBucket(bucket)]);
    if (!entries.length) return null;

    const uniqueBuckets = new Set(entries.map(([, resolvedBucket]) => resolvedBucket));
    if (uniqueBuckets.size === 1) return entries[0][1];
    return entries.map(([project, resolvedBucket]) => `${project}=${resolvedBucket}`).join(', ');
}

/**
 * Parse CLI arguments into a structured options object.
 * Throws an Error with a descriptive message on invalid input.
 * Callers are responsible for handling the error and exiting.
 *
 * @param {string[]} argv - Arguments after `process.argv.slice(2)`
 * @returns {{ projects: string[], storage: string[], bucket: string|null, region: string|null, cdnId: string|null, help: boolean }}
 */
export function parseArgs(argv) {
    const args = {
        projects: null,
        storage: null,
        bucket: null,
        region: null,
        cdnId: null,
        help: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = argv[i + 1];

        switch (arg) {
            case '--help':
                args.help = true;
                return args;

            case '--projects':
            case '--storage':
            case '--bucket':
            case '--region':
            case '--cdn-id': {
                if (!next || next.startsWith('--')) {
                    throw new Error(`${arg} requires a value`);
                }
                const parsed = arg === '--projects' || arg === '--storage'
                    ? [...new Set(next.split(',').map(s => s.trim()).filter(Boolean))]
                    : next;
                if (arg === '--projects') args.projects = parsed;
                else if (arg === '--storage') args.storage = parsed;
                else if (arg === '--bucket') args.bucket = parsed;
                else if (arg === '--region') args.region = parsed;
                else args.cdnId = parsed;
                i++;
                break;
            }

            default:
                throw new Error(`Unknown argument: ${arg}\nRun with --help for usage.`);
        }
    }

    if (!args.projects) args.projects = [...VALID_PROJECTS];
    if (!args.storage) args.storage = ['local'];
    return args;
}

/**
 * Validate parsed arguments. Throws an Error if any value is invalid.
 *
 * @param {{ projects: string[], storage: string[] }} args
 */
export function validateArgs(args) {
    const validProjectSet = new Set(VALID_PROJECTS);
    const validStorageSet = new Set(VALID_STORAGE);

    for (const p of args.projects) {
        if (!validProjectSet.has(p)) {
            throw new Error(`Unknown project "${p}". Valid: ${VALID_PROJECTS.join(', ')}`);
        }
    }
    for (const s of args.storage) {
        if (!validStorageSet.has(s)) {
            throw new Error(`Unknown storage target "${s}". Valid: ${VALID_STORAGE.join(', ')}`);
        }
    }
}

// ─── Subprocess helpers ───────────────────────────────────────────────

/**
 * Build the argument array for an `aws s3 sync` invocation.
 * AWS CLI requires `--exclude` to appear before `--include` to take effect;
 * this function enforces that ordering regardless of how options are passed.
 *
 * @param {string} src
 * @param {string} dest
 * @param {{ contentType: string, cacheControl: string, exclude?: string, include?: string, delete?: boolean, region?: string }} opts
 * @returns {string[]}
 */
export function buildAwsSyncArgs(src, dest, { contentType, cacheControl, exclude, include, delete: del, region }) {
    const args = ['s3', 'sync', src, dest,
        '--content-type', contentType,
        '--cache-control', cacheControl,
    ];
    if (del) args.push('--delete');
    // --exclude must precede --include for AWS CLI filter logic to work correctly
    if (exclude !== undefined) args.push('--exclude', exclude);
    if (include !== undefined) args.push('--include', include);
    if (region) args.push('--region', region);
    return args;
}

/**
 * Run a command synchronously, streaming output to the terminal.
 * Throws on non-zero exit or spawn error.
 */
export function run(command, args = [], { env } = {}) {
    console.log(`\n$ ${command} ${args.join(' ')}`);
    const result = spawnSync(command, args, {
        stdio: 'inherit',
        cwd: REPO_ROOT,
        env: { ...process.env, ...env },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`Command exited with status ${result.status}: ${command} ${args.join(' ')}`);
    }
}

function awsSync(src, dest, opts) {
    run('aws', buildAwsSyncArgs(src, dest, opts));
}

// ─── Project backfill functions ───────────────────────────────────────

export function backfillTemperatures({ storage, bucket, region, cdnId }) {
    const tempDataDir = process.env.TEMP_DATA_DIR || resolve(REPO_ROOT, '.temp/temperatures');
    const resolvedBucket = resolveTemperatureBucket(bucket);
    const resolvedRegion = resolveRegion(region);
    const resolvedCdnId = resolveTemperatureCdnId(cdnId);

    console.log('\n🌡️  Backfilling temperature records (full sync)...');
    console.log('   This fetches all-time state + county records from NOAA/ACIS.');
    console.log('   Expect 30–60 minutes on a first run; subsequent runs use the S3 cache.');

    // Run full sync (no --recent-only).
    // Always pass the bucket name so the subprocess can read from the S3 ACIS
    // response cache, reducing redundant API calls even in local storage mode.
    run('node', ['scripts/sync-temperatures.js'], {
        env: {
            TEMPERATURE_DATA_BUCKET: resolvedBucket,
            TEMPERATURE_DATA_BASE_URL: process.env.TEMPERATURE_DATA_BASE_URL || 'https://data.rsmb.tv',
            TEMP_DATA_DIR: tempDataDir,
        },
    });

    if (!storage.includes('s3')) return;

    console.log('\n☁️  Uploading temperature records to S3...');

    // Public-facing JSON files (stateRecords, countyRecords, climateTrends, etc.)
    awsSync(
        'public/data/temperatures/',
        `s3://${resolvedBucket}/`,
        { contentType: 'application/json', cacheControl: 'public, max-age=3600', exclude: '*', include: '*.json', region: resolvedRegion },
    );

    // Daily observations, station index, and ACIS response cache
    awsSync(
        `${tempDataDir}/`,
        `s3://${resolvedBucket}/`,
        { contentType: 'application/json', cacheControl: 'public, max-age=86400', region: resolvedRegion },
    );

    if (resolvedCdnId) {
        console.log('\n🔄 Invalidating CloudFront cache (temperatures)...');
        run('aws', [
            'cloudfront', 'create-invalidation',
            '--distribution-id', resolvedCdnId,
            '--paths',
            '/stations.json', '/recentRecords.json', '/countyRecords.json',
            '/stateRecords.json', '/climateTrends.json', '/summary.json',
        ]);
    }
}

export function backfillTornadoes({ storage, bucket, region, cdnId }) {
    const resolvedBucket = resolveTornadoBucket(bucket);
    const resolvedRegion = resolveRegion(region);
    const resolvedCdnId = resolveTornadoCdnId(cdnId);

    console.log('\n🌪️  Backfilling tornado tracks (1950–present)...');
    console.log('   StormEvents CSVs are cached in .cache/tornado-tracks between runs.');

    run('node', ['projects/tornado-tracks/scripts/syncTornadoes.js']);

    if (!storage.includes('s3')) return;

    console.log('\n☁️  Uploading tornado data to S3...');

    // JSON summary files — use --delete to remove stale entries; exclude GeoJSON
    awsSync(
        'public/data/tornadoes/',
        `s3://${resolvedBucket}/tornadoes/`,
        { contentType: 'application/json', cacheControl: 'public, max-age=3600', delete: true, exclude: '*.geojson', region: resolvedRegion },
    );

    // GeoJSON track files — RFC 7946 MIME type; --exclude '*' then --include '*.geojson'
    awsSync(
        'public/data/tornadoes/',
        `s3://${resolvedBucket}/tornadoes/`,
        { contentType: 'application/geo+json', cacheControl: 'public, max-age=3600', exclude: '*', include: '*.geojson', region: resolvedRegion },
    );

    if (resolvedCdnId) {
        console.log('\n🔄 Invalidating CloudFront cache (tornadoes)...');
        run('aws', [
            'cloudfront', 'create-invalidation',
            '--distribution-id', resolvedCdnId,
            '--paths', '/tornadoes/*',
        ]);
    }
}

export function backfillFlights() {
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!sheetId) {
        console.warn('\n⚠️  GOOGLE_SHEET_ID is not set — skipping Google Sheets sync.');
        console.log('   Set GOOGLE_SHEET_ID to pull the latest flight data, or');
        console.log('   proceed with the existing projects/flights/data/flights.csv.');
    } else {
        console.log('\n✈️  Syncing flights from Google Sheets...');
        run('node', ['scripts/sync-flights.js']);
    }

    console.log('\n✈️  Building flights GeoJSON from CSV...');
    run('node', ['projects/flights/scripts/convertFlights.js']);
    run('node', ['projects/flights/scripts/generateAllAirports.js']);
    run('node', ['projects/flights/scripts/generateUSStates.js']);

    console.log('\n   Flights data does not use S3 — files written to public/data/flights/');
}

export function backfillBlogs() {
    const sheetId = process.env.GOOGLE_BLOG_SHEET_ID;

    if (!sheetId) {
        console.warn('\nGOOGLE_BLOG_SHEET_ID is not set - skipping Google blog sync.');
        console.log('   Set GOOGLE_BLOG_SHEET_ID to pull Google-authored posts, or');
        console.log('   proceed with the existing src/content/posts.json and MDX files.');
    } else {
        console.log('\nSyncing blog posts from Google Docs/Sheets...');
        run('node', ['scripts/sync-blogs.js']);
    }

    console.log('\nBuilding blog metadata artifacts...');
    run('node', ['scripts/generate-og-images.js']);
    run('node', ['scripts/generate-rss.js']);
    run('node', ['scripts/generate-sitemap.js']);

    console.log('\n   Blog content does not use S3 - files written to src/content/ and public/.');
}

// ─── Main ─────────────────────────────────────────────────────────────

function main() {
    let args;
    try {
        args = parseArgs(process.argv.slice(2));
    } catch (err) {
        console.error(`error: ${err.message}`);
        process.exit(1);
    }

    if (args.help) {
        printHelp();
        process.exit(0);
    }

    try {
        validateArgs(args);
    } catch (err) {
        console.error(`error: ${err.message}`);
        process.exit(1);
    }

    const wantsS3 = args.storage.includes('s3');

    console.log('🚀 Backfill starting');
    console.log(`   Projects : ${args.projects.join(', ')}`);
    console.log(`   Storage  : ${args.storage.join(', ')}`);
    if (wantsS3) {
        const bucketSummary = resolveS3BucketSummary(args.projects, args.bucket);
        if (bucketSummary) {
            console.log(`   S3 bucket: ${bucketSummary}`);
            console.log(`   Region   : ${resolveRegion(args.region)}`);
        } else {
            console.log('   S3 bucket: not used by selected projects');
        }
    }

    const opts = { storage: args.storage, bucket: args.bucket, region: args.region, cdnId: args.cdnId };

    for (const project of args.projects) {
        try {
            switch (project) {
                case 'temperatures': backfillTemperatures(opts); break;
                case 'tornadoes': backfillTornadoes(opts); break;
                case 'flights': backfillFlights(); break;
                case 'blogs': backfillBlogs(); break;
            }
        } catch (err) {
            console.error(`\n❌ Backfill failed for "${project}": ${err.message}`);
            process.exit(1);
        }
    }

    console.log('\n✅ Backfill complete!');
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) main();
