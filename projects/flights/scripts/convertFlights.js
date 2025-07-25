import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

const base = path.resolve('projects', 'flights')

const airportsPath = path.resolve(base, 'data', 'airports.csv')
const flightsPath = path.resolve(base, 'data', 'flights.csv')
const outputPath = path.resolve('public', 'data', 'flights', 'flights.geojson')

const airportsRaw = fs.readFileSync(airportsPath, 'utf-8')
const flightsRaw = fs.readFileSync(flightsPath, 'utf-8')

const airports = parse(airportsRaw, {
    columns: true,
    skip_empty_lines: true
})

const airportMap = {}
airports.forEach((a) => {
    airportMap[a.code] = {
        name: a.name,
        city: a.city,
        state: a.state,
        country: a.country,
        lat: parseFloat(a.lat),
        lon: parseFloat(a.lon),
    }
})

const flights = parse(flightsRaw, {
    columns: true,
    skip_empty_lines: true,
})

const features = flights.map((row, index) => {
    const origin = airportMap[row.origin]
    const destination = airportMap[row.destination]

    if (!origin || !destination) {
        console.warn(`⚠️ Skipping flight with missing airport: ${row.origin} → ${row.destination}`)
        return null
    }
    return {
    type: 'Feature',
    properties: {
      id: index + 1,
      date: row.date,
      airline: row.airline,
      origin_code: row.origin,
      origin_name: origin.name,
      origin_city: origin.city,
      origin_state: origin.state,
      origin_country: origin.country,
      destination_code: row.destination,
      destination_name: destination.name,
      destination_city: destination.city,
      destination_state: destination.state,
      destination_country: destination.country,
      altitude: parseFloat(row.altitude),
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

const geojson = {
    type: 'FeatureCollection',
    features,
}

fs.mkdirSync(path.dirname(outputPath), {recursive: true})
fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2))
console.log(`✅ Generated ${features.length} flights to ${outputPath}`)