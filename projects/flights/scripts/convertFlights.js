import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { features } from 'process'

const base = path.resolve('projects', 'flights')

const airportsPath = path.resolve(base, 'data', 'airports.csv')
const flightsPath = path.resolve(base, 'data', 'flights.csv')
const flightsOutputPath = path.resolve('public', 'data', 'flights', 'flights.geojson')
const visitedAirportsOutputPath = path.resolve('public', 'data', 'flights', 'visitedAirports.geojson')

const airportsRaw = fs.readFileSync(airportsPath, 'utf-8')
const flightsRaw = fs.readFileSync(flightsPath, 'utf-8')

const airports = parse(airportsRaw, {
    columns: true,
    skip_empty_lines: true
})

const airportMap = {}
airports.forEach((a) => {
    airportMap[a.iata_code] = {
        name: a.name,
        municipality: a.municipality,
        region: a.iso_region,
        country: a.iso_country,
        continent: a.continent,
        lat: parseFloat(a.latitude_deg),
        lon: parseFloat(a.longitude_deg),
        elev_ft: parseFloat(a.elevation_ft)
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
        country: origin.country,
        continent: origin.continent,
        lon: origin.lon,
        lat: origin.lat,
        name: origin.name,
        dates: new Set([row.date]),
        visitCount: 1,
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
        country: destination.country,
        continent: destination.continent,
        lon: destination.lon,
        lat: destination.lat,
        name: destination.name,
        dates: new Set([row.date]),
        visitCount: 1,
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
      origin_country: origin.country,
      origin_continent: origin.continent,
      destination_code: row.destination,
      destination_name: destination.name,
      destination_municipality: destination.municipality,
      destination_region: destination.region,
      destination_country: destination.country,
      destination_continent: destination.continent,
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
      country: a.country,
      continent: a.continent,
      name: a.name || '',
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
