# ADV Atlas day styling research

Date: 2026-11-01.
Reviewed baseline: `661b860`.
Project observations include the current uncommitted working tree, including the recent atlas controls and column editor changes.
Scope: show the selected trip's riding-day breakdown while retaining its exact assigned trip color.
This is research and a design recommendation; no application behavior changed.
**Evidence** identifies checked project behavior or primary-source findings. **Recommendation** identifies design judgment for this atlas.

Follow-up decision: the author chose small, unnumbered dots at selected-trip day breaks for an at-a-glance overview. Day details stay in the trip report. The broader interaction options below remain research alternatives; the current implementation is described in the [atlas guide](../trips/ADV-ATLAS.md).

## Recommendation

Keep the selected trip's colored stroke at its existing RGB value and full opacity. Add numbered day markers and a linked day list with persistent day focus. Offer alternating solid/dashed day strokes as an additional **Show day segments** treatment. Use one solid style and one clearly dashed style, repeating by authored day order; use numbers and labels to identify individual days. Two styles separate neighbors but cannot uniquely identify a long trip's days.

Use a continuous, opaque neutral casing underneath the selected route. A focused day can become wider and move above other selected-trip geometry without changing its color. Offer **Only this day** when overlapping geometry prevents identification. This combination addresses boundaries, identity, and overlap separately. It is a project recommendation, not an established research finding that solid/dash alternation is the best way to map riding days.

The [local comparison artifact](2026-11-01-atlas-day-styling-options.html) illustrates candidate treatments using Boise geometry. It is a schematic SVG comparison, not a MapLibre rendering test or evidence that a treatment works at every map zoom.

## What the project actually knows

**Evidence.** Atlas route assembly preserves original feature properties and adds `tripId` and the assigned `color`. The atlas summary does not contain the manifest's day-to-track membership. Full manifests load lazily through the existing promise-cached `loadTripManifest(id)` function. The trip-story map already resolves `trackId` through `manifest.days[].trackIds`; its separate `dayColor()` cycles hues and would violate this request if reused. See [atlas assembly](../../src/features/trips/atlas/tripAtlasView.ts), [manifest schema](../../shared/tripManifestSchema.ts), [manifest loader](../../src/features/trips/tripManifests.ts), and [trip map grouping](../../src/features/trips/tripMapView.ts).

**Evidence.** The manifest audit found these distinctions:

| Trip | Authored day entries | Entries with route tracks | Declared tracks | Recorded riding-day fact |
| --- | ---: | ---: | ---: | ---: |
| [Ocean Shores](../../src/content/trips/ocean-shores-2024.json) | 2 | 2 | 2 | 2 |
| [Boise](../../src/content/trips/boise-2024.json) | 6 | 6 | 6 | 6 |
| [Kalaloch](../../src/content/trips/kalaloch-2024.json) | 3 | 3 | 3 | 3 |
| [PCH](../../src/content/trips/pch-2024.json) | 5 | 5 | 5 | 5 |
| [Route 66ish](../../src/content/trips/route-66ish-2025.json) | 11 | 8 | 8 | 8 |
| [Mississippi–Wisconsin](../../src/content/trips/river-wisco-2025.json) | 7 | 7 | 8 | 7 |
| [ON–QC–New England](../../src/content/trips/on-qc-new-england-2026.json) | 37 | 34 | 36 | 27 |

All declared tracks map once to an authored day. Some days contain multiple tracks. Only three Boise days have authored dates; Kalaloch's days have none. The 2026 count shows that a mapped day entry and the trip-level `ridingDays` fact are different concepts. A map must not silently reconcile them by inventing a new riding-day total.

