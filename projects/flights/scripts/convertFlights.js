import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

const base = path.resolve('projects', 'flights')

const airportsPath = path.resolve(base, 'data', 'airports.csv')
const flightsPath = path.resolve(base, 'data', 'flights.csv')
const flightsOutputPath = path.resolve('public', 'data', 'flights', 'flights.geojson')
const visitedAirportsOutputPath = path.resolve('public', 'data', 'flights', 'visitedAirports.geojson')

// ISO 3166-1 alpha-2 country code to English name mapping
const COUNTRY_NAMES = {
  AL: 'Albania', AR: 'Argentina', AT: 'Austria', AU: 'Australia', BR: 'Brazil',
  CA: 'Canada', CH: 'Switzerland', CL: 'Chile', CN: 'China', CO: 'Colombia',
  CR: 'Costa Rica', CY: 'Cyprus', CZ: 'Czechia', DE: 'Germany', DK: 'Denmark',
  EC: 'Ecuador', EG: 'Egypt', ES: 'Spain', FR: 'France', GB: 'United Kingdom',
  GR: 'Greece', GT: 'Guatemala', HR: 'Croatia', HU: 'Hungary', IE: 'Ireland',
  IS: 'Iceland', IT: 'Italy', JP: 'Japan', KR: 'South Korea', MA: 'Morocco',
  MX: 'Mexico', NL: 'Netherlands', NO: 'Norway', NZ: 'New Zealand', PA: 'Panama',
  PE: 'Peru', PH: 'Philippines', PL: 'Poland', PT: 'Portugal', RU: 'Russia',
  SE: 'Sweden', SG: 'Singapore', TH: 'Thailand', TR: 'Turkey', TW: 'Taiwan',
  UA: 'Ukraine', US: 'United States', VN: 'Vietnam', ZA: 'South Africa',
  AE: 'United Arab Emirates', BE: 'Belgium', FI: 'Finland', HK: 'Hong Kong',
  ID: 'Indonesia', IN: 'India', MY: 'Malaysia', RO: 'Romania', SK: 'Slovakia',
}

// Continent code to English name mapping
const CONTINENT_NAMES = {
  AF: 'Africa',
  AN: 'Antarctica', 
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  OC: 'Oceania',
  SA: 'South America',
}

