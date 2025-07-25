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

const geojson = {
    type: 'FeatureCollection',
    features,
}

fs.mkdirSync(path.dirname(outputPath), {recursive: true})
fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2))
console.log(`✅ Generated ${features.length} flights to ${outputPath}`)