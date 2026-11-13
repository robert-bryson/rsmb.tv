# Pins of Inaccessibility

Explore the point farthest from each administrative boundary.
The map includes 257 country or territory poles and 4,599 state, province, and regional pins.
The U.S. also has 3,235 county or county-equivalent pins.
Each circle shows the distance from its pin to the nearest boundary.
A boundary contact is a point where a radius reaches an edge.

Open `/projects/pins-of-inaccessibility/map` for the map.
Open `/projects/pins-of-inaccessibility` for the project description.

## Coverage

Choose **World overview** to rank country poles.
Choose a country to explore its state, province, or regional pins.
The default view retains the original U.S. map and county controls.
Country and pin URL parameters preserve the chosen view.
A shared province link can also infer its country from the pin ID.
Click outside a selection to return one geographic level.
A county returns to its state. A state or province returns to its country. A country returns to the world.
The **Up one level** button, the selected card's parent button, and Escape use the same hierarchy.
The location trail shows the current path. Its **World** button returns directly to the globe.
At the world level, Escape closes the explorer panel.
Escape first closes a hover tooltip or clears a nonempty search field. Native selectors retain their Escape behavior.
Parent views remain in the URL. Browser Back and Forward restore the path.
For a U.S. state view, `state=51` retains Virginia without selecting a county.
Every selected pin links to its exact coordinates in Google Maps and OpenStreetMap.

The map uses MapLibre's globe projection with the CARTO Dark Matter basemap.
Choose **World overview** to see and drag the sphere, then select a country or pin to zoom in.
The projection transitions to a local flat view at street-level zooms.
Globe projection and atmosphere are restored after background reloads and recovery.
Distance badges appear only on the visible surface; back-side spokes do not show labels through the globe.

Global coverage uses Natural Earth 5.1.1 at 1:10 million scale.
The 257 entries are source map units, including countries, territories, and disputed units.
They are not a count of sovereign states.
The source follows its default de facto boundary policy.
Region levels and dates vary by country.
For example, the source has 13 Canadian units, 11 Australian units, and 101 French units.
These counts describe the pinned source, not a claim about current legal divisions.
Six regions have no source name and retain a clear code-based label.
Antarctica and its two source regions have no pins in this administrative dataset.

The existing U.S. national, state, territory, and county pins retain Census data.
The global country index copies the published U.S. national pin exactly.
The global overview uses a generalized Natural Earth U.S. outline.
Choose the U.S. view for its Census outlines.

The state dataset contains 50 states, DC, and five inhabited territories.
The territories are American Samoa, Guam, the Northern Mariana Islands, Puerto Rico, and the U.S. Virgin Islands.
County equivalents include boroughs, census areas, parishes, independent cities, Connecticut planning regions, and territorial equivalents.
The Census files omit minor outlying islands.

U.S. administrative boundaries include jurisdictional water.
Global sources use administrative borders and source coastlines.
Foreign regions are intersected with their parent country before calculation.
This aligns differences between the source layers' coastlines and international edges.
The current publication flags 1,852 adjusted regions and explains the change in each selected card.
The Natural Earth files retain large inland lakes, instead of cutting their shores into new edges.
Inland lake shores add no edges.
Administrative enclaves remain holes in the surrounding jurisdiction.
Coastal limits can extend offshore, so a pin can lie over water.

