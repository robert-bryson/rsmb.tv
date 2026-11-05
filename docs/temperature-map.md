# Temperature record map

The map shows recent station records and standing county and state extremes.
The [historical pipeline](../projects/temperature-records/readme.md) is a separate project. It does not supply this map.

## Recent records

Open `/projects/temperature-records/map` for recent station records.
Select **Yesterday** or **Last 7 Days** to change the observation period.
Period controls remain visible when the records panel is closed.
Open **Filters** to select a state, record scope, or minimum margin.
Use **Clear filters** to remove these three filters. Other URL settings remain unchanged.
An empty filtered result says that no records match the filters.

Each record with valid coordinates has a marker at its station location.
A solid red marker identifies a record high. A blue ring identifies a record low.
The source does not cluster points at any zoom level.
Nearby records can overlap. The map does not move stations to separate them.

Temperature labels use a separate symbol layer.
The map hides a label when it conflicts with another label.
Zoom in to make more room for labels.
Hidden labels do not remove their markers.

Click a marker to open its popup and station history.
Click a recent-record list row to open station history and move the camera to its location.
Closing station history returns keyboard focus to the list row.
The list keeps its expanded rows and scroll position while station history is open.
The visible marker takes priority over a nearby station's larger glow.
A click on a glow also selects its record when no inner marker is under the pointer.

The unit control changes temperatures in labels, hover text, and popups.
The minimum-margin filter uses Fahrenheit differences in both unit modes.
Changing the view clears the selected station or state.
Zoom changes and data updates preserve the selection.
Changing a recent-record filter or period clears station selection.
The initial camera fits the contiguous United States at phone and desktop widths.
The state filter frames its stations. A single station becomes the camera center.
Panel changes preserve the current zoom.
Use absolute padding for viewport fits. MapLibre otherwise adds fit padding to the current camera padding.

## Freshness and coverage

The map displays the snapshot update date and geographic coverage together.
County coverage comes from the loaded county records. It does not use attempted request counts.
Missing states appear in the status text. The status tooltip lists all missing states.
Recent coverage requires completion metadata for every date in the selected period.
Older snapshots without this metadata show **Coverage unverified**.
Recent snapshots become stale after two days. Standing-record snapshots become stale after 45 days.

## Sync and recovery

The sync checks ACIS responses before it uses or caches them.
Each POST request has up to three attempts.
The sync waits one second before attempt two and two seconds before attempt three.
Each attempt has a 60-second deadline by default, including the response body.
Monthly threshold, full-month series, and station-series fallback requests use 120 seconds per attempt.
HTTP 200 does not prove that a response contains valid data.
Errors, empty responses, invalid station metadata, and invalid summary structures cause another attempt.
A daily response must contain at least one usable station observation.
Missing values, malformed numbers, and non-finite numbers do not count as observations.
Zero degrees is valid. A day with observations and no broken records is also valid.

The sync validates cached historical responses before reuse.
It fetches a replacement when a cached response is invalid.
Failed responses do not enter the response cache.

Recent coverage requires successful requests for all 48 contiguous states on each date.
County coverage is checked after county metadata filtering.
Daily archives require verified state completion before reuse.
Archives without this metadata must be regenerated.
A warning identifies unverified coverage, unavailable archives, or missing station metadata.
Rebuilt records replace that date's previous summary rows. This also removes old rows when the rebuilt date has no records.

The sync keeps record files in memory until all upstream requests and validation checks succeed.
An upstream failure leaves the previous record files in place and exits with code 1.
After validation, the script replaces each output file atomically.
The complete file set is not one transaction.
The workflow uploads files only after the script succeeds.
An interrupted upload can leave different object versions visible together.

Monthly historical requests compare the matching calendar month in prior years.
February sampling includes leap-day observations from leap years and complete February observations from ordinary years.
A separate current-year sample includes only days preceding the target observation.
Both fresh generation and archive repair require historical monthly values when calendar-date records prove that history exists.
New stations without prior-year records can legitimately lack those values.

Full archive repairs also verify current-month coverage for each archived station before reducing the series.
If a state response omits a station, a cached `StnData` fallback must identify that station and supply every requested date with valid temperatures or explicit `M` values.
At most eight omitted stations per state/month receive this fallback; broader omissions fail the repair.
Malformed or unverifiable responses cannot replace archive thresholds or mark an archive as version 2.

