# Shared modules

Use these modules when adding a project or extending an existing project.
Keep project-specific URLs, processing rules, and content with their callers.

## Map background recovery

Use [`src/maps/recoverBasemap.ts`](../src/maps/recoverBasemap.ts) for provider deadlines, background recovery, retry, and cleanup.
Temperature, Tornado, and Pins adapters supply provider styles and application source IDs.
The helper checks provider sources. It does not wait for application data or camera motion.
Each feature restores its data layers on `style.load`.
Each feature controls its camera and selection state.
Dispose the helper before you remove the renderer.

## Browser data requests

Import request caching from [`src/data/fetchCache.ts`](../src/data/fetchCache.ts).
It stores JSON responses and shares pending requests for each URL.
Flights, Temperature Records, Tornado Tracks, and Pins use the same cache.
The old Flights path exports the same functions for compatibility.

```ts
import { fetchWithCache } from '../data/fetchCache';

const payload = await fetchWithCache<unknown>(url, { ttl: 300_000 });
```

Validate external payloads in the caller before using them.
The generic type parameter does not validate a response.

Use [`fetchValidatedJson`](../src/data/validatedJson.ts) when malformed data must be removed from the cache.
Supply a schema parser as its validation function.
It returns validated data and removes only the rejected cached value.
It also handles asynchronous validators.
Use [`warmJson`](../src/data/warmJson.ts) for validated speculative requests.
New speculative requests use low priority. New navigation requests use normal priority.
Shared pending requests keep their original priority.

- `ttl` sets the response lifetime in milliseconds. The default is five minutes.
- Responses expire on a timer even when no further requests occur. A later caller cannot extend the stored lifetime.
- At most 32 responses are retained. Reads promote entries; capacity eviction removes the least recently used response.
- Pending requests are separate from stored responses and retain their deduplication and retry behavior during eviction.
- `getCacheStats()` reports retained entries, pending requests, and capacity for diagnostics. The capacity bounds entry count, not payload bytes or a measured phone heap budget.
- `timeout` sets the request deadline in milliseconds. The default is 30 seconds.
- The deadline includes reading the response body.
- `forceRefresh: true` bypasses a stored response and starts a new request.
- Older requests still resolve for their callers. They cannot replace the refreshed response.
- `invalidateCache(url)` removes one stored response and detaches its pending request.
- `clearCache()` does the same for all URLs.
- Detached requests continue. Their results cannot enter the cache.
- `preloadCache(urls)` stores successful responses and logs each failure. Failed URLs can be requested again.

Keep trip route loading in its existing module.
Its reader tracking and cancellation rules differ from this cache.

## Published data contracts

Use [`shared/temperatureSchemas.ts`](../shared/temperatureSchemas.ts) for temperature payload validation in browser and Node callers.
It owns record, summary, station-history, and climate-trend schemas and `parseTemperaturePayload`.
The old feature path re-exports these definitions for compatibility.

Use [`shared/flightSchemas.ts`](../shared/flightSchemas.ts) for published Flights GeoJSON validation.
`flightsSchema` checks route geometry, coordinates, calendar dates, required airport properties, and duration metadata.
`visitedAirportsSchema` checks point geometry, airport properties, visit counts, and visit dates.
Release validation uses these contracts; a nonempty `FeatureCollection` alone does not establish compatibility.
These modules have no browser runtime dependency and can be imported without loading map features.

Use [`shared/pins.ts`](../shared/pins.ts) for the Pins publication contract.
It validates complete 2025 coverage, geographic identities, bounds, and contact distances and bearings.
State and county readers reject a file served under the wrong geographic level.
The Python generator checks full polygon validity before publication.
The browser also checks closed, nonzero-area rings and date-line edges.
These browser checks do not replace full polygon topology checks.

The [Census snapshot](../shared/geography/census2025.json) supplies source checksums and county counts to Python and TypeScript.
Update both publications and tests when changing this snapshot.

Use [`shared/pinGeometry.ts`](../shared/pinGeometry.ts) for common geometry fields and contact checks.
Use [`shared/worldPins.ts`](../shared/worldPins.ts) for global country and region payloads.
The world contract validates every expected ID against its country catalog.
The global catalog uses Natural Earth identities and available ISO codes, independently of Census FIPS codes.
Global and Census pins share drawing, radius labels, and presentation helpers.
Foreign area is labeled as mapped area; Census area retains its land-area label.
Foreign regions use the intersection of the regional and parent-country source boundaries.
The snapshot records this rule. Each changed pin carries a flag for its source note.
Country-specific resource state is tied to its URL. A delayed response cannot replace the current country.

Use [`src/features/tornadoes/schemas.ts`](../src/features/tornadoes/schemas.ts) for notable-event metadata.
The schema checks event fields and geographic coordinates.
Its inferred types also define the existing track properties contract.
Keep the schema and its types together when adding event fields.

## MapLibre maps

Import MapLibre runtime values from [`src/maps/maplibre.ts`](../src/maps/maplibre.ts).
This entry point sets the bundled worker URL before a map starts.
Use it for full-page maps and embedded trip maps.
Type-only imports can use `maplibre-gl` directly.
Use [`screenGeometry.ts`](../src/maps/screenGeometry.ts) for map label clipping and rectangle collision checks.
The atlas compatibility path re-exports these functions.
Use [`ResilientFullscreenControl.ts`](../src/maps/ResilientFullscreenControl.ts) when replacing a renderer during fullscreen use.
Retain the control while its fullscreen target remains active.
Create a fresh control if the user exited fullscreen while the renderer was detached.
Atlas adds its own tooltip text through a small adapter.
Keep styles and attribution in [`cartoBasemaps.ts`](../src/maps/cartoBasemaps.ts).
Detach listeners that write the URL before disposing of a renderer. A late camera
event must not restore the map route after navigation has started.

