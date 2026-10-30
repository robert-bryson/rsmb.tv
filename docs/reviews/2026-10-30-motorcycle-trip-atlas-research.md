# Motorcycle trip atlas research: 2026-10-30

## Recommendation

Build a map-first collection of the existing motorcycle trip reports.
Use Ride with GPS Collections as the primary interaction reference.
The map fills the explorer, with a browsable card panel beside or over it.
Reuse MapLibre GL JS and the existing trip route files.
Use trip selection to connect the map and cards.
Keep each trip report available through a normal link.
Reuse existing report descriptions, hero photographs, and trip facts in the cards.
Keep full stories, galleries, and daily maps in their existing reports.

The user's preferred direction is a central collection with modern map interaction and cards that readers can browse.
The collection brings existing reports together and supplies geographic context.
It requires no new version of each report or separate editorial workflow.

Start with the current published trips.
Defer search, complex filters, elevation profiles, route planning, and additional map libraries.
Measure route loading before introducing a separate overview geometry format.

This report records research and design recommendations.
It does not implement the atlas.
No applicable `AGENTS.md` was found in the repository or its ancestors.

## Questions to ask during implementation

These questions follow the architecture review of this plan.
Ask unanswered questions when the relevant phase starts.
Unanswered preferences use the suggested defaults in the first playable version.
Track remaining implementation work in [TODO.md](../../TODO.md#motorcycle-trip-atlas).

1. **Return state, before navigation work:** Should returning from a report restore the previous camera, panel state, and card position?
   Suggested default: restore the previous view during the same session. Fit the selected route for a fresh shared URL.
   The atlas needs its own session storage. `ScrollToTop` only restores window scrolling.

2. **Renderer failure, before map work:** Should a failed map leave all cards available with a separate Retry control?
   Suggested default: retain the cards, navigation, and panel controls.
   Keep them outside the map's loading and error handling. Test failed module imports, constructor errors, and WebGL loss.

3. **Report navigation, before navigation work:** Should every report return link say **Back to map** after entering from the atlas?
   Suggested default: use that label in the header, footer, and unavailable-manifest view.
   Preserve the return destination through series links and previous or next report links.
   `PostNavigation` also hardcodes **Back to posts** and needs the same return context.

4. **Multipart ordering, before card work:** Without explicit series order, should report links follow publication date, oldest first?
   Confirmed answer: oldest publication first when explicit series order is absent. Use slug to resolve equal publication dates.
   Use the first ordered report for fallback card copy. Post series metadata takes precedence over manifest series metadata.

5. **Route loading, before map work:** Should opening the atlas load all eligible routes, including routes for cards outside the visible panel?
   Suggested default: load the current small collection when the map opens.
   Reuse the story route cache. Choose mounted route readers or an extracted request module before implementing multiple-route loading.
   Collapsing the panel must not cancel active route readers.

6. **Project identity, before release metadata:** Should the project entry continue directly to the explorer, without a separate introduction page?
   Confirmed direction: open the explorer directly. The user requested a playable map through the project entry.
   Define its canonical URL and structured data. Add the explorer to the sitemap and register its social image.
   Run the documented project-preview generator and commit its outputs.

7. **Development visibility, before card work:** Should the development atlas show published trips only, or also show clearly labeled drafts?
   Updated answer: include unpublished reports with valid manifests in development. Use subtle amber labels to identify drafts.
   Production must continue to use the content plugin's publication filtering.

8. **Incomplete development content, before card work:** Should a trip without a valid manifest have a report-only card, or be omitted?
   Suggested default: omit it until its summary is available.
   A missing published manifest must still fail the production build. Runtime route-download failures must retain eligible cards.

## Implementation progress

The first implementation slice adds route URLs and descriptions to the shared summary type.
Development summaries rewrite route URLs to local assets. Production summaries retain their CDN URLs.
The summaries exclude track definitions, galleries, daily maps, and the remaining photo collection.

The content adapter groups eligible reports by trip ID and orders cards by travel start date.
It uses explicit series order before the confirmed publication-date fallback.
It reads report metadata and summaries without loading story bodies or complete manifests.
The development explorer includes drafts with valid summaries. Amber badges identify unpublished cards and draft links within multipart trips.
Production includes published reports only. Draft report pages link back to their atlas route during development.
Incomplete development entries without summaries are omitted. The existing production checks still reject missing published manifests.

The playable explorer now runs at `/projects/motorcycle-trips/map`.
The Projects entry opens it directly. The explorer includes published routes, report cards, shared selection URLs, and a collapsible trip panel.
Route selection fits the complete geometry. Shared roads offer a trip choice.
Cards retain authored facts and normal report links. Route failures provide independent retry controls.
Renderer failures retain the trip list. Context-loss recovery preserves selection.

Report headers and footers use **Back to map** after entry from the atlas.
Same-session returns restore the camera, card scroll position, and panel state.
Trip reports also link directly to their selected route. The filtered post list links to the collection map.

The project has a real map screenshot, generated responsive previews, a registered social image, and a canonical sitemap entry.
Its feature-release date and changelog await publication on the default branch.

Validation on 2026-10-30: 289 focused unit tests and 37 browser checks passed.
TypeScript checks and changed-file ESLint checks passed.
Browser checks used fixed production content in desktop Chromium, phone Chromium, and iPhone WebKit.
Two pointer hit tests were skipped on phone projects. The equivalent card controls passed on both phone engines.

The draft-visibility follow-up passed 134 focused unit tests and ten Chromium browser checks.
The local atlas showed five configured trips, including two labeled drafts. The 320-pixel layout and draft-report return link passed manual browser checks.

The linked-interaction follow-up passed 25 focused unit tests and 47 browser checks.
Four hover or overlapping-route pointer cases were skipped on phone projects. Card taps and direct route selection passed on both phone engines.

The shared-hover follow-up passed 92 focused unit tests and 53 browser checks.
That browser run included atlas and story-map hover behavior, keyboard dismissal, recovery, and reading-page JavaScript budgets.

The overlap-popup follow-up passed TypeScript, changed-file ESLint, and three browser checks across desktop Chromium, phone Chromium, and iPhone WebKit.
Choices match route colors. Pointer and keyboard previews reuse the map/card emphasis, and the top-right close icon clears previews while preserving selection and camera position.

The route-context styling follow-up passed seven focused unit tests, TypeScript, changed-file ESLint, and 40 browser checks across desktop Chromium, phone Chromium, and iPhone WebKit.
Two hover-only phone cases were skipped. Local visual inspection confirmed that background routes retain their own colors at 50% opacity without halos.

Palette review used Chrome's protanopia, deuteranopia, and tritanopia simulations against the actual muted basemap.
Some hues converge under these simulations, so named hover feedback, overlapping-route choices, and the selected-trip filter remain essential identification tools.
Local review confirmed Route 66's mint route and card marker, PCH's retained yellow, and filter access at a 320-pixel viewport.
The registry and filter follow-up passed 48 focused unit tests, TypeScript, changed-file ESLint, and 55 browser checks across desktop Chromium, phone Chromium, and iPhone WebKit, including reading-page JavaScript budgets.
Two hover-only phone cases were skipped.

## Fit within rsmb.tv

Use **Motorcycle Trips** as a working project title.
The project provides a central collection and geographic entrance to the existing trip reports.
Through Routes already provides motorcycle route planning.
Flights establishes the site's personal travel-map convention.

Use the existing full-viewport map convention, with direct access from the project entry:

- `/projects/motorcycle-trips`: redirects to the explorer, so the Projects entry opens the collection directly.
- `/projects/motorcycle-trips/map`: the route explorer.
- `/projects/motorcycle-trips/map?trip=boise-2024`: a selected trip that readers can share.

Put a short collection introduction inside the explorer's header or card panel.
A separate project introduction page is unnecessary for the first version.

Keep `/trips/<post-slug>` as the report destination.
The existing `/trips` collection redirects to `/posts?type=trips`.
Add an **Explore trips on a map** link to that filtered post view.
Add a **View this trip on the map** link to trip reports.
Register the project in the existing Projects list and navigation.

The [router](../../src/App.tsx) already separates project introductions from `/map` explorers.
The [layout](../../src/components/Layout/Layout.tsx) gives `/map` routes the full viewport.
That layout omits the normal header, main landmark, and skip link.
The explorer must therefore supply its own heading, navigation, main landmark, and accessible trip-list access.

### Existing content to reuse

| Information | Existing owner | Atlas use |
| --- | --- | --- |
| Report title, description, slug, and publication | Google-authored post registry, exposed through [posts.ts](../../src/content/posts.ts) | Card copy and report links |
| Travel dates, authored distance, riding days, motorcycle, and regions | [Trip manifests](../../src/content/trips/) | Card facts and chronological ordering |
| Hero photograph and responsive sources | Existing small [trip summaries](../../src/features/trips/tripSummaries.ts) | One photograph per card |
| Route geometry and segment boundaries | Each manifest's `route.geoJson` asset | Overview lines and selection bounds |
| Publication filtering and small summary generation | [Trip content plugin](../../scripts/trip-content-plugin.ts) | Include the same trips as production reports |
| Geometry validation and distance helpers | [Shared route geometry](../../shared/routeGeometry.ts) | Validate and combine route features |
| Map styles, worker configuration, recovery, and reduced motion | Existing [trip maps](../../src/features/trips/components/TripRouteMap.tsx) | Reuse relevant patterns and small helpers |

The current small summaries omit route URLs.
Add the route URL and its description to those summaries and their [types](../../src/trip-content.d.ts).
Retain the existing local-development URL rewriting.
Cards should not require full photo manifests or loaded story bodies.

The complete story map assumes one manifest and the story context provider.
Create a small overview renderer beside it.
Reuse appropriate helpers without importing day controls, galleries, or the complete story-map component.

### Current local inventory

The local registry marks Boise, Kalaloch, and Ocean Shores as published.
PCH and Route 66ish remain drafts.
The 2026 tour has route geometry and three draft report entries, but no manifest.
These are local observations, not a check of the deployed website.
Existing editorial and asset tasks remain recorded in [TODO.md](../../TODO.md).
The atlas must not change publication state or treat a prepared route as publication approval.

The three locally published routes contain 18,150 coordinate positions.
Their files total 410,724 bytes, or approximately 401 KiB.
Compressing those files locally with Node's default gzip settings totals 118,727 bytes, or approximately 116 KiB.
This is a local size measurement, not observed CDN transfer size or phone performance.
The measurement excludes MapLibre, its worker, basemap tiles, and card photographs.

All six local route files total approximately 1.17 MiB before compression and 366 KiB after local gzip compression.
The [asset preparation script](../../scripts/prepare-trip-assets.js) already simplifies routes, with a default tolerance of five meters.
Start by reusing its output.
Check real transfer compression and phone behavior before adding another geometry derivative.

## Proposed first version

### Presentation

Use the site's zinc background, violet accents, rounded cards, and existing trip photograph treatment.
Keep the basemap quiet enough for route lines and photographs to lead.
Reuse the current muted map style initially.

On desktop, keep the map fixed within the full viewport.
Place a card panel approximately 340–400 pixels wide beside or over the map.
Let readers scroll through the cards while the map remains available.
Provide a labeled control to collapse and reopen the panel.
Keep a compact collection heading and site navigation visible.

On phones, keep the map as the main surface.
Use a compact lower panel with an explicit **Browse trips** control.
Expanding the panel reveals a scrollable card list while leaving some map visible.
Selecting a route reveals its card in the same panel.
Use native buttons for expansion and collapse; dragging can be a later enhancement.
Keep controls, focus, and map attribution visible in both panel states.
Use map padding so selected routes fit the space above or beside the panel.

Start with no selected trip and fit all eligible routes.
Order cards by trip start date, newest first.
Reuse one hero photograph, the report title and description, travel dates, available distance, and riding days.
Show the motorcycle and regions as secondary information when useful.
Keep **Show route** and **Read trip report** as separate actions.
Use a stable route color and matching card mark.
Keep explicit trip ID → palette-token assignments in [the atlas color registry](../../src/features/trips/atlas/tripAtlasColors.ts).
PCH retains yellow, Route 66 uses mint green, and Ocean Shores, Boise, and Kalaloch retain violet, sky blue, and rose respectively.
Assignments cover published and draft trips together; loading order, publication, and filtering do not change them.
Authoring checks require each manifest's assignment and reject duplicate assigned colors. Unconfigured local IDs retain a stable violet fallback until authored.
The small qualitative palette represents trip identities rather than ordered values. [ColorBrewer scheme guidance](https://colorbrewer2.org/learnmore/schemes.html)
Emphasize selection with line width, casing, and a visible card border as well as color.

Selecting a route reveals its card and fits its complete geometry.
Selecting a card's button fits the same route without moving keyboard focus.
Clicking a card's photo, title, or body also selects and frames its route, with space around the line.
Report links and other controls retain their normal actions.
Hover emphasizes the matching route and card temporarily, without moving the camera or scrolling the list.
Card focus can provide the same temporary emphasis.
Keep the collection browsable when one trip is selected.
Use restrained transitions and respect reduced motion.
**Show all trips** clears selection and restores the overview.
The native **Show only selected trip** toggle filters the map geometry and card list while retaining the camera and selected trip.
It is available in the open panel and disabled until a trip is selected. Its `view=selected` URL state survives report navigation and same-session returns.
Changing the filter or opening the panel dismisses obsolete overlapping-route choices, keeping phone controls reachable. Deselecting a trip or choosing **Show all trips** clears the filter.
This provides isolation as the collection grows; add year filtering when browsing many trips calls for it.
Clicking empty map space clears selection and temporary highlights while preserving the current camera.
Do not filter the card list merely because the reader pans the map.

### Content and state rules

Build one entry per `tripId`, rather than one entry per post.
A trip with several published report parts gets one route, one card, and ordered report links.
Use the series title when available; otherwise use its first report's title and description.
Include only published report parts in production.
Read card content from its existing sources so report edits also update the collection.
Cards provide a short invitation to open the report.
Do not introduce copied story excerpts, duplicate galleries, or a second trip detail page.

Use authored `distanceMiles` and `ridingDays` when available.
Omit missing facts.
Do not substitute the number of manifest days for riding days.
Do not present distances from incomplete or reconstructed geometry as verified trip totals.
The Route 66ish draft currently lacks authored distance and riding-day totals.
It also has a date reconciliation task, so its map card must inherit later source corrections.

Use `?trip=<tripId>` for persistent selection.
An invalid trip ID returns to the overview with an explanatory message.
Browser Back from a report should restore the selected trip and card position.
Preserve the camera for same-session returns; a fresh shared URL can fit the selected route.

The [report page](../../src/pages/BlogPost.tsx) currently accepts return locations only under `/posts`.
The [trip header](../../src/features/trips/components/TripStoryHeader.tsx) also hardcodes **Back to posts**.
Extend that behavior for the exact atlas path and use **Back to map** when appropriate.
Retain the existing filtered-post return behavior.
The atlas must preserve its own scroll position because its viewport shell uses an internal scroll region.

## Proposed implementation sequence

These phases describe proposed implementation work.
They are not changes completed by this research task.

| Phase | Work | Completion condition |
| --- | --- | --- |
| 1. Content adapter | Extend small summaries with route URLs. Join published report metadata to summaries. Group by `tripId` and sort by travel date. | Cards need no full manifest or loaded MDX. Drafts stay out of production. Several report parts produce one entry. |
| 2. Map and cards | Add an atlas module under `src/features/trips/atlas/`. Render a full-viewport map, collapsible card panel, shared selection, overlap choices, and Show all trips. | Map and card selection agree. Cards remain browsable. The phone panel supports touch and keyboard access. |
| 3. Navigation | Add the explorer and project-entry redirect, project metadata, post-list and report links, selected-trip URLs, and return behavior. | The Projects entry opens the collection directly. Reports and shared URLs retain selection. Returning restores card position. |
| 4. Recovery and release checks | Verify route, photo, tile, and renderer failures. Add metadata, sitemap entries, a real project preview, and focused browser coverage. | Reports remain reachable after failures. Existing article loading budgets pass. Keyboard and phone checks pass. |

Fetch only the eligible trips' existing GeoJSON files when the explorer map loads.
Keep the cards usable while those requests run.
Reuse the route loader's validation, retry, cancellation, and caching behavior where practical.
Use independent results so one failed route does not discard the others.

Tag each feature with `tripId` and give it a stable, namespaced feature ID.
Combine the features in one source with a few context and selection layers.
Keep track boundaries and `MultiLineString` segments intact.
Store selection in React state outside the map instance.
Do not reload geometry when selection changes.

Fit the initial successful route set once, after loading settles.
A later route response must not override a newer selection or manual camera movement.
Keep a failed route's card and report links visible, with a route-unavailable message and Retry action.
Keep card content after image, basemap, or WebGL failure.

Load the map renderer lazily on the explorer page.
Keep map code and route requests out of the post list and Projects listing.
Use the existing photograph sizes and load offscreen card images lazily.
Release the map and its worker resources when leaving the explorer.

### Focused validation

Use fixed content and fixed tile responses, following the existing [trip browser tests](../../docs/trips/TESTING.md).
Cover these cases:

- Published and draft trips, absent manifests, and several reports with the same `tripId`.
- Missing optional facts, distinct trip and publication dates, and predictable card order.
- Selection through routes, card buttons, keyboard, and touch.
- Panel expansion, collapse, scroll position, focus retention, and camera padding at desktop and phone sizes.
- Shared roads with several candidate trips and disconnected route segments.
- Shared URLs, invalid IDs, browser Back, and **Back to map** restoration.
- One failed route, slow responses, failed photographs, missing tiles, and WebGL recovery.
- Initial loading that finishes after a reader selects a trip or moves the camera.
- A 320-pixel phone, desktop, enlarged text, reduced motion, and visible attribution.
- Existing article and post-list JavaScript budgets, plus measured explorer transfer and initialization costs.

### Later additions

Add year and region filters when the published collection makes them useful.
Consider a few extra selected-trip photographs after measuring card loading.
Add a separate simplified overview route only when route transfer or rendering becomes a measured problem.
Keep day playback, elevation charts, photo markers, and route planning outside the initial scope.
Route-only trips without reports would need an explicit publication model before inclusion.

## Evidence limits

The sources below are first-party websites and official documentation, checked on the report date.
Page text, links, and documented controls were inspected.
Dynamic maps were not exercised in a graphical browser.
Responsive layouts, keyboard behavior, route hit areas, and camera transitions remain unverified.

The comparison distinguishes inspected content from product documentation.
The recommendations are design judgments for this personal archive.
They are not claims that every example uses those interactions.

## Relevant live examples

| Example | Inspected content or documented behavior | Useful pattern | Limits |
| --- | --- | --- | --- |
| [TheTwoWheelJourneys: Living Map](https://thetwowheeljourneys.com/map) and [Ride Journal](https://thetwowheeljourneys.com/journal) | A personal motorcycle archive offers geographic and chronological entry points. The map page explicitly links to a JavaScript-free journal. It acknowledges overlapping rides near Pune. | Keep the same trips available as readable cards. Explain dense routes near home. | The page describes dots, rather than complete route lines. Map selection and phone layout were not verified. |
| [Terraxplor: Northern Sumatra by Motorcycle](https://www.terraxplor.com/post/n-sumatra-by-motorcycle) | A ridden motorcycle trip combines a route map, photographs, journey context, and separate links to individual ride reports. | Provide direct report links outside the map. Use short route labels that identify the journey. | This is one trip with several legs. The embedded map interaction was not independently verified. |
| [Itchy Boots: Routes and Motorcycles](https://www.itchyboots.com/route) | Motorcycle sections contain photographs, short journey descriptions, and links to corresponding blog series and videos. | Give each journey a recognizable identity and editorial introduction. Connect geography to the author's story. | The extracted page does not establish route-map selection behavior. It supports the content model more than the interaction design. |
| [Ride with GPS: Collections](https://support.ridewithgps.com/hc/en-us/articles/7795141585307-Collections) | Official documentation describes multicolored routes and selection through either the map or item list. Selection exposes route details. A Show All control restores the collection. | Connect map and list selection. Keep overview restoration explicit. Separate route selection from opening its detail page. | These are documented product behaviors. A public collection and its responsive website layout were not directly exercised. |
| [Komoot: The Pamir Highway](https://www.komoot.com/collection/964786/the-pamir-highway-dushanbe-to-osh-via-the-wakhan-valley) | A rider's collection contains an introductory story, aggregate distance and elevation, and numbered route entries with individual statistics. | Put story context beside route statistics. Keep trip totals separate from individual route details. | This collection divides one journey into activities. Its map behavior and mobile layout were not verified. |
| [BIKEPACKING.com: Routes](https://bikepacking.com/bikepacking-routes/) | The route directory offers map exploration and a linked list sorted by location or route length. Visible entries include destinations, duration, and distance. | Offer geographic discovery and a complete list. Include only statistics that help readers choose a story. | This is a large route-guide directory. Its filtering depth exceeds this archive's initial needs. |

Ride with GPS is the primary interaction reference, matching the user's stated preference.
TheTwoWheelJourneys provides a related personal motorcycle archive.
Komoot provides the strongest inspected example of narrative context with route statistics.

## Layout and trip cards

The following layouts are recommendations, rather than verified responsive behavior from the examples.

On desktop, keep a full-viewport map available beside a scrollable card panel.
Let readers collapse the panel for additional map space.
On phones, use a lower panel that expands through an explicit button.
Retain the same cards and selection state at every width.
These choices apply the user's map-first preference to this archive.
A draggable panel is optional and must not become the only way to browse cards.

Each card should contain:

- A representative photograph with intrinsic dimensions.
- The trip title and travel dates.
- The existing report description.
- A geographic summary, such as the destination or major corridor.
- A small set of reliable statistics, such as distance and days.
- A normal trip-report link.
- A separate Show route button.

Use the card photograph as orientation and an invitation to read.
Keep the title, description, and statistics in HTML.
Avoid hiding those details inside a popup.
Use consistent units.
Label travel dates separately from report publication dates.
Do not infer missing dates, riding time, or trip totals from incomplete tracks.

Komoot demonstrates narrative and route statistics in one collection.
Itchy Boots demonstrates personal journey introductions with story links.
These examples support the card content recommendation above.

## Selection and overlapping routes

Use one persistent selected trip.
Selecting a map route or its Show route button should produce the same result.
Non-interactive card content also selects the route. Map selection scrolls the matching report card into view.
Highlight the selected route and card.
Retain the other trips as subdued geographic context.
Keep their original route colors at 50% opacity and their normal line width, with no halo while another trip is selected or previewed.
Keep an explicit Show all trips control.

Treat hover as an optional preview.
Hover should not move the camera, scroll cards, replace persistent selection, or open a report.
The hovered route and report card share temporary visual emphasis.
Show the trip title in the story map's dark tooltip, with an edge matching the route color.
Reuse the shared tooltip factory, route casing, and motion-aware transitions. Dim other routes during temporary emphasis using the same 50%-opacity colors without halos.
Escape dismisses tooltip feedback without clearing the selected trip.
Keyboard focus should remain visible without forcing a route selection.
Opening the report should require its own normal link.
This separates browsing from navigation.
Ride with GPS documents a similar separation between collection selection and opening a route page.

Several trips can follow the same road near home.
Distinct colors alone cannot make every shared segment selectable.
Draw the selected trip above the context routes, with a wider line and contrasting casing.
Draw hover feedback above selection so shared roads retain visible preview feedback.
Always permit selection through the cards.
Keep stable trip IDs on route features.

For map clicks, query a small screen-space area around the pointer.
Deduplicate the resulting features by trip ID.
If several trips match, show a short labeled choice list.
Color each choice to match its route. Hovering or focusing it previews the route and report card without changing selection.
Use an accessible close icon in the popup's top-right corner. Closing it or pressing Escape clears the preview.
Do not silently select whichever route happens to render last.
This ambiguity control can remain small when most routes do not overlap.

MapLibre supports point and bounding-box feature queries.
Its results can include duplicate features across tile boundaries.
Its line styling supports width, opacity, offset, and draw ordering.
These are implementation capabilities, rather than a prescribed interface.
See [Map queries](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#queryrenderedfeatures) and [line styling](https://maplibre.org/maplibre-style-spec/layers/#line).

Avoid offsetting all shared routes in the initial version.
Offsets can complicate junctions and imply roads that differ from the recorded geometry.
Selection and the card list provide a simpler first solution.

## Camera and scrolling

Fit the complete available route set on initial map load.
Fit the selected trip after an explicit selection.
Use padding and a maximum zoom to preserve context for small routes.
Do not continually refit while readers pan or zoom.
Do not refit after unrelated card updates.
Give Show all trips a predictable overview extent.

Calculate trip bounds from the complete stored geometry.
Do not calculate them from rendered query results, which can contain clipped segments.
Check bounds before moving the camera.
Preserve disconnected route segments without drawing invented connecting lines.

MapLibre provides `fitBounds`, padding, and `maxZoom`.
See [camera fitting](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#fitbounds) and [FitBoundsOptions](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FitBoundsOptions/).

Retain cooperative gestures for an embedded map.
MapLibre documents modifier-assisted desktop interaction and two-finger mobile interaction for this option.
Test the resulting instructions and scrolling on actual phones.
See [MapOptions](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/#cooperativegestures).

Use immediate camera changes when the reader requests reduced motion.
W3C's interaction-animation guidance supports respecting this preference.
The cited criterion is Level AAA.
See [Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).

## Accessible browsing and failure behavior

Keep the full trip list available before map initialization and after map failure.
Panel controls must work independently from the map renderer.
Every trip must retain its title, geographic summary, dates, statistics, and report link.
TheTwoWheelJourneys explicitly provides a non-map journal.
BIKEPACKING.com provides a separate route-list entry point.

An accessible map label alone does not describe all trip information.
W3C recommends a complete text equivalent for complex visual information.
The cards should provide that equivalent for this atlas's purpose: discovering trips and opening their reports.
See [WAI Images Tutorial](https://www.w3.org/WAI/tutorials/images/).

Use native links for reports and native buttons for map actions.
Use a visible selected mark in addition to route color.
Expose selection programmatically when using toggle buttons.
Keep keyboard focus on the initiating button after route selection.
See [WAI Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) and [Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

Use generous card controls and visible focus indicators.
WCAG 2.2 specifies a 24 CSS pixel minimum target size, subject to exceptions.
Larger controls suit touch browsing.
See [Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Allow cards and controls to reflow on narrow screens and at enlarged text sizes.
Maps have a two-dimensional-layout exception, but surrounding content still needs to reflow.
See [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

## Modest MapLibre implementation direction

Reuse the installed MapLibre GL JS implementation and existing trip assets.
Keep card summaries separate from map geometry.
Load geometry when the map is requested or approaches visibility.
Do not require full trip manifests or story modules to render the overview cards.

For the initial archive, combine the eligible route features into one GeoJSON source at runtime.
Add the owning trip ID to each feature.
Use a small, fixed set of layers for context, selected route, and casing.
Update selection through styles or filters instead of replacing the map or reloading every route.
MapLibre documents these operations in [setFilter](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setfilter) and [setPaintProperty](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setpaintproperty).

Measure transferred route bytes, map initialization, and interaction on a modest phone.
Include cold-cache loading and shared-road selection.
Use one representative card image rather than loading complete galleries.

If measured route cost becomes material, produce simplified overview geometry during asset preparation.
Retain complete geometry for the trip report and downloads.
Preserve segment boundaries and trip IDs in any derivative.
Introduce vector tiles only if the archive outgrows ordinary GeoJSON.

MapLibre's performance guide recommends reducing unused properties, simplifying geometry, compressing data, and keeping styles simple.
It also discusses vector tiling for larger datasets.
These are available techniques, not evidence that this small archive requires them now.
See [MapLibre large-data guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/).

### Basemap service and attribution

The current [trip basemaps](../../src/features/trips/tripMapBasemaps.ts) use OpenStreetMap and OpenTopoMap raster tiles.
Reuse their visual treatment only with the required provider attribution.
Keep attribution visible and outside cards or other overlays.

OpenStreetMap's standard tile service requires visible attribution, normal caching, and a valid browser Referer.
It prohibits bulk downloading and tile prefetch features.
It provides no availability guarantee.
These requirements apply if the atlas retains that provider.
See the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

Choose another suitable provider if later traffic or styling requirements justify it.
A new provider is not required merely to build the first version.

## Validation before release

Check desktop, narrow-phone, enlarged-text, keyboard, and reduced-motion behavior.
Check two trips that share a road.
Check a trip with several disconnected tracks.
Check an unavailable route file and an unavailable map renderer.
Confirm that the remaining trips and all report links still work.
Confirm that initial loading does not override a newer selection.
Confirm that panning does not cause repeated automatic camera movement.

The examples establish useful content and interaction patterns.
They do not establish accessibility conformance or performance for the proposed atlas.
Those properties require validation in this repository.
