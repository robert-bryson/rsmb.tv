# Global Pins research and implementation — November 12, 2026

## Decision and delivered coverage

Global expansion is feasible and is implemented.
The map now has 257 country or territory poles and 4,599 first-level regional pins.
The U.S. retains its 3,235 county-equivalent pins.
The added data supplies 256 country poles and 4,543 regional pins.
Existing Census positions, radii, contacts, and U.S. data files remain unchanged.

Choose a country in the map's **Country / territory** control.
Choose **World overview** to compare country poles.
Choose a country to compare its states, provinces, departments, or other source regions.
Country and province circles use the existing map, selected-pin behavior, spokes, distance badges, rankings, and units.
The map continues to use CARTO Dark Matter.

The counts describe source map units.
They are not counts of sovereign states or uniformly defined legal provinces.
Territories and disputed units retain the source's grouping.
Antarctica is excluded because this view uses Mercator and lacks a suitable administrative hierarchy for that continent.

## Source research

| Source | Evidence | Decision |
| --- | --- | --- |
| Natural Earth 1:10 million | Global country and regional coverage; public-domain redistribution; consistent small-scale cartography | Use for the initial global expansion |
| geoBoundaries gbOpen | Rich per-country metadata and detailed boundaries; license and represented year vary by layer | Consider for later country-specific detail adapters |
| GADM | Broad administrative coverage; redistribution requires permission | Do not ship its data in this repository |
| National mapping and statistical agencies | Can provide official divisions, water treatment, and current legal definitions | Retain Census for the U.S.; evaluate other countries separately |

