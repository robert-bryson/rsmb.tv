# TODO

## Projects

### aborg

- [ ] Add screenshots to project page
- [x] add project page/links/etc

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

## Next steps

### Content

- [ ] Add screenshots to all project pages (aborg, Anki Artisan, Bookend, Temperature Records, Through Routes)
- [x] Write project page for aborg
- [ ] Add more blog posts to RSS feed as they are published

### Testing

- [ ] Add test coverage for Layout component
- [ ] Add test coverage for ScrollToTop component
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
