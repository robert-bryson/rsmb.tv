# Documentation

Use this index to find current instructions and dated reviews.
Use [TODO.md](../TODO.md) for incomplete work.

## Writing rules

Use [ASD-STE100](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf) as the language guide for repository documentation.
Use short sentences and active voice.
Give one instruction in each sentence. Use no more than 20 words in an instruction.
Use no more than 25 words in a description.
Use one term for each concept. Define technical terms before their first use.
Keep commands, identifiers, product names, and source quotations exact.
Keep dated findings and measurements as evidence. Add a new report when findings change.
Record each incomplete task once in [TODO.md](../TODO.md). Link to its acceptance conditions.
Keep an alt description separate from a photo caption.
An alt description states the visible content. A caption can supply other information.

## Current instructions

| Document | Use |
| --- | --- |
| [Repository guide](../README.md) | Install, develop, test, and build the site |
| [Release validation](release-validation.md) | Activate hosted preview checks before production releases |
| [Shared modules](shared-modules.md) | Reuse request caching, state identities, airport normalization, and project presentation |
| [Intent prefetch](intent-prefetch.md) | Configure hover/focus destination preparation, resource limits, and browser measurements |
| [Umami analytics](umami-analytics.md) | Review event definitions, privacy rules, and dashboard checks |
| [Blog publication](blog-publishing.md) | Configure the Sheet and import documents |
| [Site metadata](site-metadata.md) | Maintain crawler metadata, social cards, canonical paths, and hosting rules |
| [Image delivery](image-assets.md) | Prepare card images, recover failed requests, and check homepage preloads |
| [CARTO basemaps](carto-basemaps.md) | Configure authenticated maps and visible attribution across projects |
| [Flights](../projects/flights/readme.md) | Build flight data, enter durations, and check maps, recovery, and filtered statistics |
| [Email DNS](email-dns.md) | Adopt and test mail records, enable signing, and verify delivery |
| [GitHub Actions OIDC](github-actions-oidc.md) | Deploy workflow roles and retire long-lived AWS credentials |
| [Trip authoring](trips/TRIP-AUTHORING-README.md) | Prepare, check, and publish trip content |
| [Trip template](trips/TRIP-STORY-TEMPLATE.md) | Start a trip document |
| [Trip source inventory](trips/TRIP-SOURCE-INVENTORY.md) | Find source files and starter outlines for every trip in the Sheet |
| [Trip tests](trips/TESTING.md) | Install browsers and check maps, photos, and JavaScript budgets |
| [ADV Atlas](trips/ADV-ATLAS.md) | Use atlas URLs, restore tab state, and find code ownership |
| [PCH galleries](trips/pch-2024-galleries.md) | Use the PCH outline, gallery IDs, and panorama shortcodes |
| [Route 66ish media](trips/route-66ish-2025-galleries.md) | Review source files, route dates, gallery IDs, and publication checks |
| [Route 66ish outline](trips/route-66ish-2025-outline.md) | Write the draft with dated chapters and media placements |
| [Temperature methodology](../projects/temperature-records/methodology.md) | Check the historical temperature data |
| [Temperature map](temperature-map.md) | Maintain record markers, units, selections, and map regression tests |
| [Tornado Tracks](../projects/tornado-tracks/readme.md) | Sync tornado data and check map behavior |
| [Pins of Inaccessibility](../projects/pins-of-inaccessibility/readme.md) | Generate global and U.S. pins, validate location details, and check publication |
| [Ride Ledger design](../projects/ride-ledger/readme.md) | Review the proposed application and open decisions |

## Reviews

Each report describes the repository at its stated date. Test results apply only to that review.
An older finding can be corrected by a later change.