Natural Earth publishes [country polygons](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/) and [first-level regions](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/).
Its [terms](https://www.naturalearthdata.com/about/terms-of-use/) permit modification and redistribution as public-domain data.
Its [boundary policy](https://www.naturalearthdata.com/about/) follows de facto control by default.
This map preserves that source policy and labels the source.
It does not make an independent sovereignty determination.

The selected archives contain 258 country units and 4,596 first-level units.
Both archives report version 5.1.1.
Exclude Antarctica and its two first-level units.
Replace the source's 51 U.S. regional units with the existing 56 Census jurisdictions.
These operations give 257 country units and 4,599 regional units.
The global index copies the existing U.S. national pin exactly.
Global U.S. overview outlines remain generalized Natural Earth geometry; the U.S. view keeps Census outlines.

Natural Earth levels are not uniform legal categories.
The pinned data contains 13 Canadian units, 11 Australian units, 101 French units, and 24 New Zealand units.
Some entries represent departments, municipalities, or overseas divisions.
Some source divisions and names are historical.
The publisher marks the first-level theme as beta.
Six added regions have no name. The UI identifies them with their source code.
These limits appear in the map and the project guide.

The [geoBoundaries API](https://www.geoboundaries.org/api.html) exposes represented years, source agencies, licenses, and download links.
Do not assume one license applies to every gbOpen layer.
For example, its [Canadian province metadata](https://www.geoboundaries.org/api/current/gbOpen/CAN/ADM1/) identifies an Open Government Canada license.
It also reports very detailed source geometry, with roughly 1.27 million vertices per province on average.
That detail is useful for a later adapter, but requires separate source, performance, and license checks.

[GADM's license](https://gadm.org/license.html) does not permit unrestricted redistribution.
That restriction conflicts with shipping boundary files in this public site without permission.
No GADM data was downloaded or included.

## Geographic definitions

A country pin maximizes distance from the source country's external boundary.
Its internal regional borders do not restrict its circle.
A regional pin uses that region's boundary.
Each disconnected component is checked, and the greatest radius is retained.
Administrative enclaves remain boundary holes.

The two Natural Earth layers have some different shorelines and international edges.
An initial hierarchy check found pins outside their parent country in Coral Sea Islands and Alo, Wallis and Futuna.
The generator now intersects each foreign region with its parent country before calculation.
This changes 1,852 regional geometries, often along small edge differences.
All regions retain nonzero area, their source IDs, and their names.
Each affected pin carries an alignment flag, and its selected card explains the change.
The snapshot records this derivation; both original archive checksums remain pinned.
Every added regional center now lies inside its source country.
The largest regional radius overrun is 4.454 meters, within the normal 25-meter search tolerance.
This rule makes the hierarchy consistent; it does not certify either source layer as a legal boundary.

The selected Natural Earth files retain large inland lakes.
The separate lake-cut variants are not used.
This preserves the request that inland lake shores do not create extra edges.
Foreign coastlines follow Natural Earth's mapped shores.
Census coastal jurisdiction limits can extend offshore, so the two sources have different coastal definitions.
The UI does not describe foreign mapped area as Census land area.

The global data is generalized at 1:10 million scale.
It is suitable for exploration and comparison at that source scale.
It is not a survey or a current legal boundary service.
Especially small units can be strongly generalized.
Their selected cards carry an additional source-detail note.

## Calculation and numerical checks

The expansion reuses the existing WGS84 azimuthal equidistant solver.
It also reuses component handling, date-line handling, source readers, nearest contacts, display geometry, and publication writes.
The solver recenters its projection for at most six passes.
Its normal maximum search tolerance is 25 meters.
Its working simplification is at most 20 meters.

Small units need tighter limits.
Global tolerances scale with the square root of mapped area.
The minimum search tolerance is 0.01 meters.
The minimum working simplification is 0.001 meters.
A test resolves a synthetic 40-meter square with a 20-meter radius.
The global generation applies tighter search limits to 1,373 source units.
These limits describe numerical work, not source accuracy.

The component upper bound now handles equatorial polygons correctly.
A polygon crossing the equator reaches its largest longitude scale between its north and south bounds.
Using only endpoint latitude scales could underestimate a component.
The new test checks that case directly.
U.S. generator defaults remain unchanged.

Every added pin is checked against its full, densified calculation boundary.
Country checks use the original country geometry.
Regional checks use the region intersected with its parent country, before display simplification.
Checks cover containment, radius agreement, contact placement, and 72 inward circle samples.
All 4,799 added pins and 345,528 samples pass.
Maximum radius disagreement is about 0.00114 meters.
Maximum contact offset is about 0.00078 meters.
Those values measure numerical consistency after coordinate rounding.
They do not measure the accuracy of Natural Earth boundaries.
Finite circle samples do not prove containment between samples.

A separate sensitivity run uses four different initial projection origins.
It checks Canada, Russia, Australia, Brazil, China, France, Greenland, and Indonesia.
Each run uses the source component containing the published pin.
The largest spread is 4.023 meters, in Canada.
The largest improvement over a published radius is 1.991 meters.
Both are below the normal 25-meter solver tolerance.
This check does not independently certify a global geodesic optimum.
The [benchmark record](../performance/2026-11-12-pins-world-solver-benchmark.json) retains every result.

## Delivery and implementation

Country codes and regional IDs are separate from U.S. FIPS codes.
The new [world contract](../../shared/worldPins.ts) checks parent country, exact identity coverage, geometry, and pinned source metadata.
The [shared geometry contract](../../shared/pinGeometry.ts) supplies source-independent fields and contact checks.
The existing Census contract still checks the original publication.
Wrong-country province files and incomplete files are rejected before caching.

The [global snapshot](../../shared/geography/naturalEarthSnapshot.json) pins both archive URLs and SHA-256 values.
The [catalog](../../shared/geography/worldCatalog.json) pins country names, bounds, and every regional ID.
Downloads and cached archives must match the snapshot.
A source change requires an explicit catalog review.

The default U.S. view requests no global files.
The global country-pin index is about 188 KiB before compression.
Country overview outlines are about 2.5 MiB.
Canada adds about 10 KiB of pins and 1.4 MiB of regional outlines.
Province data is split by country, so visiting Canada does not request Australia's files.
The identity catalog is included in the lazy Pins route bundle.
The measured route chunk is about 147 KiB, or 39 KiB with gzip.
This adds JavaScript work even when the initial U.S. view requests no global data files.
Country overview simplification reduced its geometry payload from about 9.3 MiB to 2.5 MiB.
These sizes do not establish a physical-phone performance budget.

The shared resource hook now keeps response state tied to its URL.
Changing country immediately clears the previous country's visible resource.
A delayed response cannot replace the current country's pins or outlines.
Completed responses can still enter the shared cache for a later return.
Retry invalidates only the failed resource.
Unknown URL country values cannot become arbitrary resource paths.

The existing renderer draws both sources.
Country labels now come from feature properties.
Province markers, circles, and outlines have a visibility control.
A selected province retains its circle and spokes when other provinces are hidden.
Source cards label foreign area as mapped area.
Small areas retain decimal places instead of appearing as zero square kilometers.
Existing U.S. shared links continue to work.
Province-only links can infer their country from the identity catalog.

Publication uses the existing lock, staging, and rollback helper.
It also supports nested country files and rejects paths outside the output directory.
All selected outputs are checked before replacement starts.
There are 514 global artifacts: two overview files and two files for each additional country.
Each replacement is atomic; the set of replacements is not one atomic transaction.
Forced termination or power failure can still leave a mixed publication.

## Validation and reproduction

The global contract test checks every country-specific pin file and every display outline.
Python checks all 514 global artifacts for complete coverage and valid geometry.
Other tests cover tiny shapes, equatorial bounds, coastline alignment, empty intersections, cached-source checksums, incorrect parents, and publication paths.
Resource tests cover lazy requests, caching, rapid country changes, and swapped-file retries.
UI tests cover country selection, rankings, province links, source labels, and return to the U.S.

All 13 map browser scenarios pass in Chromium and WebKit.
The existing ten U.S. scenarios remain included.
New cases cover Canada, Ontario, Fiji, Australia, Japan, delayed responses, and malformed province pins.
A real-provider check also rendered Canada and Ontario with the configured CARTO key.
The [Canada screenshot](../../public/images/pins-of-inaccessibility/canada.webp) records the reviewed layout.

An initial full unit run during concurrent generation hit an unrelated trip-map timing assertion.
The isolated trip suite passed all 78 tests.
The final full run uses bounded parallelism.
All 3,096 JavaScript tests pass across 215 files.
All 25 Pins Python tests and 18 temperature Python tests pass.
The 60 focused Pins tests cover 99.06% of lines and 93% of branches in the measured modules.
Lint, TypeScript checks, and the Vite bundle check pass.
The task does not change trip-map implementation.

Use the prepared Python environment to reproduce source checks:

```bash
.venv-pins/bin/python projects/pins-of-inaccessibility/generate_world.py --verify-only
.venv-pins/bin/python projects/pins-of-inaccessibility/generate_world.py --benchmark
.venv-pins/bin/python -m unittest discover -s projects/pins-of-inaccessibility/tests -v
```

Run the interface checks:

```bash
npx vitest run scripts/__tests__/pins*.test.* scripts/__tests__/worldPins*.test.*
npm run lint
npm run typecheck
PLAYWRIGHT_WEBKIT=1 npm run test:e2e -- tests/e2e/pins-map.spec.ts
```

The [measurement record](../performance/2026-11-12-pins-world-expansion.json) retains source checks, sizes, coverage, and publication fingerprints.

## Remaining work

Add country-specific providers when a higher-resolution or current legal boundary is needed.
Check each provider's license, dates, water definition, and identity mapping first.
Keep the existing U.S. Census publication as its own source.
A polar view needs separate geometry and projection work before Antarctica can be added.

Physical-phone transfer, memory, rendering time, and screen-reader checks remain open.
A country-scale numerical consistency check does not replace those measurements.
Track this work in [TODO.md](../../TODO.md#pins-of-inaccessibility).
