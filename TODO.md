# Open work

This file lists incomplete work. Keep completed tasks in Git history.
Use the [review index](docs/README.md) for dated evidence and test results.
Use the [trip authoring guide](docs/trips/TRIP-AUTHORING-README.md#6-publish-assets) for recurring photo checks and asset publication steps.

## Priority and ownership

Each task appears once below. Linked guides define its acceptance conditions.
Keep local checks separate from work that needs a deployment, an owner decision, or a physical device.
Write tasks as actions with a clear expected result.
Move completed results to a dated review. Remove their checkboxes from this file.
The site owner must confirm travel dates, source descriptions, and other editorial facts.
Hosted checks require a deployed build. Device checks require the named physical device.

| When | Work | Required access or decision |
| --- | --- | --- |
| Next local validation | [Automated checks](#automated-checks) | Local test environment |
| Before the next hosted release | [Release checks](#next-release-checks) and [Pins hosting](#hosted-release) | Deployed origin and analytics account |
| Before closing device checks | [Physical devices](#physical-devices) | Named hardware or assistive technology |
| Before publishing a story | [Content publication](#content-publication) and [source checks](#published-story-checks) | Owner confirmation and source files |
| Before historical signal publication | [Temperature publication](#historical-signal-publication) | Approved data and methodology |
| Later engineering work | [Build and maintenance](#build-and-maintenance), [Tornado Tracks](#tornado-tracks), and [dashboard checks](#dashboard-checks) | Local implementation and regression tests |
| Infrastructure changes | [Infrastructure](#infrastructure) | AWS or Google Admin access |
| Content additions | [Project content](#project-content) | Reviewed content and assets |
| Before the ski-status release | [ski-status](#ski-status) | Verified area records, pass rules, and report sources |
| Application planning | [Ride Ledger prerequisites](#ride-ledger-prerequisites) | Owner decisions and synthetic fixtures |

## Next release checks

Do these checks after the reviewed changes reach a hosted preview or production.
Local browser tests cannot verify the analytics account or physical devices.

- [ ] Verify Web Vitals in the Umami Performance view after deployment. Record the build revision and observation period.
- [ ] Verify one `map-ready` event for each map visit. Check startup failure, runtime failure, and phase-specific recovery. Confirm that events exclude query values.
- [ ] Verify the `rsmb-tv` tag, project events, map events, error reports, and privacy preferences in Umami.
  Check the details, demo, and source destinations on project cards.
  Create the goals and funnel in the [analytics guide](docs/umami-analytics.md).
- [ ] Test navigation, site search, list filters, and map controls with VoiceOver or NVDA.
  Check result announcements, keyboard browsing, Escape, retry, and focus after clearing.
  Open a search result and check passage focus, the highlight, sticky heading clearance, and Back/Forward positions.
  Check that a matched summary control remains in its normal Tab order.
  Check the post filter button's active count, link order, selected states, and focus after dismissal.
  Check category counts and the new-tab descriptions on project actions.
  Include hover dismissal, route announcements, help dismissal, and disabled character shortcuts.

## Content publication

Complete these checks before publishing the affected story.

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

### PCH 2024

- [ ] Resolve the remaining chronology, mileage, and image privacy decisions in the [PCH source checks](docs/trips/pch-2024-galleries.md#publication-checks).

### Ocean Shores

- [ ] Confirm the travel dates against the [photo and GPS evidence](docs/reviews/2026-10-31-blog-and-trip-asset-refresh.md#source-date-conflict). Photo EXIF spans February 16–19. The manifest uses February 17–20.

### Kalaloch

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
Keep it separate from the operational map's standing-record data.

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

- [ ] Check site search and list filters with a phone keyboard.
  Include composed text, accented names, clearing, and returning from a result.
  Confirm that composition keys keep focus in the field and do not open a result.
  Verify filter counts, clearing, and restoration through Back, Forward, and reload.
  Open post filters with enlarged text and after rotation. Scroll to the final region and close the panel.
  Open a search match in a code block and on a short screen. Check placement after the keyboard and browser chrome resize.
  Record the device, keyboard, browser, and result.
- [ ] Check [trip reading](docs/reviews/2026-11-13-trip-layout-quality-review.md#remaining-checks) on a real phone.
  Include large text, chapter changes, subsection links, and rotation.
  Check title shrinking, reduced motion, and reader input during a section jump.
  Record the device, browser, and result.
- [ ] Measure trip photos and the quality-99 viewer on a real phone.
  Record opening time, peak memory, selected image widths, and transfer sizes.
  Include a large panorama, repeated arrow navigation, and native-resolution zoom.
  Expand and collapse a long gallery. Check that its focused control stays in view.
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

Use the [dashboard guide](docs/dashboard.md#code-and-tests) for code ownership and completed event-log checks.
Use fixed provider responses and UTC dates.

- [ ] Test build fetchers with throttled, failed, empty, and malformed responses.
  Verify the displayed status and error for each response.
- [ ] Test cost cache reads, writes, provider failures, and month-end forecasts.
  Use fixed UTC dates and check the resulting totals.

## Build and maintenance

Preserve passing publication checks when changing build scripts.

- [ ] Remove scoped minimatch overrides when all three upstream consumers declare a patched compatible range. Run the [compatibility checks](README.md#lint-security-override).
- [ ] Recheck the development-tool [picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) when a patched compatible release is available.
  The [main branch review](docs/reviews/2026-11-17-main-branch-review.md#dependency-audit) records the audit scope and current result.
- [ ] Extract the remaining temperature-map rendering, interaction, and loading code. Preserve browser behavior and URL contracts. Track tornado-map work in its own section above.
- [ ] Reduce MapLibre loading and worker costs. Preserve the article JavaScript budgets.
- [ ] Split document conversion, shortcode handling, and publication checks into separate modules. Keep `scripts/sync-blogs.js` as the coordinator. Retain compilation, formatting, and unsafe-content tests.
- [ ] Replace the TypeScript 6 lint compiler after `typescript-eslint` supports TypeScript 7. Run lint and typecheck first.

## Project content

- [ ] Add aborg screenshots from a controlled audiobook fixture. Show real scan and organize output. Record the app revision and remove personal paths.
- [ ] Recheck the Through Routes expanded road profile after an upstream fix.
  Select a road from **In View**, then expand its profile. The November 15 capture showed a chart and a **Loading profile** label together.
  Confirm that the label clears. Then capture the expanded view and update its caption.
  The current gallery uses the loaded compact panel. See the [presentation review](docs/reviews/2026-11-15-project-presentation-refresh.md#capture-views).

Track pending stories in [Content publication](#content-publication). Do not add duplicate story tasks here.

## ski-status

### First release

- [ ] Review the remaining North American areas by region. Record the source and decision for each area. List unresolved areas. [Catalog rules](projects/ski-status/readme.md#build-the-catalog)
- [ ] Add rules by pass product and local ski date. Test day limits, shared days, blackout dates, and reservations. [Pass rules](projects/ski-status/readme.md#pass-access-by-product-and-date)
- [ ] Add resort reports and forecasts from sources that permit reuse. Measure field coverage and report age. [Conditions pilot](projects/ski-status/readme.md#sources-and-pilot)
- [ ] Add operating status colors after the app can check report age. [Map and table](projects/ski-status/readme.md#map-and-table)
- [ ] Add column settings and CSV export. Verify the data license for export. [Map and table](projects/ski-status/readme.md#map-and-table)

### Catalog maintenance

- [ ] Check each pass roster at the start of the season. Verify included access and discounts. Check the countries that each shared area covers. [Catalog rules](projects/ski-status/readme.md#build-the-catalog)
- [ ] Fill missing statistics and conditions links from operator sources. Check the units and terrain that each figure covers. Publish field coverage. [Mountain statistics](projects/ski-status/readme.md#comparable-mountain-statistics)

### Version 2

- [ ] Show runs, lifts, and lift terminals from OpenSkiData at resort zoom. Link to official resort trail maps. [Runs and lifts](projects/ski-status/readme.md#runs-and-lifts-at-resort-zoom)
- [ ] Show polygons for official and unofficial trail areas. Show run length, maximum slope, and grooming status where sources supply them. [Runs and lifts](projects/ski-status/readme.md#runs-and-lifts-at-resort-zoom)
- [ ] Use operator directions to match resorts to access roads. Show agency road restrictions. Link to official agency and resort webcams. [Access routes and webcams](projects/ski-status/readme.md#access-routes-and-webcams)
- [ ] Record parking locations, prices, and shuttle service where operators publish them. [Access routes and webcams](projects/ski-status/readme.md#access-routes-and-webcams)
- [ ] Add device-local visits, a visited filter, and a backup format. [Visited areas](projects/ski-status/readme.md#visited-areas)

### Later ideas

- [ ] Link to operator policies for uphill travel.
- [ ] Compare lift ticket and rental prices. Link to resort dining details and prices.
- [ ] Add links to Wikipedia articles about ski areas.
- [ ] Compare ski areas with maps and mountain statistics side by side. Use the same zoom for both maps.

## Ride Ledger prerequisites

- [ ] Resolve the [open decisions](projects/ride-ledger/readme.md#open-decisions).
- [ ] Create at least 20 synthetic import fixtures without personal data. Add the expected output to each fixture.
- [ ] Compare fixture totals with an independent calculation.
- [ ] Write a threat model for identity, local data, synchronization, attachments, export, and account deletion.
