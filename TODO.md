# Open work

This file lists incomplete work. Keep completed tasks in Git history.
Use the [review index](docs/README.md) for dated evidence and test results.
Use the [trip authoring guide](docs/trips/TRIP-AUTHORING-README.md#6-publish-assets) for recurring photo checks and asset publication steps.

## Next release checks

Do these checks after the reviewed changes reach a hosted preview or production.
Local browser tests cannot verify the analytics account or physical devices.

- [ ] Verify Web Vitals in the Umami Performance view after deployment. Record the build revision and observation period.
- [ ] Verify one `map-ready` event for each map visit. Check startup failure, runtime failure, and phase-specific recovery. Confirm that events exclude query values.
- [ ] Verify the `rsmb-tv` tag, project and map events, caught error reports, and privacy preferences in Umami. Create the goals and funnel in the [analytics guide](docs/umami-analytics.md).
- [ ] Test navigation and map controls with VoiceOver or NVDA. Include hover dismissal, route announcements, help dismissal, and disabled character shortcuts.

## Content publication

Complete these checks before publishing the affected story.

### PCH 2024

- [ ] Complete the [PCH publication checks](docs/trips/pch-2024-galleries.md#publication-checks).

### Route 66ish 2025

- [ ] Write the report from the [starter outline](docs/trips/route-66ish-2025-outline.md). Check the May 9–19 window against the recorded May 17 arrival.
- [ ] Complete the [Route 66ish publication checks](docs/trips/route-66ish-2025-galleries.md#publication-checks).

### Mississippi–Wisconsin 2025 and ON–QC–New England 2026

- [ ] Complete the [starter outlines](docs/trips/TRIP-SOURCE-INVENTORY.md). Confirm dates, motorcycle, stops, and report boundaries.
- [ ] Complete the Mississippi–Wisconsin source description. Complete the 2026 descriptions and series columns. Sheet row 7 links its source Doc.
- [ ] Confirm photo membership for Mississippi–Wisconsin. Expand the 2026 photo collection beyond its temporary July 17 hero.
- [ ] Apply the current 2026 outlines to the source Docs. Replace stale `.json.draft` notes. Add the recovered July 17 map and gallery.
- [ ] Confirm GPS mileage and riding-day estimates. Account for route gaps, alternate exports, and travel modes.

### Cycling a Third of St. Louis

- [ ] Complete the date and description in Sheet row 12. Make its source Doc export accessible. The import returns HTTP 401.

## Published story checks

### Ocean Shores

- [ ] Confirm the travel dates against the [photo and GPS evidence](docs/reviews/2026-10-31-blog-and-trip-asset-refresh.md#source-date-conflict). Photo EXIF spans February 16–19. The manifest uses February 17–20.

### Kalaloch

The manifest's 76 external asset URLs returned HTTP 200 on October 31, 2026.
Source accuracy still needs review.

- [ ] Compare each photo with its source. Verify alt text, dates, and gallery order.
- [ ] Verify track dates against source records. Some filenames contain dates outside the stated trip period.
- [ ] Verify the reported 450 miles, three riding days, and stop locations.

### Source corrections

Use the [editorial review](docs/reviews/2026-10-29-trip-editorial-review.md) for exact passages and source ownership.

- [ ] Correct the definite copy errors in the three source Google Docs. Qualify the ferry boarding claims.
- [ ] Explain the reconstructed Boise route sections and approximate distances in the source story.
- [ ] Reconcile Boise's Panther Creek overnight route boundary with the campground stop. Confirm the Nampa stop location.
- [ ] Confirm the mountain range in Boise's barn photo before changing its identification.

## Temperature data

### Operational checks

- [ ] Approve a correction and refresh policy for the twelve legacy daily thresholds. Use the [November 9 comparison](docs/performance/2026-11-09-temperature-threshold-check.json) as evidence. Preserve raw observations and legacy `rh` and `rl` until approval.

### Historical signal publication

The historical signal is not ready for publication.
The operational map's standing-record history is a separate dataset.
Its November 9 snapshot already includes all calendar years from 1890 through 2026.

- [ ] Build an ACIS extraction command that can continue after an interruption. Retain raw responses and request manifests.
- [ ] Verify ACIS flags and certification fields against current RCC documentation.
- [ ] Complete the [publication checks](projects/temperature-records/methodology.md#validate-before-publication).
- [ ] Store an approved station cohort with a version number.
- [ ] Publish station coverage, failed geography requests, and data quality in a manifest with a version number.

## Pins of Inaccessibility

Use the [Pins guide](projects/pins-of-inaccessibility/readme.md) for generation and regression tests.
Use the [zoom quality review](docs/reviews/2026-11-13-pins-zoom-quality-review.md) for current defects, fixes, and measurement limits.
Use the [review index](docs/README.md#reviews) for source, context, and navigation history.

### Source and calculation

- [ ] Compare large and irregular jurisdictions with an independent geodesic search. Measure tolerance sensitivity and near-equal radius rankings.
- [ ] Evaluate current national boundary providers for global countries that need more detail. Check license, dates, water treatment, and source IDs.
- [ ] Assess Antarctic boundary definitions and polar calculation coverage before adding its pins to the globe.

### Hosted release

- [ ] Check the hosted map with the configured CARTO key. Verify origin restrictions, attribution, and every territory shortcut.
- [ ] Verify context loading and retry from the deployed origin. Check CORS headers and recovery after a context release change.

### Data delivery and refresh

- [ ] Compare tiled boundary delivery with the current GeoJSON files. Use the [delivery research](docs/reviews/2026-11-13-geospatial-delivery-research.md) and retain numeric pin indexes for search.
- [ ] Set a refresh schedule for GeoNames and terrain data. Record the selected source dates before each context release.

Track phone measurements in [Physical devices](#physical-devices).

## Browser and performance checks

Use fixed data. Record the browser, viewport, and expected result.
Keep the current reading budgets. Include WebKit in trip checks.
See the [browser setup](README.md#testing-notes).
Use the [laboratory report](docs/reviews/2026-10-24-performance-follow-up.md) as the measurement baseline.
The [live prefetch check](docs/reviews/2026-11-09-live-release-verification.md) records the production comparison from November 9.
Use the [November 10 review](docs/reviews/2026-11-10-project-quality-review.md) for measurement scope and known limits.

### Physical devices

- [ ] Check [trip reading](docs/reviews/2026-11-13-trip-layout-quality-review.md#remaining-checks) on a real phone. Include large text, chapter changes, subsection links, and rotation.
- [ ] Check the flight globe, ADV Atlas, and Pins on a real phone. Record LCP, CLS, INP, cold transfer, and startup. Verify [atlas navigation and recovery](docs/trips/ADV-ATLAS.md).
- [ ] Measure Pins parsing time, peak memory, and input delay on a real phone.
  Compare the U.S. index, county outlines, world overview, and province outlines.
  Compare first-use and cached circle preparation during zoom gestures.
  Check the dot, boundary, circle, name, and distance stages.
  Check parent navigation, slow double taps, rotation, and context markers.
  Verify that world navigation preserves the center and does not zoom in.
  Verify small-pin measurements at zoom 16.
  Record the device, browser, data files, and measurements in one report.
- [ ] Compare prefetch modes `off`, `pages`, and `all` where input supports intent. Include clicks during module evaluation and after a longer hover. Use the [startup evidence](docs/reviews/2026-11-09-live-release-verification.md#prepared-globe-input) as the baseline.
- [ ] Review the compressed project previews and trip thumbnails on a real phone at standard and high pixel density. Check fine map detail and photo quality. See [image delivery](docs/image-assets.md#checks).

### Automated checks

- [ ] Test list scroll restoration with content delayed for more than three seconds. Check browser Back and the article return link.
- [ ] Extend fixed-tile checks to cover stop selection and all three map styles.
- [ ] Reproduce the intermittent flight-control failures. Confirm the cause, then add regressions. See the [unresolved failure report](docs/reviews/2026-11-04-flight-duration-test-review.md#intermittent-controls-failures).

## Tornado Tracks

- [ ] Publish source coverage dates and omitted-coordinate counts separately from upload timestamps.
- [ ] Separate renderer lifecycle and trend presentation. Preserve interaction coverage.

## Infrastructure

- [ ] Deploy the two remaining [sync OIDC roles](docs/github-actions-oidc.md). Set the role variables. Verify both sync workflows before removing legacy sync credentials.
- [ ] Verify [Gmail signing and external delivery](docs/email-dns.md#enable-and-verify-signing) with the configured Google Admin account.

## Dashboard checks

Use fixed provider responses. Do not contact production services from unit tests.

- [ ] Test build fetchers with throttled, failed, empty, and malformed responses. Verify the displayed status and error.
- [ ] Test cost cache reads, writes, provider failures, and month-end forecasts. Use fixed UTC dates.
- [ ] Test event log rendering, its size limit, and removal. Verify that unmounted subscribers receive no updates.

## Build and maintenance

Preserve passing publication checks when changing build scripts.

- [ ] Remove scoped minimatch overrides when all three upstream consumers declare a patched compatible range. Run the [compatibility checks](README.md#lint-security-override).
- [ ] Extract the remaining temperature-map rendering, interaction, and loading code. Preserve browser behavior and URL contracts. Track tornado-map work in its own section above.
- [ ] Reduce MapLibre loading and worker costs. Preserve the article JavaScript budgets.
- [ ] Split document conversion, shortcode handling, and publication checks in `scripts/sync-blogs.js`. Retain compilation tests.
- [ ] Replace the TypeScript 6 lint compiler after `typescript-eslint` supports TypeScript 7. Run lint and typecheck first.

## Project content

- [ ] Add screenshots to the Aborg project page.
- [ ] Publish more blog posts from the configured Google documents.

## Ride Ledger prerequisites

- [ ] Resolve the [open decisions](projects/ride-ledger/readme.md#open-decisions).
- [ ] Create at least 20 synthetic import fixtures without personal data. Add the expected output to each fixture.
- [ ] Compare fixture totals with an independent calculation.
- [ ] Write a threat model for identity, local data, synchronization, attachments, export, and account deletion.