The U.S. national calculation merges all covered state and territory polygons.
It removes shared state borders.
International borders and coastal jurisdiction limits remain edges.
This definition differs from a calculation that uses only the continental coastline.
See the original [pole of inaccessibility concept](https://en.wikipedia.org/wiki/Pole_of_inaccessibility).

## Sources and calculation

The global generator reads Natural Earth's [country](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/) and [first-level region](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/) archives.
The data is [public domain](https://www.naturalearthdata.com/about/terms-of-use/).
The [global snapshot](../../shared/geography/naturalEarthSnapshot.json) pins URLs, checksums, counts, and the excluded polar unit.
The [identity catalog](../../shared/geography/worldCatalog.json) pins country names, bounds, and every regional ID.
The generator rejects source drift before publication.
The browser checks exact coverage and country ownership before use.
It removes a rejected response from the shared cache if that response is still current.
Global records use Natural Earth and available ISO codes. They do not invent FIPS codes.

The generator reads full [2025 state](https://www2.census.gov/geo/tiger/TIGER2025/STATE/) and [county](https://www2.census.gov/geo/tiger/TIGER2025/COUNTY/) TIGER/Line archives.
The [snapshot contract](../../shared/geography/census2025.json) stores URLs, SHA-256 checksums, and county counts for each state.
Both Python and TypeScript use this contract.
Downloaded and cached archives must match the pinned checksums.
A changed source requires an explicit snapshot update.

For each jurisdiction, the generator does these steps:

1. Preserve holes and separate disconnected components.
2. Unwrap each component across the date line.
3. Densify segments to at most 0.02 degrees.
4. Use a local WGS84 azimuthal equidistant projection.
5. Simplify the working boundary by at most 20 meters.
6. Find its maximum inscribed circle with at most a 25-meter search tolerance.
7. Recenter the projection at the candidate pin, for at most six passes.
8. Measure the final radius against the original densified boundary.
9. Check the pin and 72 circle samples against that boundary.
10. Select the component with the greatest radius.
11. Record up to four distinct boundary contacts.

A component can be skipped when its bounding estimate cannot exceed the current radius.
Boundary contacts must be within one percent of the radius, with a 100-meter maximum tolerance.
Their bearings must differ by at least 25 degrees.
Each contact stores its measured distance and initial bearing.
The browser uses a shared Vincenty direct calculation to draw geodesic circles and spokes.
A geodesic follows the shortest path on the WGS84 ellipsoid.

Small global units use tighter limits derived from their mapped area.
The minimum search tolerance is 0.01 meters; the minimum working simplification is 0.001 meters.
These numerical limits do not establish the accuracy of Natural Earth boundaries.

Results are approximate.
Projection iteration can change the selected point.
The search tolerance does not certify a global geodesic optimum or source survey accuracy.
Rectangular jurisdictions can have several points with nearly equal radii.
The 72 samples check circle containment; they do not prove containment between samples.

Census display outlines use a separate 0.0015-degree simplification.
Global province outlines retain source vertices rather than independently simplifying neighboring polygons.
Independent simplification created gaps and overlaps along shared borders, even where the source polygons matched.
Global overview country outlines use at most 0.02 degrees, capped at 0.1% of each component's smaller longitude or latitude extent.
This preserves small-island detail even when an island belongs to a large country.
Country views use province coastlines while that layer is visible, without overlaying the coarser country outline.
The generator reduces them to a six-decimal precision grid that preserves valid geometry.
Collapsed small pieces can be removed by precision reduction.
Every final outline must remain valid and nonempty.
Publication and source verification also reject display changes that break an edge-matched regional source coverage.
Precision reduction can leave sub-meter seams; existing source gaps and overlaps are not repaired.
These display changes do not increase the source's survey accuracy or update its administrative divisions.
Use the original TIGER data for detailed boundary analysis.

## Generate U.S. data

Use Python 3.12 or later.
Install the pinned packages in a separate environment.
Run these commands from the repository root:

```bash
python3 -m venv .venv-pins
.venv-pins/bin/python -m pip install --requirement projects/pins-of-inaccessibility/requirements.txt
.venv-pins/bin/python projects/pins-of-inaccessibility/generate.py
```

The first run downloads about 90 MB into `.cache/pins-of-inaccessibility/`.
Later runs verify and reuse these archives.
Delete a cached archive if its checksum fails.
Do not update the expected checksum without checking the replacement source.

| Option | Action |
| --- | --- |
| `--cache PATH` | Select the archive cache |
| `--output PATH` | Select the publication directory |
| `--download-only` | Verify the archives without calculating pins |
| `--verify-only` | Check the publication against full source boundaries without replacing files |
| `--national-only` | Update the national pin in a publication with matching sources |
| `--contacts-only` | Update contacts without calculating new pin positions |

Partial modes preserve the other pins and display outlines.
They require an existing publication with matching source hashes.
With the packages available to `python3`, `npm run build-pins` runs the full generator.

## Generate global data

Use the same prepared Python environment:

```bash
.venv-pins/bin/python projects/pins-of-inaccessibility/generate_world.py
```

With packages available to `python3`, use `npm run build-pins:world`.
The first run downloads about 20 MB into `.cache/pins-of-inaccessibility/world/`.
It reuses the existing U.S. solver, source reader, display geometry, contacts, verification, and publication writer.
It does not replace the U.S. data files.
All 4,799 added pins receive source and sampled-circle checks before publication.
Regional source checks use the full country-aligned geometry, before display simplification.
The checks also confirm that each regional pin lies inside its parent country.

The global files live under `public/data/pins-of-inaccessibility/world/`:

| File | Contents |
| --- | --- |
| `pins.json` | A small index of 257 country poles, including the retained Census U.S. pole |
| `countries.geojson` | Generalized country and territory overview outlines |
| `regions/CODE.json` | Province and regional pins for one country |
| `regions/CODE.geojson` | Province and regional outlines for one country |

The global index is about 188 KiB before compression.
Overview outlines are about 6.0 MiB, or 2.2 MiB with gzip.
Canada adds about 10 KiB of pins and 1.7 MiB of province outlines.
The default U.S. view also loads the small global country index for context markers.
The index is 192,685 bytes before compression, or 44,184 bytes in a local gzip measurement.
Global country outlines still load only when the world or a foreign country needs them.
Province files are loaded only for the chosen country.
Province pins supply the rankings even when their map layer is hidden.
Province outlines load only while that layer is on.
An outline error does not block the country view while the layer is off.
A country change cancels the old UI reader and clears data from the previous country.
The shared cache can still retain a completed response for a later return.

The source catalog is a build input.
After an intentional source update, inspect and regenerate it with `--write-catalog`.
Do not accept a new checksum or identity list without reviewing the source change.

Use `--outlines-only` to refresh display geometry without recalculating pin positions, radii, or contacts.
This mode requires a complete existing publication with matching source hashes and catalog identities.
All replacement outlines are validated before publication begins.

Repeat the source checks and origin-sensitivity benchmark:

```bash
.venv-pins/bin/python projects/pins-of-inaccessibility/generate_world.py --verify-only
.venv-pins/bin/python projects/pins-of-inaccessibility/generate_world.py --benchmark
```

The benchmark compares four projection origins in eight selected country components.
It measures solver sensitivity, not independent proof of a global geodesic optimum.
See the [research and implementation report](../../docs/reviews/2026-11-12-pins-world-expansion.md) for results and source tradeoffs.

## Elevation and nearby places

Selected pins load a small context file from `https://data.rsmb.tv/maps/pins/context`.
Context does not block pin results, boundaries, or the external map links.
The browser checks field types, scope, pin ID, and sampled coordinates.
It rejects context from an older pole.
Changing the distance preference also switches elevation between feet and meters.

The offline enrichment samples NASA/USGS SRTM 30 m terrain through [Open Topo Data](https://www.opentopodata.org/), with NASA/METI ASTER GDEM v3 as fallback.
These are approximate raster elevations above sea level, not surveyed measurements.
Missing samples remain unavailable; zero and negative elevations remain valid.
No elevation or geocoding service is called from a visitor's browser.

Nearby places come from [GeoNames cities500](https://download.geonames.org/export/dump/readme.txt), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
That catalog includes towns with over 500 residents and administrative seats down to PPLA4.
The card says **Nearest listed place** because smaller settlements may be absent.
Distance is the shortest WGS84 geodesic to the listed place coordinates, not a driving or walking route.
The compass bearing describes the pin's direction from that place.
The nearest listed place can be across a border.
Place elevation is never substituted for terrain elevation at the pin.

Generate with the same Python environment:

```bash
.venv-pins/bin/python projects/pins-of-inaccessibility/enrich.py
.venv-pins/bin/python projects/pins-of-inaccessibility/publish_context.py
.venv-pins/bin/python projects/pins-of-inaccessibility/publish_context.py --profile rsmbtv-admin --publish
```

The generator first validates every required U.S. and global pin file.
It uses the pinned country catalog to find required files. A missing region file stops generation and publication.
An extra working file cannot add pins to the context release.

Generation and publication use the same Python context checks.
They reject invalid names, IDs, coordinates, counts, terrain samples, and place fields.
Booleans cannot replace numbers. Nonfinite coordinates cannot pass the coordinate comparison.
Cached terrain samples must pass the same checks before reuse.
Cache checkpoints and release files use unique temporary files and atomic replacement.
An interrupted file write keeps the previous file.

The publisher defaults to a dry run. `--publish` uploads to the existing data bucket.
It completes these steps before changing the active manifest:

1. Validate the manifest, file checksums, current pin coordinates, and nearby-place measurements.
2. Copy only listed release files to a private temporary directory.
3. Validate the temporary files against their copied manifest.
4. Upload the temporary release files with immutable cache headers.
5. Compare the remote file inventory with the manifest.
6. Upload the copied manifest last.

A concurrent local build cannot replace the manifest used by an active upload.
A failed release upload or inventory check leaves the active manifest unchanged.
Old releases remain available. The publisher does not delete files or invalidate the CDN cache.
The publication destination is scoped to `maps/pins/context/`.

Generated context and source downloads live in the ignored `.cache/pins-of-inaccessibility/context/` directory.
They are outside Git and the application's `public` directory.
The first publication covers 8,091 pins with 8,091 elevation samples and nearest places: 2,586,600 bytes in 307 files.
The largest file is about 80 KiB; the selected pin loads only its country-pole index, country-region file, or U.S. state county file.
The manifest records source URLs and SHA-256 checksums, terrain providers, release checksums, and coverage counts.

GeoNames downloads are cached. Use `--refresh-sources` for a deliberate catalog refresh.
Terrain requests are batched to at most 100 coordinates, paced below one request per second, and checkpointed after every successful batch.
The public elevation service currently permits 1,000 requests per day; the initial build used 81 requests for 8,037 unique coordinates.
Reruns reuse terrain samples by coordinates. `--retry-missing` explicitly retries missing samples.
Regenerate and publish context after recalculating poles or changing the source catalog.

For a local context preview, generate with `--output public/data/pins-of-inaccessibility/context` and set `VITE_PINS_CONTEXT_DATA_BASE_URL=/data/pins-of-inaccessibility/context` before starting Vite.
That optional mirror is ignored; remove it before building the application to keep data on the CDN.
With packages available to `python3`, the equivalent commands are `npm run build-pins:context` and `npm run publish-pins:context -- --profile rsmbtv-admin --publish`.

## Publication

The U.S. generator writes these tracked files:

| File | Contents |
| --- | --- |
| `public/data/pins-of-inaccessibility/pins.json` | Pins, contacts, bounds, coverage, method, and source checksums |
| `public/data/pins-of-inaccessibility/states.geojson` | State and territory display outlines |
| `public/data/pins-of-inaccessibility/counties.geojson` | County display outlines |

The writer checks coverage, identity, contact geometry, and outline validity before replacement.
It rejects nonfinite JSON values.
New pin publications also record Python, GEOS, and package versions.
For a partial update, these versions describe the writer used for that update.

An exclusive lock prevents concurrent publication writes.
For the default output, the lock is `public/data/.pins-of-inaccessibility.lock`.
It contains the writer process ID.
A killed writer can leave this lock behind.
Check that the process has stopped before removing a stale lock.

The writer stages all selected outputs before replacing any file.
Both generators use the same coordinate, bounds, contact, and polygon checks.
They reject nonfinite numbers, invalid map coordinates, duplicate contact directions, open rings, and unsplit date-line edges.
The world validator also checks the file's administrative level, parent country, and verification metadata.
Each file replacement is atomic.
An I/O error or handled interruption restores the previous files.
This sequence is not one atomic transaction across all three files.
A forced process kill or power failure can leave a mixed publication.
Run validation after an interrupted generation.
Commit all three outputs together after a full generation.
The normal site build needs no Python environment or Census download.

Use `--verify-only` for a source comparison after generation.
It checks every pin, radius, contact, and 72 circle samples for each pin.
Published radii and contacts must agree with the source within one meter.
U.S. circle samples use a two-meter inward margin for coordinate rounding.
Global samples use the smaller of two meters and 0.1% of the pin radius.
This check reuses the source projection method; it does not certify a global geodesic optimum.

## Interface

The map starts over the contiguous U.S.
The location trail shows world, country, state or province, and selected county levels.
Choose an ancestor in the trail to open that view.
The **Up one level** button and the selected card's parent button provide explicit alternatives to clicking outside a selection.
An empty map click moves up after a 500 ms window for native double-click and double-tap zoom.
Dragging, zooming, starting another touch, and changing location cancel a pending background action.
Clicks on map controls do not navigate.
Click another pin to select it directly.
A polygon inside the selected geography can open a child geography.
Click a sibling polygon's area to return to the parent view.
Clicking inside the selected polygon retains that selection.

Selection keeps other pins visible in muted colors.
The pointer changes over muted pins, and their hover details remain available.
Only peer circles at the selected geographic level remain as quiet outlines.
These circles have no fill or distance badges.
The selected pin keeps its stronger marker, circle, boundary, and measurements.
Country context uses the lightweight index. It does not load other countries' province geometry.
U.S. state views retain neighboring state markers and omit counties outside the chosen state.

On touch screens, marker picking uses an expanded area of about 44 by 44 CSS pixels.
The closest marker wins when these areas overlap.
The layer controls start collapsed on phones and short screens.
They sit in a dock along the bottom edge of the map.
Opening the controls resizes the canvas above them and keeps map content clear.
The dock remains available in fullscreen mode.
The location trail and parent action remain visible.
Short landscape screens place the explorer beside the map.
Camera framing keeps a selected point below controls when they cover the map center.
The globe view clears this camera padding when returning to the world.

The country selector opens the world view or any covered country.
Country views rank first-level regions and provide a national pole card.
A province-layer checkbox controls foreign province markers and outlines.
The selected pin keeps its circle and spokes when that layer is hidden.
Hover details close when the pointer leaves the map, the camera moves, or the displayed pins or units change.
Press Escape to close hover details without changing focus.
Foreign selected cards label area as mapped area.
They show source scale and flag especially small or unnamed source units.
The violet marker identifies the national pole.
Regional shortcuts reach Alaska, Hawaii, and each inhabited territory.
The national card and region menu can zoom to the U.S. pole.
The U.S. national pin has `level: "country"`, `fips: "US"`, and an empty `stateFips`.
It stays separate from state and county rankings.

Rankings support radius and name order.
Search accepts names, state abbreviations, and FIPS codes.
The jurisdiction selector filters results and map layers.
The largest and smallest cards use the current search and jurisdiction filter.
The `pin` URL parameter preserves a selected pin.
Distance units and the circle preference use local storage.

County modes are **Off**, **Auto**, and **On**.
Auto reveals counties at zoom 6.
County outlines load when the county layer first becomes visible.
County pins remain searchable before the outlines load.

The selected circle stays visible when other circles are hidden.
Its dashed spokes reach the published boundary contacts.
Badges show each contact's distance in miles or kilometers.
Unselected national details start at zoom 4.
State details start at zoom 6, and county details start at zoom 9.
Small circles wait until their radius spans about 70 pixels.
A selected pin shows its spokes at any zoom.

Badges use the visible part of each spoke.
They avoid map controls, spoke origins, and other badges.
A wide map shows at most 45 badges.
A map narrower than 600 pixels shows at most 20.
A badge is hidden when no clear position is available.

## Loading and recovery

The background uses CARTO's hosted Dark Matter vector style.
It includes roads, place labels, and geographic detail.
The current public vector endpoint works without a local key.
A configured basemap key is included when available.
CARTO and OpenStreetMap attribution remains visible.

Required data failures show a data retry action.
Optional county failures show a boundary retry action.
A failed background uses a neutral style and keeps the application layers.
Its retry action reloads only the background.

Renderer errors show **Retry map**.
A 15-second deadline also detects pins that never finish rendering.
Each replacement pin batch must finish loading in the renderer before the map reports ready again.
Background changes do not restart an existing pin deadline.
The data panel remains usable during a renderer failure.
A retry restores current layers, selection, camera request, and fullscreen controls.
A graphics restoration event alone does not clear a renderer error.

`data-map-state` reports `loading`, `ready`, `degraded`, or `error`.
The existing map monitor records readiness, failure, and recovery.
It excludes selected pin IDs and query values.
Local and preview hosts do not send analytics.

## Code ownership and reuse

| Module | Responsibility |
| --- | --- |
| `src/features/pins/PinsExplorer.tsx` | Search, scope, rankings, preferences, and URL selection |
| `src/features/pins/navigation.ts` | Geographic parents, shared scopes, ranking transitions, and location paths |
| `src/features/pins/PinsNavigation.tsx` | Location trail, parent action, and view announcements |
| `src/features/pins/PinsLayerControls.tsx` | Docked layer controls and their disclosure state |
| `src/features/pins/presentation.ts` | Visible context, muted pins, and peer-circle selection |
| `src/features/pins/PinsMap.tsx` | React state and renderer lifetime |
| `src/features/pins/mapRenderer.ts` | Map events, data updates, deadlines, and cleanup |
| `src/features/pins/mapLayers.ts` | Source and layer definitions |
| `src/features/pins/radii.ts` | Spoke geometry and zoom thresholds |
| `src/features/pins/radiusLabels.ts` | Badge placement and collision checks |
| `src/features/pins/usePinDetails.ts` | Selected scope loading, context retry, and stale-coordinate rejection |
| `src/features/pins/PinLocationDetails.tsx` | External maps, terrain units, place details, and source credits |
| `src/features/pins/locationDetails.ts` | Coordinate links, elevation units, and compass formatting |
| `shared/pinDetails.ts` | Browser context fields, manifest checks, and scope ownership |
| `projects/pins-of-inaccessibility/context_contract.py` | Shared offline context validation |
| `shared/pins.ts` | Census browser and Node publication validation |
| `shared/worldPins.ts` | Global contracts, catalog lookup, and shared pin presentation |
| `shared/pinGeometry.ts` | Source-independent geometry fields and validation |
| `shared/geography/census2025.json` | Python and TypeScript snapshot contract |
| `shared/geography/geodesy.ts` | Direct WGS84 destinations |

The feature reuses the site's MapLibre worker, CARTO styles, and background recovery.
It also reuses validated requests, state identities, persisted preferences, navigation, and project presentation.
Atlas and Pins share fullscreen recovery and screen collision geometry.
See [shared modules](../../docs/shared-modules.md), [CARTO configuration](../../docs/carto-basemaps.md), and [analytics](../../docs/umami-analytics.md).

## Validation

Run the geometry and publication tests in the prepared environment:

```bash
.venv-pins/bin/python -m unittest discover -s projects/pins-of-inaccessibility/tests -v
```

Install the development requirements to run the same security audit as CI:

```bash
.venv-pins/bin/python -m pip install --requirement projects/pins-of-inaccessibility/requirements-dev.txt
.venv-pins/bin/python -m pip_audit --requirement projects/pins-of-inaccessibility/requirements-dev.txt --strict
```

This audit includes the geometry packages, the audit tool, and their resolved dependencies.
It fails if a package cannot be audited. Do not add advisory ignores without reviewing the affected code.

Run the interface and contract tests:

```bash
npx vitest run scripts/__tests__/pins*.test.* scripts/__tests__/worldPins*.test.* src/test/usStates.test.ts src/test/AtlasFullscreenControl.test.ts src/test/MapPerformance.test.tsx src/test/analytics.test.ts
npm run lint
npm run typecheck
npm run test:e2e -- tests/e2e/pins-map.spec.ts
```

Set `PLAYWRIGHT_WEBKIT=1` to include WebKit.
Install browser system libraries as described in the [repository guide](../../README.md#testing-notes).

Python tests check analytic radii, dissolved borders, enclaves, islands, and date-line geometry.
They also check every published outline, source checksums, failed writes, rollback, and writer locks.
Context tests check complete source inventories, malformed fields, terrain checkpoints, upload snapshots, and failed remote inventories.
Upload tests use fixed AWS responses. They do not contact AWS or the terrain service.
Global checks also cover the 514 country and regional artifacts, tiny units, and equatorial component bounds.
Corruption tests also check world metadata, administrative levels, bounds, raw polygon rings, and rollback before replacement.
CI installs the pinned Python packages and runs these tests without a Census download.

Interface tests check loading, retries, rankings, scope, preferences, cleanup, deadlines, and badge placement.
Navigation tests check parent steps, shared state scopes, browser history, gesture cancellation, and muted context.
Browser tests use the real renderer and published geographic files.
They replace remote tiles and glyph responses with fixed responses.
They check rendered pixels, fullscreen retry, stalled workers, county loading, selection, accessible controls, and mobile layout.
Touch checks include a 320-pixel viewport, short landscape layout, native disclosure controls, and tapping outside a country.

See the [navigation design review](../../docs/reviews/2026-11-13-pins-navigation-design.md) for interaction decisions and current validation.
The [November 13 review](../../docs/reviews/2026-11-13-pins-review.md) records earlier fixes and source-check limits.
