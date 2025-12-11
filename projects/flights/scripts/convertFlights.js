import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

const base = path.resolve('projects', 'flights')

const airportsPath = path.resolve(base, 'data', 'airports.csv')
const flightsPath = path.resolve(base, 'data', 'flights.csv')
const flightsOutputPath = path.resolve('public', 'data', 'flights', 'flights.geojson')
const visitedAirportsOutputPath = path.resolve('public', 'data', 'flights', 'visitedAirports.geojson')

// Load pre-generated name mappings (run generateNameMappings.js to update these)
const mappingsDir = path.resolve(base, 'data', 'mappings')
const COUNTRY_NAMES = JSON.parse(fs.readFileSync(path.join(mappingsDir, 'countryNames.json'), 'utf8'))
const REGION_NAMES = JSON.parse(fs.readFileSync(path.join(mappingsDir, 'regionNames.json'), 'utf8'))
const CONTINENT_NAMES = JSON.parse(fs.readFileSync(path.join(mappingsDir, 'continentNames.json'), 'utf8'))

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
  domesticFlights: 0,
  years: new Set(),
  minYear: Infinity,
  maxYear: -Infinity
}

const flightFeatures = flights.map((row, index) => {
    const origin = airportMap[row.origin]
    const destination = airportMap[row.destination]

    if (!origin || !destination) {
        console.warn(`⚠️ Skipping flight with missing airport: ${row.origin} → ${row.destination}`)
        return null
    }
  
    // Parse year from date
    const dateParts = row.date.split('/')
    const year = parseInt(dateParts[2], 10)
    stats.years.add(year)
    stats.minYear = Math.min(stats.minYear, year)
    stats.maxYear = Math.max(stats.maxYear, year)
  
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
    metadata: {
      totalFlights: flightFeatures.length,
      years: Array.from(stats.years).sort((a, b) => a - b),
      minYear: stats.minYear,
      maxYear: stats.maxYear,
      internationalFlights: stats.internationalFlights,
      intercontinentalFlights: stats.intercontinentalFlights,
      domesticFlights: stats.domesticFlights,
      generatedAt: new Date().toISOString()
    }
}

fs.mkdirSync(path.dirname(flightsOutputPath), {recursive: true})
fs.writeFileSync(flightsOutputPath, JSON.stringify(flightsGeojson, null, 2))
console.log(`✅ Generated ${flightFeatures.length} flights to ${flightsOutputPath}`)
console.log(`   Years: ${stats.minYear} - ${stats.maxYear} (${stats.years.size} unique)`)

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
