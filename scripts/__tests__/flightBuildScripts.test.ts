import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { afterEach, describe, expect, it } from 'vitest';
import { writeFlightGeoJson } from '../../projects/flights/scripts/writeFlightGeoJson.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const tempDirs: string[] = [];

function makeWorkspace() {
    const cwd = mkdtempSync(join(tmpdir(), 'rsmb-flight-build-'));
    tempDirs.push(cwd);
    mkdirSync(join(cwd, 'projects/flights/data/mappings'), { recursive: true });
    mkdirSync(join(cwd, 'public/data/flights'), { recursive: true });

    writeFileSync(join(cwd, 'projects/flights/data/mappings/countryNames.json'), JSON.stringify({ US: 'United States' }));
    writeFileSync(join(cwd, 'projects/flights/data/mappings/regionNames.json'), JSON.stringify({ 'US-WA': 'Washington', 'US-CA': 'California' }));
    writeFileSync(join(cwd, 'projects/flights/data/mappings/continentNames.json'), JSON.stringify({ NA: 'North America' }));

    return cwd;
}

function runScript(cwd: string, relativeScriptPath: string) {
    const result = spawnSync(process.execPath, [join(repoRoot, relativeScriptPath)], {
        cwd,
        encoding: 'utf8',
    });
    expect(result.error).toBeUndefined();
    return result;
}

function readJson(cwd: string, relativePath: string) {
    return JSON.parse(readFileSync(join(cwd, relativePath), 'utf8'));
}

afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
        rmSync(dir, { recursive: true, force: true });
    }
});

