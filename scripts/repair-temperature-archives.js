import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { usStates } from '../shared/geography/usStates.ts';
import { writeAtomically } from './atomic-write.js';

/** Resolve symlinks even when the final destination does not exist yet. */
async function canonicalPath(filename) {
    const absolute = path.resolve(filename);
    try { return await fs.realpath(absolute); }
    catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return path.join(await canonicalPath(path.dirname(absolute)), path.basename(absolute));
    }
}

function containsPath(directory, filename) {
    const relative = path.relative(directory, filename);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function repairPaths(sourceDirectory, outputDirectory, sourceStationsFile) {
    const source = await fs.realpath(sourceDirectory);
    const output = await canonicalPath(outputDirectory);
    if (containsPath(source, output) || containsPath(output, source)) {
        throw new Error('Source and repair output directories must be disjoint.');
    }
    const stations = await canonicalPath(path.join(path.dirname(path.resolve(outputDirectory)), 'stations.json'));
    if (containsPath(source, stations)) throw new Error('Station destination must be outside the source directory.');
    if (sourceStationsFile) {
        const sourceStations = await fs.realpath(sourceStationsFile);
        if (stations === sourceStations || containsPath(output, sourceStations)) {
            throw new Error('Repair destinations must not overwrite the source station catalog.');
        }
    }
    return { source, output, stations };
}

function validStationUid(uid) {
    return (typeof uid === 'number' || (typeof uid === 'string' && uid.trim() !== ''))
        && Number.isSafeInteger(Number(uid)) && Number(uid) >= 0;
}

function validObservation(observation) {
    return observation && typeof observation === 'object' && validStationUid(observation.uid)
        && ['maxt', 'mint'].some(field => Number.isFinite(observation[field]))
        && ['maxt', 'mint'].every(field => observation[field] == null || Number.isFinite(observation[field]));
}

async function collectArchives(source, output) {
    const archives = [];
    const dates = new Set();
    const stationUids = new Set();
    async function visit(directory) {
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
            const filename = path.join(directory, entry.name);
            if (entry.isSymbolicLink()) throw new Error(`Invalid archive inventory: symbolic link ${filename}`);
            if (entry.isDirectory()) { await visit(filename); continue; }
            if (!entry.name.endsWith('.json')) continue;
            const date = entry.name.slice(0, -5);
            const calendarDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
            if (!entry.isFile() || !calendarDate || !Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== date) {
                throw new Error(`Invalid archive filename ${entry.name}`);
            }
            let archive;
            try { archive = JSON.parse(await fs.readFile(filename, 'utf8')); }
            catch (error) { throw new Error(`Invalid archive ${date}: ${error.message}`, { cause: error }); }
            if (archive?.date !== date || !Array.isArray(archive.observations) || !archive.observations.length
                || archive.observations.some(observation => !validObservation(observation))) {
                throw new Error(`Invalid archive ${date}: expected matching date and nonempty station observations`);
            }
            if (dates.has(date)) throw new Error(`Duplicate archive date ${date}`);
            dates.add(date);
            for (const observation of archive.observations) stationUids.add(Number(observation.uid));
            const destination = await canonicalPath(path.join(output, path.relative(source, filename)));
            if (!containsPath(output, destination)) throw new Error(`Archive destination escapes the repair output directory: ${destination}`);
            archives.push({ filename, date, destination, version: archive.monthlyThresholdVersion });
        }
    }
    await visit(source);
    if (!archives.length) throw new Error('No daily archives found in the source directory.');
    return { archives: archives.sort((left, right) => left.date.localeCompare(right.date)), stationUids };
}

