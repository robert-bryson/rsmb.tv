# Pins UI refinement — November 13, 2026

The map needs a clearer hierarchy, rather than fewer geographic records.
The implementation reduces permanent controls and repeated labels while retaining the dataset, rankings, filters, measurements, and selected-pin details.
Large western counties also reveal detail at useful regional scales.

## Findings

The supplied county screenshot shows a location trail, a separate parent button, a jump selector, an overview button, and a persistent instruction.
Several offer the same geographic navigation.
The legend, unit selector, and expanded layer dock form three more control groups.
The dock removes canvas height even though display settings are secondary to exploration.

The world screenshot has a different density problem.
National markers, names, circle outlines, basemap labels, and the sidebar's large introductory blocks compete for attention.
The size of a marker says little about its importance to the current task.
The selected pin should provide the strongest visual anchor.

The old county policy used nationwide zoom limits of 6 for dots, 7 for boundaries, 8 for circles, 9 for names, and 10 for measurements.
It already checked measurement size, but the level-10 minimum overrode that check for large counties.
For example, Imperial County's 42.7 km radius is readable at zoom 7.
Its ordinary measurements nevertheless waited until zoom 10.
San Bernardino, Coconino, and Nye counties have readable measurements at zoom 6.

These are findings from the supplied views, source inspection, and published pin geometry.
They are not results from a moderated usability study.

## Research and design decisions

