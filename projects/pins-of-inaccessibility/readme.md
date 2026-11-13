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

Global coverage uses Natural Earth 5.1.1 at 1:10 million scale.
The 257 entries are source map units, including countries, territories, and disputed units.
They are not a count of sovereign states.
The source follows its default de facto boundary policy.
Region levels and dates vary by country.
For example, the source has 13 Canadian units, 11 Australian units, and 101 French units.
These counts describe the pinned source, not a claim about current legal divisions.
Six regions have no source name and retain a clear code-based label.
Antarctica and its two source regions are excluded from this Mercator map.

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
The browser checks exact coverage and country ownership before caching any file.
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

Census and global province outlines use a separate 0.0015-degree simplification.
Global overview country outlines use 0.02 degrees.
The generator reduces them to a six-decimal precision grid that preserves valid geometry.
Collapsed small pieces can be removed by precision reduction.
Every final outline must remain valid and nonempty.
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
Overview outlines are about 2.5 MiB.
Canada adds about 10 KiB of pins and 1.4 MiB of province outlines.
These files load only when needed; the default U.S. view requests no global files.
Province files are loaded only for the chosen country.
A country change cancels the old UI reader and clears data from the previous country.
The shared cache can still retain a completed response for a later return.

The source catalog is a build input.
After an intentional source update, inspect and regenerate it with `--write-catalog`.
Do not accept a new checksum or identity list without reviewing the source change.

Repeat the source checks and origin-sensitivity benchmark:

```bash
.venv-pins/bin/python projects/pins-of-inaccessibility/generate_world.py --verify-only
.venv-pins/bin/python projects/pins-of-inaccessibility/generate_world.py --benchmark
```

The benchmark compares four projection origins in eight selected country components.
It measures solver sensitivity, not independent proof of a global geodesic optimum.
See the [research and implementation report](../../docs/reviews/2026-11-12-pins-world-expansion.md) for results and source tradeoffs.

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
Circle samples use a two-meter inward margin for coordinate rounding.
This check reuses the source projection method; it does not certify a global geodesic optimum.

## Interface

The map starts over the contiguous U.S.
The country selector opens the world view or any covered country.
Country views rank first-level regions and provide a national pole card.
A province-layer checkbox controls foreign province markers and outlines.
The selected pin keeps its circle and spokes when that layer is hidden.
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
| `src/features/pins/PinsMap.tsx` | React state and renderer lifetime |
| `src/features/pins/mapRenderer.ts` | Map events, data updates, deadlines, and cleanup |
| `src/features/pins/mapLayers.ts` | Source and layer definitions |
| `src/features/pins/radii.ts` | Spoke geometry and zoom thresholds |
| `src/features/pins/radiusLabels.ts` | Badge placement and collision checks |
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
Global checks also cover the 514 country and regional artifacts, tiny units, and equatorial component bounds.
CI installs the pinned Python packages and runs these tests without a Census download.

Interface tests check loading, retries, rankings, scope, preferences, cleanup, deadlines, and badge placement.
Browser tests use the real renderer and published geographic files.
They replace remote tiles and glyph responses with fixed responses.
They check rendered pixels, fullscreen retry, stalled workers, county loading, selection, accessible controls, and mobile layout.

See the [November 12 review](../../docs/reviews/2026-11-12-pins-quality-review.md) for measured coverage and remaining limits.
