# Shared library consolidation analysis

Date: 2026-11-03. Source baseline: `dd1ba96`.

## Initial recommendation

This analysis describes the repository before the first four extractions.
The implementation record appears at the end of this report.

Build a shared library within this repository first. Extend the existing folders instead of introducing a package build or release process.

The best starting points are request caching, U.S. state reference data, airport normalization, and project page presentation.
These have concrete consumers and small interfaces. The map lifecycle and URL update modules offer greater long-term value, with greater migration risk.

Treat reusable browser behavior, reusable script behavior, and project-specific calculations as separate modules.
Only the first two categories should become general infrastructure for future projects.

This report records the initial analysis. The implementation follow-up below records the completed first four extractions.

## Scope and method

The review covers these local sources:

- Flights, Temperature Records, Tornado Tracks, trip reports, and ADV Atlas under `src/features/`.
- Shared hooks, presentation modules, map configuration, and utilities under `src/`.
- Data generators and importers under `scripts/` and `projects/`.
- The terminal dashboard, Python temperature pipeline, workflows, and Terraform definitions.

Most interactive projects are feature modules in one React application. They share the root package, Vite configuration, and deployment.
Several portfolio projects have descriptions here, with implementation hosted in separate repositories.
This review cannot establish duplication inside those external implementations.

The method combined source inspection, import tracing, pattern searches, and a TypeScript syntax-tree comparison.
The comparison ignored comments and formatting. It also checked function bodies that differed only in identifier names.
It covered JavaScript and TypeScript source, excluding tests. Whole-function matches required at least eight source lines.
Manual inspection covered smaller helpers and partial duplication that the comparison could not detect.

Findings identify both repeated implementations and reusable modules placed under a feature-specific owner.
The initial analysis did not run tests or measure runtime performance.
Later implementation checks appear in the implementation record.

## Existing consolidation to preserve

| Existing module | Current value |
| --- | --- |
| [`src/maps/cartoBasemaps.ts`](../../src/maps/cartoBasemaps.ts) | Shared URLs, attribution, key handling, and raster/vector style construction |
| [`src/hooks/useReducedMotion.ts`](../../src/hooks/useReducedMotion.ts) | Shared motion preference subscription; the Flights file is already a re-export |
| [`src/hooks/usePersistedState.ts`](../../src/hooks/usePersistedState.ts) | Shared storage behavior; Flights panel state already delegates to it |
| [`src/utils/escapeHtml.ts`](../../src/utils/escapeHtml.ts) | Shared HTML escaping; Flights already re-exports it |
| [`src/utils/formatDate.ts`](../../src/utils/formatDate.ts) | Validated ISO calendar dates and consistent UTC display |
| [`shared/tripManifestSchema.ts`](../../shared/tripManifestSchema.ts) | Shared trip validation and inferred types across browser and scripts |
| [`shared/routeGeometry.ts`](../../shared/routeGeometry.ts) | Shared route validation and geometry operations; the feature file is a re-export |
| [`src/components/ProjectPageHeader.tsx`](../../src/components/ProjectPageHeader.tsx) | Existing project header and action presentation |
| [`src/components/ProjectScreenshotGallery.tsx`](../../src/components/ProjectScreenshotGallery.tsx) | Existing screenshot layout with dimensions, captions, and image loading |
| [`scripts/atomic-write.js`](../../scripts/atomic-write.js) | Existing atomic file replacement for project previews |

Re-export files are compatibility adapters, not duplicated implementations.
Moving or deleting them alone provides little maintenance value.

## Ranked opportunities

Effort estimates include focused migration and verification. They assume one developer familiar with this repository.
These are planning estimates, not measured delivery times. Each row describes the initial useful extraction.