// ISO 3166-2 region code to English name mapping (for regions in user's visited airports)
const REGION_NAMES = {
  // United States
  'US-AZ': 'Arizona', 'US-CA': 'California', 'US-CO': 'Colorado', 'US-FL': 'Florida',
  'US-GA': 'Georgia', 'US-HI': 'Hawaii', 'US-ID': 'Idaho', 'US-IL': 'Illinois',
  'US-LA': 'Louisiana', 'US-MA': 'Massachusetts', 'US-MI': 'Michigan', 'US-MN': 'Minnesota',
  'US-MO': 'Missouri', 'US-NC': 'North Carolina', 'US-NJ': 'New Jersey', 'US-NV': 'Nevada',
  'US-NY': 'New York', 'US-OR': 'Oregon', 'US-PA': 'Pennsylvania', 'US-TN': 'Tennessee',
  'US-TX': 'Texas', 'US-UT': 'Utah', 'US-VA': 'Virginia', 'US-WA': 'Washington',
  'US-WI': 'Wisconsin',
  // Canada
  'CA-AB': 'Alberta', 'CA-BC': 'British Columbia', 'CA-ON': 'Ontario', 'CA-QC': 'Quebec',
  // United Kingdom
  'GB-ENG': 'England', 'GB-SCT': 'Scotland', 'GB-WLS': 'Wales', 'GB-NIR': 'Northern Ireland',
  // Germany
  'DE-BE': 'Berlin', 'DE-BR': 'Brandenburg', 'DE-HE': 'Hesse', 'DE-NW': 'North Rhine-Westphalia',
  'DE-BY': 'Bavaria', 'DE-HH': 'Hamburg',
  // France
  'FR-IDF': 'Île-de-France', 'FR-PAC': 'Provence-Alpes-Côte d\'Azur', 'FR-ARA': 'Auvergne-Rhône-Alpes',
  // Spain
  'ES-CT': 'Catalonia', 'ES-MD': 'Madrid', 'ES-AN': 'Andalusia', 'ES-CN': 'Canary Islands',
  // Italy
  'IT-25': 'Lombardy', 'IT-21': 'Piedmont', 'IT-62': 'Lazio', 'IT-52': 'Tuscany',
  // Mexico
  'MX-BCN': 'Baja California', 'MX-DIF': 'Mexico City', 'MX-JAL': 'Jalisco',
  'MX-NLE': 'Nuevo León', 'MX-ROO': 'Quintana Roo',
  // Brazil
  'BR-SP': 'São Paulo', 'BR-RJ': 'Rio de Janeiro',
  // Argentina
  'AR-B': 'Buenos Aires Province', 'AR-V': 'Córdoba',
  // Chile
  'CL-RM': 'Santiago Metropolitan', 'CL-MA': 'Magallanes',
  // Colombia
  'CO-DC': 'Bogotá',
  // Peru
  'PE-LIM': 'Lima',
  // Ecuador
  'EC-P': 'Pichincha',
  // Costa Rica
  'CR-A': 'Alajuela',
  // Guatemala
  'GT-GU': 'Guatemala',
  // Panama
  'PA-8': 'Panamá',
  // Other Europe
  'AT-9': 'Vienna', 'CH-GE': 'Geneva', 'CH-ZH': 'Zürich', 'CY-04': 'Famagusta',
  'CZ-PR': 'Prague', 'DK-84': 'Capital Region', 'GR-I': 'Attica', 'HR-17': 'Split-Dalmatia',
  'HR-19': 'Dubrovnik-Neretva', 'HU-BU': 'Budapest', 'IE-D': 'Dublin', 'IS-2': 'Southern Peninsula',
  'NL-NH': 'North Holland', 'NO-32': 'Vestfold', 'NO-46': 'Vestland', 'PT-13': 'Porto',
  'PT-20': 'Azores', 'SE-AB': 'Stockholm', 'AL-02': 'Fier',
  // Asia
  'KR-28': 'Incheon', 'SG-04': 'Central Singapore', 'TH-10': 'Bangkok', 'TH-83': 'Phuket',
  'TR-34': 'Istanbul', 'TW-TAO': 'Taoyuan', 'VN-SE': 'Ho Chi Minh City',
  // Africa
  'EG-C': 'Cairo', 'EG-JS': 'South Sinai', 'MA-06': 'Casablanca-Settat', 'MA-07': 'Marrakech-Safi',
  // Ukraine
  'UA-46': 'Lviv',
}

// Helper to get normalized country name
function getCountryName(isoCode) {
  return COUNTRY_NAMES[isoCode] || isoCode
}

// Helper to get normalized continent name
function getContinentName(code) {
  return CONTINENT_NAMES[code] || code
}

// Helper to get normalized region name
function getRegionName(isoRegion) {
  return REGION_NAMES[isoRegion] || isoRegion
}

// Convert feet to meters
function feetToMeters(ft) {
  return Math.round(ft * 0.3048)
}

const airportsRaw = fs.readFileSync(airportsPath, 'utf-8')
const flightsRaw = fs.readFileSync(flightsPath, 'utf-8')

const airports = parse(airportsRaw, {
    columns: true,
    skip_empty_lines: true
})

const airportMap = {}
airports.forEach((a) => {
    const elevFt = parseFloat(a.elevation_ft) || 0
    airportMap[a.iata_code] = {
        name: a.name,
        municipality: a.municipality,
        region: a.iso_region,
        regionName: getRegionName(a.iso_region),
        country: a.iso_country,
        countryName: getCountryName(a.iso_country),
        continent: a.continent,
        continentName: getContinentName(a.continent),
        lat: parseFloat(a.latitude_deg),
        lon: parseFloat(a.longitude_deg),
        elevationFt: elevFt,
        elevationM: feetToMeters(elevFt),
    }
})

const flights = parse(flightsRaw, {
    columns: true,
    skip_empty_lines: true,
})

const visitedAirports = {}
const stats = {
  internationalFlights: 0,
  intercontinentalFlights: 0,
  domesticFlights: 0
}

