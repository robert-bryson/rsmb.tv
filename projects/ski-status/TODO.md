# ski-status tasks

Use the guide for procedures and acceptance checks. Find completed work in Git history and dated reviews. [Project guide](readme.md), [Review index](../../docs/README.md#reviews)

## Before release

- [ ] Run the terrain validator on the hosted preview. Check the byte ranges and the Heavenly tooltips. Match the report to the candidate revision and Amplify job. [Release checks](readme.md#release-checks)
- [ ] Run **Sync Ski Status** on `main` with its scoped role. Check the active manifest and its archived predecessor. [OIDC setup](../../docs/github-actions-oidc.md#enable-ski-status-sync)
- [ ] Verify Indy product rules for the remaining areas. Record each exception, blackout date, and reservation rule. [Pass rules](readme.md#pass-access-by-product-and-date)

## Before publishing the Rockies feed

- [ ] Confirm the display and storage terms for Banff Sunshine and Mt. Norquay. [Report sources](readme.md#sources-and-pilot)
- [ ] Recheck the Mt. Norquay XML endpoint. Compare its counts with the operator's report when the feed returns. [Report sources](readme.md#sources-and-pilot)
- [ ] Compare **Ski today** with the three operator reports for seven ski days. Record the dates and any differences in terrain counts. Verify at least 19 of 21 ski area days. Check that each current report has a verified date for the local ski day. [Pilot checks](readme.md#conditions-publication)

## Catalog gaps

- [ ] Fill gaps in the six main comparison fields for 237 downhill areas. Start with base elevation, summit elevation, and skiable acres. Record each value's units, scope, source, and date. Update the field counts. [Measurement rules](readme.md#comparable-mountain-statistics)
- [ ] Verify the endpoints of a lift-served descent at Amihari Onsen before restoring its vertical figure. [Measurement rules](readme.md#comparable-mountain-statistics)
- [ ] Add official conditions links for 48 areas. Open each link. Confirm that its report covers the area. [Catalog](readme.md#catalog)
- [ ] Review the 485 open North American candidates by region. Record each decision and its source. Update the regional counts. [Candidate log](research/north-america-2026-11-16.csv)
- [ ] Use operator directions to check visitor entrances for the 16 areas without a reliable inferred base. [Terrain and base review](../../docs/reviews/2026-11-20-ski-status-map-and-resort-data-review.md#terrain-and-base-points)
- [ ] Add more verified resort icons and Wikipedia articles. Give each icon a source. [Catalog](readme.md#catalog)

## Report and season data

- [ ] Record actual opening and closing dates for areas with plans. Add opening-day terrain and breaks in operation when the operator reports them. [Season date rules](readme.md#opening-and-closing-dates)
- [ ] Add snowfall and snow depth for areas with gaps in the snow table. Record the measurement location, period, and source for each series. [Snow history](readme.md#season-and-snowfall)

## Recurring checks

- [ ] Confirm pass access and discounts at the start of each season. Check the countries that shared areas cover. [Pass rules](readme.md#pass-access-by-product-and-date)
- [ ] Check missing and shared terrain after each build. Review changes to the base points. [Terrain importer](readme.md#runs-and-lifts-at-resort-zoom)
- [ ] Verify field scope, local ski dates, and reuse terms before adding a scheduled feed. Compare its values with the operator's report. [Report rules](readme.md#report-and-forecast-rules)

## Planned features

- [ ] Build a season calendar from verified daily reports. Remove duplicate observations. Check coverage before adding terrain, snow, and temperature to the calendar. [Calendar design](readme.md#season-conditions-calendar)
- [ ] Add current weather and a five-day forecast. Test local dates, units, and missing values. [Forecast design](readme.md#resort-conditions-and-5-day-forecast)
- [ ] Link to operator trail maps. Show access, run length, maximum slope, and grooming status when the source gives these values. [Terrain guide](readme.md#runs-and-lifts-at-resort-zoom)
- [ ] Match resort bases to access roads. Show road restrictions. Link to agency and resort cameras. Record parking locations, prices, and shuttle service. [Access routes](readme.md#access-routes-and-webcams)
- [ ] Store visited areas on the device. Add a filter and a backup format. [Visited areas](readme.md#visited-areas)

## Research

- [ ] Find operator policies for uphill travel. Record a source link for each area.
- [ ] Compare lift ticket and rental prices. Link to dining price lists.
- [ ] Measure the time needed to compare acreage, vertical drop, and lift count with the current column order. [Interface review](../../docs/reviews/2026-11-20-ski-status-interface-review.md)
- [ ] Compare terrain maps and statistics side by side. Use the same zoom for both maps.
