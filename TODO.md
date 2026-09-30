# Open work

This file contains incomplete work. Use Git history for completed work.

## Publication blockers

### Boise trip

The manifest supports local preview. The public route and a sample photo returned HTTP 403 on 2026-09-30.

- [ ] Publish the processed Boise photos and route files. Confirm that each manifest URL returns HTTP 200.
- [ ] Verify the recorded track dates. The source filenames do not agree with all dates in the story.
- [ ] Add the missing return route from Panther Creek to Seattle, if a source track is available.
- [ ] Replace the unknown distances and repeated day numbers in the Google Doc.
- [ ] Verify the total distance, riding days, stops, and photo captions before publication.
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

- [ ] Validate the complete trip manifest schema during blog sync. Currently, the application validates the schema when the module loads.
- [ ] Compare manifest track IDs with the published route features during publication checks.
- [ ] Test Flights map keyboard controls and camera URL synchronization with Playwright.
- [ ] Test trip map fallback behavior and the basemap control with Playwright.
- [ ] Test trip gallery keyboard controls with Playwright.

## Project content

- [ ] Add screenshots to the Aborg project page.
- [ ] Add screenshots to the Flights project page.
- [ ] Publish more blog posts from the configured Google documents.

## Ride Ledger prerequisites

- [ ] Resolve the [open decisions](projects/ride-ledger/readme.md#open-decisions).
- [ ] Create at least 20 synthetic import fixtures with no personal data. Add the expected output to each fixture.
- [ ] Compare fixture totals with an independent calculation.
- [ ] Write a threat model for identity, local data, synchronization, attachments, export, and account deletion.
