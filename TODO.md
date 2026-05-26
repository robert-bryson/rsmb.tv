# TODO

## Projects

### Aborg

- [ ] Add screenshots to project page

### Anki Artisan

No open items.

### Bookend

No open items.

### Parc

No open items.

### rsmb.tv

- [ ] Add screenshots to flights map project page

### Status dashboard

No open items.

### Temperature records

No open items.

### Through Routes

No open items.

### Tornado Tracks

No open items.

## Next steps

### Content

- [ ] Publish additional Google-backed blog posts

### Testing

- [ ] Add test coverage for ScrollToTop component
- [ ] Add test coverage for FlightsMap integration (keyboard shortcuts + globe state)

---

## Completed

### Flights map

- [x] Make globe rotation explicit opt-in and stop it on map, UI, and keyboard interactions
- [x] Add active filter chips for shareable flight map URL state
- [x] Replace Show/Hide Stats button with side pull-tab slider
- [x] Rename ← Back nav button to ← rsmb.tv linking to home
- [x] Fix stats panel height so it never overlaps BottomStatsBar
- [x] Remove "Press H for help" from BottomStatsBar
- [x] Fix close-animation bug (always-mount panel content; slide carries visible content)
- [x] Plug keyboard/screen-reader access to off-screen stats panel via `inert`
- [x] Add component tests for StatsPanel, TopNavigationBar, BottomStatsBar
- [x] Keep stats panel open when clearing airport, route, country, or region selections
- [x] Add selected country/region status to BottomStatsBar
- [x] Add persisted metric/imperial unit toggle across flight stats UI
- [x] Add airport-code tooltips in stats panel route and airport links
- [x] Prevent mixed airport/route/country/region URL selection state

### General

- [x] JSON-LD for all pages
- [x] Add generated Open Graph images for aborg and parc project pages
- [x] Standardize page Open Graph metadata through shared site metadata helpers
- [x] Add Google Sheets/Docs blog sync with MDX generation, syntax highlighting, table support, and GitHub Actions automation
- [x] Validate Google Docs link normalization and unsafe-link stripping in blog sync tests
- [x] Move Google-authored blog posts to build-time sync so generated posts are not committed to git
- [x] Move generated temperature data to S3/CDN canonical storage; keep local JSON ignored, fix sync actions, and clean tracked generated data
- [x] does it make sense to have tornado data in the repo or s3? → S3, same pattern as temperatures: serve via data.rsmb.tv/tornadoes, gitignore generated files, workflow uploads instead of commits
- [x] create script to be run locally to backfill as much data as possible for all projects, having local & s3 storage options

### Completed projects

#### Aborg completed

- [x] add project page/links/etc

#### Parc completed

- [x] Add project page, route, project card metadata, preview image, and Open Graph image

#### Anki Artisan completed

- [x] Add screenshots to project page

#### Bookend completed

- [x] Add screenshots to project page
- [x] Add prominent project page link

#### Content completed

- [x] Write project page for aborg

#### rsmb.tv completed

- [x] Make blog post tags clickable and filterable
- [x] Rework the front page so posts and projects have clearer hierarchy
- [x] Hovering over projects link on header should allow either:
  - clicking and going to /projects
  - hovering and having a list of direct links to projects pop down

#### Status dashboard completed

- [x] Fix forecast cost estimate
- [x] Align build number links and timestamps in calm-mode running build rows

#### Through Routes completed

- [x] Add screenshots to project page
- [x] Add prominent project page link

#### Temperature records completed

- [x] Clarify record terminology across recent station records, county/state all-time records, record-age views, and trends
- [x] Verify screenshots are present on the project page and clean up stale screenshot TODO
- [x] Improve county/state all-time map symbology so high/low panel tabs drive map emphasis
- [x] Consolidate scattered temperature map controls and prevent top-right control overlap
- [x] Fix and clarify chart math: computed all-time county totals, explicit temperature-delta conversion, sparse-data chart guards

#### Tornado Tracks completed

- [x] scrolling resets the tracks/trends/density layer (URL state race — pendingSearchParams draft fix)
- [x] better share button placement (moved to summary panel header on desktop, track-count overlay on mobile)
- [x] evaluate vector-tile pipeline for large tornado datasets (documented in readme)
- [x] revisit visual styling — capture reference notes instead of loose screenshots (documented in readme)
- [x] dev-server JSON parse error — DATA_BASE_URL now defaults to CDN; local override via VITE_TORNADO_DATA_BASE_URL
- [x] Add screenshots to project page
- [x] refreshing the page moves the map back to the starting zoom/bbox
- [x] how to keep track data up to date?
- [x] add in state tornadoes over time? county?
  - [x] get a sense of how often tornadoes hit that geography
  - [x] get a sense of how common which strength of tornadoes is
- [x] Project button should be something like `rsmb.tv` or `←Back` and always go back to either the rsmb.tv homepage or the project homepage on rsmb.tv
- [x] there should be a share button somewhere
- [x] ← rsmb.tv button doesnt work correctly
- [x] should be able to click on a state, see tornadoes that went through, get stats
- [x] trends charts dont update to the selected year/decade/geography correctly
- [x] hover popups have weird, large white boundaries
- [x] playing the timeline animation flickers annoyingly
- [x] scale should include all possible values (0-5, i believe?)
- [x] map is unusable when many years are chosen
- [x] refreshing the page should not reset state. state should be part of the URL
- [x] ui elements should be able to be minimized
- [x] some of the track data appears to be bad (like the San Bernardino, CA, May 18, 1997, 3:50 PM tornado track)
- [x] what happened to the warnings data? → added IEM storm-based warning and SPC watch summaries to Tornado Tracks trends
  - [x] what areas get the most warnings? → top WFOs in selected range
  - [x] warnings over time → annual warning bars in Trends
  - [x] likelihood of watches/warnings producing thunderstorms → approximate StormEvents report-match rates

### Completed testing

- [x] Add test coverage for flights utility functions (parseYear, getRouteKey, hexToRgba, calculateDistance)
- [x] Add test coverage for useGeoJsonData hook
- [x] Add test coverage for useStatsPanelState hook
- [x] Add test coverage for useKeyboardShortcuts hook
- [x] Add test coverage for useReducedMotion hook
- [x] Add test coverage for useGlobeTextures hook
- [x] Add test coverage for useFlightsFilters hook
- [x] Add test coverage for parseDateString and sortDatesDescending utilities
- [x] Add test coverage for useDocumentHead meta restore and canonical cleanup
- [x] Add test coverage for selectedRouteAirports validation edge cases
- [x] Add test for useGeoJsonData stale closure prevention
- [x] Add fetchCache error recovery and malformed JSON tests
- [x] Add useDocumentHead OG image/URL customization tests
- [x] Add formatDate leap year and boundary tests
- [x] Add parseDateString zero-padded month test (radix bug prevention)
- [x] Add calculateDistance NaN input test
- [x] Add test coverage for useAwsPoll recovery/error event behavior
- [x] Add test coverage for tornado scale filter bounds (scaleFilterBounds)
- [x] Add test coverage for useTornadoFilters (URL params, setters, selectedTrackId)
- [x] Add test coverage for Layout component
- [x] Add test coverage for active flight filter chips, globe rotation controls, generated airport-coordinate warnings, and tooltip HTML escaping
