/**
 * One-time script to generate country and region name mappings from airports.csv
 * Uses npm packages for comprehensive ISO 3166 data.
 * 
 * Run: npm install i18n-iso-countries iso-3166-2 --save-dev
 * Then: node projects/flights/scripts/generateNameMappings.js
 * 
 * This generates JSON files that convertFlights.js imports, so the npm packages
 * are only needed when regenerating the mappings (e.g., when airports.csv changes).
 */

import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import countries from 'i18n-iso-countries'
import { createRequire } from 'module'
import iso3166 from 'iso-3166-2'

// Use createRequire to import JSON in ESM
const require = createRequire(import.meta.url)
const englishCountries = require('i18n-iso-countries/langs/en.json')

// Register English locale for country names
countries.registerLocale(englishCountries)

const base = path.resolve('projects', 'flights')
const airportsPath = path.resolve(base, 'data', 'airports.csv')
const outputDir = path.resolve(base, 'data', 'mappings')

// Continent codes are simple and fixed - no package needed
const CONTINENT_NAMES = {
  AF: 'Africa',
  AN: 'Antarctica',
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  OC: 'Oceania',
  SA: 'South America',
}

// Manual overrides for special cases or preferred names
const COUNTRY_OVERRIDES = {
  TW: 'Taiwan',           // iso package may say "Taiwan, Province of China"
  KR: 'South Korea',      // iso package says "Korea, Republic of"
  VN: 'Vietnam',          // iso package says "Viet Nam"
  GB: 'United Kingdom',   // ensure consistency
  US: 'United States',    // ensure consistency
  CZ: 'Czechia',          // iso package may say "Czech Republic"
  HK: 'Hong Kong',        // ensure it's not "Hong Kong SAR"
  XP: 'International',    // used for airports spanning multiple countries
}

// Manual overrides for regions where iso-3166-2 is wrong or missing
const REGION_OVERRIDES = {
  'TW-TAO': 'Taoyuan',
  'VN-SE': 'Ho Chi Minh City',
  'EG-C': 'Cairo',
  'EG-JS': 'South Sinai',
  'GR-I': 'Attica',
  'IS-2': 'Southern Peninsula',
  'CY-04': 'Famagusta',
}

console.log('📖 Reading airports.csv...')
const airportsRaw = fs.readFileSync(airportsPath, 'utf-8')
const airports = parse(airportsRaw, {
  columns: true,
  skip_empty_lines: true
})

// Extract unique country and region codes
const countryCodes = new Set()
const regionCodes = new Set()

airports.forEach(a => {
  if (a.iso_country) countryCodes.add(a.iso_country)
  if (a.iso_region) regionCodes.add(a.iso_region)
})

console.log(`📊 Found ${countryCodes.size} unique countries, ${regionCodes.size} unique regions`)

// Build country names mapping
const countryNames = {}
let missingCountries = []

for (const code of countryCodes) {
  if (COUNTRY_OVERRIDES[code]) {
    countryNames[code] = COUNTRY_OVERRIDES[code]
  } else {
    const name = countries.getName(code, 'en')
    if (name) {
      countryNames[code] = name
    } else {
      missingCountries.push(code)
      countryNames[code] = code // fallback to code
    }
  }
}

// Build region names mapping
const regionNames = {}
let missingRegions = []

for (const code of regionCodes) {
  if (REGION_OVERRIDES[code]) {
    regionNames[code] = REGION_OVERRIDES[code]
  } else {
    const sub = iso3166.subdivision(code)
    if (sub && sub.name) {
      regionNames[code] = sub.name
    } else {
      missingRegions.push(code)
      regionNames[code] = code // fallback to code
    }
  }
}

// Sort objects by key for consistent output
const sortObject = (obj) => {
  return Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = obj[key]
    return acc
  }, {})
}

// Write output files
fs.mkdirSync(outputDir, { recursive: true })

fs.writeFileSync(
  path.resolve(outputDir, 'countryNames.json'),
  JSON.stringify(sortObject(countryNames), null, 2)
)

fs.writeFileSync(
  path.resolve(outputDir, 'regionNames.json'),
  JSON.stringify(sortObject(regionNames), null, 2)
)

fs.writeFileSync(
  path.resolve(outputDir, 'continentNames.json'),
  JSON.stringify(sortObject(CONTINENT_NAMES), null, 2)
)

console.log(`✅ Generated mappings to ${outputDir}/`)
console.log(`   - countryNames.json (${Object.keys(countryNames).length} entries)`)
console.log(`   - regionNames.json (${Object.keys(regionNames).length} entries)`)
console.log(`   - continentNames.json (${Object.keys(CONTINENT_NAMES).length} entries)`)

if (missingCountries.length > 0) {
  console.log(`\n⚠️  Missing country names (add to COUNTRY_OVERRIDES):`)
  missingCountries.forEach(c => console.log(`   ${c}`))
}

if (missingRegions.length > 0) {
  console.log(`\n⚠️  Missing region names (add to REGION_OVERRIDES):`)
  missingRegions.forEach(r => console.log(`   ${r}`))
}
