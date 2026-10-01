# Trip report audit - 2026-10-01

This report records the state before implementation. Its findings and measurements are historical.
Use the [implementation report](2026-10-01-trip-report-implementation.md) for corrections, current checks, and release limits.

The strongest improvements are to loading cost, failure isolation, photo consistency, and navigation through long stories. The existing dark theme, photography, readable article column, responsive image infrastructure, and manifest model are good foundations. A redesign should preserve those strengths.

This review covers the current working tree, including its four pre-existing modified files. No application changes were made. It includes the trip feature, post discovery, shared article/layout components, MDX import, asset preparation/publication, metadata, build configuration, and relevant tests. Findings marked **confirmed** have browser or diagnostic evidence; **code finding** means the behavior follows from the implementation; **design opportunity** is a recommendation rather than a defect.

## Method and limits

- Inspected Ocean Shores, Boise, the posts index, and an ordinary article in Chromium at 1440px desktop and 390px mobile widths. Mobile used iPhone 13 device settings in Chromium, not Safari or a physical iPhone.
- Built with Vite into `/tmp/rsmb-trip-review-build` using existing local generated content. This deliberately bypassed Google sync and publication checks. Draft content in this preview is not evidence that drafts are publicly deployed.
- In the production preview, intercepted trip CDN requests and served existing local derivatives. Bundle requests and image selection are real browser observations; these are not live-CDN latency measurements or field Core Web Vitals.
- Normal browser visits produced no uncaught page errors. No horizontal page overflow appeared in the sampled widths.
- Existing targeted tests: **151 passed across 8 files**. The 3 existing post-rendering Playwright tests passed. TypeScript and ESLint passed. Production bundling passed, with a Tailwind source-map warning.
- A temporary diagnostic added the missing camera assertion to the existing stop-map test. It failed with zero `easeTo` calls, confirming finding 8. The diagnostic file was removed.
- Browser fault injection disabled canvas contexts and reproduced the report-wide error in finding 2.
- Temporary screenshots and browser measurements are in `/tmp/rsmb-trip-review/`; diagnostic scripts are `/tmp/rsmb-trip-review*.mjs`.

The application flow is: Google Sheet metadata + Google Doc → sanitized MDX and post registry → lazy article component. Separately, source photos/GPS → prepared derivatives → S3/CDN; checked-in trip manifests connect those assets to article blocks. Production asset availability checks and browser manifest validation currently happen at different boundaries.

## Priority overview

| Priority | Improvement | Expected effect | Relative effort |
| --- | --- | --- | --- |
| P1 | Restore real route-level code splitting | Remove major unnecessary downloads from reading/discovery | Medium |
| P1 | Contain map failures inside the map | Keep reports readable without WebGL or healthy tiles | Medium |
| P1 | Validate manifests before publication and isolate drafts | Prevent one bad manifest breaking unrelated pages | Medium |
| P1 | Version photo URLs and preparation inputs | Make corrected photos reliably reach returning readers | Medium |
| P2 | Correct image sizes and tune derivatives | Reduce gallery bandwidth; sharpen desktop hero | Small–medium |
| P2 | Unify photo viewing | Make every photo behave predictably | Small–medium |
| P2 | Repair stop focus and keyboard/touch access | Make route exploration work consistently | Medium |
| P2 | Preserve reading/filter context and improve article navigation | Reduce repeated scrolling and lost place | Medium |
| P2 | Emit route metadata in delivered HTML | Improve sharing and non-JavaScript discovery | Medium |
| P3 | Refine hero, facts, cards, galleries, and story structure | Improve editorial pacing and visual clarity | Small–medium |

P1 means a substantial reliability or performance problem worth fixing first; it does not imply an active incident on the public site.

## 1. Unused visualization code - confirmed, P1

The production posts index requested approximately **932 KB of encoded JavaScript** in the local browser run. About **806 KB** was the combined MapLibre, Three.js, and three-globe chunks. There were zero canvases on that page. The same heavy chunks loaded on an ordinary article.

Two boundaries are responsible:

