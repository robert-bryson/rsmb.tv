# Open work

This file lists incomplete work. Keep completed tasks in Git history.
Complete publication blockers before you publish the affected content.
Use the [review index](docs/README.md) for dated findings and test results.

## Publication blockers

### Ocean Shores trip

- [ ] Confirm the travel dates against the [photo and GPS evidence](docs/reviews/2026-10-31-blog-and-trip-asset-refresh.md#source-date-conflict). Photo EXIF spans February 16–19; the manifest uses February 17–20.

### PCH 2024 trip

- [ ] Complete the [PCH publication checks](docs/trips/pch-2024-galleries.md#publication-checks) before publishing the story.

### Route 66ish 2025 trip

- [ ] Write the report using the [starter outline](docs/trips/route-66ish-2025-outline.md). Confirm the May 9–19 window against the May 17 recorded arrival.
- [ ] Complete the [Route 66ish publication checks](docs/trips/route-66ish-2025-galleries.md#publication-checks) before publishing the story.

### Mississippi–Wisconsin 2025 and ON–QC–New England 2026

- [ ] Continue the [starter outlines](docs/trips/TRIP-SOURCE-INVENTORY.md). Confirm working dates, motorcycle, stops, and report boundaries while writing.
- [ ] Complete the Mississippi–Wisconsin source description and 2026 descriptions and series columns. Sheet row 7 now links its source Doc.
- [ ] Confirm Mississippi–Wisconsin photo membership. Expand the 2026 photo collection beyond its temporary July 17 hero.
- [ ] Apply the current 2026 outlines to the source Docs. Replace stale `.json.draft` notes and add the recovered July 17 map and gallery.
- [ ] Confirm provisional GPS mileage and riding-day estimates against route gaps, alternate exports, and travel modes.

### Cycling a Third of St. Louis

- [ ] Complete the date and description in Sheet row 12. Make its source Doc accessible through its export URL; import returns HTTP 401.

### Kalaloch trip

Kalaloch is published. All 76 external asset URLs in its manifest returned HTTP 200 on October 31, 2026.
The following source checks remain open.

- [ ] Review each photo against its source. Verify the alt text, dates, and gallery order.
- [ ] Verify the track dates against source records. The filenames include dates outside the stated trip period.
- [ ] Verify the reported 450 miles, three riding days, and stop locations against source records.

### Trip story sources

Use the [editorial review](docs/reviews/2026-10-29-trip-editorial-review.md) for exact passages and source ownership.
The duplicate photos, unused galleries, and stale heading IDs are corrected locally.

- [ ] Correct the definite copy errors in the three source Google Docs. Qualify the ferry boarding claims.
- [ ] Explain the reconstructed Boise route sections and their approximate distances in the source story.
- [ ] Reconcile Boise's Panther Creek overnight route boundary with the campground stop. Confirm the Nampa stop location.
- [ ] Confirm the mountain range in Boise's barn photo before changing its identification.

### Temperature record data

- [ ] Correct calendar-month thresholds and regenerate affected archives and recent summaries. Cover the [query semantics and backfill conditions](docs/reviews/2026-11-05-data-pipeline-analysis.md#recommended-work-and-acceptance-conditions).
- [ ] Run a full temperature sync after deployment. Verify California and all per-date state coverage. See [the map guide](docs/temperature-map.md#freshness-and-coverage).

The historical signal is not ready for publication.

- [ ] Build an ACIS extraction command that can continue after an interruption. Retain raw responses and request manifests.
- [ ] Verify ACIS flags and certification fields against current RCC documentation.
- [ ] Regenerate `climateTrends.json`. Include a zero-count row for each calendar year.
- [ ] Complete the [publication checks](projects/temperature-records/methodology.md#validate-before-publication).
- [ ] Store an approved station cohort with a version number before publication.
- [ ] Bound historical `events.csv` to `--analysis-end`. Add the [CLI regression](docs/reviews/2026-11-05-data-pipeline-analysis.md#2-p2--the-offline-estimator-writes-events-after---analysis-end).
- [ ] Publish station coverage, failed geography requests, and data quality in a manifest with a version number.

## ADV Atlas

- [ ] Check the atlas on a real phone. Measure cold-cache transfer and initialization. Verify the [current navigation and recovery behavior](docs/trips/ADV-ATLAS.md).

## Dependency security

- [ ] Remove the scoped minimatch overrides when all three upstream consumers declare a patched compatible range. Run the [compatibility checks](README.md#lint-security-override).

## Browser checks

Use fixed data for browser checks. Record the browser, viewport, and expected result.

- [ ] Test list scroll restoration with browser Back and the article return link after delayed content loads.
- [ ] Extend fixed-tile browser checks to verify stop marker selection and all three map styles.
- [ ] Reproduce the intermittent flight-control failures and add regressions for the [confirmed cause](docs/reviews/2026-11-04-flight-duration-test-review.md#intermittent-controls-failures).

Run trip browser checks with WebKit enabled. Include JavaScript budgets, photo viewers, and delayed map loading.
Keep the current budgets. See the [repository guide](README.md#testing-notes) for browser setup.

## Tornado Tracks

- [ ] Publish source coverage dates and omitted-coordinate counts separately from upload timestamps.
- [ ] Add recovery for failed basemap requests. Check the degraded view and Retry with fixed browser responses.
- [ ] Add keyboard-accessible state selection, chart data tables, and a clear zero-results action.
- [ ] Separate renderer lifecycle and trend presentation after preserving interaction coverage.

## Mail deployment checks

- [ ] Confirm [mail record ownership](docs/email-dns.md#adopt-existing-records) in remote Terraform state before applying DNS changes.
- [ ] Verify [Gmail signing and external delivery](docs/email-dns.md#enable-and-verify-signing) with the configured Google Admin account.

## Dashboard checks

Use fixed provider responses. Do not contact production services from unit tests.

- [ ] Test build fetchers with throttled, failed, empty, and malformed provider responses. Verify the displayed status and error.
- [ ] Test cost cache reads and writes, provider failures, and month-end forecasts. Use fixed UTC dates.
- [ ] Test event log rendering, its size limit, and log removal. Verify that unmounted subscribers receive no updates.

## Build and maintenance

Preserve passing publication checks when you change build scripts.

- [ ] Add recovery for failed page downloads. Preserve site navigation and verify [production chunk failures and document recovery](docs/reviews/2026-11-05-project-analysis.md#2-a-failed-lazy-import-cannot-recover-through-try-again).
- [ ] Deploy the [prepared OIDC roles](docs/github-actions-oidc.md). Set the role variables and verify both workflows before removing legacy credentials.
- [ ] Extract the remaining map rendering, interaction, and loading code. Preserve browser behavior and URL contracts.
- [ ] Reduce MapLibre loading and worker costs. Preserve the passing article JavaScript budgets.
- [ ] Split document conversion, shortcode handling, and publication checks in `scripts/sync-blogs.js`. Retain the compilation tests.
- [ ] Replace the TypeScript 6 lint compiler only after `typescript-eslint` supports TypeScript 7. Run lint and typecheck first.

## Trip release tasks

Complete these tasks after the affected trip passes its source review.

- [ ] For each new trip, review its processed photos and use versioned filenames. Upload the assets before site deployment.
- [ ] Collect real-device LCP, CLS, and INP measurements. Use the [laboratory report](docs/reviews/2026-10-24-performance-follow-up.md) as a baseline.

## Project content

- [ ] Add screenshots to the Aborg project page.
- [ ] Publish more blog posts from the configured Google documents.

## Ride Ledger prerequisites

- [ ] Resolve the [open decisions](projects/ride-ledger/readme.md#open-decisions).
- [ ] Create at least 20 synthetic import fixtures with no personal data. Add the expected output to each fixture.
- [ ] Compare fixture totals with an independent calculation.
- [ ] Write a threat model for identity, local data, synchronization, attachments, export, and account deletion.
