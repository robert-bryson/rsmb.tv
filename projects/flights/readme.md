# ✈️ Flights — 3D Webmap of My Flight History

This project visualizes flights I've taken using a 3D globe powered by [react-globe.gl](https://github.com/vasturiano/react-globe.gl) (Three.js/WebGL). It converts structured flight data into GeoJSON for display in the portfolio site.

## 📂 Folder Structure

```
projects/flights/
├── data/
│   ├── airports.csv        # List of airport codes with location and metadata
│   ├── flights.csv         # Flight records referencing origin/destination by airport code
│   └── mappings/           # Pre-generated ISO name lookup JSONs
├── scripts/
│   ├── convertFlights.js   # Build script that generates GeoJSON from the CSV files
│   ├── generateAllAirports.js  # Generates full airport dataset GeoJSON
│   └── generateNameMappings.js # Generates country/region/continent name mappings
└── README.md               # This file
```

## 🔄 Build Process

Running the following command will regenerate the GeoJSON used by the site:

```bash
npm run build-flights
```

This script reads the raw CSV files and outputs:

```
public/data/flights/flights.geojson
public/data/flights/visitedAirports.geojson
public/data/flights/allAirports.geojson
```

These GeoJSON files are then loaded by the globe component in the flights feature module.

## ✨ Features

- 3D globe visualization with react-globe.gl (Three.js/WebGL)
- Animated flight arcs with staggered dot animations
- Filter by year, airport, airline, or route
- Color modes: default gradient, by year, by frequency, by airline
- Interactive airport selection with connection visualization
- Flight statistics panel with collapsible sections
- All airports layer with continent/country/elevation symbolization
- US states choropleth layer with visit/flight count modes
- Deep-linking via URL parameters for shareable views
- Keyboard shortcuts and accessibility features
- Mobile-optimized with swipe gestures for year navigation
- Auto-rotation with configurable delay
- Customizable flight data via simple CSV files
- Automated data sync from Google Sheets with QA/QC validation
