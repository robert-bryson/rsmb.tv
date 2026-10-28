# Trip day map research: 2026-10-27

## Scope

This report covers daily GPS tracks, overview selection, maps inside stories, accessibility, and browser resources.
It separates source facts from implementation recommendations.
It does not certify trip dates, route accuracy, tile availability, or the completed implementation.

Research used MapLibre documentation, W3C material, OpenStreetMap policy, and the repository source.
The installed application already uses MapLibre GL JS.
The existing mapping library can support this feature.

## Repository findings before implementation

The [manifest schema](../../shared/tripManifestSchema.ts) already supports `days`, `trackIds`, `stopIds`, and story heading IDs.
Each day can reference several tracks and stops.
Referenced IDs must exist.

The [map](../../src/features/trips/components/TripRouteMap.tsx) already supports one selected track.
It fits the initial camera to that track and dims the other tracks.
It currently lists all trip stops.
Its reset action fits the whole trip.

The [importer](../../scripts/sync-blogs.js) supports track and stop map shortcodes.
The [route loader](../../src/features/trips/useTripRoute.ts) shares requests by URL.
The [story map block](../../src/blog/TripMdxBlocks.tsx) defers interactive loading until the map approaches visibility.
Previously visited maps remain mounted.

The [GPX preparation script](../../scripts/prepare-trip-assets.js) replaces the original feature properties.
Published properties retain the track ID, source order, distance, and optional filename date.
They do not retain timestamp sequences for automatic day splitting.
Source order can reflect filename order rather than travel order.

Boise contains six separate route tracks.
Its manifest had no day definitions when this research began.
Several tracks are reconstructed and explicitly named as such.
These facts support explicit day authoring, rather than automatic date inference.

## Track rendering and selection

### Evidence

