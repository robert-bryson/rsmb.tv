import fs from 'fs';
import path from 'path';

const outputPath = path.resolve('public', 'data', 'flights', 'usStates.geojson');

// FIPS code → { abbr, name } for all 50 states + DC
const STATE_LOOKUP = {
    '01': { abbr: 'AL', name: 'Alabama' },
    '02': { abbr: 'AK', name: 'Alaska' },
    '04': { abbr: 'AZ', name: 'Arizona' },
    '05': { abbr: 'AR', name: 'Arkansas' },
    '06': { abbr: 'CA', name: 'California' },
    '08': { abbr: 'CO', name: 'Colorado' },
    '09': { abbr: 'CT', name: 'Connecticut' },
    '10': { abbr: 'DE', name: 'Delaware' },
    '11': { abbr: 'DC', name: 'District of Columbia' },
    '12': { abbr: 'FL', name: 'Florida' },
    '13': { abbr: 'GA', name: 'Georgia' },
    '15': { abbr: 'HI', name: 'Hawaii' },
    '16': { abbr: 'ID', name: 'Idaho' },
    '17': { abbr: 'IL', name: 'Illinois' },
    '18': { abbr: 'IN', name: 'Indiana' },
    '19': { abbr: 'IA', name: 'Iowa' },
    '20': { abbr: 'KS', name: 'Kansas' },
    '21': { abbr: 'KY', name: 'Kentucky' },
    '22': { abbr: 'LA', name: 'Louisiana' },
    '23': { abbr: 'ME', name: 'Maine' },
    '24': { abbr: 'MD', name: 'Maryland' },
    '25': { abbr: 'MA', name: 'Massachusetts' },
    '26': { abbr: 'MI', name: 'Michigan' },
    '27': { abbr: 'MN', name: 'Minnesota' },
    '28': { abbr: 'MS', name: 'Mississippi' },
    '29': { abbr: 'MO', name: 'Missouri' },
    '30': { abbr: 'MT', name: 'Montana' },
    '31': { abbr: 'NE', name: 'Nebraska' },
    '32': { abbr: 'NV', name: 'Nevada' },
    '33': { abbr: 'NH', name: 'New Hampshire' },
    '34': { abbr: 'NJ', name: 'New Jersey' },
    '35': { abbr: 'NM', name: 'New Mexico' },
    '36': { abbr: 'NY', name: 'New York' },
    '37': { abbr: 'NC', name: 'North Carolina' },
    '38': { abbr: 'ND', name: 'North Dakota' },
    '39': { abbr: 'OH', name: 'Ohio' },
    '40': { abbr: 'OK', name: 'Oklahoma' },
    '41': { abbr: 'OR', name: 'Oregon' },
    '42': { abbr: 'PA', name: 'Pennsylvania' },
    '44': { abbr: 'RI', name: 'Rhode Island' },
    '45': { abbr: 'SC', name: 'South Carolina' },
    '46': { abbr: 'SD', name: 'South Dakota' },
    '47': { abbr: 'TN', name: 'Tennessee' },
    '48': { abbr: 'TX', name: 'Texas' },
    '49': { abbr: 'UT', name: 'Utah' },
    '50': { abbr: 'VT', name: 'Vermont' },
    '51': { abbr: 'VA', name: 'Virginia' },
    '53': { abbr: 'WA', name: 'Washington' },
    '54': { abbr: 'WV', name: 'West Virginia' },
    '55': { abbr: 'WI', name: 'Wisconsin' },
    '56': { abbr: 'WY', name: 'Wyoming' },
};

// Public domain US state boundaries (simplified)
const SOURCE_URL =
    'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';

// Mapping from state name to FIPS code (reverse of STATE_LOOKUP)
const NAME_TO_FIPS = {};
for (const [fips, { name }] of Object.entries(STATE_LOOKUP)) {
    NAME_TO_FIPS[name] = fips;
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
        const fips = NAME_TO_FIPS[rawName];
        if (!fips) {
            // Skip territories (Puerto Rico, Guam, etc.)
            console.log(`  ⏭️  Skipping: ${rawName}`);
            continue;
        }

        const { abbr, name } = STATE_LOOKUP[fips];

        features.push({
            type: 'Feature',
            properties: {
                code: `US-${abbr}`,
                name,
                abbr,
            },
            geometry: feature.geometry,
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
    fs.writeFileSync(outputPath, JSON.stringify(geojson));

    console.log(`✅ Wrote ${features.length} states to ${outputPath}`);
}

main().catch((err) => {
    console.error('❌', err);
    process.exit(1);
});