| Priority | Candidate | Initial consumers | Effort | Payoff and risk |
| --- | --- | --- | --- | --- |
| 1 | Promote the existing request cache | Flights, temperatures, tornadoes | 1–3 hours | Correct shared ownership; low risk without behavior changes |
| 2 | U.S. state reference registry | Temperature sync, tornado sync, flight state generation | Half a day | Removes three overlapping tables; preserve coverage differences |
| 3 | Airport normalization | Two flight generators | 2–4 hours | Removes repeated mappings and conversions; low risk |
| 4 | Project page presentation | Multiple project pages and the project listing | 2–4 hours initially | Reuses existing modules and removes repeated badge markup |
| 5 | Google Sheets download and CSV handling | Flights and blog importers | Half to one day | Removes divergent transport and parsing behavior |
| 6 | Script HTTP requests and retry handling | Temperature and tornado sync; Google importers | 1–2 days | Centralizes deadlines and errors; preserve retry policies |
| 7 | URL update coordination | Flights, tornadoes, ADV Atlas | 1–2 days | Shares race handling and navigation rules; medium-to-high risk |
| 8 | Simple JSON resource hook | Flight files and climate trends first | About one day | Removes repeated request state; complex orchestration stays local |
| 9 | MapLibre lifecycle | Five map modules | Several days | Large maintenance benefit; requires staged adoption |
| 10 | Sharing and progressive list behavior | Three map sharing flows; Flights and temperature lists | Half to one day per module | Useful browser primitives; presentation still varies |
| 11 | Shared tornado aggregation and temperature contracts | Each project's browser and generator | About one day per project | Prevents contract drift; these remain domain modules |
| 12 | Artifact publication and CI setup | Generators and sync workflows | 1–2 days initially | Reduces operational repetition; publication policies differ |

The first four can be independent, reviewable changes. The remaining rows do not depend on completing every earlier row.

## First four extractions

### 1. Promote the request cache without changing behavior

The cache originally lived at [`fetchCache.ts`](../../src/features/flights/utils/fetchCache.ts).
It supplied response lifetimes, shared requests, deadlines, invalidation, and protection against stale responses.
Three hooks outside Flights imported it directly:

- [`useTemperatureData.ts`](../../src/features/temperatures/hooks/useTemperatureData.ts)
- [`useClimateTrends.ts`](../../src/features/temperatures/hooks/useClimateTrends.ts)
- [`useTornadoData.ts`](../../src/features/tornadoes/hooks/useTornadoData.ts)

Suggested destination: `src/data/fetchCache.ts`.

Move the implementation and update consumers. Retain the old re-export temporarily if it makes migration easier.
Keep the current interface and behavior for this change.

This extraction primarily fixes ownership and discoverability. It does not remove several cache implementations immediately.
Future projects can use the cache without depending on Flights internals.

Existing verification: `fetchCache.test.ts`, `fetchCacheTimeout.test.ts`, and the affected data-hook suites under `src/test/`.
Preserve in-flight deduplication and protection against stale responses after invalidation or forced refresh.

Do not replace the trip route cache in this change.
[`useTripRoute.ts`](../../src/features/trips/useTripRoute.ts) tracks readers, aborts unused requests, validates geometry, and prunes released entries.
Its policy differs from the general cache. A later common transport module must preserve those guarantees.

### 2. Create one U.S. state reference registry

Three sources repeat state identity data:

- [`sync-temperatures.js`](../../scripts/sync-temperatures.js), starting at line 60: names, abbreviations, centroids, and FIPS mappings.
- [`syncTornadoes.js`](../../projects/tornado-tracks/scripts/syncTornadoes.js), starting at line 32: full names and abbreviations.
- [`generateUSStates.js`](../../projects/flights/scripts/generateUSStates.js), starting at line 8: FIPS codes, abbreviations, and names.

Suggested destination: `shared/geography/usStates.ts`.
Use one record per jurisdiction. Derive name, abbreviation, and FIPS indexes from those records.
Keep the module free of browser and Node-specific imports.

Preserve FIPS codes as strings. Keep each caller's jurisdiction selection explicit.
Temperature processing currently lists 50 states. Flight boundaries include DC. Tornado normalization also includes Puerto Rico.
Using one undifferentiated list would change processing scope.

