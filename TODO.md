# TODO

This file contains incomplete work. Git history contains the completed work.

## Project media

- [ ] Add screenshots to the Aborg project page.
- [ ] Add screenshots to the Flights project page.

## Content publishing

- [ ] Publish more blog posts from the configured Google documents.
- [ ] Verify that each manifest asset URL is available before a trip is published.

## Test coverage

- [ ] Add unit tests for the `ScrollToTop` component.
- [ ] Add Playwright tests for Flights map keyboard controls and camera URL synchronization.
- [ ] Add Playwright tests for trip map fallback behavior and gallery keyboard controls.

## Temperature record data

The historical signal is not ready for publication.

### Data extraction

- [ ] Build a resumable ACIS extraction command. Keep raw responses and request manifests.
- [ ] Verify ACIS flags and certification fields against current RCC documentation.

### Publication quality

- [ ] Regenerate `climateTrends.json`. Include a zero-count row for each calendar year.
- [ ] Complete the publication checks in [the methodology](projects/temperature-records/methodology.md#validate-before-publication).
- [ ] Archive an approved, versioned station cohort before publication.
- [ ] Publish station coverage, failed geography requests, and data quality in a versioned manifest.

## Ride Ledger prerequisites

- [ ] Resolve the [Ride Ledger open decisions](projects/ride-ledger/readme.md#open-decisions).
- [ ] Create at least 20 synthetic and de-identified import fixtures. Add the expected normalized output to each fixture.
- [ ] Compare the fixture totals with an independent calculation.
- [ ] Write a threat model. Include identity, local data, synchronization, attachments, export, and account deletion.
