import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atlasGeographyName } from '../shared/atlasGeography.ts';

// Natural Earth v5.1.2, public domain: https://www.naturalearthdata.com/about/terms-of-use/
const source = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson';
const root = fileURLToPath(new URL('../', import.meta.url));

export function atlasGeometryBounds(geometry) {
    if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) {
        throw new Error('Geographic bounds require Polygon or MultiPolygon geometry.');
    }
    const longitudeSet = new Set();
    let south = Infinity;
    let north = -Infinity;
    const visit = coordinates => {
        if (typeof coordinates[0] === 'number') {
            const [longitude, latitude] = coordinates;
            if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(latitude) > 90) {
                throw new Error('Geographic bounds require finite coordinates and valid latitudes.');
            }
            longitudeSet.add(((longitude % 360) + 360) % 360);
            south = Math.min(south, latitude);
            north = Math.max(north, latitude);
        } else coordinates.forEach(visit);
    };
    visit(geometry.coordinates);
    const longitudes = [...longitudeSet].sort((a, b) => a - b);
    if (!longitudes.length) throw new Error('Geographic bounds require at least one coordinate.');
    let gap = -1;
    let start = 0;
    for (let index = 0; index < longitudes.length; index++) {
        const next = longitudes[(index + 1) % longitudes.length] + (index === longitudes.length - 1 ? 360 : 0);
        if (next - longitudes[index] > gap) { gap = next - longitudes[index]; start = index; }
    }
    let west = longitudes[(start + 1) % longitudes.length];
    let east = longitudes[start];
    if (east < west) east += 360;
    if ((west + east) / 2 >= 180) { west -= 360; east -= 360; }
    return [west, south, east, north].map(value => Number(value.toFixed(4)));
}

export async function generateAtlasGeographyBounds({
    fetchImpl = fetch,
    outputPath = path.join(root, 'src/features/trips/atlas/atlasGeographyBounds.json'),
    timeoutMs = 30_000,
} = {}) {
    const data = { countries: {}, regions: {} };
    for (const name of ['ne_50m_admin_0_countries', 'ne_50m_admin_1_states_provinces']) {
        const response = await fetchImpl(`${source}/${name}.geojson`, { signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
        const collection = await response.json();
        for (const feature of collection.features) {
            const properties = feature.properties;
            const country = properties.ISO_A2_EH ?? properties.ISO_A2 ?? properties.iso_a2;
            if (!/^[A-Z]{2}$/.test(country)) continue;
            if (name.includes('admin_0')) data.countries[country] = atlasGeometryBounds(feature.geometry);
            else if (['US', 'CA'].includes(country)) {
                const bounds = atlasGeometryBounds(feature.geometry);
                for (const label of [properties.name, properties.name_en].filter(Boolean)) {
                    data.regions[`${country}/${atlasGeographyName(label)}`] = bounds;
                }
            }
        }
    }
    for (const key of ['countries', 'regions']) {
        data[key] = Object.fromEntries(Object.entries(data[key]).sort(([a], [b]) => a.localeCompare(b, 'en')));
    }
    await fs.writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
    return data;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const data = await generateAtlasGeographyBounds();
    console.log(`Wrote ${Object.keys(data.countries).length} countries and ${Object.keys(data.regions).length} region names.`);
}
