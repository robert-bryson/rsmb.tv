# ski-status guide and project plan

November 19, 2026

ski-status is a personal map and comparison table for North American downhill ski areas. Use it to compare mountain statistics and find ski areas on your pass.

## Use the pilot

The pilot contains 25 ski areas in the United States and Canada. Open `/projects/ski-status/map` from the project directory. The desktop view shows the map beside the table. On a phone, select **Map** or **Table**.

- Search by ski area, alternative name, town, or country.
- Filter by region, pass family, or night skiing.
- Select a column header to change the sort order.
- Select a map marker or table row to show the area details.
- Select **Official conditions** to open the operator's report.

The URL stores the search text, filters, sort order, selection, and phone view. The browser stores your unit preference. The table remains available when the basemap or map renderer fails.

## Pilot catalog

| File | Use |
| --- | --- |
| [Area statistics](data/pilot-areas.json) | Mountain statistics and report links checked on November 19, 2026. Empty fields display as unknown. |
| [Area locations](data/pilot-locations.json) | Points from the November 16 OpenSkiData build. Each point has source identifiers. The file includes ODbL attribution. |
| [Pass memberships](data/passes-2026-27.json) | Family access for the 2026/27 season. The details show discounts. The pass filter includes areas with lift access. |

Use the same area ID in the three files. Add one point for each area. Add at most one membership for each area and pass family. Palisades Tahoe uses one point with sources for both bases. A value with a plus sign sorts by its stated minimum.

The catalog checks for duplicate IDs and missing references. It checks eligibility and rejects conflicting values. Use HTTPS source URLs without embedded credentials. [Catalog validation](../../src/features/ski-status/catalog.ts)

## Local checks

Start Vite with `npm run dev` after you install the repository dependencies. Open `/projects/ski-status/map` on the local server.

Run the catalog tests.

```bash
npx vitest run src/test/skiStatus.test.ts
```

Run the browser regression tests.

```bash
npm run test:e2e -- tests/e2e/ski-status.spec.ts --project=chromium
```

## First release

