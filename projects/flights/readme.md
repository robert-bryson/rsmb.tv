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

## Map code

The map separates page controls from renderer behavior:

| File in `src/features/flights/` | Responsibility |
| --- | --- |
| `components/FlightsMap.tsx` | URL filters, selection, statistics, and page controls |
| `components/FlightsGlobe.tsx` | Globe layers, styling, labels, and hit handling |
| `hooks/useFlightMapLayers.ts` | Optional geography loading, airport labels, and filtered state layers |
| `hooks/useGlobeCamera.ts` | Renderer readiness, camera restoration, rotation, and listener cleanup |
| `hooks/useGlobeTextures.ts` | Texture progress, failure state, and fresh loading attempts |
| `hooks/useZoomNavigation.ts` | Camera targets, route bounds, and transition requests |
| `utils/globeView.ts` | Camera comparisons at the URL's stored precision |

Camera listeners remain active after filter and camera URL changes.
The camera hook applies renderer readiness after its component commits.
Discarded renders cannot update camera state.
A linked camera takes precedence over a year fit, including during browser history navigation.
Selecting a year in the map controls fits its airports after data loads.
An empty year does not prevent the next selection from fitting its airports.
Navigation, reset, direct camera gestures, and unmount cancel pending year fits.
Unmount and superseding navigation also cancel pending camera synchronization.
Late renderer callbacks cannot schedule or publish camera updates after unmount.
Linked views retain explicit rotation. Direct interaction pauses it.
The camera ignores URL updates from its own transitions and gestures, so synchronization cannot interrupt them.
URL setters use the latest committed query and preserve newer pending writes through intermediate navigation commits.
Browser history navigation clears pending writes.
Writing an unchanged setting does not add a history entry.
Camera fitting uses the smallest longitude interval that contains the selected airports.
Pacific routes can cross the date line without moving the camera to Greenwich.

Texture failures show an error and a **Try Again** button.
Retry loads a fresh texture batch and creates a fresh globe renderer.
It retains the URL filters and camera.
Changing basemaps also clears errors from the previous texture batch.
Returning to an earlier basemap starts a new batch, even if another batch is still loading.

The share control reports success only after a clipboard operation succeeds.
If both clipboard methods fail, it opens a prompt for manual copying.

`src/test/FlightsMap.test.tsx` exercises these modules together.
It keeps filtering, navigation, layer derivation, and page controls real.
It replaces WebGL and asset loading with fixed adapters.
The browser checks use the actual globe renderer:

```bash
npx vitest run src/test/FlightsMap.test.tsx src/test/useGlobeCameraLifecycle.test.tsx \
  src/test/useGlobeTextures.test.ts src/test/useZoomNavigation.test.ts
PLAYWRIGHT_WEBKIT=1 npm run test:e2e -- tests/e2e/flights-controls.spec.ts tests/e2e/flight-duration.spec.ts tests/e2e/carto-basemaps.spec.ts
```

The camera recovery cases use fixed flight and airport data.
They cover normal startup, delayed flights, and delayed textures.
Each case waits for the canvas, filtered data, and texture loading before checking the camera target.
The URL stores that target before the camera animation ends.
The checks advance the browser clock, then compare airport label positions from the renderer.
Reset must move those labels. Returning from an empty year must restore their fitted positions.
These checks use clock control and request gates. They do not use fixed wall-clock waits.

### Animation performance

Pause and play reuse existing arc objects.
The renderer changes their animation timing without resetting their dash positions.
Thin route meshes use 24 curve segments and four tube sides.
The canvas retains the library's display resolution.

The optional performance check uses Pixel 7 emulation, 4× CPU slowdown, and a throttled network.
It measures six trusted pause/play taps with the committed flight data.
Each measurement ends after two animation frames following the click.
The maximum must be 600 ms or less.
This laboratory check is separate from field INP measurements.

Prepare the flight data first with `npm run build-flights` if it is missing or outdated.
Build and start a production preview in one terminal:

```bash
VITE_CARTO_API_KEY=browser-test-key CARTO_API_KEY='' npx vite build
npx vite preview --host 127.0.0.1 --port 4176 --strictPort
```

