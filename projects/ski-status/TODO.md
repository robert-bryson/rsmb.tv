# ski-status tasks

Use the guide for procedures and acceptance checks. Record completed work in Git history. [Project guide](readme.md)

## Before release

- [ ] Check terrain on the hosted preview. Confirm byte ranges and the Heavenly tooltips. Match the report to the candidate revision and Amplify job. [Release checks](readme.md#release-checks)
- [ ] Verify the 22-resort and 32-resort Epic Day Pass tiers. Record the access rules for each area. [Product coverage](../../docs/reviews/2026-11-20-ski-status-first-release-work.md#pass-product-coverage)
- [ ] Complete the remaining Ikon and Indy product rules. Record each verified exception, blackout date, and reservation rule. [Product coverage](../../docs/reviews/2026-11-20-ski-status-first-release-work.md#pass-product-coverage)
- [ ] Verify the sync workflow with its scoped role on `main`. Check the active manifest and its archived predecessor. [OIDC setup](../../docs/github-actions-oidc.md#enable-ski-status-sync)

## Before publishing the Rockies feed

- [ ] Confirm the display and storage terms for Banff Sunshine and Mt. Norquay. [Report sources](readme.md#sources-and-pilot)
- [ ] Recheck the Norquay XML endpoint after SkiBig3 restores it. Compare the counts with the operator's report. [Report sources](readme.md#sources-and-pilot)
- [ ] Compare **Ski today** with the three Rockies operators for seven ski days. Record report dates and differences in terrain counts. Verify at least 19 of 21 ski area days. Confirm that no stale or undated report appears as current. [Pilot checks](readme.md#conditions-publication)

## Catalog gaps

- [ ] Fill the six main comparison fields for the 236 downhill areas that have gaps. Start with base elevation, summit elevation, and skiable acres. Give each value its units, scope, source, and date. Update the field counts. [Measurement rules](readme.md#comparable-mountain-statistics)
- [ ] Confirm the scope of the published vertical at Amihari Onsen, Bergbahnen Hohsaas, and Ober Mountain. Compare it with each area's published elevation range. Record the measurement scope or correct the source. [Measurement rules](readme.md#comparable-mountain-statistics)
- [ ] Add official conditions links for the 56 areas that need them. Open each link and confirm that the report covers the intended area. [Catalog](readme.md#catalog)
- [ ] Review the 485 open North American candidates by region. Record each decision and its source. Update the regional counts. [Candidate log](research/north-america-2026-11-16.csv)
- [ ] Check the visitor entrances for the 16 areas that lost an inferred base. Use operator directions. [Terrain and base review](../../docs/reviews/2026-11-20-ski-status-map-and-resort-data-review.md#terrain-and-base-points)
- [ ] Add more verified resort icons and Wikipedia articles. Give each icon a source. [Catalog](readme.md#catalog)

## Report and season data

- [ ] Record actual opening and closing dates for areas with plans. Include opening-day terrain and breaks in operation when the source gives them. [Season date rules](readme.md#opening-and-closing-dates)
- [ ] Add snowfall and snow depth for areas with no history. Record the measurement location, period, and source for each series. [Snow history](readme.md#season-and-snowfall)
- [ ] Before adding a scheduled feed, verify its field scope, local ski dates, and reuse terms. Compare it with the operator's report. [Report rules](readme.md#operating-status-and-terrain)

## Regular maintenance

- [ ] At the start of each season, confirm pass access and discounts. Check the countries that shared areas cover. [Pass rules](readme.md#pass-access-by-product-and-date)
- [ ] After each terrain build, check missing and shared terrain. Check changes in base points. [Terrain importer](readme.md#runs-and-lifts-at-resort-zoom)

## Planned features

- [ ] Build a season calendar from verified daily reports. Remove duplicate observations. Check coverage before adding terrain, snow, and temperature to the calendar. [Calendar design](readme.md#season-conditions-calendar)
- [ ] Add current weather and a five-day forecast. Test local dates, units, and missing values. [Forecast design](readme.md#resort-conditions-and-5-day-forecast)
- [ ] Link to operator trail maps. Show access, run length, maximum slope, and grooming status when the source gives these values. [Terrain guide](readme.md#runs-and-lifts-at-resort-zoom)
- [ ] Match resort bases to access roads. Show road restrictions. Link to agency and resort cameras. Record parking locations, prices, and shuttle service. [Access routes](readme.md#access-routes-and-webcams)
- [ ] Store visited areas on the device. Add a filter and a backup format. [Visited areas](readme.md#visited-areas)

## Research

- [ ] Link to operator policies for uphill travel.
- [ ] Compare lift ticket and rental prices. Link to dining prices.
- [ ] Measure the time needed to compare acreage, vertical drop, and lift count with the current column order. [Interface review](../../docs/reviews/2026-11-20-ski-status-interface-review.md)
- [ ] Compare terrain maps and statistics side by side. Use the same zoom for both maps.