Include active, public, lift-served downhill areas. An area qualifies with **at least 100 published skiable acres or included lift access on a supported pass**. Apply this rule throughout North America, including Alaska, Mexico, and Greenland. Start with Ikon, Epic, Indy, and Mountain Collective. Consider Powder Alliance next. Keep eligible areas visible in the off-season. [Powder Alliance eligibility](https://www.powderalliance.com/), [Visit Nuuk ski area](https://visitnuuk.com/providers/skiliften/), [Monterreal](https://www.monterreal.com/)

Whaleback has 86 skiable acres and qualifies through Indy lift access. Show Indy Allied discounts on areas that qualify. Use skiable acreage for the threshold. Resort property acreage can include lodging and terrain outside the ski area. [Indy Whaleback profile](https://www.indyskipass.com/our-resorts/whaleback-mountain), [Indy Allied terms](https://www.indyskipass.com/this-is-indy/news/whiteface-gore-and-belleayre-join-allied-program-as-indy-pass-announces-15-additional-resorts-for), [Monterreal property description](https://www.monterreal.com/)

### Map and table

- Show a map beside the table on desktops. Keep filters and selection when a phone user changes views.
- Group nearby markers at low zoom. Show individual markers at high zoom. Use one detail panel for map and table selections.
- Search by area name, alternative name, state, province, country, or town. Filter by family, product, ski date, operating status, and night skiing.
- Sort by any published statistic. Compare numbers in common units. Put unknown values last in both directions. Give reported and forecast snow their own columns.
- Group columns by mountain statistics, conditions, and season dates. Save visible columns and units on the device. Use **In map view** to limit results to the map bounds.
- Store filters, sort order, and the selected area in the URL. Keep the table usable if the basemap or renderer fails.
- Export filtered rows as CSV where licenses permit it. Include units, report times, and source links.

### Comparable mountain statistics

| Field | Definition |
| --- | --- |
| Area identity | Store the official name, website, ID, region, country, and time zone. Keep former names for search. Place the point near public lift access. |
| Skiable acres | Use the operator's published skiable area. Record which mountains or terrain the figure covers. |
| Lifts | Use the operator's total for the same area. Include surface lifts. Record the counts by lift type when available. |
| Elevation and vertical | Store the highest and lowest lift terminal elevations. Use their difference for lift elevation range. Keep the operator's skiable vertical. |
| Trails | Store the total and the number for each published grade. Keep the original basis for percentages such as trail count or terrain area. |
| Night skiing | Store yes, no, or unknown. Show night skiable acres when the operator publishes them. Track scheduled night operations in the conditions report. |
| Season dates | Keep planned and actual dates. Use the median of up to five completed seasons for each typical date. Verify at least three actual opening or closing dates for each median. |

Store values in common units. Keep the original unit and source. Display acres, feet, and inches by default. Offer metric units.

Use operator announcements and reports to verify season dates. Record the first and last days when the regular winter season has public lift access. Compare typical dates in winter season order across the year boundary. If you have fewer verified dates, show the published season window or mark the typical dates as unknown. Use the resort's time zone. Use **Year-round** for areas that offer lift access in every season. [Big SNOW specifications](https://www.bigsnowamericandream.com/press-room/), [Palisades Tahoe mountain statistics and season windows](https://www.palisadestahoe.com/footer/mountain-statistics)

## Inventory and data quality

### OpenSkiData audit

The November 19 download contained 12,440 world records. The audit selected named rows with `has_downhill=yes` and `status=operating`. The matching metadata reports a November 16 UTC build. Website counts indicate a populated source field. Lift counts indicate at least one mapped lift. [Ski-area CSV](https://tiles.openskimap.org/csv/ski_areas.csv), [Build metadata](https://tiles.openskimap.org/metadata.json)

| Geography | Candidate rows | Website present | Mapped lifts | Mapped elevation range |
| --- | ---: | ---: | ---: | ---: |
| United States | 571 | 529 | 511 | 526 |
| Canada | 273 | 239 | 235 | 257 |
| Mexico | 1 | 1 | 1 | 1 |
| Greenland | 3 | 2 | 3 | 3 |
| **Total** | **848** | **771** | **750** | **787** |

These counts precede the acreage and pass checks. Use operator sources for skiable acreage. A named row can describe one base area. Verify the mapped elevations with the operator. The CSV shows 3–4 m of elevation for indoor Big SNOW. The operator reports 160 ft of vertical and four skiable acres. [OpenSkiData schema](https://www.openskidata.org/#schema), [Big SNOW specifications](https://www.bigsnowamericandream.com/press-room/)

The CSV has SHA-256 `9c5a372b8d02aedd281fd387c581c16f48915d89abacec7eba0faa53726a9df5`.

### Build the catalog

1. Import a versioned OpenSkiData file. Import names, points, source IDs, and candidate websites. Check official pass lists and regional directories for missing areas. [OpenSkiData downloads](https://www.openskidata.org/#downloads), [NSAA inventory by state](https://nsaa.org/NSAA/About/Media/Industry_Stats/NSAA/About/Media/Industry_Stats.aspx), [Canadian Ski Council directory](https://www.skicanada.org/ski-area-list/), [Québec ski area directory](https://maneige.ski/en/stations-et-conditions/)
2. Match by source ID or a verified name and location. Assign a stable local ID for links, reports, and visits. OpenSkiData feature IDs can change between builds. [OpenSkiData feature IDs](https://www.openskidata.org/#whats-in-the-data)
3. Review uncertain matches. Group bases when the operator publishes combined statistics. Palisades Tahoe publishes combined resort statistics. Keep independently operated areas separate if they share a pass allowance. [Palisades Tahoe statistics](https://www.palisadestahoe.com/footer/mountain-statistics), [Ikon access comparison](https://www.ikonpass.com/en/compare-benefits)
4. Verify eligibility with operator acreage or a current pass list. Record the reason and source. Keep areas with unresolved acreage in the review list. Remove duplicate, closed, and private areas from the release catalog.
5. Add operator statistics for each eligible area. Record the source URL, verification date, and scope. Label mapped lift terminal estimates. Use operator statistics for the official trail count. [OpenSkiData data definitions](https://www.openskidata.org/#whats-in-the-data)
6. Count resolved and unresolved candidates by region. Measure coverage for acres, elevations, grades, night acres, and dates. Skibowl reports total acres and the number of lit runs. Keep night skiable acres unknown until you find a source. [Skibowl statistics](https://skibowl.com/about-winter/stats/)

### Similar tools

PisteFinder compares mapped terrain and filters areas by pass. OnTheSnow groups reports by pass and shows forecasts and webcams. For ski-status, put date-specific pass rules, mountain statistics, and report times in one sortable table. [PisteFinder](https://pistefinder.com/), [OnTheSnow app](https://www.onthesnow.com/news/mobile/)

## Pass access by product and date

Create a reviewed file for each season and pass family. Record the product, area, access type, valid dates, and day allowance. Record shared allowances, blackout dates, and reservation rules. Include consecutive-day and weekday restrictions when they apply. Keep the source and verification date on each rule. Keep rules for past seasons.

| Program | Launch products and rules to verify |
| --- | --- |
| Ikon | Ikon, Base, and Session variants. Alta and Snowbird share Ikon days, with Snowbird access under Base. Store each partner's reservation and access rules. [Ikon 2026/27 comparison](https://www.ikonpass.com/en/compare-benefits) |
| Epic | Epic, Epic Local, and Day Pass variants by duration, resort tier, and peak-date option. The 4–7 day All Resorts products can include Canadian Rockies partners. Verify specialty products before adding their filters. [Epic products](https://www.epicpass.com/), [Epic partner rules](https://www.epicpass.com/regions/partner-resorts.aspx), [Peak dates](https://www.epicpass.com/info/peak-restricted-dates.aspx) |
| Indy | Base, Indy+, and Add-On variants. Track excluded dates and reservations by area. Record Allied discounts separately from included ski days. [Indy products](https://www.indyskipass.com/shop), [Blackouts and reservations](https://www.indyskipass.com/blackout-dates-reservations) |
| Mountain Collective | Included days, any published bonus days, and advance reservations where required. [Pass terms](https://mountaincollective.com/), [Destination reservation rules](https://mountaincollective.com/how-to-use-my-pass/) |

The family filter finds included partners for the season. When the user selects a product and date, apply the rules for the resort's local date. Show **Included**, **No access**, **Blackout**, **Reservation required**, or **Rules unverified**. Show reservation requirements on eligible results. Show the total allowance and any shared days. Individual usage and reservation availability need their own sources.

Review the pass lists at the start of each season. Check for changes each week. Confirm each change with the pass operator. Keep pending changes visible until the review completes.

## Current conditions

### Sources and pilot

| Source | What it can supply | How to use it |
| --- | --- | --- |
| Resort reports | Operating status, lifts, trails, acres, base depth, measured snowfall, and night operations. Whistler has separate pages for snow and terrain. | Start with operator links. Add feeds from sources that permit reuse. [Killington mountain report](https://killington.com/mountain-report), [Whistler snow report](https://www.whistlerblackcomb.com/the-mountain/mountain-conditions/snow-and-weather-report), [Whistler lift and terrain status](https://www.whistlerblackcomb.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx) |
| Open-Meteo | Current weather estimates and forecasts for temperature, wind, precipitation, and snowfall. | Use one named base location per area. Show the forecast period and location or elevation. Show the model time when available. [Forecast API](https://open-meteo.com/en/docs), [Noncommercial access](https://open-meteo.com/en/pricing) |
| SnoCountry | Resort and regional feeds with counts of open lifts, trails, and acres where available. | Evaluate the feed if operator reports leave large gaps. The full feed requires a paid key. Verify coverage and terms before use. [SnoCountry API](https://feeds.snocountry.net/) |
| Mountain News and Skiresort Service | Paid resort and mountain data feeds. Mountain News includes report times and fields that resorts supply. | Compare the resort list and field coverage before using a paid feed. [Mountain News partner API](https://partner.docs.onthesnow.com/api-reference/ski-resort-snowreport-api), [Skiresort Service product description](https://www.skiresort-service.com/fileadmin/user_upload/skiresort-service/content/engl/Skiresort-access-snow-reports-ski-resort-data-ski-weather.pdf) |

On November 19, the SnoCountry demo returned Bolton Valley, Bromley, and Burke. Each report had a time and an opening status. Base depth, recent snowfall, and open lift, trail, and acre counts were empty. Measure field coverage and report age during winter operation. [SnoCountry public example and field definitions](https://feeds.snocountry.net/)

### Report and forecast rules

- Store operating status with each report. Use open, limited, temporarily closed, season closed, or unknown. Store planned opening dates and the area's daily schedule.
- Show open and total lifts, trails, and acres when reported. Calculate closed counts and percentages from counts with the same scope and time. Use distinct columns for **trails open %** and **acres open %**.
- Keep the snow depth unit, range, and measurement location. Show the reporting period for new snow. Use one column for forecast snow. Show empty values as unknown. Show reported zeros as zero.
- Keep the operator's report time and the time the app retrieved it. Mark pilot reports older than 24 hours as stale. Keep the last report and date visible. Identify missing fields on new reports.
- Use a freshness limit for each source when its schedule changes. Show the date of an official seasonal closure. Calculate report age from the source time.
- Publish a count of recent reports and a count for each main conditions field. Show the operator's link when the report is incomplete or stale.

## Repository and hosting design

The project uses React, TypeScript, Vite, and MapLibre. The `/projects/ski-status` route opens `/projects/ski-status/map`. Keep data preparation in `projects/ski-status/`. Keep feature code in `src/features/ski-status/`. Use the shared CARTO configuration and map recovery. [CARTO basemap configuration](../../docs/carto-basemaps.md), [Existing project routes](../../src/App.tsx)

Use a GeoJSON source for clustered points and typed JSON for table data. Join static facts, pass rules, reported operations, and forecast snapshots by the local area ID. A single filter result drives the map and table.

```mermaid
flowchart LR
    A[OpenSkiData and operator statistics] --> E[Area catalog]
    B[Official pass rules] --> F[Season and product rules]
    C[Resort operations reports] --> G[Operations snapshots]
    D[Weather models] --> H[Forecast snapshots]
    E --> I[Map and sortable table]
    F --> I
    G --> I
    H --> I
```

Use scheduled jobs for feeds. Update verified pass rules by hand. Publish checked JSON to `data.rsmb.tv` through S3 and CloudFront. Limit publisher access to the `ski-status` prefix. Keep partner keys in the scheduled job. [Repository geospatial delivery review](../../docs/reviews/2026-11-13-geospatial-delivery-research.md#reusing-s3-and-cloudfront), [GitHub OIDC setup](../../docs/github-actions-oidc.md)

Publish catalog and pass files by revision. Refresh weather and reports on their own schedules. Upload each data file before you update the manifest. Include the schema version, catalog revision, coverage, and times. Keep the last valid file when a source fails or returns invalid data. Write one manifest update at a time. Save the previous manifest for rollback.

Refresh pilot forecasts every six hours. With 400 areas and one point per area, this gives 1,600 location updates per day. Retries and selected variables can increase the call count. Open-Meteo lists 10,000 daily calls and 300,000 monthly calls for noncommercial use. Check the actual call count. Keep capacity for retries. Update operations reports each hour where the source supports it. [Open-Meteo plans and call accounting](https://open-meteo.com/en/pricing)

Credit sources where their data appears. OpenSkiData permits use under ODbL and requires source credits. Limit automatic downloads to once per day. Build tiles from the downloads. Publish modified ODbL data with its license and attribution. Verify each feed's terms for storage, display, and export before use. [OpenSkiData terms and attribution](https://www.openskidata.org/#license), [OpenStreetMap Foundation licensing guidance](https://osmfoundation.org/wiki/Licence/Community_Guidelines)

## Implementation sequence and acceptance checks

| Stage | Deliverable | Acceptance check |
| --- | --- | --- |
| 1. Catalog pilot | Review 25 eligible areas. Include a small pass partner, a resort with multiple bases, and an area with night skiing. | Verify eligibility, points, source links, and field definitions for each area. Publish coverage for the pilot. |
| 2. Map and table | Build the views, details, search, sortable columns, URL state, and unit choices. | Check that views use the same results and selection. Test keyboard access, phone layout, and map recovery. Verify sorting for zero, unknown, and stale values. |
| 3. Pass products | Add date rules for the first four families. Verify them against official season sources. | Test shared days, reservations, excluded products, blackout date boundaries, and discount partners. Match every included partner or record why it is outside scope. |
| 4. Conditions pilot | Add forecasts and official report links. Schedule updates from permitted sources. | Measure fresh status, terrain, depth, and snow for a week. Compare values with operator reports. Test failed updates, stale reports, empty values, zero, and partial openings. |
| 5. First release | Review eligible areas by region. Expand report coverage. Publish coverage by field and source. | Verify the reason for each area's inclusion and its website. Verify the source and time on each report. Count areas with a fresh report. |

At four minutes per area, manual review of 848 candidates takes about 57 hours. Start with official pass lists and regional directories. Use the map data to find matches. Review uncertain areas and areas near the acreage threshold. Measure the time for 25 reviews before you estimate the full catalog. Use existing hosting and the free forecast feed for the pilot. Measure report coverage before you consider a paid feed.

## Version 2

### Runs and lifts at resort zoom

Show named runs, lift lines, and terminals from OpenSkiData at resort zoom. Use local difficulty grades. Link to the resort map. Report incomplete mapping. Load one resort at a time. Use PMTiles on S3 and CloudFront if tests show a benefit. Check byte range requests, caching, and attribution on hosted tiles. [OpenSkiData runs and lifts](https://www.openskidata.org/), [PMTiles on cloud storage](https://docs.protomaps.com/pmtiles/cloud-storage), [Repository tile delivery review](../../docs/reviews/2026-11-13-geospatial-delivery-research.md)

### Access routes and webcams

Start with Washington and British Columbia. Match each resort base to road segments and directions. Use US 2 for Stevens Pass. Use the applicable Highway 99 segments for Whistler. Match closures, restrictions, and cameras by agency ID and road geometry. Show the agency's report time. Mark missing coverage as unknown. Link to agency cameras. Embed views where an agency permits it. Consider Utah's feed for expansion. [WSDOT Traveler Information API](https://apps.wsdot.wa.gov/traffic/api/), [DriveBC Open511](https://api.open511.gov.bc.ca/help), [BC HighwayCams](https://images.drivebc.ca/bchighwaycam/pub/html/www/index.html), [UDOT API](https://www.udottraffic.utah.gov/developers/doc)

### Visited areas

Add a **Visited** toggle and an optional ski date. Store visits on the device with stable area IDs. Add a visited filter. Support backup import and export. Keep visits attached when an area name or source ID changes. Add account synchronization if users need visits on more than one device.
