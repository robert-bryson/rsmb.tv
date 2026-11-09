# Open work

This file lists incomplete work. Keep completed tasks in Git history.
Use the [review index](docs/README.md) for dated evidence and test results.
Use the [trip authoring guide](docs/trips/TRIP-AUTHORING-README.md#6-publish-assets) for recurring photo checks and asset publication steps.

## Content publication

Complete these checks before publishing the affected story.

### PCH 2024

- [ ] Complete the [PCH publication checks](docs/trips/pch-2024-galleries.md#publication-checks).

### Route 66ish 2025

- [ ] Write the report from the [starter outline](docs/trips/route-66ish-2025-outline.md). Check the May 9–19 window against the recorded May 17 arrival.
- [ ] Complete the [Route 66ish publication checks](docs/trips/route-66ish-2025-galleries.md#publication-checks).

### Mississippi–Wisconsin 2025 and ON–QC–New England 2026

- [ ] Continue the [starter outlines](docs/trips/TRIP-SOURCE-INVENTORY.md). Confirm dates, motorcycle, stops, and report boundaries.
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

- [ ] Investigate the twelve legacy threshold disagreements in the [backfill audit](docs/performance/2026-11-05-temperature-full-backfill.json). Preserve raw observations and legacy `rh` and `rl` until a correction policy is approved.
- [ ] Run a full temperature sync after deployment. Verify California and every per-date state count. See [freshness and coverage](docs/temperature-map.md#freshness-and-coverage).

### Historical signal publication

The historical signal is not ready for publication.

- [ ] Build an ACIS extraction command that can continue after an interruption. Retain raw responses and request manifests.
- [ ] Verify ACIS flags and certification fields against current RCC documentation.
- [ ] Regenerate `climateTrends.json`. Include a zero-count row for each calendar year.
- [ ] Complete the [publication checks](projects/temperature-records/methodology.md#validate-before-publication).
- [ ] Store an approved station cohort with a version number.
- [ ] Bound historical `events.csv` to `--analysis-end`. Add the [CLI regression](docs/reviews/2026-11-05-data-pipeline-analysis.md#2-p2--the-offline-estimator-writes-events-after---analysis-end).
- [ ] Publish station coverage, failed geography requests, and data quality in a manifest with a version number.

## Browser and performance checks

Use fixed data. Record the browser, viewport, and expected result.
Keep the current reading budgets. Include WebKit in trip checks.
See the [browser setup](README.md#testing-notes).
Use the [laboratory report](docs/reviews/2026-10-24-performance-follow-up.md) as the measurement baseline.
The [live prefetch check](docs/reviews/2026-11-09-live-release-verification.md) records the current production comparison. Physical-phone checks remain open.

### Physical devices

- [ ] Check reading, the flight globe, and ADV Atlas on a real phone. Record LCP, CLS, INP, cold transfer, and startup. Verify [atlas navigation and recovery](docs/trips/ADV-ATLAS.md).
- [ ] Compare prefetch modes `off`, `pages`, and `all` where input supports intent. Include clicks during module evaluation and after a longer hover. Use the [startup evidence](docs/reviews/2026-11-09-live-release-verification.md#prepared-globe-input) as the baseline.
- [ ] Review the compressed project previews and trip thumbnails on a real phone at standard and high pixel density. Check fine map detail and photo quality. See [image delivery](docs/image-assets.md#checks).

### Automated checks

- [ ] Test list scroll restoration after delayed content loads. Check browser Back and the article return link.
- [ ] Extend fixed-tile checks to cover stop selection and all three map styles.
- [ ] Reproduce the intermittent flight-control failures. Add regressions for the [confirmed cause](docs/reviews/2026-11-04-flight-duration-test-review.md#intermittent-controls-failures).

## Tornado Tracks

- [ ] Publish source coverage dates and omitted-coordinate counts separately from upload timestamps.
- [ ] Add recovery for failed basemap requests. Check the degraded view and Retry with fixed responses.
- [ ] Add keyboard-accessible state selection, chart data tables, and a clear zero-results action.
- [ ] Separate renderer lifecycle and trend presentation. Preserve interaction coverage.

## Infrastructure

- [ ] Deploy the two remaining [sync OIDC roles](docs/github-actions-oidc.md). Set the role variables. Verify both sync workflows before removing legacy sync credentials.
- [ ] Confirm [mail record ownership](docs/email-dns.md#adopt-existing-records) in remote Terraform state before applying DNS changes.
- [ ] Verify [Gmail signing and external delivery](docs/email-dns.md#enable-and-verify-signing) with the configured Google Admin account.

## Dashboard checks

Use fixed provider responses. Do not contact production services from unit tests.

- [ ] Test build fetchers with throttled, failed, empty, and malformed responses. Verify the displayed status and error.
- [ ] Test cost cache reads, writes, provider failures, and month-end forecasts. Use fixed UTC dates.
- [ ] Test event log rendering, its size limit, and removal. Verify that unmounted subscribers receive no updates.

## Build and maintenance

Preserve passing publication checks when changing build scripts.

- [ ] Remove scoped minimatch overrides when all three upstream consumers declare a patched compatible range. Run the [compatibility checks](README.md#lint-security-override).
- [ ] Extract the remaining map rendering, interaction, and loading code. Preserve browser behavior and URL contracts.
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
