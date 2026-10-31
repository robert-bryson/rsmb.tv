# ADV Atlas multipart trip research: 2026-10-31

## Recommendation

Represent one continuous journey as **one atlas trip with three ordered articles**.
Keep the complete route, travel dates, and total distance at the trip level.
Give every article its own title, URL, and place in the reading sequence.
Offer article-specific map views when explicit route assignments support them.

This recommendation is a synthesis of the evidence below.
It is not a universal UX rule or a measured result from this site's readers.
Publication boundaries alone do not establish separate journeys.

Use these terms consistently:

| Term | Meaning |
| --- | --- |
| Trip | The real journey, with its complete route and travel facts |
| Article | One published account of all or part of that journey |
| Series | The editorial relationship and reading order between related articles |
| Stage | An explicitly defined geographic or temporal section of a route |

An article need not equal one stage.
A reflective article can cover several stages or revisit places covered elsewhere.
A series can also contain articles about several separate trips.
Keep these relationships distinct even when this example uses one trip and one series.

## Scope and evidence limits

The question concerns an actual journey published in three narrative articles.
This report examines travel journals, route planners, geographic storytelling, accessibility, and page identity.
It uses official product documentation, first-party editorial guidance, W3C material, and Schema.org.
The source pages were checked for this dated review.

The sources establish existing models and documented capabilities.
They do not prove that every continuous journey must use one card.
Product choices also reflect different audiences, authoring tools, and commercial constraints.
No controlled comparison of this atlas's two alternatives was found or conducted.

## Travel products separate journeys from entries

### Polarsteps