MapLibre expressions read feature properties.
The `match` expression can match one label or an array of labels.
Each label must be unique.
This permits a day color to apply to several track IDs.
[MapLibre expression specification](https://maplibre.org/maplibre-style-spec/expressions/#match)

MapLibre filters determine which source features a layer renders.
`setFilter` updates that filter.
`setPaintProperty` updates a layer's appearance.
These methods support selection changes without replacing the map.
[MapLibre Map methods](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setfilter)

### Recommendations

- Keep one combined route source for each map.
- Set colors from manifest day order, rather than GeoJSON feature order.
- Give each day a labeled control and a matching color sample.
- Highlight the selected day with greater line width and opacity.
- Dim other tracks in the overview to retain geographical context.
- Limit inline day maps to the referenced day tracks.
- Keep tracks without a day assignment visible in the overview.
- Retain a fallback color for tracks without metadata.
- Preserve reconstructed route labels in controls and summaries.
- Support several track segments within one day.
- Avoid connecting separate segments with invented straight lines.

Color is a useful aid for overview comparison.
Selection remains necessary where tracks overlap or colors become difficult to distinguish.
A fixed palette cannot provide a unique, accessible distinction for arbitrarily many days.

## Camera behavior and POIs

### Evidence

`fitBounds` changes the camera to fit geographical bounds.
It emits movement events.
Its options accept padding, animation settings, and a maximum zoom.
[MapLibre camera method](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#fitbounds),
[FitBoundsOptions](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FitBoundsOptions/)

### Recommendations

- Fit the complete selected day when the reader selects it.
- Include that day's displayed POIs when computing its extent.
- Use padding to prevent clipping near the map edges.
- Cap zoom for very short tracks.
- Report missing track geometry instead of fitting an empty extent.
- Give inline day maps a reset action that returns to that day.
- Keep a separate overview action that restores the complete trip.
- Clear a selected stop when the reader changes the day.
- Preserve the selected day when the reader focuses a stop.
- Keep marker numbering consistent with the visible stop list.
- Apply the same day and POI selection to the SVG preview.

Use explicit `stopIds` for day membership.
A stop's coordinates or date alone do not establish that membership.
An overnight stop can belong to both adjacent days.
An empty POI list is valid.
Make the POI visibility control independent from the selected day.

Movement and delayed loading need particular care.
An initial camera effect must not override a newer user selection or reset.
Tests must exercise selection before and after map load.

## Accessible controls and reading

### Evidence

WCAG requires information in addition to color when color conveys meaning.
Text, shapes, and other visible cues can provide that information.
[W3C Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)

The WAI button pattern supports native button activation with Enter and Space.
Toggle buttons expose their state through `aria-pressed`.
Their labels remain stable when the state changes.
[WAI Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)

WCAG 2.2 specifies a 24 CSS pixel minimum target size, with exceptions.
W3C also recommends larger controls for easier use.
[W3C Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

Meaningful interface states and graphics generally need 3:1 contrast against adjacent colors.
[W3C Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

WCAG's interaction animation guidance describes respecting the reduced motion preference.
This criterion has Level AAA status.
[W3C Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)

### Recommendations

- Use native labeled buttons for day selection.
- Expose the selected day with `aria-pressed` and a visible border or selection mark.
- Keep controls at least 44 CSS pixels high, following existing trip controls.
- Allow controls to wrap on narrow screens.
- Provide visible keyboard focus indicators.
- Keep selection available without hovering over a track.
- Supply a textual day title and associated stop list outside the canvas.
- Provide an accessible name that identifies the displayed day.
- Keep a route download and preview available after interactive failures.
- Use zero-duration camera changes when reduced motion is enabled.
- Retain dark route halos to improve separation from variable basemap colors.

These measures improve access.
They do not replace manual contrast, keyboard, screen reader, and phone checks.

## Scrolling, map resources, and tiles

### Evidence

MapLibre's cooperative gestures require modifier keys on desktop and multiple fingers on mobile.
This helps an embedded map coexist with document scrolling.
[MapLibre MapOptions](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/#cooperativegestures)

`Map.remove()` releases internal resources, including workers and WebGL resources.
Methods must not be called after removal.
[MapLibre cleanup](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#remove)

Intersection Observer reports visibility asynchronously.
Its root margin can expand the observed viewport.
It supports deferred loading without continuous scroll measurements.
The cited specification is a W3C Working Draft.
[Intersection Observer specification](https://www.w3.org/TR/intersection-observer/#intersection-observer-interface)

MapLibre recommends reducing GeoJSON size and simplifying geometry for large datasets.
Its guide also describes source splitting and vector tiles for larger workloads.
[MapLibre performance guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)

OpenStreetMap's public tile policy prohibits bulk downloading and speculative tile prefetching.
It requires attribution and normal caching behavior.
The service provides no availability guarantee.
[OSM tile policy](https://operations.osmfoundation.org/policies/tiles/)

### Recommendations

- Keep cooperative gestures enabled.
- Activate interactive maps when they become visible or the reader requests them.
- Remove maps after they move far outside the viewport.
- Retain a generous distance margin to avoid repeated creation near the viewport edge.
- Use that margin for retaining existing maps, rather than speculative tile loading.
- Keep selected day, stop, and POI visibility outside the disposable map instance.
- Preserve a stable preview area while the interactive map is removed.
- Keep focused and fullscreen maps mounted until the interaction ends.
- Ignore callbacks from a map that has been removed.
- Retain shared route loading and build-time geometry simplification.
- Keep attribution and route downloads available.

Recreating a map consumes work and can request tiles again.
Keeping every visited map consumes resources throughout a long article.
A retention margin balances these costs.
Measure this balance on phones before making a device-wide performance claim.

## Implementation and verification priorities

1. Resolve a day into its tracks, stops, title, color, and geographical extent in one shared module.
2. Use the same resolved data for the interactive map and preview.
3. Add a day shortcode while preserving existing track and stop shortcodes.
4. Author Boise day groups from the report and source records.
5. Keep publication and generated Google Docs content workflows intact.
6. Test several tracks per day, empty POIs, missing geometry, and legacy manifests.
7. Test resets, reduced motion, and selection during delayed loading.
8. Test map disposal and restoration without losing the selected day or stop.
9. Use fixed tile browser fixtures for map rendering checks.
10. Preserve the existing article JavaScript budgets.

Mocked map tests can verify selection logic and camera arguments.
They cannot prove rendered pixels, physical GPU usage, or provider availability.
Browser checks must cover desktop and phone layouts.
Any unavailable browser or measurement must remain an explicit validation limit.

## Implementation

The implementation uses explicit manifest day assignments and one shared day resolver.
Overview controls update map filters and paint properties without replacing the map.
Inline day maps use `{{trip-map:day:day-id}}` in the source Google Doc.
The author controls their placement. Day definitions do not insert maps automatically.
Boise now has six day groups with track and stop references.
The first three groups omit dates. Export filenames do not establish their riding dates.
Reconstructed routes remain labeled.

Previews reserve the interactive map's dimensions before route loading.
This prevents earlier maps from displacing later story sections as their geometry loads.
Far-offscreen maps release their WebGL instance and retain their day, selected stop, and stop visibility.
Focus and fullscreen interactions prevent suspension until the interaction ends.
The eight-color palette repeats for longer trips. Numbered labels and selection remain available.

## Validation

These results record the initial implementation checks.
See the [follow-up review](2026-10-27-trip-map-review.md) for defects found later and the current verification results.

| Check | Result |
| --- | --- |
| Complete Vitest suite | 1,363 tests passed across 99 files |
| Python temperature pipeline suite | 17 tests passed |
| TypeScript and ESLint | Passed |
| Trip browser cases | All 57 cases verified across desktop Chromium, phone Chromium, and phone WebKit |
| Article JavaScript budgets | Existing budgets passed in all three browser projects |
| Fixed-tile rendering | Daily colors, scoped tracks, stop visibility, and canvas retention verified |
| Boise content references | Six day groups matched their local route tracks and story headings |
| Production browser fixture build | Passed |

The complete browser run passed 54 cases.
Three inline cases then passed after correcting a selector that matched the map and its canvas.
Earlier concurrent runs encountered severe host contention. Final browser checks used one worker.
The checks use fixed map tiles and synthetic browser content.
They do not measure real-device GPU memory, certify source dates, or verify live tile-provider availability.
Stop marker selection and all three basemap styles remain separate browser follow-up work in `TODO.md`.
