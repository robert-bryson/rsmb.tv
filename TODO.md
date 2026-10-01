# Open work

This file contains incomplete work. Use Git history for completed work.
Complete publication blockers before you publish the affected content.
Use the [review index](docs/README.md) for dated findings and test results.

## Publication blockers

### Boise trip

The manifest supports local preview. The public route and a sample photo returned HTTP 403 on 2026-09-30.

- [ ] Review all 81 Boise photos and captions. Check each new photo against its source and recorded date.
- [ ] Publish the processed Boise photos and route files. Check every image size and route URL for HTTP 200.
- [ ] Verify the recorded track dates. The source filenames do not agree with all dates in the story.
- [ ] Find the source track from Panther Creek to Seattle. Add its manifest reference only after route preparation includes that track.
- [ ] Replace the unknown distances and repeated day numbers in the Google Doc.
- [ ] Verify the reported 1,516 miles, six riding days, stops, and photo captions before publication.
- [ ] Identify reconstructed tracks in public content before publication. Keep the current manifest names until the content review.
- [ ] Compare the story references with the renamed `camp-1` and `camp-2` stops.
- [ ] Keep the Sheet `published` value `false` until the publication checks pass.

### Temperature record data

The historical signal is not ready for publication.

- [ ] Build an ACIS extraction command that can continue after an interruption. Retain raw responses and request manifests.
- [ ] Verify ACIS flags and certification fields against current RCC documentation.
- [ ] Regenerate `climateTrends.json`. Include a zero-count row for each calendar year.
- [ ] Complete the [publication checks](projects/temperature-records/methodology.md#validate-before-publication).
- [ ] Store an approved station cohort with a version number before publication.
- [ ] Publish station coverage, failed geography requests, and data quality in a manifest with a version number.

## Automated checks

Use fixed data for browser checks. Record the browser, viewport, and expected result.

- [ ] Test Flights map keyboard controls and camera URL synchronization with Playwright.
- [ ] Run the trip viewer and interactive map checks in WebKit with the required host libraries. Check all three map styles.
- [ ] Test list scroll restoration with browser Back and the article return link after delayed content loads.
- [ ] Extend the fixed-tile browser test. Check route pixels, stop selection, and each map style.

## Build and maintenance

Preserve passing publication checks when you change build scripts.

- [ ] Reduce the large visualization chunks. Preserve the passing article JavaScript budgets.
- [ ] Check Tailwind source-map output. Confirm that production error locations match source files.
- [ ] Split document conversion, shortcode handling, and publication checks in `scripts/sync-blogs.js`. Retain the compilation tests.

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