**Evidence.** Local route GeoJSON contains `trackId`, `trackOrder`, distance properties, and sometimes a date, but no per-point timestamps. Some geometry is `MultiLineString`. File order is not reliably chronological: Boise starts with the reconstructed May 17 feature, and Mississippi–Wisconsin starts with October 11 before October 10. GPS filename dates also have known conflicts with source photographs. See the [existing chronology review](2026-10-31-blog-and-trip-asset-refresh.md#photo-and-gps-review) and the routes under [public/data/trips](../../public/data/trips/).

**Recommendation.** Derive style order and membership from the authored `manifest.days` array, keeping all `trackIds` for one day in the same style family. Retain the source `day.id` and title; show a date only when authored. Prefer that date and title to a guessed riding-day number. If numeric badges are useful, define them as the stable authored itinerary-entry sequence, including entries without tracks. Do not renumber after filtering or equate 34 mapped entries with 34 riding days. Preserve days without tracks in a full itinerary as **No track recorded**; that does not establish a rest day. Do not alternate styles by GeoJSON feature index, filename, or `trackOrder`, and do not split at presumed midnight.

Load day metadata only for the selected trip, with a solid-route fallback while loading or after failure. Keep route selection and recovery usable independently. Unmapped or unrecognized tracks should remain visible with an explicit **Day not assigned** state instead of acquiring a guessed day.

## What the external evidence supports

**Evidence.** Sterzik and colleagues' three-study paper examined line attributes, including dashing, luminance, and width. Its drawing task elicited dashing as an uncertainty cue. Its perception studies found multiple distinguishable levels, but the authors specifically warn that dashing needs sufficiently long, continuous lines and that their level recommendations may hold only under their test conditions. Colored backgrounds and combinations of attributes need further investigation. These experiments do not establish a maximum safe number of riding-day styles on a street basemap. See [Perception of Line Attributes for Visualization, sections 6–8](https://arxiv.org/html/2308.04150v3#S6).

**Evidence.** Existing cartographic conventions already assign meaning to line patterns: USGS legends use dashed symbols for unimproved roads and trails, and distinguish intermittent water from perennial water with pattern. See the [USGS topographic legend](https://pubs.usgs.gov/gip/70039472/topomap.pdf) and [US Topo symbol guidance](https://www.usgs.gov/ngp-standards-and-specifications/us-topo-cartographic-specifications-map-symbol-guide). These conventions support a risk of interpretation; they do not prove that this atlas's readers will mistake day styling for road surface.

**Evidence.** Ordnance Survey recommends matching legend symbols to the actual map and explaining thematic overlays. Its web-map guidance allows an accessible separate legend panel and considers legends that respond to zoom. See [OS map legends](https://docs.os.uk/more-than-maps/geographic-data-visualisation/guide-to-cartography/map-legends).

**Recommendation.** Do not describe dashed days as alternate routes. Use a visible explanation such as **Same trip color. Line style alternates between consecutive route days. Numbers identify days.** Show actual solid/dash samples alongside day labels. If observers interpret dashes as unpaved, uncertain, planned, or optional travel, prefer continuous lines plus markers and focus. Reserve uncertainty and road-surface styling for real source data if those attributes are introduced later.

**Evidence.** Shneiderman's visualization taxonomy proposes overview, zoom/filter, and details on demand as a starting framework. It supports keeping broad exploration and focused inspection available; it does not prescribe a particular map symbol. See the [author-hosted 1996 paper](https://www.cs.umd.edu/users/ben/papers/Shneiderman1996eyes.pdf).

## Compare the alternatives

The evaluations below are design judgments informed by those constraints.

| Treatment | Retains exact trip RGB? | Useful role | Main limitation |
| --- | --- | --- | --- |
| Alternating solid/dash core | Yes, for every colored stroke | Make adjacent day changes visible without extra hues | Repeated styles do not identify a day; gaps and short fragments weaken visibility |
| Continuous core plus neutral notches or ticks | Yes in the remaining colored core | Preserve a strong trip trace with a secondary texture | Can resemble railway or road symbols; requires restrained, tested pattern geometry |
| Numbered day/boundary markers | Yes | Explicit sequence and links to day details | Dense or repeated stop locations collide; a marker alone does not describe every segment |
| Width or casing alternation | Yes | Strong focused-day emphasis | Repeated width changes suggest magnitude or importance; thick days occlude roads |
| Day focus/list or itinerary strip | Yes if emphasis uses width, casing, or isolation | Identify one day exactly, including retraced roads | Requires interaction; needs an obvious return to the whole route |
| Direction arrows | Yes with neutral symbols over the stroke | Help interpret loops and travel direction | Direction is not day identity; arrows add clutter and require reviewed geometry direction |
| Tints, brightness ramps, or opacity alternation | No, in displayed appearance | Alternative only if the color requirement is relaxed | Changes RGB or blends with the basemap; low-contrast days become harder to trace |
| Many dash/dot/dash-dot signatures | Yes | Potentially distinguish a small fixed set | Large legends, weak ordering, and fragile recognition on short/overlapping segments |

**Evidence and inference.** Alpha compositing combines a partially transparent stroke with its backdrop. Therefore, keeping the same `line-color` while reducing opacity does not keep the same displayed color. See [W3C compositing, simple alpha compositing](https://www.w3.org/TR/compositing-1/#simplealphacompositing). Antialiasing at stroke edges also means an exact color-token requirement cannot imply identical RGB in every rasterized edge pixel.

**Recommendation.** Interpret the requirement as a constant, opaque trip-color core wherever that core is drawn. Neutral casing, labels, and cutouts are additional symbols. Keep hue and RGB variants out of the default design. For strict focus without recoloring, widen the active day or hide sibling days through **Only this day**; fading them is a deliberate trade-off to approve separately.

## Verified MapLibre constraints

**Evidence.** This checkout installs MapLibre GL JS `6.16.0` and style-spec `26.5.0`. Checks used the installed package metadata and source, plus current official documentation. Property support should be assessed against these versions, not older Mapbox examples or MapLibre Native support tables.

### Dash arrays and solid lines

**Evidence.** The style specification lists data-driven `line-dasharray` support from GL JS `5.8.0`. Dash/gap numbers use line-width units; zoom-dependent dash expressions evaluate at integer zooms. It warns that `lineMetrics: true` changes expected dash scale. See [line-dasharray](https://maplibre.org/maplibre-style-spec/layers/#line-dasharray).

**Evidence.** The documented data-driven contract selects literal array outputs using feature values. It does not promise arrays obtained from feature properties. The implementing PR gives a `case` example with `['literal', [...]]` outputs. See [MapLibre PR 5812](https://github.com/maplibre/maplibre-gl-js/pull/5812). For example:

```js
'line-dasharray': [
  'match', ['get', 'dashFamily'],
  'long', ['literal', [4, 2]],
  ['literal', [2, 2]],
]
```

**Checked limitation.** A read-only probe of installed `createPropertyExpression` and `validateStyleMin` accepted this expression. It also accepted `['get', 'dashArray']`, despite the documented restriction. Parser acceptance is therefore insufficient evidence of supported renderer behavior. This research did not render the latter expression and does not recommend depending on it.

**Checked rendering.** An isolated Chromium probe loaded the installed MapLibre modules and drew three inline GeoJSON lines with feature-selected literal dash arrays, a constant blue core, and continuous opaque neutral casing. All three patterns rendered without map errors. This establishes feasibility in that small case; it does not validate the atlas's full layer composition, every device, or long-route performance.

**Recommendation.** For simple alternation, use filtered solid and dashed day layers with the same `['get', 'color']` paint. Omit `line-dasharray` on the true solid layer. Start with a moderate repeated pattern such as `[3, 2]`, then test actual paths; these values are trial settings, not research-backed optima. Keep `lineMetrics` false or omitted for this design. Avoid fake solid arrays such as `[0, 0]` and arbitrarily long dashes.

**Evidence.** Caps can extend beyond endpoints; `line-offset` is screen-space displacement whose sign depends on coordinate direction. See [caps](https://maplibre.org/maplibre-style-spec/layers/#line-cap) and [offset](https://maplibre.org/maplibre-style-spec/layers/#line-offset).

**Recommendation.** Compare butt and round caps at the intended widths. Round dash caps visibly shorten gaps and can make small patterns look solid. A continuous neutral casing avoids mismatched casing/core dash phases: identical numeric dash arrays on different widths produce different physical periods. Keep width changes modest because dash dimensions change with them. Do not use offset as the general day encoding: it displaces geographic appearance, behaves differently when direction reverses, and can complicate bends, joins, and hit testing.

### Patterns and a documentation disagreement about gradients

**Evidence.** `line-pattern` uses image pixels, takes precedence over `line-color` and dashes, and requires a power-of-two image width for seamless repetition. A gradient needs GeoJSON line metrics. See [pattern](https://maplibre.org/maplibre-style-spec/layers/#line-pattern), [line color](https://maplibre.org/maplibre-style-spec/layers/#line-color), and [gradient example](https://maplibre.org/maplibre-gl-js/docs/examples/create-a-gradient-line-using-an-expression/).

**Important version detail.** The [style-spec gradient entry](https://maplibre.org/maplibre-style-spec/layers/#line-gradient) still says dashes disable gradients. However, the official [GL JS 6.16.0 gradient-dash example](https://maplibre.org/maplibre-gl-js/docs/examples/create-a-gradient-dashed-line-using-an-expression/) explicitly combines them. The installed renderer agrees: `src/webgl/draw/draw_line.ts` selects `lineGradientSDF` when both are present; its `linePattern` branch takes precedence over both. Thus **gradient plus dash is supported by this GL JS renderer**, despite the stale incompatibility wording. A second isolated Chromium probe also rendered this combination without map errors, using `lineMetrics: true`. Its visible dash density differed from the fixed-color, no-metrics probe; the documentation's dash-scale warning remains relevant.

**Recommendation.** Gradients still offer no benefit for a constant-RGB day design. Prefer separate day features over using line progress to synthesize boundaries. A neutral pattern overlay above an opaque trip-color core is a feasible alternative to colored pattern assets. Replacing the core with `line-pattern` would require baking the trip color into the image; `line-color` does not recolor it. Evaluate image seams, turns, zoom changes, high-density screens, and pattern legibility before choosing that extra machinery.

### Markers and arrows

**Evidence.** Line symbols support `symbol-placement: 'line'` and pixel-based `symbol-spacing`. Map-aligned icons follow line orientation. `icon-keep-upright` may flip icons. See [symbol properties](https://maplibre.org/maplibre-style-spec/layers/#symbol-placement). HTML-backed marker elements are also available through [MapLibre Marker](https://maplibre.org/maplibre-gl-js/docs/API/classes/Marker/#getelement).

**Recommendation.** Prefer numbered markers as the primary day cue. Place a marker at a verified day start or transition and label it accordingly. A recorded endpoint is not automatically an overnight camp. Use authored stops where they establish that meaning. For disconnected tracks or unreviewed direction, use a numbered day anchor on the route instead of asserting an invented boundary. Use distance along a suitable route part for that anchor; a bounding-box center may lie off the road, and the existing flattened-coordinate midpoint helper is not a distance midpoint.

If arrows are added, show a few on the focused day at useful detail zooms, use an icon designed along its positive x-axis, and keep `icon-keep-upright: false` for a directional glyph. Verify coordinate direction, including every `MultiLineString` part. Do not infer travel direction from day order alone, force every arrow through collisions, or use animation as a required cue.

## Selected-route layering, zoom, and overlap

**Evidence.** The current atlas draws a 3.5-pixel solid colored base route, an 8-pixel selected casing at opacity `0.85`, a 5.5-pixel solid selected route, and a 6.5-pixel solid hover route. Selection leaves that trip's base stroke at opacity `1`. See [TripAtlasMap layers and state updates](../../src/features/trips/atlas/TripAtlasMap.tsx).

**Recommendation.** A dasharray added only to `atlas-selected` would leave the solid base visible in its gaps. Hover can paint the route solid again. Treat base, selected, hover, focus, and hit layers as one composition. Remove the selected trip from its colored base rendering while the day treatment is active, or explicitly mask that base with opaque neutral casing. Preserve day patterns through hover and focus. A dark casing at partial opacity can reveal underlying colored strokes, especially on retraced paths.

**Evidence.** MapLibre's feature-query documentation includes zero-opacity layers in hit results but excludes `visibility: 'none'` layers. It also warns that tiled geometry can produce duplicate feature results. See [queryRenderedFeatures](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#queryrenderedfeatures).

**Recommendation.** Keep a separate continuous, zero-opacity hit corridor so gaps remain tappable; do not hide it with `visibility: 'none'`. Query that layer explicitly. Resolve candidates by `(tripId, dayId)`, deduplicate tile fragments and tracks belonging to one day, and keep the existing between-trip overlap chooser. Add a labeled day chooser for multiple days on the selected trip; changing the hover label alone cannot resolve coincident days. Invisible hit geometry must not become a visible route or an obstacle used for tooltip placement.

At overview zoom, prioritize trip shape and a small number of noncolliding day markers. Reveal more markers and day texture as screen-space separation permits. Do not promise that every short day will show a full dash cycle. Prefer a stable solid overview if the alternating core becomes speckled. Keep the selected trip's day list accessible at every zoom, with an explicit **Zoom to day** action rather than forcing a new camera position on every preview.

On out-and-back roads, mirrored days, and shared overnight stops, the same position may represent several days. A later solid day can cover an earlier dashed day of the same trip color; even different patterns do not reveal fully coincident strokes reliably. Use a combined marker such as **2 / 6** with a chooser when appropriate, a label explaining **Used on multiple route days**, and **Only this day**. Do not shift roads apart by default or claim that a static pattern solves occlusion. Preserve separate parts and gaps; never invent connectors between recordings.

## Interaction and accessibility

**Evidence.** WCAG requires a visible alternative when color conveys meaning. Relevant non-text graphical information generally needs 3:1 contrast against adjacent colors; W3C also cautions that very thin antialiased lines can be faint in practice. See [Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) and [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Numbered labels and patterns help, but their presence alone does not establish accessibility or sufficient contrast on a variable basemap.

**Recommendation.** Keep the colored core wide enough to remain perceptible and test neutral casing against both the core and actual map backgrounds. Give marker numbers an opaque background, readable text contrast, and a visible focus indicator. A dark casing is a starting candidate, not an automatic pass for every assigned trip color. Show trip and day names in text alongside swatches so color is never the sole identifier.

**Evidence.** Keyboard users need equivalent functionality; non-text information needs a text alternative serving the same purpose. See [Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) and [Non-text Content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html). W3C's target-size guidance specifies 24-by-24 CSS pixels with exceptions, including spatially essential map pins; it encourages equivalent controls when density prevents suitable targets. See [Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

**Recommendation.** Provide an ordered, keyboard-operable day list outside the canvas. Each day exposes its number, authored title, available date, route availability, and selection state. Use ordinary buttons or a native single-choice control rather than creating a custom timeline widget. Include **All route days**, **Previous**, **Next**, **Zoom to day**, and **Only this day** as appropriate. Aim for 44-pixel panel targets; the map's essential-position exception is not a reason to make the equivalent list hard to operate. A strip can be a compact presentation of this same list, with responsive wrapping or scrolling and visible controls.

**Evidence.** APG toggle buttons use `aria-pressed`, maintain their label, and support Enter and Space. WCAG hover/focus content generally needs to be dismissible, hoverable, and persistent. Focus itself must not trigger a change of context. See [APG buttons](https://www.w3.org/WAI/ARIA/apg/patterns/button/), [Content on Hover or Focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html), and [On Focus](https://www.w3.org/WAI/WCAG22/Understanding/on-focus.html).

**Recommendation.** Hover and keyboard focus may preview the same day without moving the camera or stealing focus; click, tap, Enter, or Space commits day focus. Keep committed focus until another day or **All route days** is chosen. Touch must expose the same information without hover. Retain the focused list control during map updates, and support Escape for temporary details in the existing atlas dismissal order. Announce a committed change once, not every pointer move. If boundary symbols are canvas-rendered, the equivalent day list supplies their actions and text; merely making the map canvas focusable does not make its individual features accessible.

## What to validate before implementation is accepted

These are proposed acceptance checks, not completed application tests:

- Ask unfamiliar readers to identify adjacent days, find a named day, and explain a dashed segment. Reject a treatment that consistently suggests road surface, missing GPS, or optional travel.
- Compare continuous strokes plus markers against alternating strokes plus markers on Boise, an out-and-back/overlap case, a two-track day, and the long 2026 trip. Test overview and road-level zooms on desktop and phone.
- Confirm the same trip RGB token is used in base identity, selected day cores, legend samples, hover, and focus; inspect actual compositing and all relevant assigned colors.
- Verify no solid base or hover layer fills dash gaps, no width change unexpectedly closes gaps, and no part of a multi-track day receives a different style.
- Verify overlap choices, list-only operation, touch targets, keyboard selection, Escape behavior, focus retention, screen-reader labels, and readable contrast against real basemaps.
- Exercise missing manifests, missing tracks, delayed metadata, and day entries without routes. Preserve the usable trip route and explain unavailable day details.

The evidence favors redundant day identification and focused inspection. It supports investigating line texture, while leaving the actual dash pattern, zoom thresholds, casing widths, and whether alternation should be enabled by default to this atlas's visual and usability evaluation.