Polarsteps creates a trip with a name, start date, and end date.
Authors add several steps within that trip.
A step represents a visited location and can contain text, photographs, and activities. [Polarsteps: Create your first trip](https://support.polarsteps.com/hc/en-us/articles/24267454919314-How-do-I-create-my-first-trip)

**Implication:** multiple narrative entries can belong to one dated journey.
This supports a parent trip with child content.
However, a location-based Polarsteps step is not equivalent to a long-form article.
Its documentation does not prescribe article counts or an atlas card design.

### TravelMap

TravelMap defines a trip as a map with attached photographs, posts, videos, and links.
It recommends creating a trip for a new adventure.
Each trip can have its own description and direct link. [TravelMap: Manage trips](https://travelmap.net/support/maps/managing-trips)

Its introductory guide attaches articles and other content to map points.
Readers can browse that content beside the map or through separate content sections. [TravelMap: Understanding TravelMap](https://travelmap.net/support/getting-started/understanding-travelmap)

**Implication:** the map represents the adventure while the posts describe its experiences.
This is the closest documented travel-blog analogue to one route with several articles.
It does not establish that an article must have one geographic point.

### FindPenguins

FindPenguins calls its posts Footprints.
Each Footprint contains narrative, media, location, and date, and can be assigned to a trip. [FindPenguins: Create a Footprint](https://support.findpenguins.com/hc/en-us/articles/360014000734-How-do-I-create-a-new-footprint)

Its trip-merging instructions separately move Footprints and tracked route points into the receiving trip.
This documents a distinction between published entries and the journey's tracked geography. [FindPenguins: Merge trips](https://support.findpenguins.com/hc/en-us/articles/22298910138012-How-do-I-merge-two-trips)

**Implication:** neither a post count nor a route-file count determines the number of real trips.
The product model supports several posts and route points within one journey.

### Bikemap

Bikemap describes a multi-day tour as a collection of routes.
Readers can inspect the tour overview and each stage in detail.
The tour and individual stages can have separate names. [Bikemap: Multi-Day Tour Planner](https://help.bikemap.net/hc/en-us/articles/20472117006108-Multi-Day-Tour-Planner)

**Implication:** complete-journey identity and useful route subdivisions can coexist.
This supports optional stages without promoting every stage to a separate atlas trip.
Bikemap concerns planned cycling routes, so its stage rules do not define narrative article boundaries.
Its distance thresholds and stage limits are product constraints, not recommendations for this site.

## Geographic stories support both collections and sequence

ArcGIS StoryMaps explicitly supports collections for longer stories published in installments or chapters.
Authors can give the collection a title, description, and chosen item order. [ArcGIS StoryMaps: Create a collection](https://doc.esri.com/en/arcgis-storymaps/latest/get-started/create-your-first-collection.html)

Esri's editorial guidance directly discusses three related stories presented as chapters.
It recommends a collection so readers arriving at the second chapter can find the first and third. [Esri: Effective strategies for engaging with your audience](https://www.esri.com/arcgis-blog/products/story-maps/constituent-engagement/effective-strategies-for-engaging-with-your-audience)

The collection viewer supports sequential navigation and returning to an overview for direct selection. [Esri: Start your first ArcGIS StoryMaps collection](https://www.esri.com/arcgis-blog/products/arcgis-storymaps/sharing-collaboration/start-your-first-arcgis-storymaps-collection)

There is an important qualification.
Esri advises geographic collection browsing when reading order is less important.
Unnumbered map pins can lead readers through chapters in an unintended order.
The traditional item list remains available beside the map. [Esri: Present collections geographically](https://www.esri.com/arcgis-blog/products/arcgis-storymaps/constituent-engagement/present-collections-geographically-in-arcgis-storymaps)

Map tours make a similar distinction.
Guided tours present numbered places sequentially.
Explorer tours let readers choose places in any order. [ArcGIS StoryMaps: Map tours](https://doc.arcgis.com/en/arcgis-storymaps/author-and-share/add-guided-tours.htm)

**Synthesis:** geographic discovery and narrative reading have different navigation needs.
The atlas can invite free exploration between trips.
The selected trip should provide an explicit ordered article list.
Reading order should remain clear even when someone first opens article two from a shared link.
These sources support that separation; they do not require adopting ArcGIS software.

## Compare the presentation choices

The following tradeoffs are design judgments for the stated scenario.

| Choice | Benefit | Cost | Suitable conditions |
| --- | --- | --- | --- |
| One trip with three articles | Preserves journey identity and one set of totals | Requires visible article choices | One continuous journey, divided for writing or reading |
| Three peer trips | Gives each account an immediately visible card and route | Can imply three journeys and repeat shared facts | Three actual trips, or an explicitly stage-based catalogue |
| One trip with optional article stages | Combines overview identity with geographic detail | Requires accurate stage assignments and more controls | Articles have meaningful, authored geographic sections |

Prefer the first choice initially.
Add the third when selecting article geography solves a demonstrated reader task.
The second choice changes what an atlas entry means.
Use it only when that meaning matches the collection's purpose.

Separate outbound and return articles do not automatically imply separate trips.
Returning home, different travel dates, and independently undertaken outings can justify separate trip identities.
An editorial theme alone can connect those trips through a series.
These boundaries require the author's knowledge of the journey.

## Recommended reader experience

### Atlas overview

Show one card with a journey-wide title and summary.
Use one route identity across the complete journey.
Show complete travel dates, total distance, and an explicit article count.
Avoid repeating trip totals once per article.

Offer **Show route** and **Start with Part 1** as distinct actions.
Place all three article links together in reading order.
Use labels such as **Part 2 — [article title]**.
Keep those links available without hovering or selecting a route line.

A journey-wide title needs authored judgment.
The first article's title might describe only its opening section.
The same concern applies to its description and hero photograph.
Choose material that represents the complete journey.

### Article page

Identify the journey and show **Part 2 of 3** near the article heading.
Provide the full ordered article list and mark the current article.
Offer previous and next article links with descriptive destinations.
Retain access to the complete journey on the atlas.
Do not require readers to finish one article before opening another.
Label journey-wide dates and distance as whole-trip facts when they appear on an individual article.
Show current-part facts separately when those facts are authored.

Only link to available destinations.
When publication is incomplete, distinguish a planned part from a published article.
Keep ordering explicit rather than inferring it from publication dates or route position.

### Route detail

Esri's map choreography varies geographic focus and visible layers as a narrative progresses.
Its guidance recommends retaining a geographic reference between adjacent views to preserve orientation.
It also supports focused views before free exploration. [Esri: Choreograph your maps](https://www.esri.com/arcgis-blog/products/arcgis-storymaps/constituent-engagement/choreograph-your-maps-with-arcgis-storymaps)

Apply that principle through optional article or stage selection.
Highlight the selected section while retaining enough context to understand the full journey.
Provide a clearly named **Whole trip** action.
Keep article reading independent from any automatic map movement.

Author route membership explicitly.
An article can reference several tracks or stages.
Two articles can discuss the same location.
Neither a shared place nor a publication date reliably assigns geography to an article.
Do not invent missing route connections to make the journey appear continuous.
Real continuity describes the travel experience, not guaranteed completeness of GPS data.

## Accessibility and orientation

WCAG's keyboard criterion requires functionality to have keyboard operation, apart from its defined exceptions. [W3C: Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)
Therefore, readers need ordinary controls for selecting trips and opening articles.
Pointer access to the route must not be their only path.

Link purposes must be understandable from their names or associated context. [W3C: Link Purpose](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html)
Prefer article titles with part numbers over three identical **Read more** links.
Distinguish opening an article from changing the map view.

Color must not be the only visual means of communicating information. [W3C: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
Use visible part labels and selected-state text alongside route colors.

WCAG's Location criterion specifically discusses a publication split across chapter pages as one logical set.
It supports context indicators for readers arriving directly at an internal page.
Location is Level AAA; this citation does not make breadcrumbs a Level AA requirement. [W3C: Location](https://www.w3.org/WAI/WCAG22/Understanding/location.html)

Mark the current article programmatically, for example with `aria-current="page"` on its navigation link.
W3C documents this as a sufficient technique, rather than a mandatory implementation. [W3C: ARIA26](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA26)

These requirements and techniques guide access to the hierarchy.
They do not determine the number of trip cards or certify the complete explorer's accessibility.

## Page URLs and optional structured data

Keep three distinct article URLs when the articles contain different substantive content.
Google's canonical guidance concerns duplicate or very similar pages.
A shared subject does not establish duplicate content. [Google Search Central: Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

Google's pagination documentation recommends unique URLs, sequential links, and a canonical URL for each page.
It explicitly rejects making the first page canonical for every page in a sequence.
Google no longer uses `rel="next"` and `rel="prev"` as indexing signals. [Google Search Central: Pagination](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)

That document concerns paginated content, rather than a complete specification for editorial series.
The applicable synthesis is narrow: retain each article's identity and connect the sequence with normal links.
Grouping three articles under one atlas trip does not require merging their URLs.
Do not canonicalize distinct articles to Part 1 or to a route-selection view merely because they share a journey.

Schema.org defines `CreativeWorkSeries` for related published works, usually organized in an order.
It allows `hasPart` and `isPartOf` relationships between the series and its components. [Schema.org: CreativeWorkSeries](https://schema.org/CreativeWorkSeries)
The general properties also connect creative works to their larger work. [Schema.org: hasPart](https://schema.org/hasPart), [isPartOf](https://schema.org/isPartOf)
`position` can express a creative work's place in a sequence. [Schema.org: position](https://schema.org/position)

If structured series data is added, describe the **article series** with it.
Keep the real journey's identity distinct from the published works describing it.
Treat this as optional descriptive metadata.
The cited vocabulary does not establish a search-ranking benefit or a special Google presentation for this series.

## Decisions to carry into implementation

1. Preserve the single journey represented by these three articles.
2. Author one journey-wide title, summary, and set of travel facts.
3. Record the article series and explicit part order.
4. Keep one atlas selection and three normal article destinations.
5. Add stage geometry only when its membership is known and useful.
6. Check direct arrival at Part 2, keyboard navigation, and small-screen access to all article links.

## Findings in the current repository

These findings describe the local working tree on October 31, 2026.
They come from source inspection, rather than a new browser validation run.
Existing content changes were present before this research.

### The trip identity already matches the recommendation

All three imported 2026 articles use `tripId: on-qc-new-england-2026`.
The [atlas adapter](../../src/features/trips/atlas/tripAtlasEntries.ts) groups reports by `tripId`, then creates one entry per group.
It does not group by article slug or series ID.
Its existing [unit cases](../../src/test/tripAtlasEntries.test.ts) cover multipart grouping and explicit series ordering.
Those tests were inspected, but were not rerun for this documentation-only task.

The [shared manifest](../../src/content/trips/on-qc-new-england-2026.json) contains July 10–August 15 travel dates, 35 tracks, and 37 calendar-day entries.
These dates describe the journey, independently from article metadata dates.
The [source inventory](../trips/TRIP-SOURCE-INVENTORY.md#onqcnew-england-2026) records the proposed article boundaries as provisional:

| Article | Working travel dates |
| --- | --- |
| Part 1 — St. Louis to the UP | July 10–16 |
| Part 2 — Canadian Shield, Boreal forest, St. Lawrence | July 17–27 |
| Part 3 — New England, Mid Atlantic, Appalachians | July 28–August 15 |

Missing recordings do not make this several trips.
Retain the recorded geometry's gaps and distinguish recorded distance from an independently verified full-trip distance.

### Series metadata is the immediate presentation gap

The inspected generated article records and shared manifest have no `series` metadata.
The adapter therefore uses the first ordered article's title for the whole-trip card.
For these drafts, that title is **St. Louis to the UP**.
The description also comes from that article and currently contains the placeholder **Part 1 of**.
This can make a complete journey appear to cover only its first section.

The [atlas card](../../src/pages/AdvAtlas.tsx) already renders all grouped article links.
The [article footer](../../src/pages/BlogPost.tsx) renders series navigation only when series metadata exists.
Its ordinary previous and next controls follow the broader post collection.
Those controls should not substitute for an explicit part sequence.

Set the following values in the source Sheet when preparing this series:

| Field | Proposed value |
| --- | --- |
| `trip_id` | `on-qc-new-england-2026` on all three rows |
| `series_id` | One shared ID, such as `on-qc-new-england-2026` |
| `series_title` | A journey-wide title, such as `Great Lakes, Canada & New England — 2026` |
| `series_order` | `1`, `2`, and `3` on the respective rows |

The [publication guide](../blog-publishing.md#configure-the-sheet) identifies the Sheet and documents as source content.
The [authoring guide](../trips/TRIP-AUTHORING-README.md#other-manifest-fields) specifically supports separate article orders when reports share a manifest.
One shared manifest cannot supply three different article orders through its single `series.order` field.
Use the per-row fields for this sequence.

A shared series title supplies the whole-trip card title through existing behavior.
The card description still needs a whole-journey introduction.
A separate trip-level description would be a possible future improvement if the first article's description needs a narrower focus.

### Keep whole-trip facts and article scope clear

[TripFacts](../../src/features/trips/components/TripFacts.tsx) reads dates and distance directly from the shared manifest.
Its current labels are **Dates** and **Distance**.
Each article therefore receives the same whole-trip facts.
Label these as whole-trip facts and describe the current article's dates separately.

The [map view](../../src/features/trips/tripMapView.ts) supports whole-route, day, and track focus.
The [manifest schema](../../shared/tripManifestSchema.ts) has no article-to-route membership field.
An unscoped `{{trip-map}}` receives the complete journey, including days outside the current article.
Article-stage highlighting would require an explicit scope over existing day or track IDs.
This would be additional behavior; it is not supplied by setting series metadata.

Keep the master route and manifest together if that enhancement becomes useful.
Derive article views from explicit membership instead of copying route files and trip totals into three independent manifests.
Retain readable article links and full-trip access when a focused route has missing data.

### Publication and counting

The current [atlas guide](../trips/ADV-ATLAS.md#content-and-recovery) distinguishes published production reports from development drafts.
Production should retain that filtering as the parts are released.
Show unavailable planned parts as text, if useful, rather than active links to missing pages.
An exact **Part 1 of 3** label requires an authored planned total when only one part is published.
The existing series model has an order, but no planned-total field.

Count this journey once in any trip total.
Article counts can separately show the three reports.
Keep trip mileage separate from article-level mileage, and avoid summing repeated whole-trip facts.

## Research artifact validation

The external claims were checked against the linked primary sources.
Local claims were checked against the named source files and current content records.
Relative file links and patch whitespace were checked after the report was completed.
This task adds the research report and its documentation index entry.
It changes no application behavior or publication state.