Keep temperature centroids and tornado data-quality bounding boxes as separate optional data or project-owned extensions.
They describe different geographic concepts. Tornado bounding boxes deliberately include a generous validation buffer.

Verify existing generator fixtures and jurisdiction subsets. Check leading zeros and name normalization.
The shared module should not silently change which records each project accepts.

### 3. Extract airport normalization inside Flights

[`convertFlights.js`](../../projects/flights/scripts/convertFlights.js) and [`generateAllAirports.js`](../../projects/flights/scripts/generateAllAirports.js) repeat these operations:

- Read country, region, and continent mapping files.
- Resolve a code to a display name, with the code as fallback.
- Convert feet to rounded meters.
- Build the same base airport properties.

Both already share [`airportCoordinates.js`](../../projects/flights/scripts/airportCoordinates.js).
Extend that consolidation with a module such as `projects/flights/scripts/airportData.js`.

A small interface could expose `normalizeAirport(row, mappings)` and one mapping-file loader.
Keep visited flags, route counts, and output-specific properties in each generator.
Preserve current empty-field defaults and invalid-coordinate handling explicitly.

Airport semantics belong to Flights. Only broadly useful conversions should move to a general library when another real consumer needs them.

Existing verification includes `airportCoordinates.test.ts`, `flightBuildScripts.test.ts`, and `flightDataIntegrity.test.ts` under `scripts/__tests__/`.
Compare generated properties and record counts before and after migration.

### 4. Complete adoption of the existing project presentation modules

`ProjectPageHeader` is currently used by Aborg, Parc, Route2Gpx, and Status Dashboard.
Flights, Temperature Records, Anki Artisan, Bookend, and Through Routes still repeat substantial header and action markup.
Flights also renders screenshot figures directly despite the existing screenshot gallery module.

The syntax-tree comparison found seven identical technology-badge rendering callbacks.
They appear in Aborg, Anki Artisan, Bookend, Flights, Projects, Temperature Records, and Through Routes.
Parc and Status Dashboard contain another matching variant.

Add a small `TechBadges` module. Use `Project.tech` from [`projects.ts`](../../src/content/projects.ts) when it describes the same technology list.
Check intentional differences before replacing hardcoded values.
Adopt the existing header and screenshot modules incrementally.

Preserve client-side navigation when replacing `Link` elements.
The existing header currently renders anchors for both internal and external actions.
A shared action renderer should retain router navigation for internal project destinations.

Keep editorial content as children in each page. A universal configuration-driven project page would add unnecessary interface complexity.

Verify project navigation, headings, screenshot dimensions, loading behavior, and external link attributes.
Existing starting points include `src/test/Projects.test.tsx` and `tests/e2e/projects.spec.ts`.

## Further consolidation with strong evidence

### Google Sheets downloads and CSV parsing

[`sync-flights.js`](../../scripts/sync-flights.js), line 44, and [`sync-blogs.js`](../../scripts/sync-blogs.js), line 472, download CSV exports from Google Sheets.
They repeat URL construction, HTTP checks, and rejection of HTML responses.
The blog implementation accepts an injected fetch function and applies a deadline. The flight implementation currently lacks that deadline.

Suggested destination: `scripts/lib/googleSheets.js`, with `fetchSheetCsv(sheetId, sheetName, options)`.
Keep source-specific environment variables and validation messages in thin caller adapters.

The blog importer also contains a handwritten CSV parser at line 168.
Flights and tornadoes already use the installed `csv-parse` dependency.
Prefer that existing parser for shared CSV syntax handling.
Preserve current handling of blank rows, BOMs, quoted newlines, CRLF, and malformed quotes.
Column interpretation and record validation remain project-specific.

Existing verification includes `syncBlogs.test.ts`, `syncFlights.test.ts`, `flightDataIntegrity.test.ts`, and `networkTimeouts.test.ts`.

