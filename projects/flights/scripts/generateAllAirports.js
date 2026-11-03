import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { writeFlightGeoJson } from './writeFlightGeoJson.js';
import { loadAirportMappings, normalizeAirport } from './airportData.js';

const base = path.resolve('projects', 'flights');

const airportsPath = path.resolve(base, 'data', 'airports.csv');
const outputPath = path.resolve('public', 'data', 'flights', 'allAirports.geojson');
const visitedPath = path.resolve('public', 'data', 'flights', 'visitedAirports.geojson');

// Load pre-generated name mappings
const mappingsDir = path.resolve(base, 'data', 'mappings');
const mappings = loadAirportMappings(mappingsDir);

// Load airports CSV
const airportsRaw = fs.readFileSync(airportsPath, 'utf-8');
const airports = parse(airportsRaw, {
    columns: true,
    skip_empty_lines: true,
});

// Load visited airports to mark which ones have been visited
let visitedCodes = new Set();
try {
    const visitedData = JSON.parse(fs.readFileSync(visitedPath, 'utf8'));
    visitedCodes = new Set(visitedData.features.map(f => f.properties.code));
} catch {
    console.warn('⚠️ Could not load visited airports, all will be marked as unvisited');
}

// Generate features for all airports
const invalidCoordinateAirports = [];
const features = airports.map(a => {
    const airport = normalizeAirport(a, mappings);

    // Skip invalid coordinates
    if (!airport) {
        invalidCoordinateAirports.push(`${a.iata_code || 'unknown'} (${a.name || 'unnamed airport'})`);
        return null;
    }
    const { lat, lon, ...properties } = airport;

    return {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [lon, lat],
        },
        properties: {
            code: a.iata_code,
            ...properties,
            municipality: properties.municipality || '',
            visited: visitedCodes.has(a.iata_code),
        },
    };
}).filter(Boolean);

if (invalidCoordinateAirports.length > 0) {
    const sample = invalidCoordinateAirports.slice(0, 10).join(', ');
    const suffix = invalidCoordinateAirports.length > 10 ? `, and ${invalidCoordinateAirports.length - 10} more` : '';
    console.warn(`⚠️ Skipped ${invalidCoordinateAirports.length} airport(s) with invalid coordinates: ${sample}${suffix}`);
}

// Create GeoJSON
const geojson = {
    type: 'FeatureCollection',
    metadata: {
        totalAirports: features.length,
        visitedCount: features.filter(f => f.properties.visited).length,
        unvisitedCount: features.filter(f => !f.properties.visited).length,
        continents: [...new Set(features.map(f => f.properties.continent))].sort(),
        countries: [...new Set(features.map(f => f.properties.country))].sort(),
        generatedAt: new Date().toISOString(),
    },
    features,
};

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

writeFlightGeoJson(outputPath, geojson);
console.log(`✅ Generated ${features.length} airports to ${outputPath}`);
console.log(`   Visited: ${geojson.metadata.visitedCount}, Unvisited: ${geojson.metadata.unvisitedCount}`);
console.log(`   Continents: ${geojson.metadata.continents.length}, Countries: ${geojson.metadata.countries.length}`);
