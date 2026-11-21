# ski-status tasks

Use the project guide for procedures and acceptance checks. Find completed work in Git history and dated reviews. [Project guide](readme.md), [Review index](../../docs/README.md#reviews)

## Release checks

- [ ] Copy the versioned runtime files to the HTTPS mirror. Set `SKI_ASSETS_BASE_URL` in Amplify. Build the candidate revision. [Release assets](readme.md#release-assets)
- [ ] Run the validator on the hosted preview. Check the terrain checksum, byte ranges, and Heavenly tooltips. Match the report to the candidate revision and Amplify job. [Release checks](readme.md#release-checks)
- [ ] Run **Sync Ski Status** on `main` with its scoped role. Check the active manifest and its archived predecessor. [OIDC setup](../../docs/github-actions-oidc.md#enable-ski-status-sync)
- [ ] Verify Indy product rules for the remaining areas. As of November 21, 2026, 59 areas have product rules and 53 cover all four cataloged products. Record exceptions, blackout dates, and reservation rules. [Pass rules](readme.md#pass-access-by-product-and-date), [Batch log](research/data-quality-log.md)

## Rockies report pilot

- [ ] Confirm the storage and display terms for Banff Sunshine and Mt. Norquay. [Report sources](readme.md#sources-and-pilot)
- [ ] Recheck the Mt. Norquay XML feed. If it responds, compare its counts with the operator's report. [Report sources](readme.md#sources-and-pilot)
- [ ] Compare **Ski today** with the three operator reports for seven ski days. Verify at least 19 of 21 area days. Record local dates, times, and differences in terrain counts. [Pilot checks](readme.md#conditions-publication)

## Catalog and report gaps

- [ ] Fill the six main comparison fields for the remaining 214 of 527 downhill areas as of November 21, 2026. Start with base elevation, summit elevation, and skiable acres. Record units, scope, source, and check date. [Catalog coverage](readme.md#catalog), [Measurement rules](readme.md#comparable-mountain-statistics)
- [ ] Verify official conditions links for areas without a report. Check that each link covers the area. [Catalog](readme.md#catalog)
- [ ] Verify the endpoints of a lift-served descent at Amihari Onsen. Use them to record vertical. [Measurement rules](readme.md#comparable-mountain-statistics)
- [ ] Review the remaining 462 unresolved North American candidates by region, including 28 in Ontario as of November 21, 2026. Record each decision and source. Update the regional counts. [Candidate log](research/north-america-2026-11-16.csv), [Regional counts](research/north-america-2026-11-16-summary.csv)
- [ ] Check visitor entrances for areas with no reliable base point. Use operator directions. [Terrain and base review](../../docs/reviews/2026-11-20-ski-status-map-and-resort-data-review.md#terrain-and-base-points)
- [ ] Find missing resort icons and verify their reuse terms. Check each icon at map and panel sizes. [Resort icon workflow](.agents/skills/ski-status-data-quality/SKILL.md#resort-icons)
- [ ] Verify more Wikipedia articles or sections for the exact ski area. [Catalog](readme.md#catalog)
- [ ] Record actual opening and closing dates. Use operator reports to confirm opening-day terrain and breaks in operation. [Season date rules](readme.md#opening-and-closing-dates)
- [ ] Add current season-to-date totals and past season totals from operator reports. Fill gaps in monthly snowfall and snow depth. Record the measurement site, period, and source for each series. [Snow history](readme.md#season-and-snowfall)
- [ ] Add missing visitor records for the 2026/27 season. Verify all public lodges, the services at each lodge, and visitor entrances. Check trail maps, parking, shuttles, day tickets, and camera links. [Coverage and sources](readme.md#recurring-data-batches)

## Planned features

- [ ] Test three tasks with resort details. Find today's and tomorrow's conditions. Compare weekend resorts. Plan a trip with season history and pass access.
- [ ] Build a season calendar from verified daily reports. Remove duplicate observations. Check coverage before you add terrain, snow, and temperature. [Calendar design](readme.md#season-conditions-calendar)
- [ ] Extend the weather panel to more resorts. Fill missing observations and forecast fields. Test local dates, units, and missing values. [Forecast design](readme.md#resort-conditions-and-5-day-forecast)
- [ ] Show straight-line distance, driving distance, and drive time from a selected origin. [Access routes](readme.md#access-routes-and-webcams)
- [ ] Add verified lodge locations to the map. Show the services at each location. [Visitor information](readme.md#inspect-and-compare-areas)
- [ ] Show published run access, length, maximum slope, and grooming status. [Terrain guide](readme.md#runs-and-lifts-at-resort-zoom)
- [ ] Match resort entrances to access roads. Show official winter closures and restrictions. [Access routes](readme.md#access-routes-and-webcams)
- [ ] Link to agency cameras. Test a map layer for nearby cameras. [Webcams](readme.md#access-routes-and-webcams)
- [ ] Store visited areas on the device. Add a filter and a backup format. [Visited areas](readme.md#visited-areas)

## Recurring checks

- [ ] Confirm pass access and discounts at the start of each season. Check the countries in each shared ski area. [Pass rules](readme.md#pass-access-by-product-and-date)
- [ ] Check missing and shared terrain after each build. Review changes to base points. Update the browser fixture when its terrain groups change. [Terrain importer](readme.md#runs-and-lifts-at-resort-zoom)
- [ ] Verify field scope, local ski dates, and reuse terms before you add a scheduled feed. Compare its values with the operator's report. [Report rules](readme.md#report-and-forecast-rules)

## Research

- [ ] Find operator policies for uphill travel. Record a source for each area.
- [ ] Evaluate a comparison of lift tickets, rentals, and dining prices. Check which sources publish dates and terms.
- [ ] Measure the time it takes to compare acreage, vertical drop, and lift count. [Interface review](../../docs/reviews/2026-11-20-ski-status-interface-review.md)
- [ ] Test a side-by-side view of terrain and mountain statistics. Use the same zoom for both maps. [Map display](readme.md#map-display)
- [ ] Test terrain overlays at resort-specific zoom levels. Keep a default for other areas. Compare 3D terrain and imagery at close zooms. [Map display](readme.md#map-display)
- [ ] Check sources for snowfall, slope angle, and freezing level layers. Check snow depth coverage outside the contiguous United States. Record reuse terms. [Report rules](readme.md#report-and-forecast-rules)
- [ ] Check sources for official weather warnings, avalanche forecasts, and avalanche terrain. Verify their coverage and reuse terms.
- [ ] Evaluate fitness app imports for ski tracks, trip totals, and records of runs and resorts visited. Review StatsHunters as a reference.
- [ ] Check if ski-day GPS tracks can identify runs and lifts. Measure the accuracy of estimates for lift queues and ride times.
