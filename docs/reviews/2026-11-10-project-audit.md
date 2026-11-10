# Project audit and improvement shortlist

Review date: November 10, 2026, America/Chicago. Repository revision: `d9cec3d503e6899ee2e798f9fc2629faeb5d06a5`.

The strongest next steps are earlier discovery of trip hero images, better navigation and route orientation, and more resilient temperature-map startup. The existing architecture already provides route splitting, responsive images, bounded caches, publication checks, and substantial regression coverage. A framework migration or broad component rewrite would have a weaker return than the specific changes below.

This review covers this repository, including the React application, map features, content pipeline, shared modules, tests, release configuration, and infrastructure definitions. Applications linked from project pages, such as Through Routes and Bookend, need their own repository reviews.

## Evidence and scope

Production reported the same revision as the checkout, in Amplify job `0000000436`. Fresh checks included:

- Nine production routes at 390 × 900 and 1280 × 900: homepage, posts, projects, about, Ocean Shores, Flights, Temperature Records, Tornado Tracks, and ADV Atlas.
- Screenshots, DOM and landmark inspection, axe-core 4.10.3 scans, and keyboard navigation checks across those 18 route/viewport combinations.
- Three mobile performance samples on each of seven production routes, using Chromium 158.0.8127.18, Pixel 7 emulation, fourfold CPU slowdown, 150 ms latency, 1.6 Mbps download, 0.75 Mbps upload, and disabled browser cache.
- Six alternating control/candidate samples testing an article-image preload in locally intercepted HTML. Production files were not changed.
- The complete installed JavaScript/TypeScript and Python unit suites, lint, type checking, a production-format fixture build, and the current npm advisory audit.

The [retained evidence](../performance/2026-11-10-project-audit.json) includes browser findings, individual performance samples, the preload experiment, failure-path checks, and probe sources. These are laboratory observations. They do not establish field percentiles, screen-reader compatibility, physical-phone performance, or complete WCAG conformance. The accessibility viewport checks used desktop Chromium at phone width; the performance checks used the Pixel 7 device profile.

## Ranked shortlist

Effort estimates include focused regression coverage and assume one developer familiar with the project. They are estimates, not measured implementation times.

| Rank | Change | Practical benefit | Estimated effort |
| --- | --- | --- | --- |
| 1 | Preload the initial trip hero from article HTML | A local browser experiment reduced median article LCP from 4.07 s to 3.20 s, about 21% | 2–4 hours |
| 2 | Make shared navigation dismissible and announce route changes | Improves orientation and keyboard use throughout the reading site | 0.5–1 day |
| 3 | Add a startup deadline and background recovery to Temperature Records | Keeps records usable when the basemap stalls or fails | About 1 day |
| 4 | Fix global character shortcuts and the small map/gallery accessibility gaps | Prevents accidental actions and makes maps easier to navigate with assistive technology | 0.5–1 day |
| 5 | Enable built-in real-user metrics and correct diagnostic byte accounting | Makes subsequent performance decisions reliable | 1–2 hours for provider enablement; 0.5–1 day including diagnostics |
| 6 | Add automated accessibility scans to existing browser CI | Prevents recurring contrast, landmark, and ARIA defects | 0.5–1 day |

### 1. Preload article hero images

The homepage already emits a responsive image preload. Article HTML does not. [The metadata generator](../../scripts/pageMetadataHtml.ts) only adds that hint for the homepage, even though [the content build plugin](../../scripts/trip-content-plugin.ts) already reads each article's manifest and resolves its hero.

On a direct article visit, [BlogPost](../../src/pages/BlogPost.tsx) waits for its page module and then the full trip manifest before rendering [TripHeroGallery](../../src/features/trips/components/TripHeroGallery.tsx). The hero image already has eager loading and high fetch priority. Its remaining issue is late discovery.

The production mobile samples measured Ocean Shores LCP at 4.144, 5.708, and 4.316 seconds. The LCP element was the hero image. Article CLS was 0.090 in all three samples, close to the 0.1 good threshold; the attribution identified the footer moving as the page filled in.