Run a local recent-record sync with a writable cache directory:

```bash
TEMP_DATA_DIR=.temp/temperatures node scripts/sync-temperatures.js --recent-only
```

For a hosted sync, run the **Sync Temperatures** workflow.
Enable **full_sync** to refresh state, county, and trend records.
Enable **repair_monthly_archives** once to regenerate every stale archive's derived monthly fields before the rolling sync. It preserves raw observations, recovers missing station metadata through ACIS, and stages the results before uploading. Routine rolling syncs also repair old versions instead of reusing their summaries. Version 2 thresholds select the matching calendar month, include earlier observations in the current month, and retain monthly predecessor dates.

To stage a repair locally from downloaded archives:

```bash
TEMP_DATA_DIR=.temp/temperature-repair TEMPERATURE_DATA_BUCKET='' npm run repair:temperature-archives -- --source /path/to/daily --stations /path/to/stations.json --out .temp/temperature-repair/daily
```

Without `--source`, the command downloads all archives and the station catalog from `TEMPERATURE_DATA_BUCKET` using AWS CLI credentials. It never uploads by itself.
Use an output tree disjoint from the source archives, preserve the source station catalog, and inspect the staged archives before publishing.
The release validator requires `monthlyThresholdVersion: 2` in the public recent summary.
An existing version 2 marker does not establish that older staging passed the newer station-coverage checks: rebuild such staging from the original archives.

The [November 5 backfill audit](performance/2026-11-05-temperature-full-backfill.json) records the fresh local staging, verified station fallbacks, and preservation checks.
Twelve legacy daily thresholds disagree numerically with the newer historical monthly tables; none affects the audited October 29–November 4 window.
Their cause remains unverified. The repair preserves raw observations and legacy daily thresholds without forcing the two derived snapshots to agree.
Archive and schema checks do not independently establish historical source accuracy or resolve later ACIS corrections.
Corrected data publication and production verification remain pending.
Check `countyRecords.json`, `summary.json`, and recent per-date coverage after a full sync.
The pending production verification is tracked in [TODO.md](../TODO.md).

## Other views

- **County Extremes** shows standing county highs and lows.
- **State Extremes** shows certified state records.
- **Record Age** colors standing county records by the year they occurred.

The selected high or low tab controls emphasis in the county and state views.
Standing records exclude records that later observations replaced.
Use the [methodology](../projects/temperature-records/methodology.md) for the separate historical estimator and its limits.

## Code ownership

| File | Responsibility |
| --- | --- |
| [`TemperatureMap.tsx`](../src/features/temperatures/components/TemperatureMap.tsx) | Map lifecycle, layers, URL state, hit testing, and panels |
| [`temperatureMapLayers.ts`](../src/features/temperatures/map/temperatureMapLayers.ts) | Recent-record GeoJSON and record-age colors |
| [`temperatureMapPopup.ts`](../src/features/temperatures/map/temperatureMapPopup.ts) | Escaped map text and record-age popups |
| [`useTemperatureData.ts`](../src/features/temperatures/hooks/useTemperatureData.ts) | Validated data requests and loading state |
| [`cartoBasemaps.ts`](../src/maps/cartoBasemaps.ts) | Shared basemap configuration and attribution |
| [`maplibre.ts`](../src/maps/maplibre.ts) | Bundled worker URL shared by all MapLibre maps |
| [`TemperatureDataStatus.tsx`](../src/features/temperatures/components/TemperatureDataStatus.tsx) | Snapshot freshness and geographic coverage |
| [`TemperatureTrendsDrawer.tsx`](../src/features/temperatures/components/TemperatureTrendsDrawer.tsx) | Charts loaded when the drawer opens |

Data can arrive after the map loads.
Apply visibility and temperature units after each layer's data becomes available.
Keep popup cleanup separate from layer updates. A data update must not close the selected station.

Register one delegated pointer handler for the interactive layer set.
Use the first rendered feature to select the visible record.
Separate handlers for dots and glows can select different stations from one click.

