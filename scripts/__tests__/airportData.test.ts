// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadAirportMappings, normalizeAirport } from '../../projects/flights/scripts/airportData.js';

const row = Object.freeze({
    name: 'Seattle-Tacoma International Airport',
    municipality: 'Seattle',
    iso_region: 'US-WA',
    iso_country: 'US',
    continent: 'NA',
    latitude_deg: '47.4502',
    longitude_deg: '-122.3088',
    elevation_ft: '433',
});
const mappings = {
    countries: Object.freeze({ US: 'United States' }),
    regions: Object.freeze({ 'US-WA': 'Washington' }),
    continents: Object.freeze({ NA: 'North America' }),
};
const directories: string[] = [];

afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('airport normalization', () => {
    it('loads the three mapping files from the supplied directory', () => {
        const directory = mkdtempSync(join(tmpdir(), 'rsmb-airport-mappings-'));
        directories.push(directory);
        for (const [file, data] of Object.entries({
            countryNames: mappings.countries,
            regionNames: mappings.regions,
            continentNames: mappings.continents,
        })) {
            writeFileSync(join(directory, `${file}.json`), JSON.stringify(data));
        }
        expect(loadAirportMappings(directory)).toEqual(mappings);
    });

    it('returns common properties and coordinates without changing the input', () => {
        expect(normalizeAirport(row, mappings)).toEqual({
            name: row.name,
            municipality: 'Seattle',
            region: 'US-WA',
            regionName: 'Washington',
            country: 'US',
            countryName: 'United States',
            continent: 'NA',
            continentName: 'North America',
            lat: 47.4502,
            lon: -122.3088,
            elevationFt: 433,
            elevationM: 132,
        });
    });

    it('rejects unusable coordinates before normalizing other fields', () => {
        expect(normalizeAirport({ ...row, latitude_deg: '47north' }, mappings)).toBeNull();
    });

    it.each(['ZZ', 'constructor', 'toString', '__proto__'])('retains unmapped codes such as %s', code => {
        const airport = normalizeAirport({ ...row, iso_country: code, iso_region: code, continent: code }, mappings);
        expect(airport).toMatchObject({ countryName: code, regionName: code, continentName: code });
    });

    it('uses only nonempty string names from own mapping entries', () => {
        const airport = normalizeAirport(row, {
            countries: { US: '' },
            regions: { 'US-WA': { name: 'Washington' } },
            continents: Object.create({ NA: 'Inherited name' }),
        });
        expect(airport).toMatchObject({ countryName: 'US', regionName: 'US-WA', continentName: 'NA' });
    });

    it.each(['', ' ', undefined, 'NaN', 'Infinity', '-Infinity', '1e309', '433feet'])(
        'uses the existing zero default for missing or invalid elevation %s', elevation_ft => {
            expect(normalizeAirport({ ...row, elevation_ft }, mappings)).toMatchObject({ elevationFt: 0, elevationM: 0 });
        },
    );

    it.each([
        ['-10', -10, -3],
        [' 433.5 ', 433.5, 132],
        ['0', 0, 0],
    ])('converts valid elevation %s from feet to meters', (elevation_ft, elevationFt, elevationM) => {
        expect(normalizeAirport({ ...row, elevation_ft }, mappings)).toMatchObject({ elevationFt, elevationM });
    });
});