The isolated experiment intercepted the same current production HTML for both scenarios. The candidate added only a responsive image preload with `imagesrcset`, `imagesizes="100vw"`, and high fetch priority. Scenario order alternated across three pairs. Analytics was blocked in both scenarios.

| Measurement | Control median | Preload median |
| --- | ---: | ---: |
| LCP | 4,068 ms | 3,204 ms |
| Hero request start, relative to navigation | 2,034 ms | 100 ms |
| Hero requests per sample | 1 | 1 |

All three pairs improved. This is evidence for the direction of the change, with a small sample on one article. It is not a deployed improvement or a guarantee of the same savings elsewhere. The intercepted document changes document timing equally in both scenarios, so compare the paired scenarios rather than their absolute times with the separate production run.

Implementation: extend the existing metadata/preload ownership to the article's initial hero, using exactly the same responsive candidates and sizes as the rendered image. Keep the hint out of unrelated pages. A second small improvement is to reserve the hero's eventual space during manifest loading; measure CLS after that change instead of assuming the attribution explains every shift.

Acceptance: hold the app entry script and verify that the intended hero request starts; verify one selected-image request at phone and desktop widths and multiple pixel densities; preserve metadata idempotence and recovery behavior. Reuse the homepage preload test approach.

Google's [LCP guidance](https://web.dev/articles/optimize-lcp) specifically addresses images discovered through JavaScript: make the resource discoverable from initial HTML and give it suitable priority.

### 2. Improve navigation and route orientation

[Layout](../../src/components/Layout/Layout.tsx) uses CSS hover/focus to reveal the Projects dropdown. The live keyboard check confirmed that Escape leaves it open. The trigger has `aria-haspopup="true"` but no expanded state or controlled element. A navigation link also doubles as the only trigger, making explicit touch expansion awkward. Active top-level pages receive color styling without `aria-current`.

Separately, pressing Enter on the Posts navigation link from About changed the page but left focus on the Posts header link. [ScrollToTop](../../src/components/ScrollToTop.tsx) handles scroll positions and fragments, but there is no corresponding shared route-focus or route-announcement policy. [The route skeleton](../../src/App.tsx) has no loading status text; some feature fallbacks have the same omission.

Implementation: preserve the Projects overview link and add a disclosure button with `aria-expanded` and `aria-controls`. Support Escape, outside interaction, focus leaving the navigation, and touch activation. Add `aria-current="page"` to the active top-level link. On a new pathname navigation, orient users to the completed destination through a deliberate heading/main focus policy and a restrained live announcement. Preserve browser Back, list-return scroll restoration, fragments, and filter-only URL updates. Add readable loading status and respect reduced motion in the shared fallback.

Acceptance: keyboard and touch can open and dismiss the dropdown; Escape retains sensible focus; ordinary new-page navigation announces the destination; changing a filter or using Back does not unexpectedly jump focus or scroll.