/** Stage every stale archive. The workflow uploads only after the whole repair succeeds. */
export async function repairTemperatureArchives({ sourceDirectory, outputDirectory, stationIndex, sourceStationsFile }) {
    const paths = await repairPaths(sourceDirectory, outputDirectory, sourceStationsFile);
    const { archives, stationUids } = await collectArchives(paths.source, paths.output);
    const { MONTHLY_THRESHOLD_VERSION, repairMonthlyArchive, postJson } = await import('./sync-temperatures.js');
    let repaired = 0;
    let current = 0;
    const requestCache = new Map();
    const missingStations = new Set();
    for (const uid of stationUids) if (!stationIndex.get(uid)?.state) missingStations.add(uid);
    const finalArchiveDate = archives.at(-1).date;
    if (missingStations.size) {
        const response = await postJson('https://data.rcc-acis.org/StnMeta', {
            state: usStates.filter(state => !['AK', 'HI'].includes(state.abbr)).map(state => state.abbr),
            elems: ['maxt', 'mint'], meta: ['uid', 'name', 'll', 'state', 'county', 'elev'],
            sdate: archives[0].date, edate: finalArchiveDate,
        }, { validate: data => { if (!Array.isArray(data?.meta) || !data.meta.length) throw new Error('No station metadata returned'); } });
        for (const station of response.meta) {
            const uid = Number(station.uid);
            if (missingStations.has(uid) && station.state) stationIndex.set(uid, { ...station, uid });
        }
        for (const uid of missingStations) {
            if (!stationIndex.get(uid)?.state) throw new Error(`Cannot recover metadata for archived station ${uid}`);
        }
        await fs.mkdir(path.dirname(paths.stations), { recursive: true });
        await writeAtomically(paths.stations, JSON.stringify({
            generated: new Date().toISOString(), count: stationIndex.size, stations: [...stationIndex.values()],
        }));
        console.log(`Recovered metadata for ${missingStations.size} archived stations`);
    }
    for (const { filename, date, destination, version } of archives) {
        if (version === MONTHLY_THRESHOLD_VERSION) { current++; continue; }
        const archive = JSON.parse(await fs.readFile(filename, 'utf8'));
        const monthEnd = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10);
        const repairMonthEnd = monthEnd < finalArchiveDate ? monthEnd : finalArchiveDate;
        const next = await repairMonthlyArchive(date, archive, stationIndex, requestCache, repairMonthEnd);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await writeAtomically(destination, JSON.stringify(next));
        repaired++;
        console.log(`Repaired ${date}: ${next.observations.length} observations`);
    }
    return { repaired, current, monthlyThresholdVersion: MONTHLY_THRESHOLD_VERSION };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.env.TEMP_DATA_DIR ||= path.resolve('.temp/temperatures');
    let temporary;
    try {
        const { values } = parseArgs({ options: { source: { type: 'string' }, stations: { type: 'string' }, out: { type: 'string' } } });
        const outputDirectory = path.resolve(values.out ?? '.temp/temperatures/daily');
        let sourceDirectory = values.source;
        let stationsFile = values.stations;
        if (!sourceDirectory) {
            const bucket = process.env.TEMPERATURE_DATA_BUCKET;
            if (!bucket) throw new Error('Set TEMPERATURE_DATA_BUCKET or supply --source and --stations.');
            temporary = await fs.mkdtemp(path.join((await import('node:os')).tmpdir(), 'temperature-repair-'));
            sourceDirectory = path.join(temporary, 'daily');
            stationsFile = path.join(temporary, 'stations.json');
            execFileSync('aws', ['s3', 'sync', `s3://${bucket}/daily/`, sourceDirectory, '--exclude', '*', '--include', '*.json'], { stdio: 'inherit' });
            execFileSync('aws', ['s3', 'cp', `s3://${bucket}/stations.json`, stationsFile], { stdio: 'inherit' });
        }
        if (!stationsFile) throw new Error('--stations is required with --source.');
        const stations = JSON.parse(await fs.readFile(stationsFile, 'utf8'))?.stations;
        if (!Array.isArray(stations) || stations.some(station => !station || typeof station !== 'object' || !validStationUid(station.uid))) {
            throw new Error('Invalid station catalog: expected a stations array with valid station UIDs.');
        }
        const stationIndex = new Map(stations.map(station => [Number(station.uid), station]));
        console.log(await repairTemperatureArchives({ sourceDirectory, outputDirectory, stationIndex, sourceStationsFile: stationsFile }));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    } finally {
        if (temporary) await fs.rm(temporary, { recursive: true, force: true });
    }
}
