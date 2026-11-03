# Temperature record map

The map shows recent station records and standing county and state extremes.
The [historical pipeline](../projects/temperature-records/readme.md) is a separate project. It does not supply this map.

## Recent records

Open `/projects/temperature-records/map` for recent station records.
Select **Yesterday** or **Last 7 Days** to change the observation period.
Use the state, scope, and minimum-margin controls to filter the records.

Each record with valid coordinates has a marker at its station location.
A solid red marker identifies a record high. A blue ring identifies a record low.
The source does not cluster points at any zoom level.
Nearby records can overlap. The map does not move stations to separate them.

Temperature labels use a separate symbol layer.
The map hides a label when it conflicts with another label.
Zoom in to make more room for labels.
Hidden labels do not remove their markers.

Click a marker to open its popup and station history.
The visible marker takes priority over a nearby station's larger glow.
A click on a glow also selects its record when no inner marker is under the pointer.

The unit control changes temperatures in labels, hover text, and popups.
The minimum-margin filter uses Fahrenheit differences in both unit modes.
Changing the view clears the selected station or state.
Zoom changes and data updates preserve the selection.

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

Data can arrive after the map loads.
Apply visibility and temperature units after each layer's data becomes available.
Keep popup cleanup separate from layer updates. A data update must not close the selected station.

Register one delegated pointer handler for the interactive layer set.
Use the first rendered feature to select the visible record.
Separate handlers for dots and glows can select different stations from one click.

Escape all external text before inserting it into popup HTML.
This includes a date formatter's fallback text. A string schema does not make HTML safe.

## Validation

Run the focused unit tests from the repository root:

```bash
npx vitest run src/test/TemperatureMap.test.tsx src/test/temperatureMapLayers.test.ts src/test/temperatureSummaryPanel.test.tsx src/test/useTemperatureData.test.ts
```

Run the browser tests:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:e2e -- tests/e2e/temperature-map.spec.ts
```

The browser tests use fixed data, neutral basemap tiles, and an empty font response.
They verify each nearby marker's color at phone and desktop widths.
They also check period changes, Celsius hover text, and selection where a glow overlaps another marker.
Screenshots use CSS pixels, including on Retina displays.

Unit tests verify the label collision setting, late data, units, view changes, and escaped popup dates.
The fixed browser font response does not verify font appearance or label placement.
These fixtures do not verify production data or provider authorization.
See [CARTO basemaps](carto-basemaps.md) for key configuration.
