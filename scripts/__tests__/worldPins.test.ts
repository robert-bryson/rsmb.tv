// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseWorldBoundaries, parseWorldCountries, parseWorldRegionPins, pinArea, pinCountryCode, pinDisplayCode,
    resolveCountry, WORLD_COUNTRIES, WORLD_COUNTRY_COUNT, WORLD_REGION_COUNT, worldPinSchema, worldPinsDataSchema } from '../../shared/worldPins';
import { focusBounds, formatArea, formatRadius, pinCircles, pinPoints, rankPins } from '../../src/features/pins/geometry';
import { radiusLines } from '../../src/features/pins/radii';
import { national, publishedPins, readPinsArtifact } from './pinsFixtures';

const countries = worldPinsDataSchema.parse(readPinsArtifact('world/pins.json'));
const canada = parseWorldRegionPins(readPinsArtifact('world/regions/CAN.json'), 'CAN');
const ontario = canada.pins.find(pin => pin.name === 'Ontario')!;

describe('global publication', () => {
    it('covers all pinned country units and preserves the original U.S. national pin', () => {
        expect(WORLD_COUNTRY_COUNT).toBe(257);
        expect(WORLD_REGION_COUNT).toBe(4599);
        expect(countries.pins).toHaveLength(257);
        expect(countries.pins.find(pin => pin.id === 'country-US')).toEqual(national);
        expect(countries.pins.some(pin => pin.id === 'country-ATA')).toBe(false);
        expect(countries.metadata.verification).toMatchObject({ checked: 4799, circleSamples: 345528 });
    });

    it('validates every country-specific pin file and outline without inventing foreign FIPS codes', () => {
        let regions = 0;
        for (const country of WORLD_COUNTRIES) {
            if (country.code === 'USA') continue;
            const pins = parseWorldRegionPins(readPinsArtifact(`world/regions/${country.code}.json`), country.code);
            const outlines = parseWorldBoundaries(readPinsArtifact(`world/regions/${country.code}.geojson`), country.code);
            expect(pins.pins.map(pin => pin.id).sort()).toEqual(outlines.features.map(feature => feature.id).sort());
            expect(pins.pins.every(pin => !('fips' in pin))).toBe(true);
            regions += pins.pins.length;
        }
        expect(regions).toBe(4543);
        expect(parseWorldCountries(readPinsArtifact('world/countries.geojson')).features).toHaveLength(257);
    }, 20_000);

    it('rejects missing countries and regions, wrong country files, altered source hashes, and duplicate IDs', () => {
        expect(worldPinsDataSchema.safeParse({ ...countries, pins: countries.pins.slice(1) }).success).toBe(false);
        expect(worldPinsDataSchema.safeParse({ ...countries, metadata: { ...countries.metadata, sourceSha256: { country: 'wrong', region: 'wrong' } } }).success).toBe(false);
        expect(() => parseWorldRegionPins(canada, 'AUS')).toThrow();
        expect(() => parseWorldRegionPins({ ...canada, pins: canada.pins.slice(1) }, 'CAN')).toThrow();
        expect(() => parseWorldRegionPins({ ...canada, pins: [canada.pins[0], ...canada.pins.slice(0, -1)] }, 'CAN')).toThrow();
        expect(() => parseWorldBoundaries(readPinsArtifact('world/regions/CAN.geojson'), 'AUS')).toThrow();
    });

    it('rejects mismatched parents, coordinates, bearings, and implausible radii', () => {
        for (const invalid of [{ ...ontario, countryCode: 'AUS' }, { ...ontario, lng: 0, lat: 0 },
            { ...ontario, radiusMeters: 1e50 }, { ...ontario, countryName: 'Canada impostor' },
            { ...ontario, boundaryContacts: ontario.boundaryContacts.map(contact => ({ ...contact, bearingDegrees: 0 })) }]) {
            expect(worldPinSchema.safeParse(invalid).success).toBe(false);
        }
    });

    it('selects countries from validated URLs and infers the country for shared province links', () => {
        expect(resolveCountry('CAN', null)).toBe('CAN');
        expect(resolveCountry('ALL', null)).toBe('ALL');
        expect(resolveCountry(null, ontario.id)).toBe('CAN');
        expect(resolveCountry(null, 'country-AUS')).toBe('AUS');
        expect(resolveCountry('../../private', null)).toBe('USA');
        expect(resolveCountry(null, 'county-51610')).toBe('USA');
        expect(resolveCountry('ATA', null)).toBe('USA');
    });

    it('records country-boundary alignment and resolves the Coral Sea source inconsistency', () => {
        const regional = parseWorldRegionPins(readPinsArtifact('world/regions/CSI.json'), 'CSI').pins[0];
        const parent = countries.pins.find(pin => pin.id === 'country-CSI')!;
        expect(regional.countryBoundaryAdjusted).toBe(true);
        expect(regional.radiusMeters).toBeLessThanOrEqual(parent.radiusMeters + 25);
        expect(countries.metadata.adjustedRegionCount).toBe(1852);
    });
});

describe('shared global map geometry and presentation', () => {
    it('ranks real provinces, searches their codes, and labels mapped area honestly', () => {
        expect(canada.pins).toHaveLength(13);
        expect(rankPins(canada.pins, 'state', '', 'Ontario', 'largest')).toEqual([ontario]);
        expect(rankPins(canada.pins, 'state', '', 'CA-ON', 'name')).toEqual([ontario]);
        expect(pinDisplayCode(ontario)).toBe('CA-ON');
        expect(pinCountryCode(ontario)).toBe('CAN');
        expect(pinArea(ontario).label).toBe('Mapped area');
        expect(pinArea(national).label).toBe('Land area');
        expect(publishedPins.pins.filter(pin => pin.level === 'county')).toHaveLength(3235);
        expect(formatRadius(2, 'km')).toBe('0.0020 km');
        expect(formatArea(0.0122)).toBe('0.0122 km²');
    });

    it('uses the same circles, endpoints, labels, and selected-pin behavior for provinces', () => {
        const circle = pinCircles([ontario]).features[0].geometry.coordinates[0];
        expect(circle[0]).toEqual(circle.at(-1));
        expect(radiusLines([ontario], 'km', ontario.id).features[0].properties.name).toBe('Ontario, Canada');
        expect(pinPoints([ontario]).features[0].properties).toMatchObject({ stateAbbr: 'CA-ON', label: 'Ontario' });
        const bounds = focusBounds(ontario);
        expect(bounds[0]).toBeLessThan(bounds[2]);
        expect(bounds[1]).toBeLessThan(bounds[3]);
    });
});
