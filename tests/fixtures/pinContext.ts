import type { PinDetails } from '../../shared/pinDetails';

// Small, real sample from the offline enrichment; tests never call third-party APIs.
export const pinContextFixture: PinDetails = {
    id: 'country-US', lat: 39.051866, lng: -97.442203, elevationMeters: 390, elevationDataset: 'srtm30m',
    nearestPlace: { geonameId: 4268150, name: 'Bennington', lat: 39.03056, lng: -97.5942,
        admin1Name: 'Kansas', countryCode: 'US', countryName: 'United States', distanceMeters: 13370.2, bearingDegrees: 79.76 },
};

export const pinContextManifestFixture = {
    schemaVersion: 1, release: 'a'.repeat(64), generatedAt: '2026-11-13T12:00:00Z',
    files: { 'countries.json': { sha256: 'b'.repeat(64), bytes: 600, count: 1 } },
    coverage: { pins: 1, elevations: 1, places: 1 },
};

export const pinContextFileFixture = { schemaVersion: 1, scope: 'countries.json', pins: [pinContextFixture] };