## Tornado chart data

Use [`shared/tornadoTrends.ts`](../shared/tornadoTrends.ts) for the generator and browser data contract.
`buildTornadoTrendIndex` accepts normalized county segments and returns geometry-free groups with width histograms.
`parseTornadoAnnualSummary` validates and orders published annual metadata.
`parseTornadoTrendIndex` requires that metadata. It validates wire types and compares every year's totals.
The comparison includes intensity counts, deaths, injuries, distance, and width medians.
`summarizeTornadoTrends` applies geographic and intensity filters. Its year domain supplies zero-result rows.
Validate the complete archive before filtering. Missing published data must not become a zero-result year.

## U.S. geography

Import state identity data from [`shared/geography/usStates.ts`](../shared/geography/usStates.ts).
Each record contains `abbr`, `name`, and `fips`. FIPS codes are strings that preserve leading zeros.

| Export | Coverage | Current consumer |
| --- | --- | --- |
| `usStates` | 50 states | Temperature sync |
| `usStatesAndDc` | 50 states and DC | Flight state boundaries |
| `usJurisdictions` | 50 states, DC, and Puerto Rico | Tornado normalization |
| `usStatesAndTerritories` | 50 states, DC, and five inhabited territories | Pins of Inaccessibility |

Choose the subset that matches the project's existing data coverage.
Derive lookup maps from these records instead of copying identity tables.
Keep display centroids and source-data validation bounds with their projects.
The registry has no browser or Node dependencies.

Use [`geodesy.ts`](../shared/geography/geodesy.ts) for WGS84 direct destinations.
Its longitude output stays continuous around the origin across the date line.
Pins uses the same calculation for drawing and contact validation.

## Flight airport data

Use [`airportData.js`](../projects/flights/scripts/airportData.js) in flight generators.

- `loadAirportMappings(directory)` reads country, region, and continent name mappings.
- `normalizeAirport(row, mappings)` returns common airport fields and validated coordinates.
- Invalid coordinates produce `null`.
- Name mappings use only their own nonempty string entries.
- Unmapped geographic codes remain unchanged. Inherited object properties cannot supply names.
- Elevations retain feet and include rounded meters. Valid negative values remain negative.
- Missing, incomplete, or non-finite elevations use zero in both units.

Keep output-specific properties in each generator. These include airport codes, visited flags, and route statistics.
The complete-airport generator also supplies an empty municipality when none is available.

## Project pages

Use the existing presentation modules for project introductions, screenshots, and technology lists.

| Module | Responsibility |
| --- | --- |
| [`ProjectPageHeader`](../src/components/ProjectPageHeader.tsx) | Title, stack summary, description, and actions |
| [`ProjectScreenshotGallery`](../src/components/ProjectScreenshotGallery.tsx) | Screenshot dimensions, captions, loading, and layout |
| [`TechBadges`](../src/components/TechBadges.tsx) | Technology badge presentation and wrapping |
| [`ProjectPreview`](../src/components/ProjectPreview.tsx) | Project card sources and original screenshot selection |
| [`ResponsivePicture`](../src/components/ResponsivePicture.tsx) | Responsive candidates, loading priority, and bounded image recovery |

Set `external: true` for actions that open another site in a new tab.
Internal actions use React Router navigation.
Use `project.tech` when the page and listing share the same technology list.
Supply a detailed list when the project page intentionally names additional technologies.
Keep editorial sections in the page itself.
Use `ResponsiveImage` from `shared/responsiveImage.ts` for generated image records.
Use `getProjectPreview` for project image lookup in React and HTML generation.
Do not copy manifest casts into consumers. See [image delivery](image-assets.md) for generation and recovery rules.

## Validation

Run the focused unit tests after changing these modules:

```bash
npx vitest run src/test/fetchCache.test.ts src/test/fetchCacheTimeout.test.ts src/test/usStates.test.ts scripts/__tests__/airportData.test.ts scripts/__tests__/flightBuildScripts.test.ts scripts/__tests__/syncTornadoes.test.ts src/test/ProjectPageHeader.test.tsx src/test/projectPages.test.tsx
```

The airport helper tests measure coverage directly.
Generator subprocess tests check written output. Their execution does not contribute to Vitest coverage.
Registry tests check every state identity and each jurisdiction subset.
Tornado fixtures check full-name normalization, including DC and Puerto Rico.

Run the project browser tests after changing presentation modules:

```bash
npm run test:e2e -- tests/e2e/projects.spec.ts
```

These tests check real screenshot dimensions, loading modes, external link attributes, and overflow at two viewport widths.
Use Vite's development server for these checks. The `trip-test` production build omits public screenshots.
The standard browser runner also downloads state boundaries before it starts Vite.

## Ownership

Put browser behavior under `src/` and script behavior under `scripts/` or its owning project.
Put pure modules used by browser and Node callers under `shared/`.
Shared modules must not depend on feature implementations.
Import specific modules directly to preserve lazy route loading.

See the [consolidation analysis](reviews/2026-11-03-shared-library-analysis.md) for later extraction candidates and migration risks.