- [The trip barrel](../../src/features/trips/index.ts) re-exports `TripRouteMap`, while [Posts](../../src/pages/Posts.tsx), [Home](../../src/pages/Home.tsx), and [BlogPost](../../src/pages/BlogPost.tsx) import lightweight helpers through it. The emitted trips chunk imports MapLibre. The nominally lazy MDX map therefore does not isolate its code from discovery pages.
- [Manual chunk configuration](../../vite.config.ts) produces a `three-globe` chunk containing React itself. The main app entry statically imports that chunk, which imports Three.js. Naming a chunk after an optional feature has not made it optional.

Use direct imports for metadata/helpers and lazy boundaries for interactive components. Rework or remove manual chunk rules, then inspect the emitted import graph. Vite's current guidance uses Rolldown code splitting; check the installed toolchain when implementing. [Vite build documentation](https://vite.dev/guide/build.html).

**Acceptance:** cold visits to `/posts`, `/`, and a text-only article request no MapLibre, Three.js, globe worker, or trip-map CSS. Verify with a production-build browser test, not only development-server tests.

## 2. Report loss after WebGL failure - confirmed, P1

With canvas contexts unavailable, Ocean Shores renders only “Something went wrong / An unexpected error occurred / Try again.” The title, story, photos, and site navigation disappear.

[TripRouteMap](../../src/features/trips/components/TripRouteMap.tsx) constructs MapLibre without a guarded initialization path. Its error UI handles route fetch/validation failures, but not constructor failures or map errors. [The application boundary](../../src/App.tsx) wraps the whole layout. Neither current manifest supplies a static fallback image.

Give the map a local error boundary and explicit initialization/load/error states. Preserve the article, route summary, and stop list. Supply a useful static preview with descriptive text, a retry action, and optional processed-route download. Also contain lazy-block import failures locally; the article currently has one Suspense boundary for the entire body.

**Acceptance:** disabled WebGL, route 404, missing map chunk, and failed tiles leave the story and navigation usable. A stalled route request eventually leaves the loading state. A missing photograph gets a labeled placeholder without losing its caption or layout.

## 3. Late manifest validation - code finding, P1

[Blog sync](../../scripts/sync-blogs.js) checks JSON parsing, matching ID, shortcode references, hosted asset URLs, and HTTP availability. It does not apply the complete [Zod schema](../../src/features/trips/tripManifests.ts). That schema runs in the browser while eagerly importing **every** trip JSON, and throws outside development mode.

Consequently, a syntactically valid but structurally invalid manifest can survive bundling and fail when readers open a page importing the registry. An unpublished manifest is in the same eager glob as published manifests. A bad draft can affect unrelated articles and discovery pages. This gap is already acknowledged in TODO.md; it deserves a release-boundary fix.

Move the schema to an environment-independent module shared by scripts and the app. Validate published manifests before creating artifacts, compare route track IDs with actual GeoJSON, and build a production registry from published references. Keep draft diagnostics isolated. Load complete trip manifests per story; cards only need a small metadata/hero summary. Detect duplicate manifest IDs rather than silently overwriting a Map entry.

**Acceptance:** a malformed published trip fails the build with a precise field path; a malformed unpublished trip cannot break the published site.

## 4. Incorrect immutable caching - code finding, P1

[Preparation](../../scripts/prepare-trip-assets.js) writes stable names such as `photo-id-1600.webp`. Existing derivatives are reused unless `--force` is passed; changes to source bytes or encoder settings do not invalidate them automatically. [Publication](../../scripts/publish-trip-assets.js) uploads these URLs with `max-age=31536000,immutable`.

A photo correction can therefore be skipped during preparation. Even when regenerated and uploaded, a returning browser may reuse the old photo for a year. CloudFront invalidation does not evict an already fresh browser response. Long immutable lifetimes should accompany versioned URLs. [MDN caching guidance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching).

Fingerprint source content and transformation settings, write versioned derivative URLs, and update manifests accordingly. Retain older published objects while old documents may reference them. If filenames must remain stable, use a cache policy appropriate for mutable content.

**Acceptance:** replacing a source photograph results in a new derivative and URL; an existing reader sees the correction without clearing browser data.

