---
name: ski-status-data-quality
description: Verify ski-status resort data in acreage order. Fill catalog gaps and collect winter highway approaches, mountain passes, trail maps, peaks, and icons. Save batch checkpoints and archive verified assets on the project NAS.
---

# Improve ski-status data in batches

Start at the repository root. Read the task list and the sections of the guide for this batch. Use the current data and the JSONL log to find cases that need review. Use dated reviews for earlier results. Run `git status --short`. Limit changes to the batch's data, assets, and research records. Save the changes in the local checkout for review. [Project tasks](../../../TODO.md), [Project guide](../../../readme.md#catalog), [Batch checkpoints](../../../research/data-quality-log.jsonl)

## Choose a batch

Use one batch of up to 10 resorts by default. Use the scope and size the user requests. For a candidate review, use the candidate log. [Candidate review](#verify-and-apply-evidence)

1. Rank catalog areas in `data/areas.json` by published skiable `acres`, from largest to smallest. Include `downhill` and `both`. A missing skiing type means `downhill`.
2. Use the recorded minimum for a published lower bound. Use area ID to break ties. Keep areas with unknown acreage unranked until a source gives a value.
3. Start with the largest area that has a check due. Use its current records and latest checkpoints to resume where work stopped.
4. Finish the area's applicable checks before you start a smaller area. Re-rank the queue after you verify a new acreage. Use the same order in later batches.

After the ranked queue, review unranked areas for published acreage and other gaps. Put an area in the ranked queue when you verify its acreage.

## Complete each resort

- Verify `baseFt`, `summitFt`, `acres`, `verticalFt`, `liftCount`, and `trailCount`. Check the official conditions link, season dates, snowfall, ski pass rules, and catalog links. Use current source records. Keep reported zero and `false` values.
- Check the verified winter entrance, lodges, parking, shuttles, trail maps, named peaks, day tickets, webcams, and icon. Check the road approaches to the public bases. [Seasonal resort access](#seasonal-resort-access), [Road approaches](#road-approaches), [Resort icons](#resort-icons)

Check related fields while the source is open. Treat earlier reviews as evidence for the fields they cover. Include road approaches when you return to a resort.

Mark an area complete when each applicable field has a verified value or evidence that it is unpublished. Record fields that do not apply. When a gap needs new evidence, record a deferral. Finish the area's other checks before you continue. Recheck larger deferred areas first when their checks are due. [Batch checkpoints](#validate-and-checkpoint)

## Verify and apply evidence

Open the source and locate each fact you need. Start with operators and pass issuers. Use public agencies, ski associations, and tourism authorities for the same area and measure. Check local-language sources and the date of the record. Use search results and mapped geometry to find published sources. Keep mapped values in the mapped fields. If values differ, compare the season, area boundary, and measurement. Use the value with the best evidence. Leave unsupported fields empty. Record what you must check next.

| Work | Apply verified changes |
| --- | --- |
| Mountain statistics | Edit `data/areas.json`. List each field once in `statSources`. Group fields with the same direct HTTPS source, check date, and note. In the note, record scope, original units, conversions, and calculations. Verify a single skiable descent before you calculate vertical. Keep published lower bounds. Verify export terms before you add `exportLicense`. [Measurement rules](../../../readme.md#comparable-mountain-statistics) |
| Conditions links and dated reports | Open the operator's report or its linked service. Check the area before you set `reportUrl` and `reportCheckedOn`. Verify reuse terms for a report in `data/conditions/operator-reports.json`. Use a source timestamp or a verified local ski date. Match the area and time for open and total counts. Check the Rockies pilot procedure and record terms that need review. [Report rules](../../../readme.md#report-and-forecast-rules), [Pilot checks](../../../readme.md#conditions-publication) |
| Ski pass access | Match the current membership file and product rules by area ID, pass family, and season. Use `data/passes-2026-27.json` and `data/pass-rules/` for 2026/27. Check Indy rules first for the selected resort. Verify products, dates, allowances, shared groups, blackouts, reservations, and exceptions. Check the resort's redemption terms. Leave unverified product rules open. [Pass rules](../../../readme.md#pass-access-by-product-and-date) |
| Season events and snow | Use dated operator records for the first and last lift-served days in `data/seasons.json`. Use the separate fields for plans and typical seasons. Record the snow measure, location, period, and source in `data/snow-history.json`. Check station distance and reading coverage. Keep zeros. Cite a separate source for an annual total when applicable. [Season dates](../../../readme.md#opening-and-closing-dates), [Snow methods](../../../readme.md#snow-history-methods) |
| Candidate review | Filter the North American log by region and `unresolved`. Verify active public access and catalog eligibility. Check duplicates, shared areas, and specialty areas. Record the decision, reason, source, and date. For `eligible`, record the matching catalog ID and location. Use `unresolved` with a specific `nextCheck` for uncertain matches. Recount the regional summary. [Eligibility](../../../readme.md#first-release), [Candidate log](../../../research/north-america-2026-11-16.csv), [Regional summary](../../../research/north-america-2026-11-16-summary.csv) |
| Entrances and links | Use operator directions to check public winter entrance coordinates in `data/resort-bases.json`. Match Wikipedia titles to the ski area. [Catalog](../../../readme.md#catalog) |

Use existing IDs, schemas, units, and formatting. When you add a resort, update the related records in the same batch. Use the check date for citations. Use the resort's local ski date for operations.

## Resort icons

Check icon coverage for each resort you review. Include new candidates that qualify for the catalog. Use the resort checkpoint to resume deferred icon checks.

Find the official mark in the press kit, favicon, Apple touch icon, or web manifest. Confirm that it represents the resort or its official group. For this personal project, skip resort logo licensing checks. Bundle one verified official mark per catalog area. Reuse a verified mark and its source from an earlier NAS manifest when available. Archive the original and both preview sizes. [Icon sizes and archive](#archive-new-assets-at-the-end-of-the-run)

Use the 84 × 84 PNG as the shared runtime icon for the map, Results, and details. Save it as `runtime/resort-icons/<areaId>.png` in the NAS asset folder.
Verify the saved file's SHA-256 checksum and add it to `data/runtime-icons.json` with the key `resort-icons/<areaId>.png`.
Add its HTTPS source to `iconSources[areaId]` in `data/resort-links.json`.
Run `skiStatusResortData.test.ts` to check for one source per icon.
Verify the runtime file loads on the map, in Results, and in details. Use Vite's test mode or a production build to exercise the runtime files directly. Check the map's fallback symbol and record readability issues as follow-ups. [Asset folder](../../../readme.md#local-assets), [Icon registry](../../../../../src/features/ski-status/resortDetailsData.ts), [Map layers](../../../../../src/features/ski-status/skiMapLayers.ts)

Add an `icon` target for each missing mark you check. When you defer a mark, record its URL and the next check. Count bundled icons before and after the batch. Use only catalog area IDs.

## Seasonal resort access

Check these fields for each resort. Use the resort's local ski season. Record the season, check date, and direct source for each fact. Verify it again if the operator or user reports a change. Keep camera playback and temporary closures tied to their check date. Record follow-ups for open items.

- **Main lodge and map pin**. Verify the primary public winter lodge name and location. Compare the current marker with operator directions or a base map. Record other public bases. Update `data/resort-bases.json` when a source verifies a new visitor point. Use longitude and latitude for a precise point. [Map placement](../../../readme.md#map-display)
- **Webcams**. List the cameras on the operator's page. Record the camera position or elevation and the view if available. Save the public page and any verified public stream or embed URL. Record the format. Give the published terms for embedding and rebroadcast. [Access routes and webcams](../../../readme.md#access-routes-and-webcams)
- **Parking**. Record published lot locations, visitor or permit rules, reservations, and free or paid periods. Record currency, times, and restrictions for each rate. Check overflow and shuttle service. Leave rates and rules blank when the operator gives only locations.

Save the facts by area ID in `projects/ski-status/research/resort-access-YYYY-YY.json`. Use `resort-access-YYYY.json` for a single-year season. Set `season` and `resorts` at the top level. Set `checkedOn` for each resort. Use the fields `lodges`, `mapPin`, `webcams`, `parking`, `trailMaps`, or `liftTickets` when verified. Give each fact a source. Keep the original check date when a later review checks a different field. List verified and deferred targets separately in the checkpoint.

## Road approaches

Use operator directions to identify the main winter driving approaches to public bases or parking lots. Check each published approach separately. Include common alternate approaches when the sources document them. Use road agency maps to verify highway numbers, junctions, and named mountain passes on each route.

Save the records in `projects/ski-status/research/road-approaches.json`. Use HTTPS source URLs and `YYYY-MM-DD` check dates. Use these two objects.

| Object | Fields |
| --- | --- |
| `approachesByArea` | Use the catalog area ID as the key. Store a list of approaches. Give the origin town or junction in `from`. Give the winter base or lot in `to`. Record `roads` and `passIds` in driving order. Include `source` and `checkedOn`. Add official `statusUrls` and `additionalSources` when available. |
| `mountainPasses` | Use a stable pass ID that includes the jurisdiction. Record the official `name`, the `road`, and `coordinates` as `[longitude, latitude]`. Put the point where the road crosses the pass. Include `source` for the location and `checkedOn`. |

Reuse the same pass ID when different routes cross the same point. Use an empty `passIds` list for a verified route without a named pass. If the crossing remains uncertain, omit `passIds` and record the next check. Give each published seasonal rule in `restrictions` a `description`, road agency `source`, and `checkedOn` date. Use the official status links for current closures. [Access routes and webcams](../../../readme.md#access-routes-and-webcams)

## Official trail maps and lift tickets

- **Trail maps**. Open the operator's winter map. Check its season, labels, and area coverage. Open the print or full-size download. Compare files for the same edition and area. Use a vector print PDF when it gives the clearest labels. For raster files, use the highest native resolution with complete coverage and readable labels. Save the original file. Record the official page, direct HTTPS download, season, and coverage in `trailMaps`. Include maps for separate bases or activities. If no download is available, record the public page and the gap.
- **Mountain peaks**. Check the named summits on each map. Verify their positions with a geographic names office or a topographic map. Record verified peaks in `data/resort-peaks.json`. Use the same peak ID for a summit that appears on maps from more than one resort. Record a deferral if you cannot match a label to a summit. [Peak records](../../../readme.md#mountain-peaks)
- **Ski-area boundaries and backcountry gates**. Check published boundaries and marked gates on operator or land manager maps. Record the mapped feature, season, source, and check date in the research log. Record a deferral if you cannot verify its location. [Terrain audit](../../../readme.md#openskidata-audit)
- **Lift tickets**. Find the operator's adult full-day downhill price in local currency. Record the price, published minimum, or price range in `liftTickets`. Give the dates, product, sales channel, and source. Include published taxes, pass rules, and required card fees. For dynamic prices, record the ski dates you sampled and the check date. Leave the price open when the source has no price for that season.

## Validate and checkpoint

Check each change against its source. Review the diff for unrelated edits. Run the focused tests for the data you changed. Run `npm run test:ski-terrain` for candidate CSVs or terrain records. Fix regressions before you mark the batch as verified. [Local checks](../../../readme.md#local-checks)

When road approaches change, run the road approach test. It checks area IDs, pass references, roads, coordinates, sources, and dates.

```sh
git diff --check
npx --no-install vitest run src/test/skiStatus.test.ts src/test/skiStatusRelease.test.ts src/test/skiStatusSeasons.test.ts src/test/skiStatusResortData.test.ts
npx --no-install vitest run src/test/skiStatusRoadApproaches.test.ts
```

Add one JSON object per verified batch to `projects/ski-status/research/data-quality-log.jsonl`. Create the file on the first run. Record the batch using these fields.

- Set `finishedAt` to an ISO timestamp in UTC.
- Set `before` and `after` to the counts for the fields you checked.
- Put the test commands and results in `checks`.
- In `attempts`, set the `work`, `key`, and `targets` for each case. Use an area ID or candidate URL as the key. List the fields, series, season, or products in `targets`.
- For road checks, use `road-approach` in `work`. List the directions, highways, or mountain passes that you checked in `targets`.
- For peak checks, use `mountain-peak` in `work`. List the summit names in `targets`. If the map shows no named summits, record that result with the map source.
- Set each `outcome` to `updated`, `confirmed`, or `deferred`. Include the sources you opened. For a deferral, specify the `nextCheck`. Set `retryOn` if a source is due to change.

Read the last entry for each target before you repeat a search. Recheck a deferred target when its retry date arrives or when you find a new lead. Count only the targets you reviewed.

## Save each batch snapshot

Create a dated directory under `N:\projects\ski-status\data-quality`. Copy the changed data files, access records, and both batch logs to that directory. Keep the paths relative to the project. Use the WSL mount at `/mnt/n/projects/ski-status` or the Windows `N:` mapping. Verify the copies against the local files. Record the snapshot path. If the share is unavailable, record the pending copy and continue locally. Keep new assets in a local staging directory for the run. Record their paths until you verify the archive.

## Report each batch

After each batch, give an update before you start the next one. Include the changes in field coverage and the test results. Give one short line per resort or candidate. State what you checked, the result, and any remaining check. Use “confirmed” for the fields you reviewed. Name the next batch.

Append the recap to `projects/ski-status/research/data-quality-log.md`. Give the batch number and date. Use one table row per case. Keep source URLs and retry details in the JSONL log. Update the coverage counts in the guide and keep dated research results.

Stop after one batch unless the user asks for more. For a longer run, start the next due batch after the recap. Stop when you reach the requested limit or when no cases are due. In both cases, finish the archive and report. If no cases are due, give the next retry date or trigger.

## Archive new assets at the end of the run

Copy each new or improved asset to `N:\projects\ski-status\assets`. Use the mount or mapping for the batch snapshot. Keep the exact bytes of published originals. This includes map PDFs, images, ICO files, and SVG files. Use area IDs and published map editions in the paths.

| Asset | Path relative to the NAS asset library |
| --- | --- |
| Trail map original | `trail-maps/<areaId>/<season-or-undated>/<filename>` |
| Logo or favicon original | `resort-icons/<areaId>/<source-sha256>/original/<filename>` |
| Map icon | `resort-icons/<areaId>/<source-sha256>/map-40.png` |
| Details panel icon | `resort-icons/<areaId>/<source-sha256>/details-84.png` |
| Other collected assets | `<asset-kind>/<areaId>/<filename>` |
| Run manifest | `manifests/<UTC-run-id>.json` |

Make transparent square PNGs with lossless compression. Use 40 × 40 pixels for the 20 px map marker. Use 84 × 84 pixels for the 42 px panel icon. Use the best official source for each size. Render vector art at the target size or decode a suitable ICO frame. Center the mark with transparent space around it. Keep its aspect ratio. Convert it to sRGB and remove unnecessary metadata. Check both display sizes against the app background. Record a follow-up if an icon is hard to read. [Map marker sizing](../../../../../src/features/ski-status/skiMapLayers.ts), [Details header sizing](../../../../../src/features/ski-status/SkiAreaDetails.tsx)

Set `version` to `1`. Set `archivedAt` to the archive time in ISO 8601 format.
List each file in `files`. Record its kind, area ID, source URL, check date, relative path, format, byte count, and SHA-256 checksum.
For a map, give its edition and coverage. Use the same edition for the folder name. Replace the slash with a hyphen.
For an icon variant, give its source checksum and dimensions.
Reuse files with the same checksum. Keep earlier editions.
Add a checksum suffix when the same file name has different content.
Verify the copy against the manifest. If the NAS is unavailable, keep the staged files. Record the pending copy.

## Summarize the run

After the archive check, add a run summary to the log. Report the same results in your final reply.

- Give the batch and case counts, changes in coverage, and test results.
- Count the resorts with checked road approaches and the mountain passes recorded.
- Count archived trail maps, original icons, and icon variants.
- Give the NAS manifest path and remaining checks.
- If the run ends early, report completed work and pending copies.