### Script request deadlines and retries

Temperature sync has separate retry loops for `fetchJson` and `postJson`, starting at lines 291 and 306.
Tornado sync has another implementation at line 968, supporting text and compressed binary downloads.
Google importers provide further deadline and HTTP-check implementations.

Suggested destination: `scripts/lib/http.js`.
Its interface should accept the request, response decoding, deadline, attempt policy, and injected fetch implementation.
It should own response consumption so deadlines also cover stalled bodies.

Preserve existing attempt counts, delays, response formats, and identifying headers during extraction.
Keep provider-specific caching outside the transport module.
Any change to retryable statuses or POST retry behavior should be a separate, explicit policy change.

The browser cache and script transport serve different runtime needs. They do not need one universal fetch abstraction.

### URL update coordination

Three implementations independently compose edits made during the same event:

- [`useFlightsFilters.ts`](../../src/features/flights/hooks/useFlightsFilters.ts), starting at line 129.
- [`useTornadoFilters.ts`](../../src/features/tornadoes/hooks/useTornadoFilters.ts), starting at line 35.
- [`useAtlasUrlState.ts`](../../src/features/trips/atlas/useAtlasUrlState.ts), starting at line 5.

Flights additionally handles callbacks retained by native listeners and intermediate navigation commits.
Atlas preserves fragments, return state, and intentional history entries.
These requirements make the coordinator more valuable than sharing a few parameter parsers alone.

Suggested destination: `src/navigation/useUrlState.ts`.
Expose current parameters and an edit operation with explicit history behavior.
Keep flight, tornado, and atlas parameter names and selection rules in their feature modules.

Preserve same-event composition, Back/Forward behavior, location state, fragments, and no-op handling.
Use the three existing URL suites as acceptance evidence. Retain their feature-specific integration tests after extraction.
Do not assume the simplest existing implementation satisfies the other callers.

### Simple resource loading

[`useGeoJsonData.ts`](../../src/features/flights/hooks/useGeoJsonData.ts) already shares the loading pattern for four flight data files.
Its implementation is not specific to geometry, but it hardcodes `data/flights/`.
`useClimateTrends` repeats similar loading, error, enabled-state, and cleanup logic with runtime validation.

Suggested destination: `src/data/useJsonResource.ts`.
Accept a complete URL, enabled state, cache options, and an optional parser from `unknown` to validated data.
Keep small feature hooks as adapters that supply URLs and schemas.

Start with flight files and climate trends.
Temperature data has separate recent and all-time loading groups. Tornado data has metadata dependencies and bounded yearly downloads.
Keep that orchestration in each project. A generic resource hook should not absorb those state machines.

### MapLibre lifecycle and shared map data

Five modules create MapLibre maps:

- [`TemperatureMap.tsx`](../../src/features/temperatures/components/TemperatureMap.tsx), line 422.
- [`RecordFreshnessMap.tsx`](../../src/features/temperatures/components/RecordFreshnessMap.tsx), line 27.
- [`TornadoMap.tsx`](../../src/features/tornadoes/components/TornadoMap.tsx), line 685.
- [`TripRouteMap.tsx`](../../src/features/trips/components/TripRouteMap.tsx), line 180.
- [`TripAtlasMap.tsx`](../../src/features/trips/atlas/TripAtlasMap.tsx), line 207.

Repeated responsibilities include map ownership, readiness, navigation controls, resize behavior, popups, listeners, and disposal.
Failure handling varies substantially. Trips and Atlas recreate failed renderers. Tornadoes retain a distinct SVG fallback.
Atlas also preserves fullscreen state across renderer replacement.

Suggested destination: focused modules under the existing `src/maps/` folder.
A lifecycle module should expose the map, readiness, failure state, and retry behavior.
Feature adapters should retain sources, layers, hit testing, camera intent, and fallback presentation.