## 5. Incorrect image size hints - confirmed, P2

[TripPhotoFigure](../../src/features/trips/components/TripPhoto.tsx) uses the same default `sizes` for every context: 720px on desktop and nearly the full viewport on mobile. [Breakout styling](../../src/index.css) allows 1152px, while galleries divide that space into columns.

| Browser context | Actual rendered image width | Selected derivative |
| --- | ---: | ---: |
| Desktop hero, DPR 1 | 1150px | 960px |
| Desktop gallery, DPR 1 | 374px | 960px |
| Mobile gallery, DPR 3 | 171px | 1600px |

The desktop hero is enlarged from an undersized file. Gallery tiles over-request pixels; the mobile tile needs roughly 513 physical pixels, so the existing 960px candidate would already suffice. Browser selection uses `sizes` with `srcset`; the hint needs to describe the layout slot. [MDN responsive images](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images).

Pass layout-specific sizes for hero, inline, gallery, and card roles. A single `photo.sizes` field cannot express every reuse of a photograph. Preserve intrinsic dimensions and high priority for the actual hero. Consider a 640px derivative only after measuring corrected selection.

**Acceptance:** desktop heroes receive adequate resolution, gallery tiles stop loading 1600px files in this mobile scenario, and photo dimensions still reserve layout space.

## 6. Large photo derivatives - measured, P2

The encoder uses WebP quality **95**. Existing local assets measure:

| Trip | 480px total | 960px total | 1600px total | Largest 1600px file |
| --- | ---: | ---: | ---: | ---: |
| Ocean Shores, 10 photos | 0.83 MB | 3.29 MB | 9.19 MB | 1.93 MB |
| Boise, 46 photos | 2.93 MB | 11.85 MB | 34.85 MB | 1.92 MB |

These are asset-set sizes, **not** claims that all bytes download at initial load; native image lazy loading is present and useful.

Compare a small set of source photos at several lower qualities, including foliage, skies, and fine detail. Use separate editorial targets for tiles and enlarged views, with a measured size budget. Consider AVIF only if visual results and extra build complexity justify it. The current 1600px ceiling can also limit large/high-DPR lightboxes; a larger on-demand variant should be considered separately from tile optimization.

## 7. Different photo controls - confirmed, P2

The hero and grouped galleries initialize PhotoSwipe. [Standalone TripPhoto](../../src/features/trips/components/TripPhoto.tsx) emits the same PhotoSwipe data attributes but has no enclosing initialized gallery. Clicking the Seattle skyline near the end of Ocean Shores opened a new browser tab; clicking the hero opened a modal.

Use a shared lightbox controller with explicit grouping: an inline photo should at least open itself in the same viewer. Make “View all 10 photos” visible on the hero so the collection is discoverable. Preserve Escape, previous/next, and return of focus to the clicked photo.

The hero currently opens at **4 / 10** because it retains manifest ordering. That can be valid, but the UI should make the collection clear. For Boise, 46 unlabeled pagination dots are cumbersome. Prefer a count and optional thumbnail picker. The current 20px-wide adjacent dot buttons also warrant target-size correction; WCAG's minimum target criterion includes size and spacing exceptions. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).

## 8. Missing initial stop focus - confirmed, P2

The camera effect at [TripRouteMap.tsx](../../src/features/trips/components/TripRouteMap.tsx) runs before asynchronous route data has created `mapRef.current`. Its dependencies are stops, reduced motion, and stop ID. Route arrival reruns map construction but not that camera effect, so the initial stop focus is skipped.

The existing test named “keeps the existing zoom behavior for a stop-focused map” only asserts that the overview zoom adjustment is absent. Adding the expected `easeTo({center, zoom: 9})` assertion fails with zero calls.

Set the initial camera during initialization or explicitly react to map readiness. Keep later camera changes separate from map construction so a selection change does not rebuild the map.

**Acceptance:** delayed route loading still focuses the requested stop; reduced-motion mode uses an immediate camera change; switching stops updates the existing map.

## 9. Keyboard and touch defects - partly confirmed, P2

