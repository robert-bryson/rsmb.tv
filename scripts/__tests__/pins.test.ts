// @vitest-environment node
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pinsDataSchema, pinSchema, parseBoundaries } from '../../shared/pins';
import { usStatesAndTerritories } from '../../shared/geography/usStates';
import { countiesVisible, destination, focusBounds, formatRadius, pinCircles, rankPins } from '../../src/features/pins/geometry';
import { radiusLines, radiusMinimumZoom, visibleRadiusPins } from '../../src/features/pins/radii';

const loadJson = (filename: string) => JSON.parse(fs.readFileSync(new URL(`../../public/data/pins-of-inaccessibility/${filename}`, import.meta.url), 'utf8'));
const data = pinsDataSchema.parse(loadJson('pins.json'));

describe('published pin data', () => {
    it('covers all 56 Census jurisdictions, with county equivalents in each one', () => {
        expect(data.metadata).toMatchObject({ countryCount: 1, stateCount: 56, countyCount: 3235, vintage: '2025' });
        expect(data.pins.filter(pin => pin.level === 'state').map(pin => pin.fips).sort())
            .toEqual(usStatesAndTerritories.map(state => state.fips).sort());
        expect(new Set(data.pins.filter(pin => pin.level === 'county').map(pin => pin.stateFips)).size).toBe(56);
        expect(data.pins.filter(pin => pin.kind === 'territory')).toHaveLength(5);
    });

    it('contains one national pole with a radius larger than every individual state', () => {
        const countries = data.pins.filter(pin => pin.level === 'country');
        expect(countries).toHaveLength(1);
        const national = countries[0];
        expect(national).toMatchObject({ id: 'country-US', name: 'United States', kind: 'country', stateFips: '' });
        expect(national.radiusMeters).toBeGreaterThan(Math.max(...data.pins.filter(pin => pin.level === 'state').map(pin => pin.radiusMeters)));
        expect(data.metadata.nationalDefinition).toContain('internal state borders dissolved');
        expect(pinsDataSchema.safeParse({ ...data, pins: data.pins.filter(pin => pin.level !== 'country') }).success).toBe(false);
        expect(pinSchema.safeParse({ ...national, stateFips: '20' }).success).toBe(false);
    });

    it('has a matching display boundary for every pin, including territorial counties', () => {
        for (const level of ['state', 'county'] as const) {
            const boundaries = parseBoundaries(loadJson(`${level === 'state' ? 'states' : 'counties'}.geojson`));
            const pins = data.pins.filter(pin => pin.level === level);
            expect(boundaries.features.map(feature => feature.id).sort()).toEqual(pins.map(pin => pin.id).sort());
        }
    });

    it('rejects duplicate, missing, and inconsistent jurisdiction identities', () => {
        const county = data.pins.find(pin => pin.level === 'county')!;
        expect(pinSchema.safeParse({ ...county, stateFips: '99' }).success).toBe(false);
        expect(pinSchema.safeParse({ ...county, radiusMeters: -1 }).success).toBe(false);
        expect(pinsDataSchema.safeParse({ ...data, pins: [...data.pins, county] }).success).toBe(false);
        expect(pinsDataSchema.safeParse({ ...data, pins: data.pins.filter(pin => pin.stateFips !== '60') }).success).toBe(false);
    });
});

describe('pin browsing', () => {
    it('filters by level, state, name, abbreviation, and FIPS, with stable radius ranking', () => {
        const largest = rankPins(data.pins, 'state', '', '', 'largest');
        expect(largest[0].name).toBe('Alaska');
        expect(rankPins(data.pins, 'state', '', '', 'smallest')[0].name).toBe('District of Columbia');
        const results = rankPins(data.pins, 'county', '29', 'st louis', 'largest');
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(pin => pin.stateFips === '29' && pin.level === 'county')).toBe(true);
        expect(rankPins(data.pins, 'county', '', 'GU', 'name').some(pin => pin.stateAbbr === 'GU')).toBe(true);
        expect(rankPins(data.pins, 'county', '', '29001', 'name').map(pin => pin.fips)).toEqual(['29001']);
        expect(largest.every((pin, i) => !i || largest[i - 1].radiusMeters >= pin.radiusMeters)).toBe(true);
        expect(rankPins(data.pins, 'county', '66', 'no such place', 'largest')).toEqual([]);
    });

    it('reveals counties at the automatic threshold, and respects manual overrides', () => {
        expect(countiesVisible('auto', 5.99)).toBe(false);
        expect(countiesVisible('auto', 6)).toBe(true);
        expect(countiesVisible('off', 12)).toBe(false);
        expect(countiesVisible('on', 2)).toBe(true);
    });

    it('converts units consistently, including small county radii', () => {
        expect(formatRadius(1609.344, 'mi')).toBe('1.00 mi');
        expect(formatRadius(1000, 'km')).toBe('1.00 km');
        expect(formatRadius(100000, 'km')).toBe('100.0 km');
    });
});

