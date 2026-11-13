# Pins zoom transitions — November 13, 2026

## Result

The map introduces county detail in stages.
County dots appear before boundaries, circles, names, and measurements.
State measurements start one zoom level earlier.
Selected pins retain their circle, boundary emphasis, and measurements at every zoom.

The previous automatic threshold combined several changes at zoom 6.
It enabled county pins, county boundaries, all county circles, and state measurements.
The first county view could generate 3,292 circles while starting the county boundary request.

## Research and application

Esri recommends continuity across scales, gradual changes in feature density, and symbols appropriate to each scale.
Its guidance also connects excessive detail with poorer drawing performance.
This supports a dot stage before geometric detail.
See [Author a multiscale map](https://pro.arcgis.com/en/pro-app/3.6/help/mapping/map-authoring/author-a-multiscaled-map.htm).

MapLibre distinguishes continuous paint expressions from layout expressions evaluated at integer zoom levels.
Zoom filters also evaluate at integer levels.
An integer filter alone therefore cannot produce a smooth fractional transition.
The implementation uses minimum zoom limits for culling and paint expressions for opacity and marker size.
See [camera expressions](https://maplibre.org/maplibre-style-spec/expressions/#camera-expressions) and [layer properties](https://maplibre.org/maplibre-style-spec/layers/#layer-properties).

MapLibre recommends reducing coordinate precision, simplifying geometry, separating suitable datasets, and limiting detail by zoom.
County circles now have their own source.
This source has no drawing layer below zoom 8.
Its geometry also uses fewer segments and shorter coordinates.
See [large GeoJSON guidance](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/).

Mapbox's rendering guidance explains why source updates, vertices, layer counts, and filters affect performance.
The renderer now skips unchanged filters, visibility settings, paint settings, and zoom ranges.
It also retains unchanged source objects across zoom events.
See [map performance guidance](https://docs.mapbox.com/help/troubleshooting/mapbox-gl-js-performance/).

Google's performance guidance recommends splitting long tasks so input and painting can run between them.
County circle preparation now yields between small batches.
The completed collection reaches MapLibre in one source update.
See [Optimize long tasks](https://web.dev/articles/optimize-long-tasks).

These sources support the techniques.
The exact zoom levels below are application design decisions, checked against the published data and rendered views.

## Detail stages

| Zoom | New detail | Treatment |
| --- | --- | --- |
| 4 | National spokes | Retain the existing screen-size minimum; fade in before distance badges |
| 5 | State and province spokes | Start one level earlier; retain the screen-size minimum |
| 6 | County dots | Start at 1.8 pixels without an outline; fade to full opacity at 6.75 |
| 7 | County boundaries | Load outlines; fade them in; prepare circles after the camera settles |
| 8 | County circles | Fade in through 8.75; markers gradually gain size and an outline |
| 9 | County names | Retain collision handling; prepare spoke geometry |
| 10 | County spokes | Fade each spoke when its radius is large enough; then reveal its distance badge |

Two zoom levels approximately quadruple the linear display scale.
The dot, circle, and measurement stages therefore have substantial separation.
Boundaries and names occupy the intermediate levels.

The existing 70-pixel radius minimum remains.
Each spoke uses the greater of its level threshold and its size threshold.
Its opacity then increases across 0.75 zoom levels.
Distance badges wait until that fade finishes.
This avoids placing a full-strength badge beside an invisible spoke.

The selected circle uses a separate source and bypasses ordinary detail thresholds.
The selected county also retains a boundary fill for picking below the ordinary boundary threshold.
County Off, Auto, and On still control ordinary county markers.
On shows dots at any zoom; detailed geometry keeps its scale limits.

The map retains the current national and regional context at closer scales.
Selecting a pin continues to mute peer features and reserve distance badges for that selection.

## Geometry and interaction cost

At zoom 6, the map prepares 57 national and state circles instead of 3,292 circles.
County discovery needs neither county circle geometry nor the 6.6 MiB county boundary file.
County pins already exist in the point dataset and remain searchable.

| Measure | Before | After |
| --- | ---: | ---: |
| Circle coordinates at county discovery | 240,316 | 4,161 |
| Complete circle message bytes | 9,812,630 | 4,249,439 across two sources |
| Cold circle generation | One 133.74 ms task for all circles | 26 county tasks; largest measured task 5.19 ms |
| Cached county generation | No geometry cache | 1.12 ms total CPU time |

The complete circle messages are 56.69% smaller.
The CPU measurements are individual development-host samples, not frame-rate or physical-phone benchmarks.

At zoom 7, county geometry preparation runs outside React rendering.
Each task processes at most 128 pins.
It checks a six-millisecond budget after each group of eight pins.
The budget permits a small overrun within the final group; it is not a frame-time guarantee.
The next task yields through a timer, allowing input and rendering between batches.

Changing scope, disabling the layer, hiding circles, or unmounting cancels unfinished work.
Prepared collections are matched against their pin list and context before display.
An older scope cannot replace the current circles.
A weak cache retains reusable geometry while its source pin objects remain reachable.

Overview county circles use 48 geodesic samples instead of 72.
Their coordinates use six decimal places, which provide approximately 0.1-meter geographic resolution.
The planar chord approximation has about 0.214% maximum radial inset at 48 segments.
At a 70-pixel radius, that inset is approximately 0.15 pixels.
Large county circles can show more polygon approximation; selecting one restores the existing 144-segment circle.

National and state circles retain 72 segments.
Selected circles retain full coordinate precision.
Published centers, radius values, boundary contacts, and geodesic calculations are unchanged.

Circle preparation sends one completed county collection to the map worker.
Fractional zoom changes only update native drawing expressions.
They do not regenerate circles or spokes, replace point data, or repeat unchanged style setters.
Distance badges skip layout measurement when no spoke is eligible.

## Alternatives

| Approach | Assessment |
| --- | --- |
| Separate hard thresholds only | Reduces simultaneous detail, but still creates visible changes at each threshold |
| Continuous fades without culling | Improves transitions, but retains unnecessary geometry work at smaller scales |
| Cluster county pins | Reduces marker density, but replaces the actual pole locations with aggregate markers |
| Generate every circle at startup | Moves the delay earlier and consumes memory before county exploration |
| Generate circles during every zoom event | Repeats geodesic work and worker updates during camera interaction |
| Separate sources, staged preparation, native fades | Preserves exact pin locations while reducing early work and repeated updates |
| Serve circle geometry as vector tiles | Could reduce larger-scale delivery costs; requires a separate publication and hosting change |

The selected approach preserves direct geographic comparisons and the current controls.
It adds no package dependency.
Vector tile delivery remains part of the separate [geospatial delivery research](2026-11-13-geospatial-delivery-research.md).

## Verification

The [measurement record](../performance/2026-11-13-pins-zoom-transitions.json) records geometry sizes and verification results.
CPU timings describe this development host, excluding worker indexing, GPU drawing, network time, and physical-phone behavior.

The focused tests validate actual MapLibre expressions and the complete installed style.
They check intermediate opacity values, selected-feature exceptions, cached geometry, scope cancellation, and unchanged source and style writes.
Coordinate tests bound overview rounding and retain full selected-circle precision.

Browser tests use the real renderer and geographic files with fixed external-service responses.
They inspect 320-pixel and 1,280-pixel layouts at each county detail stage.
They verify visible dots, native layer culling, one deferred boundary request, and the number of source updates.
Screenshots show distinct dot, circle, and spoke stages.

| Check | Result |
| --- | --- |
| Focused Pins tests | 114 pass across 11 files |
| Chromium browser scenarios | 27 pass |
| WebKit browser scenarios | 27 pass |
| TypeScript | Pass |
| Production Vite bundle | Pass |
| Local documentation links | Pass across three changed documents |

The existing project-navigation test used an outdated screenshot alt description.
Its assertion now matches the current project page.
Chromium passes that corrected scenario separately from the other 26 scenarios.

WebKit uses the existing local WPE browser and cached libraries because the default launch lacks system libraries.
Two initial WebKit scenarios encountered a trace-file cleanup conflict with the concurrent Chromium run.
Both pass when rerun with an isolated artifact directory.
The other 25 WebKit scenarios pass in the full run.
