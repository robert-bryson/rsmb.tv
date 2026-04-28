# TODO

- [x] Move generated temperature data to S3/CDN canonical storage; keep local JSON ignored, fix sync actions, and clean tracked generated data
- [ ] JSON-LD for all pages

## Projects

### aborg

- [ ] Add screenshots to project page

### Anki artisan

- [ ] Add screenshots to project page

### Bookend

- [ ] Add screenshots to project page

### Temperature records

- [ ] Sometimes it is confusing what the term record refers to. There are many types: local/state/county/all time/date/month/etc. Please review usage and improve
- [ ] Add screenshots to project page
- [ ] Improve map symbology (maybe gradient of county icons for whatever tab is selected on right panel)
- [ ] random controls all over map UI, some get hidden. review and improve
- [ ] it doesnt seem like the chart math is correct (or maybe just correct for a specific type of record?). Review, fix, and clarify

### Through Routes

- [ ] Add screenshots to project page

### Tornado Tracks

- [ ] Add screenshots to project page
- [x] refreshing the page moves the map back to the starting zoom/bbox
- [x] how to keep track data up to date?
- [x] add in state tornadoes over time? county?
  - [x] get a sense of how often tornadoes hit that geography
  - [x] get a sense of how common which strength of tornadoes is
- [x] Project button should be something like `rsmb.tv` or `←Back` and always go back to either the rsmb.tv homepage or the project homepage on rsmb.tv
- [x] there should be a share button somewhere
- [ ] scrolling seems to reset the tracks/trends/density layer?
- [ ] ← rsmb.tv button doesnt work correctly
- [ ] should be able to click on a state, see tornadoes that went through, get stats
- [ ] better share button somewhere else
- [ ] what happened to the warnings data? id be curious to see:
  - [ ] what areas get the most warnings?
  - [ ] warnings over time
  - [ ] likelyhood of watches/warnings producing thunderstorms
  - [ ] etc

### Status dashboard 

- [ ] Forecast cost estimate seems way off

## Next steps

### Content

- [ ] Add screenshots to all project pages (aborg, Anki Artisan, Bookend, Temperature Records, Through Routes)
- [ ] Add more blog posts to RSS feed as they are published

### Testing

- [ ] Add test coverage for Layout component
- [ ] Add test coverage for ScrollToTop component

---

## Completed

### Projects

#### aborg

- [x] add project page/links/etc

#### Content

- [x] Write project page for aborg

#### Tornado Tracks

- [x] hover popups have weird, large white boundaries
- [x] playing the timeline animation flickers annoyingly
- [x] scale should include all possible values (0-5, i believe?)
- [x] map is unusable when many years are chosen
- [x] refreshing the page should not reset state. state should be part of the URL
- [x] ui elements should be able to be minimized
- [x] refreshing the page moves the map back to the starting zoom/bbox
- [x] how to keep track data up to date?
- [x] some of the track data appears to be bad (like the San Bernardino, CA, May 18, 1997, 3:50 PM tornado track)

### Testing

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