The [WAI disclosure navigation example](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/) covers state, dismissal, and keyboard behavior. [WCAG hover/focus guidance](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) addresses dismissal of additional content. [React Router's accessibility guidance](https://reactrouter.com/how-to/accessibility) calls out focus management and route announcements as application responsibilities.

### 3. Bring temperature-map recovery up to the existing tornado standard

[TemperatureMap](../../src/features/temperatures/components/TemperatureMap.tsx) waits for the map's `load` event before installing its record layers. Its error handler surfaces worker/WebGL/context errors, but other background failures have no equivalent recovery state or startup deadline. Data failures offer a full document reload.

The appropriate starting point already exists in [tornadoBasemap](../../src/features/tornadoes/tornadoBasemap.ts): a deadline, a plain background, a visible background-specific retry, and restoration of data layers. Keep each feature's camera and lifecycle contracts explicit when adapting this behavior.

The browser reproduction held 16 basemap requests for 18 seconds. The temperature map remained blank with `data-map-state="loading"`, while record counts and controls were visible. There was no startup or failure message explaining the missing map. After aborting those background requests, the map reported `ready` without a background-failure warning. This establishes the stalled-background and missing-feedback cases; it does not mean every tile failure prevents records from rendering.

Implementation: distinguish background, renderer, and record-data failures. After a bounded background startup, expose a usable plain map and records panel with a retry action. Preserve filters, units, selections, and camera during background retry. Make data retry invalidate only the failed resources. Use [fetchValidatedJson](../../src/data/validatedJson.ts) where appropriate so rejected JSON does not remain a successful cached response; the current temperature hook parses after the generic cache stores the value.

Acceptance: hold tile requests beyond the chosen deadline, fail tiles, restore service, and fail a data resource independently. Records and controls should remain useful, errors should name the affected function, and retry should recover without a full-page reload or unrelated downloads. Include a stalled globe-texture request in a later resilience pass: [useGlobeTextures](../../src/features/flights/hooks/useGlobeTextures.ts) also has no explicit image-load deadline.

### 4. Close the remaining small accessibility gaps

The strongest confirmed issues are specific, not a need to redesign the visual system:

- [Flight shortcuts](../../src/features/flights/hooks/useKeyboardShortcuts.ts) listen on `window` for letters and digits without a way to turn them off or remap them. Ignoring text inputs is useful but does not satisfy every use case. Add a persistent shortcut setting or scope shortcuts to the focused visualization. Shift plus a printable character still needs consideration. [WCAG 2.1.4](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html) permits disabling, remapping, or focus-limited activation.
- Temperature Records and Tornado Tracks expose no main landmark or h1 on their fullscreen routes. Flights and ADV Atlas already provide these semantics. Add one main landmark and an accessible page heading to each affected map, and provide a useful controls skip target. The axe `region` results are best-practice findings, not by themselves proof of a specific WCAG failure.
- The selected `1yr` button in [TornadoTimeline](../../src/features/tornadoes/components/TornadoTimeline.tsx) measured 4.12:1 contrast at 11 px. Adjust its foreground/background pair and check the other selected states. Normal text requires [4.5:1 contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Multiple [TripGallery](../../src/features/trips/components/TripGallery.tsx) regions on Ocean Shores have the same accessible name, “Photo gallery.” Give each a meaningful distinct label. Unique element IDs alone do not make accessible names unique.

Navigation links measured 16 px high, and several post chips measured 20 px high. Increasing important tap areas toward 44 px is a useful phone improvement. These measurements alone do not establish failure of WCAG's [24 px minimum target criterion](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum): spacing and other exceptions must also be evaluated.

The live shortcut check focused the “rsmb.tv” navigation link and pressed `s`. The stats panel closed while focus remained on that link, confirming activation outside the visualization itself.

Acceptance: test shortcut behavior with focus outside the visualization and with shortcuts disabled; assert map landmarks and headings; verify selected-state contrast; inspect gallery names. Follow automated checks with a real keyboard and VoiceOver/NVDA pass.

### 5. Make performance measurements trustworthy and representative

There is a reproducible accounting problem in [measure-performance](../../scripts/measure-performance.js). It sums only `Network.dataReceived.encodedDataLength`. In this Chromium/production combination, many JavaScript responses emitted zero in those events despite completing and executing.

The separate browser trace captured the discrepancy on the same article visit:

| Counter | JavaScript bytes |
| --- | ---: |
| Sum of `dataReceived.encodedDataLength` | 5,613 |
| Same-origin Resource Timing `encodedBodySize` | 156,983 |
| `loadingFinished.encodedDataLength` | 183,106 |

The last value includes transfer overhead and is not interchangeable with compressed body bytes. The existing helper also reported zero script bytes for all three homepage samples. Its JavaScript totals should not be used as transfer evidence for this run.

Implementation: choose an explicit definition for compressed body bytes versus transferred bytes, reconcile completed requests, preserve repeated-request accounting, and verify actual browser behavior under compression and modulepreload. Retain checks that distinguish an unavailable counter from a genuine zero. The existing small local browser fixture is useful, but did not establish correctness for this production response pattern.

For real-user metrics, the smallest first step is to enable the existing analytics provider's built-in feature. [Umami documents automatic Web Vitals collection](https://docs.umami.is/docs/performance) through `data-performance="true"`, available since version 3.1.0. [The current initializer](../../src/utils/analytics.ts) does not set that attribute. Verify the hosted tracker's support, enable it, and confirm that real visits appear under Performance before building another metric sender. This enablement alone should take much less time than the combined instrumentation task in the shortlist; the hosted account and dashboard were not inspected in this review.

Add custom map-ready timings and startup failure events where built-in Web Vitals are insufficient. Record bounded route identifiers, build identity, device class, and prefetch mode. Preserve the current query exclusion and Do Not Track behavior. Handle absent or blocked analytics without affecting navigation. The installed `web-vitals` package remains useful for diagnostics if additional attribution is needed.

For SPA metrics, associate a measurement with its navigation identity rather than whichever URL is current when the callback fires. Keep supported soft-navigation reporting distinct from traditional document metrics. The [web-vitals documentation](https://github.com/GoogleChrome/web-vitals) explains this distinction. [Umami's tracker functions](https://docs.umami.is/docs/tracker-functions) support custom events and event data, so an additional analytics service may be unnecessary.

Use field p75 segmented by mobile/desktop for the usual [Web Vitals targets](https://web.dev/articles/vitals): LCP ≤2.5 s, INP ≤200 ms, and CLS ≤0.1. Treat map readiness as a separate product metric because WebGL content is not adequately represented by a loading label's LCP.

### 6. Add accessibility regression scans to browser CI

The repository has meaningful manual accessibility assertions, including flight skip links, headings, focus handoffs, and selected airline contrast. The current test dependencies and browser suites do not include axe scans. Fresh scans found one selected-state contrast defect plus map/gallery landmark issues despite the passing unit suite.

Add `@axe-core/playwright` to selected existing production-format browser tests. Cover reading pages, each map's controls, the open Projects dropdown, expanded filters, the flight help dialog, and gallery/lightbox states. Start with serious/critical WCAG findings and explicit follow-up for reviewed best-practice findings. Keep keyboard behavior tests: an automated scan did not detect the Escape and global-character-shortcut problems above.

Acceptance: CI fails on a deliberately introduced contrast or ARIA regression, reports the affected selector, and passes for the repaired states in Chromium. Preserve the current WebKit interaction coverage and add manual assistive-technology checks separately. Playwright's [accessibility testing guide](https://playwright.dev/docs/accessibility-testing) recommends this combination of automated and manual assessment.

## Performance findings beyond the shortlist

These medians come from three samples per route. The interaction column is one sampled interaction after settling; it is not field INP or a sweep of every control.

| Route | LCP | CLS | Sampled interaction latency | LCP target / interpretation |
| --- | ---: | ---: | ---: | --- |
| Home | 1.73 s | 0.000 | 48 ms | Main project preview |
| Posts | 1.58 s | 0.045 | 24 ms | Post description |
| Ocean Shores | 4.32 s | 0.090 | 80 ms | Hero photo |
| Flights | 7.15 s | 0.002 | 224 ms | Statistics text; pause animation was the interaction |
| Temperature map | 1.72 s | 0.003 | 88 ms | Loading message; this is not map-ready time |
| Tornado map | 4.24 s | 0.026 | 112 ms | Basemap attribution; this is not map-ready time |
| ADV Atlas | 1.79 s | 0.007 | 56 ms | Trip description; this is not map-ready time |

All 21 samples completed without application errors. They suggest that article hero discovery and Flights startup deserve attention, while layout stability is broadly controlled. The map targets explain why a single Lighthouse or LCP number would give an incomplete comparison between these applications.

The fixture production build still has a 1,387,725-byte raw Flights module, approximately 377.6 KiB gzip. MapLibre's renderer and worker are 1,088,341 and 519,751 raw bytes respectively, approximately 285.3 and 144.9 KiB gzip. These are artifact sizes, not measured browser transfers. The route boundaries already keep these costs out of ordinary reading visits.

For Flights, capture a startup/interaction trace before further optimization. Keep the recent initial-paint gate, optional-layer deferral, bounded pixel ratio, and retained arc geometry. The measured pause interaction ranged from 216–240 ms under the probe's CPU slowdown, so reducing rendering work remains useful. There is no measured basis here for replacing the renderer or promising a particular saving.

For broad tornado year ranges, retained geometry can still become expensive. The code already limits concurrent year requests, loads trend aggregates separately, and defaults to a narrow range. Later work can evaluate slimmer map properties, geometry simplification, or vector tiles with selection/detail metadata fetched separately. [MapLibre's large-data guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/) covers these options. Vector tiling is a larger data-delivery change and belongs after the quick wins.

## UI, code quality, and other follow-ups

The reading UI has a consistent content width, restrained typography, visible focus treatment, responsive project previews, and clear project descriptions. No document-level horizontal overflow or uncaught application exception was observed in the 18 route/viewport checks. The mobile atlas preserves useful map and list areas, and Tornado Tracks keeps filters behind a clear disclosure.

Additional small UX work: provide a direct clear-filters action and result count on Posts, including empty results; show counts for Writing/Trips so an empty collection is understandable. The current published registry contains three trip reports and no writing posts. A search box, pagination, or a new content framework would add little value at this size. Source-content completion and editorial accuracy are separate existing tasks in [TODO](../../TODO.md).

Temperature charts already have descriptions and some keyboard-operable decade choices. Add expandable data tables for annual and rolling series so exact values do not depend on pointer hover. Tornado Tracks already has a useful table pattern. Verify the accessibility tree of interactive SVG content when doing this work.

Code organization is generally sound: feature directories, pure shared schemas and geometry, bounded request caches, explicit lazy loaders, and focused domain hooks. The remaining large files are worthwhile maintenance targets: TemperatureMap is 1,556 lines, TornadoMap 1,159, and the blog importer 1,512. Extract startup/recovery and pure popup/layer construction as those behaviors change. Separate blog document conversion, shortcode handling, and publication orchestration when touching that pipeline. File size alone does not justify a broad rewrite or a generic abstraction for every map.

SEO foundations are already present: generated canonical/social metadata, structured data, sitemap, RSS, and JSON Feed. The generated HTML is primarily metadata plus the application root; full reading content still depends on JavaScript. Build-time rendering of text and article shells is a later improvement for first paint and non-JavaScript consumers. Google's [JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) supports prerendering, but the current setup is not evidence that Google cannot index the site.

Security and operations: npm reported zero known advisories in the installed dependency tree, and hosting defines CSP, HSTS, referrer, framing, and permissions headers. Existing CI validates infrastructure and gates production through a hosted preview. The two sync workflows still contain legacy credential fallbacks alongside OIDC configuration; finish the existing role migration and verify it before retiring credentials. This review did not query or modify the AWS account, so it does not re-establish the live state of those roles. A passing advisory audit is not a full security assessment.

## Verification and boundaries

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript project references | Passed |
| JavaScript/TypeScript unit suite | 2,984 tests passed in 202 files |
| Historical Python suite | 18 tests passed |
| Production-format fixture build | Passed, output isolated under `/tmp` |
| npm advisory audit | Zero reported advisories |
| Live route/viewport audit | 18 combinations completed; no uncaught app errors or document overflow |
| Mobile performance probe | 21 samples completed |
| Article preload experiment | Six samples; one hero request per sample; no app errors |

The first sandboxed test run blocked CLI subprocesses with `EPERM`; the complete suite passed after rerunning with subprocess access. Chromium likewise required permission to launch outside the process sandbox. These were execution-environment restrictions, not reproduced product defects.

Checks used installed Node.js 26.13.0 and npm 11.20.0. Node is within the declared range; npm differs from the pinned npm 12.2.2. A clean installation with the pinned toolchain was not performed. The entire Playwright and Terraform suites were not rerun, and no physical devices or screen readers were available in this review.

Only this review, its evidence, and the documentation index were added. No application implementation, dependency installation, content publication, deployment, or infrastructure change was performed.
