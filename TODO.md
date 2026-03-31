# TODO

## Projects

### aborg

- [ ] Add screenshots to project page
- [ ] add project page/links/etc

### Anki artisan

- [ ] Add screenshots to project page

### Bookend

- [ ] Add screenshots to project page

### Temperature records

- [x] Rename project to Record Highs
- [x] When switching units to C -> F, or F -> C, tooltips/map icons, symbology scales, etc do not all honor. `https://www.rsmb.tv/projects/temperature-records/map?view=county&unit=C` Unit should trigger all units everywhere to use the `unit=` value
- [ ] Sometimes it is confusing what the term record refers to. There are many types: local/state/county/all time/date/month/etc. Please review usage and improve
- [ ] Add screenshots to project page
- [ ] Improve map symbology (maybe gradient of county icons for whatever tab is selected on right panel)
- [ ] random controls all over map UI, some get hidden. review and improve
- [ ] it doesnt seem like the chart math is correct (or maybe just correct for a specific type of record?). Review, fix, and clarify


### Through Routes

- [ ] Add screenshots to project page

## Next steps

### SEO & Social

- [x] Add `ogImage` to pages missing it: Blog, About, Projects, Flights (map), ClimateTrends, TemperatureRecords (map), BlogPost (dynamic)
- [x] Regenerate OG image for temperature-records now that title is "Record Highs"

### Quality of life

- [x] Consolidate duplicate `fToC` helpers (defined separately in TemperatureMap, SummaryPanel, StationDetailPanel) into a shared util
- [x] Add a loading/skeleton state for the ClimateTrends page when embedded in the map view
- [x] Review map controls layout on mobile — some buttons overlap or get hidden at small viewports

### Content

- [ ] Add screenshots to all project pages (aborg, Anki Artisan, Bookend, Temperature Records, Through Routes)
- [ ] Write project page for aborg (currently has no page, only a TODO)
- [ ] Add more blog posts to RSS feed as they are published

### Testing

- [x] Add unit tests for temperature C/F conversion in map labels and popups
- [x] Add test coverage for the ClimateTrends page