Adopt it in two MapLibre consumers before designing for all five.
Flight rendering uses Three.js through `react-globe.gl`; it should retain its own renderer lifecycle.
Share only renderer-independent controls or utilities where behavior actually matches.

There are two smaller opportunities around this work:

1. `RecordFreshnessMap` repeats the transformation already implemented by `buildFreshnessGeoJson` in `temperatureMapLayers.ts`.
2. Tornadoes fetch `/data/flights/usStates.geojson`, although the boundaries are general map data.

The first is a small local cleanup. The second merits shared ownership of both the generated asset and its generator.
Retain the existing URL during migration if needed. Moving the generator changes build and publication dependencies.

Popup framing and dark styling can also move under `src/maps/`.
Keep record-specific labels, values, and HTML content with their features. Continue using the shared HTML escaper.

### Reusable interaction and presentation behavior

Flights, Tornado Tracks, and ADV Atlas each implement copy/share behavior.
Their implementations differ in native sharing, cancellation, clipboard fallback, manual copying, feedback timers, and focus restoration.
Extract a shared behavior module with explicit result states. Keep button appearance and feature side effects local.
Stopping globe rotation before sharing remains a Flights action.

Flights has a generic `CollapsibleSection` and a `VirtualizedList` under `components/shared/`.
The latter progressively reveals rows; it does not perform viewport virtualization.
Temperature summaries repeat visible counts and Show more controls in several panels.
Extract progressive list state or a small shared list module, with an explicit reset key for filter and sort changes.
Preserve table semantics instead of wrapping every row in a generic `div`.

`useFocusTrap` is reusable but currently serves Flights dialogs.
Move it when a second consumer needs the same behavior. Nonmodal drawers should retain their own focus policy.

Temperature maps also define local date formatting despite the shared calendar-date utility.
Consolidate compatible date display with explicit empty-value and formatting options.
Keep NOAA timestamps, flight input parsing, and calendar dates distinct.
Temperature formatting similarly differs in null handling and precision; share conversions while preserving display contracts.

### Shared domain calculations and contracts

Tornado browser utilities and the sync script contain identical 19-line `emptyAnnualSummary` bodies.
They also separately implement annual scale counts, deaths, injuries, track miles, and median widths.

Suggested destination: `shared/tornadoes/annualSummary.ts`.
Use the same pure aggregation module for generated summaries and filtered browser summaries.
Preserve zero-filled year domains, ordering, and rounding. Keep notable-event ranking and publication local to the generator.
Verify parity using shared track fixtures and the existing tornado utility and sync suites.

Temperature JSON contracts are represented in both [`schemas.ts`](../../src/features/temperatures/schemas.ts) and handwritten [`types/index.ts`](../../src/features/temperatures/types/index.ts).
Infer payload types from schemas, following the existing trip manifest pattern.
Keep view state types separate. Move contracts to `shared/temperatures/` if the generator will validate against them.
This avoids a Node generator importing browser modules.

Neither change belongs in a generic statistics framework.
Temperature and tornado calculations encode different domain rules despite similar chart shapes.

### Artifact publication, workflows, and infrastructure

Artifact code currently uses several distinct policies:

- `writeAtomically` replaces one file through a temporary file and rename.
- Blog `writeIfChanged` avoids rewrites when text is unchanged.
- `writeFlightGeoJson` preserves an existing generation timestamp when the payload is otherwise identical.
- Tornado output publication stages and replaces a directory, with restoration if promotion fails.

These are related capabilities, not interchangeable implementations.
Place reusable file operations under `scripts/lib/` while keeping timestamp policy and managed-file selection in callers.
Do not replace directory-level publication with individual atomic writes.

The sync workflows repeat checkout, Node setup, npm installation, AWS authentication, S3 commands, and CDN invalidation.
Use a small composite action for repeated setup, or a shared upload script for explicit publication plans.
Keep workflow triggers, permissions, credentials, object prefixes, MIME types, cache settings, and deletion policy visible to each workflow.
Temperature sync currently needs no dependency installation. A common setup action should preserve that benefit.

