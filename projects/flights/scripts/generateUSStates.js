import fs from 'fs';
import path from 'path';
import { writeFlightGeoJson } from './writeFlightGeoJson.js';
import { usStatesAndDc } from '../../../shared/geography/usStates.ts';

const outputPath = path.resolve('public', 'data', 'flights', 'usStates.geojson');

// Public domain US state boundaries (simplified)
const SOURCE_URL =
    'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';

const STATE_BY_NAME = new Map(usStatesAndDc.map(state => [state.name, state]));

function hasArea(ring) {
    if (ring.length < 4) return false;
    // Translate to the first vertex before computing area to avoid cancellation.
    const [originX, originY] = ring[0];
    let area = 0;
    for (let i = 1; i < ring.length; i++) {
        const [x1, y1] = ring[i - 1];
        const [x2, y2] = ring[i];
        area += (x1 - originX) * (y2 - originY) - (x2 - originX) * (y1 - originY);
    }
    return Math.abs(area) > 1e-12;
}

function cleanGeometry(geometry) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    // The source's shared VA/MD island collapses to one latitude. Spherical
    // triangulation can interpret that ring as the entire globe. Drop collapsed
    // exteriors and holes; retain every usable island and its original winding.
    const coordinates = polygons
        .filter(rings => hasArea(rings[0]))
        .map(rings => rings.filter(hasArea));
    if (coordinates.length === 0) {
        throw new Error('State boundary has no usable polygons');
    }
    return {
        type: geometry.type,
        coordinates: geometry.type === 'Polygon' ? coordinates[0] : coordinates,
    };
}

async function main() {
    console.log('📥 Fetching US state boundaries…');
    const res = await fetch(SOURCE_URL);
    if (!res.ok) {
        throw new Error(`Failed to fetch state boundaries: ${res.status} ${res.statusText}`);
    }
    const raw = await res.json();

    const features = [];

    for (const feature of raw.features) {
        const rawName = feature.properties.name;
        const state = STATE_BY_NAME.get(rawName);
        if (!state) {
            // Skip territories (Puerto Rico, Guam, etc.)
            console.log(`  ⏭️  Skipping: ${rawName}`);
            continue;
        }

        const { abbr, name } = state;

        features.push({
            type: 'Feature',
            properties: {
                code: `US-${abbr}`,
                name,
                abbr,
            },
            geometry: cleanGeometry(feature.geometry),
        });
    }

    // Sort alphabetically by name
    features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));

    const geojson = {
        type: 'FeatureCollection',
        metadata: {
            totalStates: features.length,
            generatedAt: new Date().toISOString(),
        },
        features,
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFlightGeoJson(outputPath, geojson);

    console.log(`✅ Wrote ${features.length} states to ${outputPath}`);
}

main().catch((err) => {
    console.error('❌', err);
    process.exit(1);
});