- **Confirmed:** after scrolling, focusing the site logo leaves the focused link outside the viewport, from y=-45 to -17. [Layout](../../src/components/Layout/Layout.tsx) translates its sticky header away without revealing it on focus. Reveal the header on `focus-within` and keep it visible while focus remains inside.
- **Code finding:** stop names are `<li>` elements with mouse-enter/leave handlers. Keyboard users cannot activate them, and touch users have no persistent equivalent. Use buttons with focus/click selection and an explicit selected state; expose stop descriptions/dates.
- **Code finding:** small secondary labels use zinc-500 on the nearly black background. The usual corresponding colors are approximately 4.1:1, below the 4.5:1 threshold for normal text. Verify computed colors when implementing and raise secondary-text contrast. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

**Acceptance:** keyboard focus always remains visible; stop exploration works with keyboard and touch; small labels meet normal-text contrast requirements.

## 10. Map loading and controls - code finding, P2

Maps fetch and create WebGL contexts on mount, including maps far below the viewport. Multiple shortcode maps each fetch and parse the same route; browser caching may save transfer but does not share application state or map initialization. There is no request deadline or retry action.

Use a static preview and activate near the viewport or on an explicit interaction. Share route fetch/state by URL, with cancellation and an error/retry policy. Avoid keeping many offscreen maps active in a long report. Memoize route-derived bounds and distances rather than recalculating them on every hover.

Keep cooperative gestures, which already protect page scrolling. Add a “Show full route” reset, explicit basemap choices with selected state, and section links for day tracks. The current icon cycles three basemaps without displaying the choices. The muted raster treatment preserves the amber route but makes geographic labels dim; compare it with a purpose-designed muted basemap. Distinguish repeated departure/arrival labels so overlapping Seattle markers remain understandable.

## 11. Lost filters on return - confirmed, P2

Opening a report from `/posts?type=trips&tag=washington` and selecting “Back to posts” returns to `/posts?type=trips`, losing the tag. The link points through `/trips`; it cannot recover the originating filter state. [ScrollToTop](../../src/components/ScrollToTop.tsx) also unconditionally resets on pathname changes rather than explicitly managing history restoration.

Carry a validated return location when opening an article, with a sensible trips default for direct visits. Restore the previous list position on browser Back. Keep a visible return/next-story action at the bottom of long reports.

**Acceptance:** return from a filtered list preserves type, tag, and position; direct article visits have a useful deterministic return destination.

## 12. Article opening - design recommendation, P3

The large photos are attractive, but hero height follows the source aspect ratio at full breakout width. The Ocean Shores desktop hero is about 767px tall, and Boise's is about 863px. Facts and table of contents follow it. Ocean Shores' TOC starts about **1278px down on desktop and 1077px on mobile**. These measurements include the existing header/title layout, not developer status panels.

Keep the expansive photography while adding immediate orientation: a compact line with trip dates, distance, and riding days, plus “Read story,” “Route,” and “Photos” anchors near the title. Consider an editorial hero crop with a reasonable maximum height and a full-image lightbox. On mobile, lay out short facts in two columns and long values across the width rather than a five-row block.

A collapsible mobile contents control and a modest active-section indicator would help longer reports. Avoid adding another permanently large sticky bar.

## 13. Gallery and phone layout - design recommendation, P3

The mobile index hides all hero thumbnails below the `sm` breakpoint. Trip reports therefore lose their strongest visual distinguishing feature on phones. Show a modest thumbnail or landscape card image and a compact distance/day summary. Keep the text hierarchy and avoid turning the list into oversized promotional cards.

Galleries use square crops everywhere. That works for scanning but loses context in landscape views and crops portrait subjects. The three-photo Ocean Shores gallery leaves one tile alone in a second row on mobile, while long captions dominate the tile area. Provide a small set of layouts based on photo count and aspect ratio, such as a lead image plus two supporting images. Keep essential captions readable without hover, and separate authored captions from alt-text fallback so mobile readers do not get a wall of image descriptions.

Boise's local draft renders all 46 photos in daily galleries and repeats all 46 in “highlights,” plus hidden hero-gallery markup. Curate highlights or replace the repeated grid with a viewer action. This is an editorial preview observation, not a claim about published content.