Escape all external text before inserting it into popup HTML.
This includes a date formatter's fallback text. A string schema does not make HTML safe.
Validate calendar dates before rendering. A `YYYY-MM-DD` pattern alone permits invalid dates.

Each view loads only its required record feeds. Summary metadata does not block record rendering.
If a record feed fails, the map keeps its container and view controls.
Select another view to use a different feed. **Retry** reloads the page.
The companion age map loads county records and summary metadata, without recent or state feeds.
Use the shared MapLibre entry point when adding a map. Its worker URL works on direct production visits.

## Validation

### Unit and sync checks

Run the focused unit tests from the repository root:

```bash
npx vitest run src/test/TemperatureMap.test.tsx src/test/temperatureDataStatus.test.tsx src/test/temperatureSchemas.test.ts src/test/temperatureMapLayers.test.ts src/test/temperatureSummaryPanel.test.tsx src/test/useTemperatureData.test.ts scripts/__tests__/syncTemperatures.test.ts scripts/__tests__/monthlyTemperatures.test.ts scripts/__tests__/repairTemperatureArchives.test.ts scripts/__tests__/temperatureArchives.test.ts scripts/__tests__/temperaturePublication.test.ts scripts/__tests__/networkTimeouts.test.ts
```

Unit tests verify label collisions, late data, units, view changes, and escaped popup dates.
They also check calendar dates, leap years, unusable observations, and freshness changes over time.
Map error tests check worker failures, WebGL failures, context loss, and nonfatal resource errors.
Fatal errors remain visible after record source loading completes.

Sync tests check retries, invalid cache replacement, archive reconstruction, and all seven legacy dates.
Publication tests run the CLI in temporary directories.
They check output preservation after persistent daily, historical, and monthly failures.
Subprocess execution does not contribute to Vitest coverage.

### Browser checks

Run the browser tests:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:temperatures:browser
```

The browser tests use fixed data, neutral basemap tiles, and an empty font response.
They count rendered high and low markers at phone and desktop widths.
They also check period changes, Celsius hover text, and selection where a glow overlaps another marker.
The dedicated command builds production assets with fixture content before starting the browser tests.
It also checks phone filters, selection after **Show more**, focus restoration, coverage, and independent data requests.
CI runs these production checks in Chromium and WebKit.
Screenshots use CSS pixels, including on Retina displays.
Marker cases check both period changes and the return to **Yesterday**.

Pixel checks preserve the MapLibre WebGL drawing buffer, which holds the rendered frame.
Linux WebKit can otherwise capture cleared or stale frames after compositing.
The snapshot helper changes only `webgl` and `webgl2` requests from MapLibre canvases.
Contract tests check both context types, requested options, unrelated canvases, unsupported names, and 2D drawing.
Startup, control, and independent-feed cases use the default drawing buffer.
A startup case checks this configuration explicitly.

Initial map readiness uses the remaining 30-second test budget, including worker startup and active record source loading.
The wait stops when the map reports an error. The test error includes available alert text.
Marker checks and period changes retain their five-second assertion budgets.
Both marker widths also run with a delayed worker.
The delay starts when the first worker request is intercepted and lasts six seconds.
Routes match the production asset URL and Vite's development worker URL.
They exclude Vite's module that exports the worker URL.
Each case verifies interception and rendered marker counts after release.
Cleanup cancels the timer and releases blocked requests, including after a test failure.

The recovery tests keep the same canvas connected after a failed county request and a return to recent records.
They also check that repeated fits do not create duplicate world copies of a station.
Startup error tests use static HTML to check the wait helper and its diagnostic text.
They do not test the map renderer.

### Test limits

Pixel checks use a preserved drawing buffer. They do not measure performance with the default drawing buffer.
The separate default-buffer case checks startup and source readiness. It does not count marker pixels.
Playwright cases do not contribute to Vitest V8 coverage.
The fixed browser font response does not verify font appearance or label placement.
These fixtures do not verify production data or provider authorization.
See [CARTO basemaps](carto-basemaps.md) for key configuration.

The performance script rejects map worker HTTP failures and MapLibre initialization errors.
It waits for the active record source to load before recording a successful sample.
Source readiness does not verify live data quality or basemap authorization.