Use an unused port. If you change the port, also change `PLAYWRIGHT_BASE_URL` below.

Run the check in another terminal:

```bash
FLIGHTS_PERFORMANCE=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:4176 PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  npx playwright test tests/e2e/flights-performance.spec.ts --project=chromium --workers=1
```

Use one worker without concurrent browser or build work.
The check attaches its samples as JSON.
Set `FLIGHTS_PERFORMANCE_REPORT` to save another copy of the report.
Ordinary browser runs skip this production-only check.
Use the [review record](../../docs/reviews/2026-11-02-flight-map-recovery-and-performance.md) for measured results and test limits.

## Airport validation

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
The compact total shows minutes below one hour.
At one hour or more, it rounds to the nearest hour and shows days and remaining hours.
A day means 24 elapsed hours. For example, 1,410 minutes displays as `1d 0h`.
This rounding changes the display only. Calculations retain whole minutes.
Hover over the total to see decimal hours, such as `2.8 h` for 165 minutes.
Each flight, average, and time record shows hours and minutes.
Screen readers receive full unit names, such as "2 hours 45 minutes."
Distance-unit changes do not change flight-time units.

Each statistics view has a **Flight Time** section.
Use its button to show or hide the total, average, longest time, shortest time, and timing coverage.
**Collapse All** and **Expand All** also control this section.
Section buttons expose their expanded state to assistive technology.

Coverage shows actual, scheduled, estimated, and unavailable flight counts.
It remains visible when the section is open, including on touch devices.
The compact total also supplies precise time and coverage as text for assistive technology.
Hover text also includes the coverage and estimate method.
Totals and averages have an **Est.** label when they include scheduled or estimated time.
Any scheduled or estimated contribution makes the total **Est. flight time**.
When all durations are missing, the interface shows **Flight time unavailable**.
The average and time records exclude flights without usable duration data.
Each time record retains its own timing basis: **Actual**, **Scheduled**, or **Estimated**.
A scheduled or estimated record has an **Est.** label.
Other flights do not change that record's label.
For equal times, prefer actual data, then scheduled data, then estimated data.
This rule gives the same result when the input order changes.
Filters apply consistently to totals and selected airport, route, country, and region details.
Country and region airport lists use only matching flights.
Their visit counts include each matching arrival or departure within the selected area.
An internal flight contributes two airport visits and one duration to the area's total.
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
  src/test/DurationSummary.test.tsx src/test/flightStatsAccessibility.test.tsx \
  src/test/flightTimeRegressions.test.tsx \
  src/test/flightSelectionAirports.test.ts src/test/FlightsMap.test.tsx \
  src/test/flightFilterTransitions.test.tsx src/test/flightFilterCommitOrder.test.ts \
  scripts/__tests__/syncFlights.test.ts scripts/__tests__/flightDataIntegrity.test.ts \
  scripts/__tests__/flightBuildScripts.test.ts
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
It accepts `M/D/YYYY` and `YYYY-MM-DD` dates and writes `M/D/YYYY` dates.
Known airline aliases use their configured names.
Other names remain text, including names that match JavaScript object properties.
Run `npm run build-flights` afterward to regenerate GeoJSON and resolve airport references.

Set `GOOGLE_SHEET_ID` to the document ID. Set `GOOGLE_SHEET_NAME` to select a tab; the default is `Flights`.
Give the Sheet public read access before you run the sync command.
The Sheet must contain `date`, `airline`, `origin`, and `destination` columns.
The `flightNumber` column is optional.
Dates must be from 1990 through one year after the current UTC date.
Airport codes must contain three or four letters. The sync command converts them to uppercase.
Origin and destination must differ.
Invalid dates, airport codes, or duration fields stop the sync before it writes CSV data.
Warnings identify empty airline names, corrected names, possible duplicates, and durations longer than 24 hours.
Review each warning against its source record.

## Basemaps

CARTO globe choices load authenticated tiles directly.
See the shared [basemap configuration guide](../../docs/carto-basemaps.md).
