# Open work

This file lists incomplete work. Keep completed tasks in Git history.
Complete publication blockers before you publish the affected content.
Use the [review index](docs/README.md) for dated findings and test results.

## Publication blockers

### Kalaloch trip

The manifest supports local preview. The public route and hero photo returned HTTP 403 on 2026-10-01.

- [ ] Review each photo against its source. Verify the alt text, dates, and gallery order.
- [ ] Publish the processed photos and route files. Check every image size and route URL for HTTP 200.
- [ ] Verify the track dates against source records. The filenames include dates outside the stated trip period.
- [ ] Verify the reported 450 miles, three riding days, and stop locations against source records.
- [ ] Keep the Sheet `published` value `false` until the publication checks pass.

### Temperature record data

The historical signal is not ready for publication.

- [ ] Build an ACIS extraction command that can continue after an interruption. Retain raw responses and request manifests.
- [ ] Verify ACIS flags and certification fields against current RCC documentation.
- [ ] Regenerate `climateTrends.json`. Include a zero-count row for each calendar year.
- [ ] Complete the [publication checks](projects/temperature-records/methodology.md#validate-before-publication).
- [ ] Store an approved station cohort with a version number before publication.
- [ ] Publish station coverage, failed geography requests, and data quality in a manifest with a version number.

## Browser checks

Use fixed data for browser checks. Record the browser, viewport, and expected result.

- [ ] Test Flights map keyboard controls and camera URL synchronization with Playwright.
- [ ] Test list scroll restoration with browser Back and the article return link after delayed content loads.
- [ ] Extend fixed-tile browser checks to verify stop marker selection and all three map styles.
- [ ] Reproduce the [WebKit map failures](docs/reviews/2026-10-27-trip-photo-review.md#browser-run-limits), including missing stop markers after clicks with normal motion. Use retained CI traces and graphics diagnostics.

Run trip browser checks with WebKit enabled. Include JavaScript budgets, photo viewers, and delayed map loading.
Keep the current budgets. See the [repository guide](README.md#testing-notes) for browser setup.

## Tornado Tracks

- [ ] Generate yearly state and scale aggregates. Filtered Trends must work without downloading the complete historical geometry.
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

- [ ] Deploy the [prepared OIDC roles](docs/github-actions-oidc.md). Set the role variables and verify both workflows before removing legacy credentials.
- [ ] Extract the remaining map rendering, interaction, and loading code. Preserve browser behavior and URL contracts.
- [ ] Reduce MapLibre loading and worker costs. Preserve the passing article JavaScript budgets.
- [ ] Profile Flights pause/play latency under mobile throttling. Add a representative interaction budget.
- [ ] Split document conversion, shortcode handling, and publication checks in `scripts/sync-blogs.js`. Retain the compilation tests.
- [ ] Replace the TypeScript 6 lint compiler only after `typescript-eslint` supports TypeScript 7. Run lint and typecheck first.

## Trip release tasks

Complete these tasks after the affected trip passes its source review.

- [ ] For each new trip, review its processed photos and use versioned filenames. Upload the assets before site deployment.
- [ ] Collect real-device LCP, CLS, and INP measurements. Use the [laboratory report](docs/reviews/2026-10-24-performance-follow-up.md) as a baseline.

## Project content

- [ ] Add screenshots to the Aborg project page.
- [ ] Add screenshots to the Flights project page.
- [ ] Publish more blog posts from the configured Google documents.

## Ride Ledger prerequisites

- [ ] Resolve the [open decisions](projects/ride-ledger/readme.md#open-decisions).
- [ ] Create at least 20 synthetic import fixtures with no personal data. Add the expected output to each fixture.
- [ ] Compare fixture totals with an independent calculation.
- [ ] Write a threat model for identity, local data, synchronization, attachments, export, and account deletion.