const flightFeatures = flights.map((row, index) => {
    const origin = airportMap[row.origin]
    const destination = airportMap[row.destination]

    if (!origin || !destination) {
        console.warn(`⚠️ Skipping flight with missing airport: ${row.origin} → ${row.destination}`)
        return null
    }
  
    if (origin.country == destination.country) {
      stats.domesticFlights += 1
    }
    if (origin.country != destination.country) {
      stats.internationalFlights += 1
    }
    if (origin.continent != destination.continent) {
      stats.intercontinentalFlights += 1
    }
  
    if (row.origin in visitedAirports) {
      visitedAirports[row.origin].dates.add(row.date);
      visitedAirports[row.origin].visitCount += 1
      visitedAirports[row.origin].departureCount += 1
    } else {
      visitedAirports[row.origin] = {
        code: row.origin,
        municipality: origin.municipality,
        region: origin.region,
        regionName: origin.regionName,
        country: origin.country,
        countryName: origin.countryName,
        continent: origin.continent,
        continentName: origin.continentName,
        lon: origin.lon,
        lat: origin.lat,
        name: origin.name,
        elevationFt: origin.elevationFt,
        elevationM: origin.elevationM,
        dates: new Set([row.date]),
        visitCount: 1,
        arrivalCount: 0,
        departureCount: 1
      }
    }
    if (row.destination in visitedAirports) {
      visitedAirports[row.destination].dates.add(row.date);
      visitedAirports[row.destination].visitCount += 1
      visitedAirports[row.destination].arrivalCount += 1
    } else {
      visitedAirports[row.destination] = {
        code: row.destination,
        municipality: destination.municipality,
        region: destination.region,
        regionName: destination.regionName,
        country: destination.country,
        countryName: destination.countryName,
        continent: destination.continent,
        continentName: destination.continentName,
        lon: destination.lon,
        lat: destination.lat,
        name: destination.name,
        elevationFt: destination.elevationFt,
        elevationM: destination.elevationM,
        dates: new Set([row.date]),
        visitCount: 1,
        departureCount: 0,
        arrivalCount: 1
      }
    }

    return {
    type: 'Feature',
    properties: {
      id: index + 1,
      date: row.date,
      airline: row.airline,
      origin_code: row.origin,
      origin_name: origin.name,
      origin_municipality: origin.municipality,
      origin_region: origin.region,
      origin_regionName: origin.regionName,
      origin_country: origin.country,
      origin_countryName: origin.countryName,
      origin_continent: origin.continent,
      origin_continentName: origin.continentName,
      origin_lon: origin.lon,
      origin_lat: origin.lat,
      destination_code: row.destination,
      destination_name: destination.name,
      destination_municipality: destination.municipality,
      destination_region: destination.region,
      destination_regionName: destination.regionName,
      destination_country: destination.country,
      destination_countryName: destination.countryName,
      destination_continent: destination.continent,
      destination_continentName: destination.continentName,
      destination_lon: destination.lon,
      destination_lat: destination.lat,
    },
    geometry: {
      type: 'LineString',
      coordinates: [
        [origin.lon, origin.lat],
        [destination.lon, destination.lat],
      ],
    },
  }
}).filter(Boolean)

const flightsGeojson = {
    type: 'FeatureCollection',
    features: flightFeatures,
}

fs.mkdirSync(path.dirname(flightsOutputPath), {recursive: true})
fs.writeFileSync(flightsOutputPath, JSON.stringify(flightsGeojson, null, 2))
console.log(`✅ Generated ${flightFeatures.length} flights to ${flightsOutputPath}`)

const visitedAirportsFeatures = Object.values(visitedAirports)
  .map(a => ({
    type: 'Feature',
    properties: {
      code: a.code,
      municipality: a.municipality,
      region: a.region,
      regionName: a.regionName,
      country: a.country,
      countryName: a.countryName,
      continent: a.continent,
      continentName: a.continentName,
      name: a.name || '',
      elevationFt: a.elevationFt || 0,
      elevationM: a.elevationM || 0,
      visitDates: Array.from(a.dates),
      visitCount: a.visitCount || 0,
      arrivalCount: a.arrivalCount || 0,
      departureCount: a.departureCount || 0,
    },
    geometry: {
      type: 'Point',
      coordinates: [parseFloat(a.lon), parseFloat(a.lat)],
    }
  })
)

fs.writeFileSync(visitedAirportsOutputPath, JSON.stringify({
  type: 'FeatureCollection',
  features: visitedAirportsFeatures,
}, null, 2))

console.log(`✅ Generated ${visitedAirportsFeatures.length} airports to ${visitedAirportsOutputPath}`)