describe('flight build scripts', () => {
    it('preserves recorded minutes and flight numbers, and rejects malformed durations before writing', () => {
        const cwd = makeWorkspace();
        writeFileSync(join(cwd, 'projects/flights/data/airports.csv'), [
            'iata_code,name,municipality,iso_region,iso_country,continent,latitude_deg,longitude_deg,elevation_ft',
            'SEA,Seattle,Seattle,US-WA,US,NA,47.4502,-122.3088,433',
            'LAX,Los Angeles,Los Angeles,US-CA,US,NA,33.9416,-118.4085,128',
        ].join('\n'));
        const csv = (minutes: string) => [
            'date,airline,flightNumber,origin,destination,durationMinutes,durationKind,durationSource,durationNote',
            `1/1/2024,United,UA123,SEA,LAX,${minutes},actual-block,manual,private evidence`,
        ].join('\n');
        const csvPath = join(cwd, 'projects/flights/data/flights.csv');
        writeFileSync(csvPath, csv('165'));
        const valid = runScript(cwd, 'projects/flights/scripts/convertFlights.js');
        expect(valid.status, valid.stderr).toBe(0);
        expect(readJson(cwd, 'public/data/flights/flights.geojson').features[0].properties)
            .toMatchObject({ flightNumber: 'UA123', durationMinutes: 165, durationKind: 'actual-block', durationSource: 'manual' });
        const original = readFileSync(join(cwd, 'public/data/flights/flights.geojson'), 'utf8');
        expect(original).not.toContain('private evidence');
        const airports = readFileSync(join(cwd, 'public/data/flights/visitedAirports.geojson'), 'utf8');
        writeFileSync(csvPath, csv('2.45'));
        const invalid = runScript(cwd, 'projects/flights/scripts/convertFlights.js');
        expect(invalid.status).not.toBe(0);
        expect(invalid.stderr).toContain('row 2');
        expect(readFileSync(join(cwd, 'public/data/flights/flights.geojson'), 'utf8')).toBe(original);
        expect(readFileSync(join(cwd, 'public/data/flights/visitedAirports.geojson'), 'utf8')).toBe(airports);
    });

    it('excludes malformed coordinates from flight, visited, and complete airport outputs', () => {
        const cwd = makeWorkspace();
        writeFileSync(join(cwd, 'projects/flights/data/airports.csv'), [
            'iata_code,name,municipality,iso_region,iso_country,continent,latitude_deg,longitude_deg,elevation_ft',
            'SEA,Seattle,Seattle,US-WA,US,NA,47.4502,-122.3088,433',
            'ZERO,Zero,Nowhere,US-CA,US,NA,0,0,0',
            'PART,Partial,Nowhere,US-CA,US,NA,47north,-118,0',
            'INF,Infinite,Nowhere,US-CA,US,NA,Infinity,-118,0',
            'LAT,Latitude,Nowhere,US-CA,US,NA,91,-118,0',
            'LON,Longitude,Nowhere,US-CA,US,NA,47,-181,0',
            'EMPTY,Empty,Nowhere,US-CA,US,NA,,-118,0',
        ].join('\n'));
        writeFileSync(join(cwd, 'projects/flights/data/flights.csv'), [
            'date,airline,origin,destination',
            '1/1/2024,United,SEA,ZERO',
            ...['PART', 'INF', 'LAT', 'LON', 'EMPTY', 'constructor'].map(code => `1/2/2024,United,SEA,${code}`),
        ].join('\n'));

        const flights = runScript(cwd, 'projects/flights/scripts/convertFlights.js');
        expect(flights.status, flights.stderr).toBe(0);
        expect(readJson(cwd, 'public/data/flights/flights.geojson').features)
            .toEqual([expect.objectContaining({ geometry: { type: 'LineString', coordinates: [[-122.3088, 47.4502], [0, 0]] } })]);
        expect(readJson(cwd, 'public/data/flights/visitedAirports.geojson').features).toHaveLength(2);
        const airports = runScript(cwd, 'projects/flights/scripts/generateAllAirports.js');
        expect(airports.status, airports.stderr).toBe(0);
        expect(airports.stderr).toContain('Skipped 5 airport(s) with invalid coordinates');
        expect(readJson(cwd, 'public/data/flights/allAirports.geojson').metadata)
            .toMatchObject({ totalAirports: 2, visitedCount: 2 });
    });

    it('convertFlights warns and skips flights that reference missing airports', () => {
        const cwd = makeWorkspace();
        writeFileSync(join(cwd, 'projects/flights/data/airports.csv'), [
            'iata_code,name,municipality,iso_region,iso_country,continent,latitude_deg,longitude_deg,elevation_ft',
            'SEA,Seattle-Tacoma International Airport,Seattle,US-WA,US,NA,47.4502,-122.3088,433',
            'LAX,Los Angeles International Airport,Los Angeles,US-CA,US,NA,33.9416,-118.4085,128',
        ].join('\n'));
        writeFileSync(join(cwd, 'projects/flights/data/flights.csv'), [
            'date,airline,origin,destination',
            '1/1/2024,United,SEA,LAX',
            '1/2/2024,United,SEA,XXX',
        ].join('\n'));

        const result = runScript(cwd, 'projects/flights/scripts/convertFlights.js');

        expect(result.status).toBe(0);
        expect(result.stderr).toContain('Skipping flight with missing airport: SEA');
        const flights = readJson(cwd, 'public/data/flights/flights.geojson');
        expect(flights.features).toHaveLength(1);
        expect(flights.features[0].properties.origin_code).toBe('SEA');
        expect(flights.features[0].properties.destination_code).toBe('LAX');

        const firstOutput = readFileSync(join(cwd, 'public/data/flights/flights.geojson'), 'utf8');
        expect(runScript(cwd, 'projects/flights/scripts/convertFlights.js').status).toBe(0);
        expect(readFileSync(join(cwd, 'public/data/flights/flights.geojson'), 'utf8')).toBe(firstOutput);
    });

    it('generateAllAirports reports invalid airport coordinates', () => {
        const cwd = makeWorkspace();
        writeFileSync(join(cwd, 'projects/flights/data/airports.csv'), [
            'iata_code,name,municipality,iso_region,iso_country,continent,latitude_deg,longitude_deg,elevation_ft',
            'SEA,Seattle-Tacoma International Airport,Seattle,US-WA,US,NA,47.4502,-122.3088,433',
            'BAD,Bad Coordinate Field,Nowhere,US-CA,US,NA,not-a-lat,-118.4085,128',
        ].join('\n'));
        writeFileSync(join(cwd, 'public/data/flights/visitedAirports.geojson'), JSON.stringify({
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: { code: 'SEA' }, geometry: { type: 'Point', coordinates: [-122.3088, 47.4502] } }],
        }));

        const result = runScript(cwd, 'projects/flights/scripts/generateAllAirports.js');

        expect(result.status).toBe(0);
        expect(result.stderr).toContain('Skipped 1 airport(s) with invalid coordinates');
        expect(result.stderr).toContain('BAD (Bad Coordinate Field)');
        const airports = readJson(cwd, 'public/data/flights/allAirports.geojson');
        expect(airports.features).toHaveLength(1);
        expect(airports.metadata.totalAirports).toBe(1);
        expect(airports.metadata.visitedCount).toBe(1);

        const firstOutput = readFileSync(join(cwd, 'public/data/flights/allAirports.geojson'), 'utf8');
        expect(runScript(cwd, 'projects/flights/scripts/generateAllAirports.js').status).toBe(0);
        expect(readFileSync(join(cwd, 'public/data/flights/allAirports.geojson'), 'utf8')).toBe(firstOutput);
    });

    it('generates identical state output from identical remote boundaries', () => {
        const cwd = makeWorkspace();
        const source = {
            features: [{
                properties: { name: 'Washington' }, geometry: {
                    type: 'Polygon', coordinates: [[[-123, 47], [-122, 47], [-122, 48], [-123, 47]]],
                }
            }],
        };
        const scriptUrl = pathToFileURL(join(repoRoot, 'projects/flights/scripts/generateUSStates.js')).href;
        const run = () => spawnSync(process.execPath, ['--input-type=module', '-e',
            `globalThis.fetch = async () => ({ ok: true, json: async () => (${JSON.stringify(source)}) }); await import(${JSON.stringify(scriptUrl)});`,
        ], { cwd, encoding: 'utf8' });
        const firstRun = run();
        expect(firstRun.error).toBeUndefined();
        expect(firstRun.status, firstRun.stderr).toBe(0);
        const outputPath = join(cwd, 'public/data/flights/usStates.geojson');
        const firstOutput = readFileSync(outputPath, 'utf8');
        const secondRun = run();
        expect(secondRun.error).toBeUndefined();
        expect(secondRun.status).toBe(0);
        expect(readFileSync(outputPath, 'utf8')).toBe(firstOutput);
    });

    it('omits collapsed state islands and holes that otherwise fill the globe', () => {
        const cwd = makeWorkspace();
        // Actual zero-area ring from the boundary source, duplicated in Virginia and Maryland.
        // D3 interprets Virginia's orientation as covering almost the entire sphere.
        const collapsedIsland = [[-76.016553, 37.95325], [-75.994645, 37.95325], [-76.043938, 37.95325], [-76.016553, 37.95325]];
        const mainland = [[-80, 37], [-80, 39], [-77, 39], [-80, 37]];
        const island = [[-76, 37], [-76, 38], [-75, 38], [-76, 37]];
        const source = {
            features: [
                { properties: { name: 'Virginia' }, geometry: { type: 'MultiPolygon', coordinates: [[mainland], [collapsedIsland], [island]] } },
                { properties: { name: 'Maryland' }, geometry: { type: 'Polygon', coordinates: [mainland, collapsedIsland.toReversed()] } },
            ],
        };
        const scriptUrl = pathToFileURL(join(repoRoot, 'projects/flights/scripts/generateUSStates.js')).href;
        const result = spawnSync(process.execPath, ['--input-type=module', '-e',
            `globalThis.fetch = async () => ({ ok: true, json: async () => (${JSON.stringify(source)}) }); await import(${JSON.stringify(scriptUrl)});`,
        ], { cwd, encoding: 'utf8' });
        expect(result.error).toBeUndefined();
        expect(result.status, result.stderr).toBe(0);
        const states = readJson(cwd, 'public/data/flights/usStates.geojson');
        expect(states.features.find((state: { properties: { abbr: string } }) => state.properties.abbr === 'VA').geometry)
            .toEqual({ type: 'MultiPolygon', coordinates: [[mainland], [island]] });
        expect(states.features.find((state: { properties: { abbr: string } }) => state.properties.abbr === 'MD').geometry)
            .toEqual({ type: 'Polygon', coordinates: [mainland] });
    });

    it('keeps the timestamp for equal data and updates it for changed data', () => {
        const cwd = makeWorkspace();
        const outputPath = join(cwd, 'public/data/flights/flights.geojson');
        const original = { type: 'FeatureCollection', features: [], metadata: { totalFlights: 0, generatedAt: '2024-01-01T00:00:00.000Z' } };
        expect(writeFlightGeoJson(outputPath, original, 2)).toBe(true);
        const bytes = readFileSync(outputPath, 'utf8');
        const next = { ...original, metadata: { ...original.metadata, generatedAt: '2024-01-02T00:00:00.000Z' } };
        expect(writeFlightGeoJson(outputPath, next, 2)).toBe(false);
        expect(readFileSync(outputPath, 'utf8')).toBe(bytes);
        expect(next.metadata.generatedAt).toBe('2024-01-02T00:00:00.000Z');
        const changed = { ...next, features: [{ type: 'Feature', properties: {}, geometry: null }] };
        expect(writeFlightGeoJson(outputPath, changed, 2)).toBe(true);
        expect(readJson(cwd, 'public/data/flights/flights.geojson')).toEqual(changed);
    });

    it.each(['not json', '{"metadata":{"generatedAt":"invalid"}}'])('replaces invalid existing output: %s', existing => {
        const cwd = makeWorkspace();
        const outputPath = join(cwd, 'public/data/flights/flights.geojson');
        writeFileSync(outputPath, existing);
        const output = { type: 'FeatureCollection', features: [], metadata: { generatedAt: '2024-01-01T00:00:00.000Z' } };
        expect(writeFlightGeoJson(outputPath, output)).toBe(true);
        expect(readJson(cwd, 'public/data/flights/flights.geojson')).toEqual(output);
    });

    it('does not treat filesystem read failures as missing output', () => {
        const cwd = makeWorkspace();
        expect(() => writeFlightGeoJson(join(cwd, 'public/data/flights'), { metadata: {} }))
            .toThrow();
    });
});
