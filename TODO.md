# Open work

This file contains incomplete work. Use Git history for completed work.
Complete publication blockers before you publish the affected content.
Use the [review index](docs/README.md) for dated findings and test results.
Work through publication blockers first. Then complete automated checks, maintenance, and content tasks.
Keep completed work in Git history. Do not add completed tasks to this file.

## Publication blockers

### Boise trip

The manifest supports local preview. The public route and hero photo returned HTTP 403 on 2026-10-01.

- [ ] Review all 82 Boise photos and captions. Check each new photo against its source and recorded date.
- [ ] Publish the processed Boise photos and route files. Check every image size and route URL for HTTP 200.
- [ ] Verify the recorded track dates. The source filenames do not agree with all dates in the story.
- [ ] Find the source track from Panther Creek to Seattle. Add its manifest reference only after route preparation includes that track.
- [ ] Replace the unknown distances and repeated day numbers in the Google Doc.
- [ ] Verify the reported 1,516 miles, six riding days, stops, and photo captions before publication.
- [ ] Identify reconstructed tracks in public content before publication. Keep the current manifest names until the content review.
- [ ] Compare the story references with the renamed `camp-1` and `camp-2` stops.
- [ ] Keep the Sheet `published` value `false` until the publication checks pass.

### Kalaloch trip

The manifest supports local preview. The public route and hero photo returned HTTP 403 on 2026-10-01.

- [ ] Review all 20 photos against their sources. Verify the alt text, dates, and gallery order.
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
- [ ] Install the required WebKit host libraries. Run the trip budget, photo viewer, and interactive map checks. Retain the current budgets. Check all three map styles.
- [ ] Test list scroll restoration with browser Back and the article return link after delayed content loads.
- [ ] Extend the fixed-tile browser test. Check route pixels, stop selection, and each map style.

## Dashboard checks

Use fixed provider responses. Do not contact production services from unit tests.

- [ ] Test build fetchers with throttled, failed, empty, and malformed provider responses. Verify the displayed status and error.
- [ ] Test cost cache reads and writes, provider failures, and month-end forecasts. Use fixed UTC dates.
- [ ] Test event log rendering, its size limit, and log removal. Verify that unmounted subscribers receive no updates.

## Build and maintenance

Preserve passing publication checks when you change build scripts.

- [ ] Reduce the large visualization chunks. Preserve the passing article JavaScript budgets.
- [ ] Check Tailwind source-map output. Confirm that production error locations match source files.
- [ ] Split document conversion, shortcode handling, and publication checks in `scripts/sync-blogs.js`. Retain the compilation tests.
- [ ] Replace the TypeScript 6 lint compiler only after `typescript-eslint` supports TypeScript 7. Run lint and typecheck first.

## Trip release tasks

Complete these tasks after the affected trip passes its source review.

- [ ] Review and apply the Amplify article rewrite rules. Check delivered article metadata on the production host.
- [ ] For each new trip, review its processed photos and use versioned filenames. Upload the assets before site deployment.
- [ ] Measure LCP, CLS, and INP under fixed test conditions. Set limits from those measurements.
- [ ] Remove inactive map instances when their sections are far outside the viewport. Retain the route preview and selected stop.

## Project content

- [ ] Add screenshots to the Aborg project page.
- [ ] Add screenshots to the Flights project page.
- [ ] Publish more blog posts from the configured Google documents.

## Ride Ledger prerequisites

- [ ] Resolve the [open decisions](projects/ride-ledger/readme.md#open-decisions).
- [ ] Create at least 20 synthetic import fixtures with no personal data. Add the expected output to each fixture.
- [ ] Compare fixture totals with an independent calculation.
- [ ] Write a threat model for identity, local data, synchronization, attachments, export, and account deletion.