`backfill.js` already centralizes parts of upload command construction.
The Terraform data distribution is already shared, and `github-actions.tf` already uses `for_each` for sync roles.
There is insufficient repeated infrastructure here to justify a new Terraform module as an early step.
The two browser runners also serve different purposes: development smoke tests and a built trip fixture site.
Share proven process utilities only if needed; retain both testing modes.

## Suggested library structure

Use this as a direction for incremental changes. Create each module only when adopting it in concrete consumers.

```text
shared/                         Browser and Node-compatible pure modules
  geography/usStates.ts
  tornadoes/annualSummary.ts
  temperatures/contracts.ts
  tripManifestSchema.ts         Existing
  routeGeometry.ts              Existing
src/
  data/fetchCache.ts
  data/useJsonResource.ts
  navigation/useUrlState.ts
  maps/                         Existing folder; MapLibre-specific behavior
  hooks/                        Existing folder; browser behavior
  components/                   Existing folder; shared presentation
  features/                     Project adapters and domain interactions
scripts/
  lib/googleSheets.js
  lib/http.js
  lib/files.js
projects/flights/scripts/
  airportData.js                Flight-specific normalization
```

Pure shared modules must not import React, browser globals, Node filesystem operations, or feature modules.
Browser modules can depend on pure shared modules. Scripts can depend on pure shared modules and script utilities.
Feature modules should not import another feature's infrastructure.

Use direct imports from specific modules. Avoid a universal barrel that pulls map or globe dependencies into unrelated pages.
Preserve lazy routes and check bundle budgets when extracting renderer-related code.

Use the repository's existing TypeScript execution conventions. Keep new shared TypeScript compatible with supported Node versions and the compiler's erasable syntax rules.
Ensure new files remain covered by TypeScript, ESLint, and test discovery.

Separate packages become useful when another real application needs independent installation or versioning.
At that point, package the proven pure modules, React behavior, and script utilities separately as needed.
The present source does not justify a monorepo tool or a public npm package.

## Recommended first changes and acceptance evidence

1. Move the request cache and remove cross-feature infrastructure imports. Preserve the existing cache and data-hook contracts.
2. Add the state registry and migrate its three consumers. Preserve jurisdiction subsets, FIPS strings, and generated identities.
3. Share airport normalization between the two generators. Preserve output properties, defaults, and invalid-coordinate behavior.
4. Add `TechBadges` and adopt existing project presentation modules. Preserve navigation and screenshot behavior.

Review these as independent changes. Keep their diffs small enough to verify unchanged behavior.
The later map and URL work should have explicit acceptance conditions before implementation.

## Implementation follow-up

The first four extractions were implemented on 2026-11-03.
See the [shared module guide](../shared-modules.md) for current imports and ownership.

- Request caching now lives in `src/data/fetchCache.ts`. Feature hooks and tests import the shared module directly.
- One state registry now supplies temperature sync, tornado normalization, and flight boundary generation.
- Both airport generators now share mapping loading and normalization through `airportData.js`.
- Six additional pages now use `ProjectPageHeader`. Three screenshot galleries now use `ProjectScreenshotGallery`.
- Eleven technology lists now use `TechBadges`. Detailed page lists retain their additional technologies.
- Internal header actions retain React Router navigation.

The initial implementation passed these checks:

- TypeScript checks and ESLint.
- A Vite production build using the `trip-test` fixture mode.
- All 2,255 Vitest tests across 156 suites, plus 17 Python pipeline tests.
- Four project browser checks at 320px and 1280px.
- Exact comparison with the original state names, FIPS strings, centroids, and jurisdiction subsets.
- Byte comparisons for 334 flights, 114 visited airports, and 4,371 complete-airport records.

The compared flight and airport outputs remain byte-for-byte unchanged.

The [follow-up quality review](2026-11-03-shared-library-quality-review.md) records input fixes and additional contract tests.