| Principle and primary source | Application to this map |
| --- | --- |
| [NN/g: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) recommends putting frequent tasks first and disclosing secondary options on request. | Keep navigation, jump, zoom, fullscreen, and units visible. Put display settings, symbol explanations, and longer help behind a named Map layers button. |
| [Esri: author a multiscale map](https://pro.arcgis.com/en/pro-app/3.6/help/mapping/map-authoring/author-a-multiscaled-map.htm) emphasizes continuity, appropriate feature density, and subtle changes between scales. | Reveal county detail according to its projected size and fade each feature in. Use a subdued overview and stronger selection. |
| [Mapbox: optimize label placement](https://docs.mapbox.com/help/dive-deeper/optimize-map-label-placement/) describes collision handling, alternate anchors, and placement priority. | Keep overlap prevention. Try labels above, below, and beside their pin. Give larger radii priority. Preserve every point even when its name cannot fit. |
| [W3C: breadcrumb pattern](https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/) provides a named navigation region with current-location semantics. | Retain the full geographic trail, ancestor actions, and location announcements. Integrate the parent action into the same surface. |
| [W3C: disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) defines a button with expanded state and a controlled content region. | Use a native button with aria-expanded and aria-controls. Support Enter, Space, Escape, focus restoration, and outside dismissal. The disclosure is not a modal dialog. |
| [W3C: target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) distinguishes the 24-pixel minimum from the larger 44-pixel enhanced target. | Retain large touch targets for parent navigation, map controls, layer controls, and units. Reduce visual framing rather than their touch area. |
| [MapLibre: camera expressions](https://maplibre.org/maplibre-style-spec/expressions/#camera-expressions) distinguishes continuous paint changes from integer layout evaluation. | Keep zoom at the top of paint expressions. Use integer feature filters for culling and fractional paint stops for smooth fades. |

The sources support these techniques.
The exact pixel thresholds and interface arrangement are application-specific design choices.

## Implemented refinement

| Previous presentation | Current presentation | Information retained |
| --- | --- | --- |
| Separate breadcrumb, parent button, overview button, and help strip | One breadcrumb surface with an integrated parent arrow; the current location recenters; country overview is also in Jump to | Every ancestor, explicit parent navigation, direct world access, current-location announcement, keyboard and background navigation |
| Expanded full-width layer dock | Compact Map layers button and floating disclosure, initially closed at every viewport | Circle toggle, regional layer toggle, county Off/Auto/On, visibility status, and selected-circle explanation |
| Separate floating legend | Symbol legend inside Map layers | Country, state, county, selected, context, and radius meanings |
| Introductory prose and large extremes cards ahead of the rankings | Smaller title, expandable introduction, quieter largest/smallest values, and no redundant one-option world tab | Coverage counts, descriptive text, extrema, rankings, search, country selection, scope, and sorting |
| Large national markers and strong ordinary circle outlines | Smaller overview markers and lighter outlines; selection remains prominent | Every actual pole location and circle, with hover and selection access |
| A distance badge on every overview contact | One badge per ordinary pin; all contact badges after selection | Published contact lines and their measurements, distance units, and full selected detail |
| Fixed label placement | Four candidate anchors and deterministic radius priority | Names remain available from the ranking, hover, and selected card when labels collide |

The desktop header is 14 CSS pixels shorter.
The map no longer gives up height to either the collapsed or expanded layer dock.
Opening display settings leaves both the canvas bounds and camera intact.
The panel scrolls within the available map height on short screens.
Units remain accessible when the phone explorer is open.

The selected circle, boundary, and distance badges retain a consistent highlight color.
Ordinary circles have less fill and lower line weight.
Country markers grow gradually with zoom rather than keeping the same large dot on the globe.

## County reveal policy

Let `mpp0 = 40,075,016.686 × cos(latitude) / 512`.
The projected-size threshold is `ceil(log2(minimumPixels × mpp0 / radiusMeters))`.
This is a local Web Mercator scale estimate, suited to county detail after zooming in from the globe.
It is not an exact globe-horizon projection or a local-density model.

| Detail | Earliest zoom | Size threshold | Latest reveal retained from previous policy |
| --- | ---: | ---: | ---: |
| County dots | 4 | 8-pixel radius | 6 |
| County circles | 5 | 22-pixel radius | 8 |
| County names | 6 | 40-pixel radius, then collision handling | 9 |
| County boundaries | 6 | One shared boundary layer | 6, previously 7 |
| County measurements | 6 | 70-pixel radius | Size dependent; no cap that would expose unreadable measurements |

All smaller counties retain their previous latest dot, circle, and name reveal levels.
Selected pins bypass ordinary drawing limits.
County On still forces ordinary dots to appear at every zoom; County Off retains the selected pin.
No published coordinates, radius values, contacts, or boundary calculations change.

| Published county | Previous measurement threshold | Current measurement threshold |
| --- | ---: | ---: |
| Imperial, California | 10 | 7 |
| San Bernardino, California | 10 | 6 |
| Riverside, California | 10 | 7 |
| Coconino, Arizona | 10 | 6 |
| Nye, Nevada | 10 | 6 |
| Clark, Nevada | 10 | 7 |
| San Juan, Utah | 10 | 7 |
| Fairfax, Virginia | 10 | 9 |
| Falls Church city, Virginia | 13 | 13 |

Spokes start fading at these integer zooms.
Their badges become eligible after the 0.75-level fade, subject to viewport and collision checks.
Thus Imperial's overview badge is eligible at 7.75 rather than 10.75.

The published dataset contains 3,235 counties and equivalents.
Applying the thresholds to that complete dataset gives the following cumulative eligibility counts.
These counts precede viewport, fade, and collision checks; they are not simultaneous on-screen label counts.

| Zoom | County dots | County circles | County names | County measurements |
| --- | ---: | ---: | ---: | ---: |
| 4 | 293 | 0 | 0 | 0 |
| 5 | 1,976 | 124 | 0 | 0 |
| 6 | 3,235 | 861 | 170 | 28 |
| 7 | 3,235 | 2,828 | 1,263 | 234 |
| 8 | 3,235 | 3,235 | 2,922 | 1,685 |
| 9 | 3,235 | 3,235 | 3,235 | 3,016 |

## Performance and implementation boundaries

Size thresholds are computed with pin data, not on every animation frame.
Native filters and paint expressions handle fractional zoom changes.
Point data and ordinary country/state circles are not rewritten when county detail appears.
Circle preparation still yields between bounded tasks and publishes one complete source update.
The earlier county-circle preparation now starts at zoom 4, with spoke preparation at zoom 5.
County boundaries remain lazy until zoom 6 or an explicit county selection.

This deliberately moves the existing nationwide county-circle source earlier.
It does not reduce its serialized size or convert boundaries to tiles.
The prior batching, weak geometry cache, scope cancellation, and selection-specific geometry remain in place.
A resize observer relays display-panel size changes to badge placement without rebuilding geometry.
It is disconnected when the renderer is disposed.

## Further opportunities

| Opportunity | Benefit | Why it is separate from this change |
| --- | --- | --- |
| Test task completion with new and returning visitors | Verify discoverability of Map layers, recentering, and geographic parent navigation | Source guidance and automated checks cannot establish user preference or task efficiency |
| Coordinate basemap country labels with thematic pole labels | Reduce duplicated names on the globe | Requires basemap-style ownership and recovery behavior across provider changes |
| Viewport or tile-based county geometry delivery | Reduce earlier source serialization and worker cost | Changes data publication and caching; the existing geospatial delivery review covers the larger migration |
| Density-aware detail selection | Improve dense eastern county views independently of county size | Needs stable placement during panning and comparison against the current collision policy |
| A smaller dedicated selection view in the explorer | Bring geographic details ahead of filters on phones | Changes the panel's navigation and Back behavior; the current detail card and data remain intact |

Clustering is a poor default for the core pole layer here.
It replaces the displayed locations with aggregates, weakening the comparison of exact poles and circles.
The first refinement should preserve those locations and reduce competing decoration.

## Verification

Focused tests evaluate the installed MapLibre style, native filters, fractional opacity, actual western county radii, and the small-county exception.
They cover one badge per overview pin, full selected contacts, disclosure dismissal, focus restoration, and unchanged data within zoom stages.
Browser checks use the real renderer and published geography with deterministic external-service responses.
They include 320-pixel and desktop layouts, regional county visibility, keyboard and touch navigation, fullscreen, map recovery, and automated accessibility scans.

The [measurement record](../performance/2026-11-13-pins-ui-refinement.json) stores the threshold counts, sample counties, source fingerprints, and verification results.
The published pin file matches the baseline SHA-256 exactly.

| Check | Result |
| --- | --- |
| Focused unit suite | 136 tests pass across 12 files |
| TypeScript | Pass |
| Production Vite bundle | Pass |
| Chromium | All 31 distinct map scenarios verified across the full run and final focused checks |
| WebKit | All 31 distinct map scenarios verified across the full run and final reload check |
| Documentation links | All relative file targets exist across the three edited guides |
| Live CARTO visual check | World and Imperial County views render with real tiles and labels; no failed requests or page errors |

The final Chromium recheck covers seven scenarios, including both corrected full-run assertions.
Those corrections use a western county in the narrow regional camera and the country overview action in the jump menu.
The final WebKit full run passes 30 scenarios.
Its remaining shared-link reload case passes after waiting for background requests to finish before document replacement.
This addresses the observed pattern described in the [Playwright WebKit document-replacement report](https://github.com/microsoft/playwright/issues/43120).
That connection is an inference from the error and successful isolated check, rather than a browser-engine diagnosis.
Application readiness retains the renderer's existing deadline.
The longer multi-camera measurement scenario has a 60-second overall test budget; individual readiness and visibility assertions keep their deadlines.
Mock external responses include explicit cross-origin headers.

The deterministic browser fixture does not verify production hosting.
A separate Chromium visual check uses the public CARTO style, tiles, and glyphs on localhost.
Physical-phone performance and moderated usability remain unmeasured.