## 14. Missing delivered article metadata - code finding, P2

[index.html](../../index.html) contains generic site title, description, canonical URL, and social image. [useDocumentHead](../../src/hooks/useDocumentHead.ts) replaces these after client rendering. A consumer reading only the delivered HTML receives site-level metadata for a trip URL. Generating an OG image does not itself put its URL into that initial response.

Prerender published article routes or otherwise emit route-specific HTML metadata during the build. Preserve the existing JSON-LD and canonical model. Also fix duplicated branding: the measured title is `Going to the beach in the rain | rsmb — rsmb`, because both BlogPost and the head hook add the site name. Use article-specific Open Graph type and publication dates where appropriate; add `dateTime` to visible `<time>` elements.

**Acceptance:** a plain HTTP fetch for an article contains its title, description, canonical URL, and social image before JavaScript executes.

## 15. Slow asset validation - code finding, P2/P3

`validateTripAssetUrls` awaits every asset check sequentially and repeats work for posts sharing a trip. Boise alone has 138 photo derivatives plus its route. Each failed HEAD can trigger a second request. This is appropriate validation but an inefficient execution strategy.

Deduplicate by trip and URL, then use bounded concurrency with clear aggregated diagnostics. Share full schema/reference validation with asset preparation and publication. Record input fingerprints and processing versions in preparation reports. Add a prepublication report for missing tracks, dates, dimensions, incomplete captions, and unavailable URLs. Distinguish warnings from actual blockers.

The importer already sanitizes active HTML and protects the MDX text boundary, with compilation tests. Preserve that boundary while splitting the large script into independently testable conversion, shortcode, registry, and validation modules.

## 16. Day and series records - design recommendation, P3

The manifests have stops, tracks, and galleries, but no shared day/section record connecting them. Authors manually keep narrative headings, distances, dates, gallery IDs, and track IDs aligned. The local collection already contains planned multi-part reports; there is no series navigation in BlogPost.

Consider optional day records containing date, heading anchor, track IDs, stop IDs, and gallery ID, plus optional series/previous/next metadata. Render small day summaries from those records. Keep free-form prose in Google Docs. Do not automate away narrative structure or force every report into an itinerary template. Label recorded versus reconstructed routes and distinguish complete-trip totals from available-track totals when they differ.

## 17. Missing reader tests - code finding, P2

The tests already cover many schemas, route styles, imported content cases, and heading navigation. However, map mocks cannot expose unavailable WebGL or production chunk behavior, and current Playwright configuration starts a development server. The camera diagnostic illustrates how a passing test name can overstate the behavior asserted.

Add a compact, synthetic trip fixture to browser tests, independent of Google and real unpublished content. Cover production-network boundaries; standalone/gallery photo behavior; close/focus restoration; stop camera after delayed data; keyboard/touch stops; disabled WebGL; failed route/photo requests; mobile image selection; filtered return navigation; and browser history. Include desktop and phone widths and at least a WebKit pass for touch-sensitive changes.

Use route-level bundle budgets and asset budgets that fail CI. The existing [bundle report](../../scripts/bundle-report.js) lists output sizes but does not gate regressions; a large global chunk warning threshold cannot enforce “no map code on the index.” Measure LCP, CLS, and INP under a repeatable setup before choosing numerical targets. This audit did not establish field values for those metrics.

Small maintenance fixes can accompany the relevant work: derive `TripManifest` from the shared schema; move the generally useful reduced-motion hook out of the flights feature; centralize duplicated distance/geometry logic; and fix `TripPhoto` prop ordering so an explicit `className` does not overwrite its composed breakout/margin classes.

## Suggested delivery order

1. Fix bundle boundaries and map failure isolation. Add production browser regressions for both.
2. Correct image sizing, standardize photo viewing, and repair stop focus/header focus. Establish an image budget through visual comparison.
3. Move schema validation to the build boundary and introduce versioned assets before republishing optimized photos.
4. Improve the opening, mobile facts/cards, contents access, filter restoration, and end-of-story navigation.
5. Add prerendered metadata, then expand day/series modeling as more reports become ready.
