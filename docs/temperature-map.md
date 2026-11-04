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
Each attempt has a 60-second deadline, including the response body.
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

Monthly historical requests end in the year before the observation.
February includes a leap day only when that historical year has one.

Run a local recent-record sync with a writable cache directory:

```bash
TEMP_DATA_DIR=.temp/temperatures node scripts/sync-temperatures.js --recent-only
```

For a hosted sync, run the **Sync Temperatures** workflow.
Enable **full_sync** to refresh state, county, and trend records.
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

Run the focused unit tests from the repository root:

```bash
npx vitest run src/test/TemperatureMap.test.tsx src/test/temperatureDataStatus.test.tsx src/test/temperatureSchemas.test.ts src/test/temperatureMapLayers.test.ts src/test/temperatureSummaryPanel.test.tsx src/test/useTemperatureData.test.ts scripts/__tests__/syncTemperatures.test.ts scripts/__tests__/temperatureArchives.test.ts scripts/__tests__/temperaturePublication.test.ts scripts/__tests__/networkTimeouts.test.ts
```

Run the browser tests:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:temperatures:browser
```

The browser tests use fixed data, neutral basemap tiles, and an empty font response.
They verify each nearby marker's color at phone and desktop widths.
They also check period changes, Celsius hover text, and selection where a glow overlaps another marker.
The dedicated command builds production assets with fixture content before starting the browser tests.
It also checks phone filters, selection after **Show more**, focus restoration, coverage, and independent data requests.
CI runs these production checks in Chromium and WebKit.
Screenshots use CSS pixels, including on Retina displays.

Unit tests verify the label collision setting, late data, units, view changes, and escaped popup dates.
They also verify calendar dates, leap years, unusable observations, and time-based freshness changes.
Sync tests check retries, invalid cache replacement, archive reconstruction, and all seven legacy dates.
Publication tests run the CLI in temporary directories.
They check output preservation after persistent daily, historical, and monthly failures.
Subprocess execution does not contribute to Vitest coverage.
The recovery tests keep the same canvas connected after a failed county request and a return to recent records.
They also check that repeated fits do not create duplicate world copies of a station.
The fixed browser font response does not verify font appearance or label placement.
These fixtures do not verify production data or provider authorization.
See [CARTO basemaps](carto-basemaps.md) for key configuration.

The performance script rejects map worker HTTP failures and MapLibre initialization errors.
It waits for the active record source to load before recording a successful sample.
Source readiness does not verify live data quality or basemap authorization.