describe('ellipsoidal display geometry', () => {
    it('publishes distinct boundary contacts close to each calculated radius', () => {
        for (const pin of data.pins) {
            expect(pin.boundaryContacts.length).toBeGreaterThan(0);
            expect(pin.boundaryContacts.length).toBeLessThanOrEqual(4);
            expect(pin.boundaryContacts[0].coordinates).toEqual(pin.nearestBoundary);
            for (const contact of pin.boundaryContacts) {
                expect(Math.abs(contact.distanceMeters - pin.radiusMeters)).toBeLessThanOrEqual(Math.min(100, pin.radiusMeters * 0.01) + 2);
                const endpoint = destination(pin.lng, pin.lat, contact.bearingDegrees, contact.distanceMeters);
                expect(Math.abs((endpoint[0] - contact.coordinates[0] + 540) % 360 - 180)).toBeLessThan(0.00001);
                expect(endpoint[1]).toBeCloseTo(contact.coordinates[1], 5);
            }
        }
    });

    it('reveals radius details by zoom and physical size, and retains the selected pin', () => {
        const national = data.pins.find(pin => pin.level === 'country')!;
        const state = data.pins.find(pin => pin.id === 'state-08')!;
        const county = data.pins.find(pin => pin.id === 'county-51610')!;
        expect(visibleRadiusPins([national, state, county], 3, true, true, null)).toEqual([]);
        expect(radiusMinimumZoom(national)).toBe(4);
        expect(radiusMinimumZoom(state)).toBe(6);
        expect(radiusMinimumZoom(county)).toBeGreaterThan(9);
        expect(visibleRadiusPins([state, county], 6, true, true, null)).toEqual([state]);
        expect(visibleRadiusPins([county], 16, true, false, null)).toEqual([]);
        expect(visibleRadiusPins([national, state], 16, false, true, null)).toEqual([]);
        expect(visibleRadiusPins([], 3, false, false, county)).toEqual([county]);
    });

    it('draws geodesic spokes to the published contacts and changes their distance units', () => {
        const pin = data.pins.find(pin => pin.level === 'country')!;
        const miles = radiusLines([pin], 'mi', pin.id);
        const kilometers = radiusLines([pin], 'km', null);
        expect(miles.features).toHaveLength(pin.boundaryContacts.length);
        for (const [index, feature] of miles.features.entries()) {
            expect(feature.geometry.coordinates[0]).toEqual([pin.lng, pin.lat]);
            expect(feature.geometry.coordinates.at(-1)![0]).toBeCloseTo(pin.boundaryContacts[index].coordinates[0], 6);
            expect(feature.geometry.coordinates.at(-1)![1]).toBe(pin.boundaryContacts[index].coordinates[1]);
            expect(feature.geometry.coordinates.length).toBeGreaterThan(2);
            expect(feature.properties.selected).toBe(true);
            expect(feature.properties.label).toBe(formatRadius(pin.boundaryContacts[index].distanceMeters, 'mi'));
            expect(kilometers.features[index].properties.label).toBe(formatRadius(pin.boundaryContacts[index].distanceMeters, 'km'));
        }
    });

    it('matches independent WGS84 reference destinations at the equator and high latitude', () => {
        // pyproj.Geod(ellps='WGS84').fwd, with longitude, latitude, bearing, and distance.
        const east = destination(0, 0, 90, 100000);
        expect(east[0]).toBeCloseTo(0.8983152841195217, 7);
        expect(east[1]).toBeCloseTo(0, 7);
        const north = destination(-150, 65, 0, 100000);
        expect(north[0]).toBeCloseTo(-150, 7);
        expect(north[1]).toBeGreaterThan(65.89);
        expect(north[1]).toBeLessThan(65.90);
    });

    it('closes circles and frames the pin without spanning the globe at the date line', () => {
        const pin = { ...data.pins[0], lng: 179.99, lat: 52, radiusMeters: 10000 };
        const ring = pinCircles([pin]).features[0].geometry.coordinates[0];
        expect(ring[0]).toEqual(ring.at(-1));
        expect(ring).toHaveLength(73);
        expect(Math.max(...ring.map(point => point[0])) - Math.min(...ring.map(point => point[0]))).toBeLessThan(1);
        const [west, south, east, north] = focusBounds(pin);
        expect(west).toBeLessThan(pin.lng);
        expect(east).toBeGreaterThan(pin.lng);
        expect(south).toBeLessThan(pin.lat);
        expect(north).toBeGreaterThan(pin.lat);
    });
});
