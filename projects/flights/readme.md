# ✈️ Flights — 3D Webmap of My Flight History

This project visualizes flights I've taken using a 3D globe powered by [react-globe.gl](https://github.com/vasturiano/react-globe.gl) (Three.js/WebGL). It converts structured flight data into GeoJSON for display in the portfolio site.

## 📂 Folder Structure

```text
projects/flights/
├── data/
│   ├── airports.csv        # List of airport codes with location and metadata
│   ├── flights.csv         # Flight records referencing origin/destination by airport code
│   └── mappings/           # Pre-generated ISO name lookup JSONs
├── scripts/
│   ├── convertFlights.js   # Build script that generates GeoJSON from the CSV files
│   ├── generateAllAirports.js  # Generates full airport dataset GeoJSON
│   └── generateNameMappings.js # Generates country/region/continent name mappings
└── readme.md               # This file
```

## 🔄 Build Process

Running the following command will regenerate the GeoJSON used by the site:

```bash
npm run build-flights
```

This script reads the raw CSV files and outputs:

```text
public/data/flights/flights.geojson
public/data/flights/visitedAirports.geojson
public/data/flights/allAirports.geojson
```

These GeoJSON files are then loaded by the globe component in the flights feature module.

## ✨ Features

- 3D globe visualization with react-globe.gl (Three.js/WebGL)
- Animated flight arcs with staggered dot animations
- Filter by year, airport, airline, route, country, or region
- Color modes: default gradient, by year, by frequency, by airline
- Interactive airport selection with connection visualization
- Flight statistics panel with collapsible sections, airport-code tooltips, and persistent unit preference
- All airports layer with continent/country/elevation symbolization
- US states choropleth layer with visit/flight count modes
- Deep-linking via URL parameters for shareable views
- Keyboard shortcuts and accessibility features
- Mobile-optimized with swipe gestures for year navigation
- Auto-rotation with configurable delay
- Customizable flight data via simple CSV files
- Automated data sync from Google Sheets with QA/QC validation

## 📏 Units & Stats

Distance values are stored and computed in kilometers, then formatted at render time. The bottom-left distance total toggles the UI between metric (`km`/`m`) and imperial (`mi`/`ft`) units, and the preference is persisted locally.

The stats panel stays open when clearing an airport, route, country, or region selection. Airport-code links expose full airport names in native hover tooltips, including codes rendered inside route rows.

## ⌨️ Keyboard Shortcuts

| Key       | Action                                                                  |
| --------- | ----------------------------------------------------------------------- |
| `H`       | Toggle keyboard shortcut help modal                                     |
| `S`       | Toggle stats panel                                                      |
| `F`       | Toggle filter panel                                                     |
| `R`       | Reset globe camera to the default position                              |
| `Escape`  | Clear current airport/route/country/region selection and close panels   |
| `Shift+A` | Toggle "all airports" layer                                             |
| `Shift+U` | Toggle US states choropleth layer                                       |
| `1`       | Color mode: default gradient                                            |
| `2`       | Color mode: by year                                                     |
| `3`       | Color mode: by flight frequency                                         |
| `4`       | Color mode: by airline                                                  |

Shortcuts are disabled when focus is inside an `<input>` or `<textarea>`.

## 📱 Mobile Gestures

On touch devices, swipe left/right on the globe to navigate between years:

| Gesture     | Action                                                                 |
| ----------- | ---------------------------------------------------------------------- |
| Swipe left  | Advance to next year (or jump to most recent year if no year selected) |
| Swipe right | Go back to previous year (or clear year filter if at the first year)   |

## 🗺️ Globe Layers

### Flight Arcs

Animated arcs between origin and destination airports. Arc height is proportional to great-circle distance. Dot animations travel along each arc with a stagger offset per route.

### Visited Airports

Points at airports where I've departed or arrived. Size scales with visit count. Selecting an airport highlights all connected routes.

### All Airports Layer (`Shift+A`)

Overlays the full global airport dataset. Symbolization modes:

- **Visited** — visited airports highlighted, unvisited dimmed
- **Continent** — colored by continent
- **Country** — unique color per country (consistent across sessions)
- **Elevation** — blue (sea level) → red (high altitude)

### US States Choropleth (`Shift+U`)

Polygon layer over US states with two display modes:

- **Visited airports** — shaded by number of airports visited in each state
- **Flight count** — shaded by total flights through each state

## 🔗 URL Parameters

All active filters are reflected in the URL for deep-linking and sharing:

Airport, route, country, and region selections are mutually exclusive; choosing one clears the others while preserving compatible filters like year and airline.

| Parameter | Example          | Description                                                        |
| --------- | ---------------- | ------------------------------------------------------------------ |
| `year`    | `?year=2023`     | Filter to a specific year                                          |
| `airport` | `?airport=LAX`   | Filter to flights through an airport                               |
| `airline` | `?airline=AA`    | Filter to a specific airline                                       |
| `route`   | `?route=JFK-LAX` | Highlight a specific route (route keys are sorted airport codes)   |
| `country` | `?country=US`    | Focus flights and airports involving a country                     |
| `region`  | `?region=US-CA`  | Focus flights and airports involving an ISO region code            |

## 🔄 Data Sync

Flight data can optionally be synced from a Google Sheet:

```bash
node scripts/sync-flights.js
```

This fetches the latest data and regenerates GeoJSON. The sync script includes QA/QC validation (unknown airport codes, malformed dates, duplicate flight records).
