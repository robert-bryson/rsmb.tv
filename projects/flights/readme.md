# Flights 3D map

This project shows flight history on a 3D globe. It uses [react-globe.gl](https://github.com/vasturiano/react-globe.gl), Three.js, and WebGL. Build scripts convert the source CSV data to GeoJSON for the website.

## Folder structure

```text
projects/flights/
├── data/
│   ├── airports.csv        # List of airport codes with location and metadata
│   ├── flights.csv         # Flight records referencing origin/destination by airport code
│   └── mappings/           # Pre-generated ISO name lookup JSONs
├── scripts/
│   ├── convertFlights.js   # Build script that generates GeoJSON from the CSV files
│   ├── generateAllAirports.js  # Generates full airport dataset GeoJSON
│   ├── generateUSStates.js     # Generates the US states layer
│   └── generateNameMappings.js # Generates country/region/continent name mappings
└── readme.md               # This file
```

## Build the flight data

Run this command from the repository root:

```bash
npm run build-flights
```

The command reads the CSV files and writes these files:

```text
public/data/flights/flights.geojson
public/data/flights/visitedAirports.geojson
public/data/flights/allAirports.geojson
public/data/flights/usStates.geojson
```

The flights feature loads these files when it needs them.
The state generator downloads public boundaries from GitHub. This step requires network access.

Both airport generators use the same coordinate checks.
Each coordinate field must contain a complete, finite number.
Latitude must be from -90 through 90 degrees.
Longitude must be from -180 through 180 degrees.
Zero is valid. Empty fields, numeric suffixes, and infinity are invalid.
The generators report rejected airports.
The flight converter omits flights that reference missing or rejected airports.
It excludes these flights from route geometry and visit totals.

The writer retains existing output when only the candidate generation timestamp changes.
Changed geometry or metadata receives a new timestamp.
The generator tests use temporary directories and fixed source data.
They check subprocess errors before they check the exit status.

## Features

- 3D globe visualization with react-globe.gl (Three.js/WebGL)
- Animated flight arcs with staggered dot animations
- Filter by year, airport, airline, route, country, or region
- Color modes: default gradient, by year, by frequency, by airline
- Interactive airport selection with connection visualization
- Flight statistics panel with collapsible sections and airport-code tooltips
- Metric and imperial units with a saved preference
- All airports layer with continent/country/elevation symbolization
- US states choropleth layer with visit/flight count modes
- Deep-linking via URL parameters for shareable views
- Keyboard shortcuts and accessibility features
- Mobile-optimized with swipe gestures for year navigation
- Explicit globe rotation toggle that stays paused until requested
- Customizable flight data via simple CSV files
- Automated data sync from Google Sheets with QA/QC validation

## Units and statistics

### Flight duration

Add these optional columns to the source Google Sheet or CSV:

```csv
durationMinutes,durationKind,durationSource,durationNote
165,actual-block,manual,optional source reference
```

Store elapsed whole minutes. `165` means 2 hours 45 minutes.
Do not enter `2.45`, `02:45`, or spreadsheet clock values in `durationMinutes`.
Keep all three duration fields blank when the duration is unknown.
A supplied duration requires both a timing basis and a source.

| Kind | Meaning |
| --- | --- |
| `actual-block` | Actual gate departure to gate arrival |
| `scheduled-block` | Scheduled gate departure to gate arrival |
| `estimated-block` | An explicitly supplied gate-to-gate estimate |
| `unclassified` | Reported duration with an unknown timing basis |

Use a short source label, such as `manual`, `itinerary`, or `bts`.
`durationNote` remains in the source; it is omitted from public GeoJSON.
The committed CSV and public Sheet remain public sources. Do not enter booking references or passenger details there.
Flight numbers and normalized duration fields reach route details.
Unclassified values appear as reported durations and do not replace the block-time estimate.

Missing values use great-circle distance divided by 800 km/h, plus 60 minutes per leg.
The resolver rounds each estimated leg to whole minutes before aggregation.
The interface displays totals in hours and each flight in hours and minutes.
Screen readers receive full unit names, such as "2 hours 45 minutes."
Distance-unit changes do not change flight-time units.

Totals show actual, scheduled, estimated, and unavailable coverage.
Any scheduled or estimated contribution makes the total **Est. flight time**.
When all durations are missing, the interface shows **Flight time unavailable**.
The average excludes flights without usable duration data.
Filters apply consistently to totals and selected airport, route, country, and region details.
Route counts and time coverage use the same legs for the selected year and airline.
Open phone and hover details use current route data after a filter change.
A flight within one state contributes its duration once to that state's total.
Dates retain their departure-calendar meaning; no local-clock subtraction is needed.

Validation rejects malformed duration input before updating CSV or generated files.
Older CSV files without duration columns remain supported.
No historical durations are invented or automatically assigned as actual.
See the [duration research](../../docs/reviews/2026-11-02-flight-duration-research.md) for evidence sources and historical matching constraints.

Run the duration and ingestion checks:

```bash
npx vitest run src/test/flightDuration.test.ts src/test/flightSummaries.test.tsx \
  src/test/DurationSummary.test.tsx src/test/FlightsMap.test.tsx \
  scripts/__tests__/syncFlights.test.ts scripts/__tests__/flightBuildScripts.test.ts
PLAYWRIGHT_WEBKIT=1 npm run test:e2e -- tests/e2e/flight-duration.spec.ts
```

### Distance

The application stores and calculates distances in kilometers.
It formats distances when it renders the page.
Select the distance total at the bottom left to change the units.
Metric units are `km` and `m`. Imperial units are `mi` and `ft`.
The application stores the selected units locally.

The stats panel stays open when you clear an airport, route, country, or region. Airport-code links show the full airport name in a native tooltip.

Use the pull tab on the left side of the map to open or close the stats panel. The closed panel does not show a scrollbar. The open panel uses the application scrollbar colors in supported browsers. In forced-colors mode, the browser controls the scrollbar colors.

## Keyboard shortcuts

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

Shortcuts do not run when focus is in an `<input>` or `<textarea>`.

## Mobile gestures

On a touch device, swipe left or right on the globe to move between years:

| Gesture     | Action                                                                 |
| ----------- | ---------------------------------------------------------------------- |
| Swipe left  | Advance to next year (or jump to most recent year if no year selected) |
| Swipe right | Go back to previous year (or clear year filter if at the first year)   |

## Globe layers

### Flight Arcs

Animated arcs between origin and destination airports. Arc height is proportional to great-circle distance. Dot animations travel along each arc with a stagger offset per route.

### Visited Airports

Points at airports where I've departed or arrived. Size scales with visit count. Selecting an airport highlights all connected routes.

### All airports layer (`Shift+A`)

Overlays the full global airport dataset. Symbolization modes:

- **Visited** — visited airports highlighted, unvisited dimmed
- **Continent** — colored by continent
- **Country** — unique color per country (consistent across sessions)
- **Elevation** — blue (sea level) → red (high altitude)

### US states choropleth (`Shift+U`)

Polygon layer over US states with two display modes:

- **Visited airports** — shaded by number of airports visited in each state
- **Flight count** — shaded by total flights through each state

## URL parameters

The application stores active filters and display settings in the URL. You can copy the URL to share the same view.

Only one airport, route, country, or region can control the map focus.
A new selection clears the other focus selections.
Compatible year and airline filters remain active.

| Parameter | Example          | Description                                                        |
| --------- | ---------------- | ------------------------------------------------------------------ |
| `year`    | `?year=2023`     | Filter to a specific year                                          |
| `airport` | `?airport=LAX`   | Filter to flights through an airport                               |
| `airline` | `?airline=AA`    | Filter to a specific airline                                       |
| `route`   | `?route=JFK-LAX` | Highlight a specific route (route keys are sorted airport codes)   |
| `country` | `?country=US`    | Focus flights and airports involving a country                     |
| `region`  | `?region=US-CA`  | Focus flights and airports involving an ISO region code            |

The map also stores camera, layer, display, and panel settings in the URL. See the **Flights Map URL State** section in the root README for the complete parameter list.

## Sync flight data

You can sync flight data from a Google Sheet. Run this command from the repository root:

```bash
npm run sync-flights
```

The command validates the Sheet and updates `projects/flights/data/flights.csv`.
It reports invalid dates, airport-code syntax, duration fields, and possible duplicates.
Run `npm run build-flights` afterward to regenerate GeoJSON and resolve airport references.

## Basemaps

CARTO globe choices load authenticated tiles directly.
See the shared [basemap configuration guide](../../docs/carto-basemaps.md).
