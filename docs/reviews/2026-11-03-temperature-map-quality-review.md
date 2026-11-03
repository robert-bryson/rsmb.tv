# Temperature map quality review

Date: 2026-11-03.
Baseline: `82c80e9`, with the marker-clustering removal present in the working tree.

## Scope

The review covers the pending temperature map change and its immediate consumers.
It checks marker rendering, pointer events, asynchronous layers, units, popup HTML, tests, and current documentation.
It does not audit the complete repository or the historical Python estimator's calculations.

The user's display requirements are:

- Draw every record marker instead of gray clusters.
- Preserve red high markers and blue low markers.
- Hide temperature labels when they cannot fit without overlap.

Independent reviewers checked repository standards and these requirements separately.
The [shared-module guide](../shared-modules.md), [basemap guide](../carto-basemaps.md), and [writing rules](../README.md#writing-rules) supply repository standards.

## Standards

The independent review found no documented coding-standard violation in the initial clustering removal.
It found one P2 interaction defect exposed by the change.

### P2: A neighboring glow could override the clicked marker

The component registered separate pointer handlers for each dot layer and the glow layer.
One click could therefore run several handlers and create several popups.
The glow handler ran last. It could replace the visible marker's station with a nearby station.

Clustering previously hid many nearby records at the initial zoom.
Removing clustering exposed this existing event-order defect in the nationwide view.

The component now registers one delegated handler for the interactive layer set.
MapLibre returns features in rendered order. The handler selects the first feature.
An inner marker therefore takes priority over a lower glow layer.
Clicks outside the inner marker can still select its glow.
The same grouped handlers prevent competing hover updates.

A component regression supplies an inner marker and a neighboring glow in one event.
It checks the selected station and requires exactly one popup.
A browser regression exercises the actual renderer with overlapping hit areas.

The final independent Standards review found no further actionable defect.
It identified the browser font fixture as a validation limit. That limit is documented below.

## Spec

The independent Spec review found no defect in the original clustering removal.
The source no longer clusters. Circle layers remain separate from the temperature symbol layer.
Red high circles and blue low rings retain their existing appearance.
Labels retain `text-allow-overlap: false`.

The final Spec review confirmed that the surrounding fixes preserve these requirements.
It requested stronger state-selection coverage. The final component suite includes that regression.

## Additional findings and fixes

### P2: Late data could use the wrong view visibility

Recent layers were created with default visible layouts.
The visibility effect ran when the view changed, but not when delayed data created new layers.
Recent markers could therefore appear over the county, state, or record-age view.

The reverse failure affected all-time data.
County and state layers started hidden. Delayed data could leave the requested view blank.

The visibility effect now depends on the data that creates each layer set.
A single view-to-layer table replaces repeated visibility branches.
Parameterized component tests cover delayed recent and all-time data in all three alternative views.

### P2: Celsius mode could show Fahrenheit values

A shared URL could select Celsius before records arrived.
New recent labels started in Fahrenheit. The unit effect did not depend on recent data arrival.
Hover text also used literal Fahrenheit templates after the unit changed.
Record-age popups had the same fixed-unit behavior.

The unit effect now runs after recent and state data becomes available.
Hover text uses the shared temperature formatter and the current unit reference.
Record-age popup options explicitly name their compact layout and temperature unit.

Tests cover late Celsius labels, a unit change before hover, and both record-age popup layouts.
The browser selection regression also requires Celsius hover text.

### P2: An invalid previous-record date could create HTML

The payload schema permits a string for `prevRecordDate`.
The date formatter returned an invalid date unchanged.
The popup inserted that fallback directly into an HTML template.

The regression supplies `<img src=x onerror="alert(1)">` as the previous-record date.
Before the fix, the popup contained the supplied image element and event attribute.
The test demonstrates HTML injection. It does not test script execution under the production content security policy.

All formatted dates are now escaped before HTML interpolation.
The popup retains malformed date text as literal text.
The regression also checks that HTML-like station names remain literal text.

### P2: Crossing a zoom threshold closed the current selection

The old visibility effect also cleared station and state selections.
It depended on the county zoom threshold, so ordinary zoom changes could close the selected record.
Adding data dependencies to that effect would also close selections during data updates.

Selection reset now depends only on an actual view change.
React clears view-specific selection state before rendering the new view.
A separate effect closes the MapLibre popup.
Layer updates only control visibility.

Tests preserve a station selection across the zoom threshold.
Another test selects a state, zooms, changes views, and returns.
State details survive zoom and remain cleared after leaving the state view.

## Documentation changes

The new [temperature map guide](../temperature-map.md) describes controls, marker behavior, code ownership, and validation limits.
The repository guide now uses the current **County Extremes** and **State Extremes** labels.
The historical pipeline guide links to the operational map guide and keeps its separate purpose explicit.
The documentation index links both current instructions and this dated review.

The affected text uses short sentences, active voice, and consistent terms.
Commands, identifiers, and product names retain their exact spelling.

## Validation

| Check | Result |
| --- | --- |
| Focused component and temperature map tests | 26 cases passed across four files |
| New component regressions | 15 cases; nine original cases failed before the fixes |
| New record-age unit cases | Two cases passed |
| Browser regressions | Six cases passed across Chromium and WebKit |
| Complete Vitest suite with V8 coverage | 2,322 cases passed across 161 files |
| Historical temperature pipeline | 17 Python tests passed |
| TypeScript | Passed |
| ESLint | Passed with zero warnings |
| Production bundle with fixture content | Passed with `vite build --mode trip-test` |
| Documentation targets and whitespace | 123 local targets exist; `git diff --check` passed |

The browser checks used an isolated development server on port 4199.
They verify nine nearby markers at widths of 390 and 1,280 CSS pixels.
They also verify marker removal after changing the observation period.
Each expected station must have pixels of its assigned color near its projected position.
Gray clusters and missing markers fail these checks.

Browser fixtures replace external data and provider responses.
Their empty glyph range makes marker checks independent of remote fonts.
They do not verify font appearance or rendered label collisions.
Component tests check the separate symbol layer and its collision setting.
Screenshots use CSS pixels so Retina device scaling cannot change sample coordinates.
The fixtures do not verify live data, CARTO authorization, or upstream availability.

### Controlled coverage comparison

Both runs use the same final source and V8 provider.
The measured files are `TemperatureMap.tsx`, `temperatureMapLayers.ts`, and `temperatureMapPopup.ts`.
The baseline runs 11 cases in the existing layer, summary, and data-hook suites.
The expanded run adds the 15-case component suite.

| Suite | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| Without the component suite | 3.35% | 3.93% | 7.25% | 3.92% |
| With the component suite | 72.20% | 57.60% | 61.29% | 75.88% |

The component itself increases from zero to 71.47% statement coverage and 56.19% branch coverage.
These figures measure the named files. They are not repository-wide percentages or proof of complete correctness.

The complete suite reports 82.68% statements, 77.69% branches, 81.02% functions, and 84.51% lines for loaded files.
This aggregate does not include every repository file.

Independent review totals: Standards — one finding, highest P2; Spec — zero findings.
The primary review corrected four additional surrounding defects. No known finding from this scoped review remains open.