| Date | Report |
| --- | --- |
| 2026-11-13 | [Trip layout quality review: hidden subsection links, short screens, header sizing, responsive images, and browser CI](reviews/2026-11-13-trip-layout-quality-review.md) |
| 2026-11-13 | [Pins zoom quality review: unreachable measurements, stale badge positions, marker input, camera limits, and gallery references](reviews/2026-11-13-pins-zoom-quality-review.md) |
| 2026-11-13 | [Pins zoom transitions: staged county detail, native fades, bounded geometry tasks, and source update budgets](reviews/2026-11-13-pins-zoom-transitions.md) |
| 2026-11-13 | [Pins navigation design: geographic parents, muted context, gesture handling, history, and touch layout](reviews/2026-11-13-pins-navigation-design.md) |
| 2026-11-13 | [Pins context review: publication snapshots, complete source inventories, validation, cache recovery, and documentation links](reviews/2026-11-13-pins-context-review.md) |
| 2026-11-13 | [Geospatial delivery research: S3, CloudFront, PMTiles prototypes, project comparisons, and migration priorities](reviews/2026-11-13-geospatial-delivery-research.md) |
| 2026-11-13 | [Pins review: publication guards, point-source readiness, hidden province outlines, hover behavior, and regression coverage](reviews/2026-11-13-pins-review.md) |
| 2026-11-13 | [Dependency update and audit: patched Node runtimes, npm and Python audits, globe compatibility, and Terraform](reviews/2026-11-13-dependency-audit.md) |
| 2026-11-12 | [Global Pins expansion: source research, province coverage, calculation checks, lazy data, and implementation](reviews/2026-11-12-pins-world-expansion.md) |
| 2026-11-12 | [Pins quality review: invalid geometry, publication contracts, map recovery, source checks, tests, and coverage](reviews/2026-11-12-pins-quality-review.md) |
| 2026-11-10 | [Project quality review: confirmed defects, regression tests, coverage, documentation, and remaining work](reviews/2026-11-10-project-quality-review.md) |
| 2026-11-10 | [Project audit implementation: article preloads, navigation, temperature recovery, accessibility, telemetry, and browser CI](reviews/2026-11-10-project-improvements.md) |
| 2026-11-10 | [Project audit: measured article preload, navigation, map recovery, accessibility, performance instrumentation, and ranked quick wins](reviews/2026-11-10-project-audit.md) |
| 2026-11-09 | [Next-task code review: data integrity, county cache validation, background deadlines, state selection, and coverage](reviews/2026-11-09-next-tasks-quality-review.md) |
| 2026-11-09 | [Next-task implementation: temperature cutoff, Tornado recovery and accessibility, full-sync staging, threshold evidence, and infrastructure inspection](reviews/2026-11-09-next-tasks.md) |
| 2026-11-09 | [Image delivery quality review: request recovery, empty publication, preload ownership, source validation, and coverage](reviews/2026-11-09-image-delivery-quality-review.md) |
| 2026-11-09 | [Prefetch quality review: data priority, metadata validation, lazy retry, CSS security attributes, and coverage](reviews/2026-11-09-intent-prefetch-quality-review.md) |
| 2026-11-09 | [Intent prefetch implementation: hover/focus preparation, failure recovery, resource limits, and measured navigation](reviews/2026-11-09-intent-prefetch-implementation.md) |
| 2026-11-09 | [Intent prefetch research and implementation plan: shared loaders, resource limits, failure recovery, and measurement](reviews/2026-11-09-intent-prefetch-plan.md) |
| 2026-11-06 | [Flights Lighthouse verification, review fixes, accessibility, caching, and coverage](reviews/2026-11-06-flights-lighthouse.md) |
| 2026-11-05 | [Pending changes quality review: archive safety, validation proofs, failure coverage, and source limits](reviews/2026-11-05-uncommitted-quality-review.md) |
| 2026-11-05 | [Monthly data correctness, page recovery, release validation, Flights startup, and bounded caching](reviews/2026-11-05-correctness-recovery-startup.md) |
| 2026-11-05 | [Tornado publication repair: missing index, deployment order, and workflow verification](reviews/2026-11-05-tornado-publication-repair.md) |
| 2026-11-05 | [Pending changes: aggregate validation, independent chart recovery, release checks, and coverage](reviews/2026-11-05-pending-changes-quality-review.md) |
| 2026-11-05 | [Responsiveness implementation: tornado aggregates, globe rendering, homepage delivery, and measured comparisons](reviews/2026-11-05-responsiveness-improvements.md) |
| 2026-11-05 | [Flights responsiveness research: callback identity, retained geometry, label churn, and rendering cost](reviews/2026-11-05-flight-responsiveness-research.md) |
| 2026-11-05 | [Project analysis: monthly-record correctness, page recovery, tornado loading, and validation](reviews/2026-11-05-project-analysis.md) |
| 2026-11-05 | [Data pipeline analysis: monthly thresholds and historical analysis windows](reviews/2026-11-05-data-pipeline-analysis.md) |
| 2026-11-04 | [Flight duration tests: filter exclusions, delayed data, and startup regression coverage](reviews/2026-11-04-flight-duration-test-review.md) |
| 2026-11-04 | [Trip preview activation: pending input, module timing, dismissal, and coverage](reviews/2026-11-04-trip-preview-activation-review.md) |
| 2026-11-04 | [Metadata review: preview publication state, fixture resource delivery, and regression coverage](reviews/2026-11-04-metadata-standards-quality-review.md) |
| 2026-11-04 | [Web discovery standards: browser identity, JSON Feed, profile links, preview controls, and deferred protocols](reviews/2026-11-04-web-discovery-standards-research.md) |
| 2026-11-04 | [Temperature snapshots: fixture isolation, native context behavior, and browser coverage](reviews/2026-11-04-temperature-snapshot-review.md) |
| 2026-11-04 | [Temperature startup: worker URL formats, error diagnostics, and regression coverage](reviews/2026-11-04-temperature-startup-review.md) |
| 2026-11-04 | [Basemap startup review: module delays, readiness guarantees, and configured keys](reviews/2026-11-04-basemap-startup-review.md) |
| 2026-11-04 | [Temperature sync: response validation, cache rejection, archive replacement, and coverage](reviews/2026-11-04-temperature-sync-review.md) |
| 2026-11-03 | [Flight years and article previews: image selection, URL resolution, validation, and coverage](reviews/2026-11-03-flight-years-and-preview-review.md) |
| 2026-11-03 | [Temperature publication review: usable observations, calendar validation, camera framing, and focus restoration](reviews/2026-11-03-temperature-publication-review.md) |
| 2026-11-03 | [Temperature map review: marker selection, late data, units, popup escaping, and coverage](reviews/2026-11-03-temperature-map-quality-review.md) |
| 2026-11-03 | [Flight display review: partial totals, shared presentation rules, and coverage](reviews/2026-11-03-flight-display-quality-review.md) |
| 2026-11-03 | [Shared module review: airport input fixes, contract tests, and coverage](reviews/2026-11-03-shared-library-quality-review.md) |
| 2026-11-03 | [Shared library consolidation: duplication, extraction candidates, and starting points](reviews/2026-11-03-shared-library-analysis.md) |
| 2026-11-03 | [Basemap timeouts, camera startup, attribution, and regression coverage](reviews/2026-11-03-basemap-ci-quality-review.md) |
| 2026-11-03 | [Flight camera CI review, renderer assertions, and callback cleanup](reviews/2026-11-03-flight-camera-ci-review.md) |
| 2026-11-02 | [Flight time display: touch coverage, time-record provenance, and regression tests](reviews/2026-11-02-flight-time-display-quality-review.md) |
| 2026-11-02 | [CI content fixtures, browser-key fallback, and publication regression coverage](reviews/2026-11-02-ci-build-quality-review.md) |
| 2026-11-02 | [Flight statistics: filtered visits, URL ordering, accessible time, and ingestion checks](reviews/2026-11-02-flight-statistics-quality-review.md) |
| 2026-11-02 | [Flight map review: camera races, texture recovery, coverage, and animation performance](reviews/2026-11-02-flight-map-recovery-and-performance.md) |
| 2026-11-02 | [Flight map structure, camera lifecycle, and renderer regression checks](reviews/2026-11-02-flights-map-refactor.md) |
| 2026-11-02 | [Flight durations, basemaps, server ownership, and regression coverage](reviews/2026-11-02-flights-and-basemaps-quality-review.md) |
| 2026-11-02 | [Flight duration sources, data audit, and application integration proposal](reviews/2026-11-02-flight-duration-research.md) |
| 2026-11-02 | [Pending changes: HTML routes, crawler directives, hosting rewrites, and trip content](reviews/2026-11-02-pending-changes-quality-review.md) |
| 2026-11-02 | [Site JSON-LD, crawler metadata, social cards, and discovery coverage](reviews/2026-11-02-site-metadata.md) |
| 2026-11-02 | [Atlas overview timeouts, control targets, and regression coverage](reviews/2026-11-02-atlas-overview-quality-review.md) |
| 2026-11-01 | [Pending changes, route hit tests, photo fingerprints, and coverage review](reviews/2026-11-01-pending-changes-quality-review.md) |
| 2026-11-01 | [ADV Atlas main merge review and final regression checks](reviews/2026-11-01-atlas-main-merge-review.md) |
| 2026-11-01 | [Atlas geography, keyboard focus, and shared-date review](reviews/2026-11-01-atlas-geography-quality-review.md) |
| 2026-11-01 | [Atlas controls, sorting, content, and regression review](reviews/2026-11-01-atlas-controls-quality-review.md) |
| 2026-11-01 | [Atlas day styling research and visual comparison](reviews/2026-11-01-atlas-day-styling-research.md) |
| 2026-10-31 | [ADV Atlas drawer, filter, sort, and comparison research](reviews/2026-10-31-adv-atlas-browsing-research.md) |
| 2026-10-31 | [Blog refresh, trip photo audit, and recovered July 17 route](reviews/2026-10-31-blog-and-trip-asset-refresh.md) |
| 2026-10-31 | [Minimatch security fix and lint compatibility](reviews/2026-10-31-minimatch-security-fix.md) |
| 2026-10-31 | [ADV Atlas critical review, pending fits, and keyboard focus](reviews/2026-10-31-adv-atlas-critical-review.md) |
| 2026-10-31 | [ADV Atlas merge fixes and dependency update](reviews/2026-10-31-adv-atlas-merge-fixes.md) |
| 2026-10-31 | [ADV Atlas pre-merge review and research](reviews/2026-10-31-adv-atlas-merge-research.md) |
| 2026-10-31 | [Trip content, native fullscreen recovery, and regression review](reviews/2026-10-31-trip-content-and-recovery-review.md) |
| 2026-10-31 | [ADV Atlas multipart trip identity and chapter navigation research](reviews/2026-10-31-adv-atlas-multipart-trips-research.md) |
| 2026-10-30 | [Trip content, atlas navigation, fullscreen recovery, and dependency review](reviews/2026-10-30-trip-content-and-atlas-review.md) |
| 2026-10-30 | [ADV Atlas session restoration and regression review](reviews/2026-10-30-adv-atlas-session-review.md) |
| 2026-10-30 | [ADV Atlas quality review, camera recovery, and publication fixes](reviews/2026-10-30-adv-atlas-quality-review.md) |
| 2026-10-30 | [ADV Atlas research and implementation plan](reviews/2026-10-30-adv-atlas-research.md) |
| 2026-10-30 | [Trip CI quality review and delayed-raster recovery](reviews/2026-10-30-trip-ci-quality-review.md) |
| 2026-10-29 | [PCH content review and regression coverage](reviews/2026-10-29-pch-content-review.md) |
| 2026-10-29 | [Trip media, browser validation, and map recovery review](reviews/2026-10-29-trip-media-and-recovery.md) |
| 2026-10-29 | [Trip editorial cleanup and photo quality review](reviews/2026-10-29-trip-editorial-quality-review.md) |
| 2026-10-29 | [Trip editorial findings and source corrections](reviews/2026-10-29-trip-editorial-review.md) |
| 2026-10-29 | [Adaptive gallery quality review and regression fixes](reviews/2026-10-29-adaptive-gallery-quality-review.md) |
| 2026-10-29 | [Adaptive trip gallery research](reviews/2026-10-29-adaptive-trip-galleries-research.md) |
| 2026-10-29 | [Post filters and trip presentation review](reviews/2026-10-29-post-filters-and-trip-presentation.md) |
| 2026-10-29 | [Pending-change quality review](reviews/2026-10-29-pending-changes-quality-review.md) |
| 2026-10-29 | [Tornado Tracks implementation review](reviews/2026-10-29-tornado-tracks-quality-review.md) |
| 2026-10-28 | [Trip CI fixes and regression review](reviews/2026-10-28-trip-ci-review.md) |
| 2026-10-28 | [Trip controls, geography, and regression review](reviews/2026-10-28-trip-controls-and-geography.md) |
| 2026-10-28 | [Trip state ownership and recovery review](reviews/2026-10-28-trip-state-and-recovery.md) |
| 2026-10-27 | [Panorama review and photo failure fixes](reviews/2026-10-27-trip-photo-review.md) |
| 2026-10-27 | [Trip photo panorama research](reviews/2026-10-27-trip-photo-panorama-research.md) |
| 2026-10-27 | [Trip map interaction review](reviews/2026-10-27-trip-map-interaction-review.md) |
| 2026-10-27 | [Trip map review and regression fixes](reviews/2026-10-27-trip-map-review.md) |
| 2026-10-27 | [Trip day map research](reviews/2026-10-27-trip-day-map-research.md) |
| 2026-10-25 | [CI and failure-path review](reviews/2026-10-25-ci-and-failure-paths.md) |
| 2026-10-24 | [Critical review and regression fixes](reviews/2026-10-24-critical-review.md) |
| 2026-10-24 | [Live performance and build follow-up](reviews/2026-10-24-performance-follow-up.md) |
| 2026-10-24 | [Repository quality, performance, and security audit](reviews/2026-10-24-repository-audit.md) |
| 2026-10-20 | [Project changelog review](reviews/2026-10-20-project-changelogs.md) |
| 2026-10-20 | [Recent changes and mail DNS review](reviews/2026-10-20-recent-changes-and-mail-dns.md) |
| 2026-10-08 | [Trip map selection review](reviews/2026-10-08-trip-map-selection.md) |
| 2026-10-07 | [Trip browser budget review](reviews/2026-10-07-trip-browser-budget.md) |
| 2026-10-07 | [Dashboard and dependency review](reviews/2026-10-07-dashboard-and-dependencies.md) |
| 2026-10-01 | [Trip registry and manifest review](reviews/2026-10-01-trip-registry-and-manifests.md) |
| 2026-10-01 | [Gallery and flight data review](reviews/2026-10-01-gallery-and-flight-data.md) |
| 2026-10-01 | [Trip assets, galleries, and follow-up review](reviews/2026-10-01-trip-assets-and-galleries.md#follow-up-review) |
| 2026-10-01 | [Pending changes review](reviews/2026-10-01-pending-changes.md) |
| 2026-10-01 | [Trip implementation](reviews/2026-10-01-trip-report-implementation.md) |
| 2026-10-01 | [Initial trip audit](reviews/2026-10-01-trip-report-audit.md) |
| 2026-09-30 | [Post rendering](reviews/2026-09-30-post-rendering.md) |
