# ski-status tasks

Use the [guide](readme.md) for procedures and acceptance checks. Keep completed work in Git history.

## Before release

- [ ] Run the terrain validator on the hosted preview. Match its report to the candidate revision and Amplify job. Confirm the byte ranges and Heavenly tooltips. [Release checks](readme.md#release-checks)
- [ ] Verify the 22-resort and 32-resort Epic Day Pass tiers. Complete the remaining Ikon and Indy product rules. [Product coverage](../../docs/reviews/2026-11-20-ski-status-first-release-work.md#pass-product-coverage)
- [ ] Verify the ski-status sync workflow with its scoped role on `main`. Check the active manifest and its archived predecessor. [OIDC setup](../../docs/github-actions-oidc.md#enable-ski-status-sync)

## Before publishing the Rockies feed

- [ ] Confirm the display and storage terms for Banff Sunshine and Mt. Norquay. Correct the Norquay XML error. Compare the feed with the operator's report. [Report sources](readme.md#sources-and-pilot)
- [ ] Compare **Ski today** with the three Rockies operators for seven ski days. Record report dates and differences in terrain counts. Check the release threshold. [Pilot checks](readme.md#conditions-publication)

## Catalog and sources

- [ ] Review the 485 open North American candidates by region. Record the evidence and decision for each case. Update the regional counts. [Candidate log](research/north-america-2026-11-16.csv)
- [ ] Fill missing mountain fields. Start with base elevation, summit elevation, and skiable acreage. Give the units, scope, source, and date for each value. Update the field counts. [Measurement rules](readme.md#comparable-mountain-statistics)
- [ ] Add direct conditions links for the remaining areas. Open each link and confirm the area name. [Catalog](readme.md#catalog)
- [ ] At the start of each season, confirm pass access, discounts, and the countries that shared areas cover. [Pass rules](readme.md#pass-access-by-product-and-date)
- [ ] After each terrain build, check areas with missing or shared terrain. Verify more visitor entrances with operator directions. Start with the 16 areas that lost an inferred base. [Terrain importer](readme.md#runs-and-lifts-at-resort-zoom) · [Base review](../../docs/reviews/2026-11-20-ski-status-map-and-resort-data-review.md#terrain-and-base-points)
- [ ] Verify more resort icons and direct Wikipedia articles. Record the source for each icon. [Catalog](readme.md#catalog)
- [ ] Confirm actual opening and closing dates for areas with plans. Record opening-day terrain and breaks in operation. [Season date rules](readme.md#opening-and-closing-dates)
- [ ] Add historical snowfall and snow depth. Give the measurement location, period, and source for each series. [Snow history](readme.md#season-and-snowfall)
- [ ] Verify field scope, local ski dates, and reuse terms before you add a scheduled feed. Compare it with the operator's report. [Report rules](readme.md#operating-status-and-terrain)

## Planned features

- [ ] Build a season calendar from daily observations. Remove duplicates. Check coverage before you show open terrain, snow, and temperature by ski date. [Calendar design](readme.md#season-conditions-calendar)
- [ ] Add current weather and a five-day forecast. Test local dates, units, and missing values. [Forecast design](readme.md#resort-conditions-and-5-day-forecast)
- [ ] Link to operator trail maps. Show verified access, run length, maximum slope, and grooming status when the source gives these values. [Terrain guide](readme.md#runs-and-lifts-at-resort-zoom)
- [ ] Match resort bases to access roads. Show agency restrictions and link to agency and resort cameras. Record parking locations, costs, and shuttle service. [Access routes](readme.md#access-routes-and-webcams)
- [ ] Store visited areas on the device. Add a filter and a backup format. [Visited areas](readme.md#visited-areas)

## Research

- [ ] Link to operator policies for uphill travel.
- [ ] Compare lift ticket and rental prices. Link to dining prices.
- [ ] Measure the time needed to compare acreage, vertical drop, and lift count with the current column order. [Interface review](../../docs/reviews/2026-11-20-ski-status-interface-review.md)
- [ ] Compare terrain maps and statistics side by side. Use the same zoom for both maps.
