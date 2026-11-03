import fs from 'node:fs';
import path from 'node:path';
import { airportCoordinates } from './airportCoordinates.js';

export function loadAirportMappings(directory) {
    return {
        countries: JSON.parse(fs.readFileSync(path.join(directory, 'countryNames.json'), 'utf8')),
        regions: JSON.parse(fs.readFileSync(path.join(directory, 'regionNames.json'), 'utf8')),
        continents: JSON.parse(fs.readFileSync(path.join(directory, 'continentNames.json'), 'utf8')),
    };
}

function mappedName(names, code) {
    const name = Object.hasOwn(names, code) ? names[code] : undefined;
    return typeof name === 'string' && name ? name : code;
}

/** Normalize common airport fields, or return null for unusable coordinates. */
export function normalizeAirport(row, mappings) {
    const coordinates = airportCoordinates(row);
    if (!coordinates) return null;
    const parsedElevation = Number(row.elevation_ft);
    const elevationFt = Number.isFinite(parsedElevation) ? parsedElevation : 0;
    return {
        name: row.name,
        municipality: row.municipality,
        region: row.iso_region,
        regionName: mappedName(mappings.regions, row.iso_region),
        country: row.iso_country,
        countryName: mappedName(mappings.countries, row.iso_country),
        continent: row.continent,
        continentName: mappedName(mappings.continents, row.continent),
        ...coordinates,
        elevationFt,
        elevationM: Math.round(elevationFt * 0.3048),
    };
}
