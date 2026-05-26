import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';

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
    return spawnSync('node', [join(repoRoot, relativeScriptPath)], {
        cwd,
        encoding: 'utf8',
    });
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
    });
});
