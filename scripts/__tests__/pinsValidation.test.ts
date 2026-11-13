// @vitest-environment node
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseBoundaries, pinSchema, pinsDataSchema } from '../../shared/pins';

const read = (name: string) => JSON.parse(fs.readFileSync(new URL(`../../public/data/pins-of-inaccessibility/${name}`, import.meta.url), 'utf8'));
const publication = read('pins.json');
const national = publication.pins.find((pin: { level: string }) => pin.level === 'country');

describe('pin publication rejection', () => {
    it('rejects a truncated county archive even when its claimed total agrees', () => {
        const pins = publication.pins.filter((pin: { id: string }) => pin.id !== 'county-01001');
        expect(pinsDataSchema.safeParse({ ...publication, pins,
            metadata: { ...publication.metadata, countyCount: publication.metadata.countyCount - 1 } }).success).toBe(false);
    });

    it('rejects an unsupported Census vintage', () => {
        expect(pinsDataSchema.safeParse({ ...publication, metadata: { ...publication.metadata, vintage: '2024' } }).success).toBe(false);
    });

    it('rejects a bearing that sends a radius away from its published endpoint', () => {
        expect(pinSchema.safeParse({ ...national, boundaryContacts: national.boundaryContacts.map((contact: { bearingDegrees: number }, index: number) =>
            index ? contact : { ...contact, bearingDegrees: contact.bearingDegrees + 90 }) }).success).toBe(false);
    });

    it('rejects a primary contact that differs from the nearest boundary point', () => {
        expect(pinSchema.safeParse({ ...national, nearestBoundary: [0, 0] }).success).toBe(false);
    });

    it('rejects a pin outside its own geographic bounds', () => {
        expect(pinSchema.safeParse({ ...national, bounds: [0, 0, 1, 1] }).success).toBe(false);
    });

    it('rejects an unbounded radius before the renderer allocates geometry', () => {
        expect(pinSchema.safeParse({ ...national, radiusMeters: 1e100, boundaryContacts: [
            { ...national.boundaryContacts[0], distanceMeters: 1e100 },
        ] }).success).toBe(false);
    });
});

describe('boundary publication rejection', () => {
    it('rejects a feature whose public ID and FIPS identity disagree', () => {
        const boundaries = read('states.geojson');
        boundaries.features[0].properties.fips = '99';
        expect(() => parseBoundaries(boundaries)).toThrow();
    });

    it('rejects duplicate boundary features', () => {
        const boundaries = read('states.geojson');
        boundaries.features[1] = boundaries.features[0];
        expect(() => parseBoundaries(boundaries)).toThrow();
    });

    it('rejects a collapsed ring that cannot enclose an area', () => {
        const boundaries = read('states.geojson');
        boundaries.features[0].geometry = { type: 'Polygon', coordinates: [[[-100, 35], [-99, 35], [-98, 35], [-100, 35]]] };
        expect(() => parseBoundaries(boundaries)).toThrow();
    });
});
