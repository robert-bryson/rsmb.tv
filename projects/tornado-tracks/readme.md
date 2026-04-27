# Tornado Tracks

Route: `/projects/tornado-tracks/map`

## Status

MVP shipped. Core features implemented:

- Full-screen MapLibre map at `/projects/tornado-tracks/map`
- NOAA/NCEI StormEvents automated sync pipeline (`scripts/syncTornadoes.js`)
- Per-year GeoJSON split under `public/data/tornadoes/tracks/{year}.geojson`
- Density (heatmap) mode uses `public/data/tornadoes/track-points/{year}.geojson`
- Annual summary and notable events JSON pre-baked at build time
- EF-scale filter, region presets (CONUS / Midwest / Plains / Dixie Alley)
- Year range timeline with play/pause animation
- Scale color mode and year color mode
- WebGL fallback SVG renderer for environments without GPU support
- All filter state stored in URL params for shareability

## Architecture

```
src/features/tornadoes/
  components/
    TornadoMap.tsx          # Main map component + SVG fallback
    TornadoSummaryPanel.tsx # Right-side stats + filters panel
    TornadoTimeline.tsx     # Bottom timeline + year range controls
  hooks/
    useTornadoData.ts       # Per-year GeoJSON fetching with cache
    useTornadoFilters.ts    # URL-param filter state
  utils.ts                  # Pure utility functions (tested)
  constants.ts              # Colors, URLs, region state lists
  types/index.ts            # All TypeScript types
projects/tornado-tracks/
  scripts/
    syncTornadoes.js        # NOAA/NCEI StormEvents sync + GeoJSON generation
public/data/tornadoes/
  tracks/{year}.geojson     # LineString per tornado (1950-present)
  track-points/{year}.geojson  # Point per tornado (for density mode)
  annual-summary.json
  notable-events.json
```

## Sync pipeline

```bash
npm run sync-tornadoes
```

Fetches the latest NOAA/NCEI StormEvents CSVs, normalizes F/EF scale labels,
drops rows without valid coordinates, and writes per-year GeoJSON + summary
JSON to `public/data/tornadoes/`. Designed to be run as a scheduled job
(monthly is sufficient for historical data; weekly for current-year freshness).

## Known limitations

- Tracks are start→end straight lines, not damage-path swaths. DAT survey
  polygons would improve modern events but require a separate layer.
- EF0 count trends are noisy (reporting practices changed over time). The UI
  defaults the legend note to EF1+ for trend interpretation.
- WebGL unavailable in WSL environments; the SVG fallback handles this case.

---

## Original research brief

> The sections below are the original pre-implementation research brief
> (2026-04-27). Retained for data source reference.

Research date: 2026-04-27

### Executive recommendation

Build this as a full-screen MapLibre project named `Tornado Tracks`, with a
primary historical track map and a time-first interaction model. The strongest
MVP is:

1. Use NOAA/NCEI StormEvents yearly CSVs as the automated canonical pipeline for
   1950-present tornado events, because they are scriptable, current into 2026,
   and include rich event metadata and narratives.
2. Validate completed historical years against SPC SVRGIS tornado path
   shapefiles, which are already published as GIS-ready tornado path and initial
   point products for 1950-2024.
3. Add IEM/NWS warning and SPC watch/outlook layers as time-matched contextual
   overlays after the track MVP, not in the initial load. Warning polygons are
   high-value but can get large quickly.



The map should answer a few questions quickly:

- Where have tornadoes tracked across the United States since 1950?
- How does the Midwest compare with the Plains, South, and Southeast over time?
- Are stronger tornadoes, fatalities, or long-track events clustering or moving?
- What happened before and during major events: outlooks, watches, warnings,
  observed/radar tags, and post-event survey details?
- Which events are worth opening as stories rather than anonymous lines?

The main interaction should be temporal brushing, not layer toggling. The map
should feel like a weather archive you can scrub through.

## Data sources

### 1. Historical tornado tracks: NOAA/NCEI StormEvents

Recommended role: primary automated source for MVP tracks and metadata.

Source:
`https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/`

File pattern:
`StormEvents_details-ftp_v1.0_d{YEAR}_c{VERSION_DATE}.csv.gz`

Useful fields sampled from 2024 data:

- `EVENT_TYPE`: filter to `Tornado`
- `BEGIN_DATE_TIME`, `END_DATE_TIME`, `YEAR`, `MONTH_NAME`
- `STATE`, `STATE_FIPS`, `CZ_FIPS`, `CZ_NAME`, `WFO`
- `BEGIN_LAT`, `BEGIN_LON`, `END_LAT`, `END_LON`
- `TOR_F_SCALE`, `TOR_LENGTH`, `TOR_WIDTH`
- `INJURIES_DIRECT`, `INJURIES_INDIRECT`, `DEATHS_DIRECT`, `DEATHS_INDIRECT`
- `DAMAGE_PROPERTY`, `DAMAGE_CROPS`
- `SOURCE`, `EPISODE_NARRATIVE`, `EVENT_NARRATIVE`
- `TOR_OTHER_WFO`, `TOR_OTHER_CZ_STATE`, `TOR_OTHER_CZ_FIPS`,
  `TOR_OTHER_CZ_NAME` for tornadoes crossing county/WFO boundaries

Why it is good:

- Official NOAA/NCEI Storm Data bulk archive.
- Direct compressed CSV, no shapefile conversion required.
- Current-year and recent-year files exist, including 2025 and 2026 as of this
  research date.
- Rich metadata makes good detail panels possible.

Limitations:

- Use `F`/`EF` labels carefully: pre-2007 tornadoes use Fujita scale, newer
  events use Enhanced Fujita scale. Normalize to numeric `scale` while showing
  the original label.
- Reporting practices changed over time. EF0 counts especially are not a clean
  climate trend signal. The UI should make `EF1+` and `EF2+` filters prominent.
- Start/end coordinates create a track line, but they are not a detailed damage
  swath. Use DAT survey lines/polygons for high-resolution modern cases.
- File version suffixes change, so the sync script should scrape the directory
  and select the newest matching file per year.

### 2. Historical tornado tracks: SPC SVRGIS

Recommended role: validation source and optional geospatial source for completed
years.

Source page:
`https://www.spc.noaa.gov/gis/svrgis/`

Direct latest track ZIP sampled:
`https://www.spc.noaa.gov/gis/svrgis/zipped/1950-2024-torn-aspath.zip`

Related point ZIP:
`https://www.spc.noaa.gov/gis/svrgis/zipped/1950-2024-torn-initpoint.zip`

Findings:

- SPC publishes United States severe report GIS data with tornadoes from
  1950-2024 and hail/wind from 1955-2024.
- Tornado downloads include `aspath` line shapefiles and `initpoint` initial
  point shapefiles.
- The 1950-2024 path ZIP is small to download, but expands to a large shapefile
  set; sampled contents included a 6.3 MB `.shp` and a 44.9 MB `.dbf`.
- Fields mirror the SPC severe database description and are generally ideal for
  final historical tracks.

Why it is good:

- Already GIS-shaped as paths and points.
- Compact enough to download in a build step.
- Strong validation target for NCEI-derived track counts and geometry.

Limitations:

- Requires shapefile conversion in the build pipeline.
- Published through 2024 at the time of research, so it is not the best source
  for live/current-year updates.
- It does not carry the same rich narratives as NCEI StormEvents.

### 3. Tornado warnings: IEM VTEC watch/warning archive

Recommended role: historical warning polygon archive for phase 2.

Source page:
`https://mesonet.agron.iastate.edu/request/gis/watchwarn.phtml`

Backend docs:
`https://mesonet.agron.iastate.edu/cgi-bin/request/gis/watchwarn.py?help`

Example: all tornado warnings for one UTC day:

```text
https://mesonet.agron.iastate.edu/cgi-bin/request/gis/watchwarn.py?accept=shapefile&sts=2024-05-21T00:00Z&ets=2024-05-22T00:00Z&limitps=1&phenomena=TO&significance=W
```

Example: tornado warnings valid at one exact time:

```text
https://mesonet.agron.iastate.edu/cgi-bin/request/gis/watchwarn.py?accept=csv&at=2024-05-21T21:20Z&timeopt=2&limitps=1&phenomena=TO&significance=W
```

Useful sampled fields:

- `wfo`
- `utc_issue`, `utc_expire`, `utc_prodissue`, `utc_polygon_begin`,
  `utc_polygon_end`, `utc_updated`
- `phenomena=TO`, `significance=W`
- `status`, `eventid`, `product_id`, `fcster`, `vtec_year`
- `tornadotag`: examples include `RADAR INDICATED` and `OBSERVED`
- `damagetag`: examples include `CONSIDERABLE`
- `is_emergency`
- `hailtag`, `windtag`, `area2d`

Archive status:

- Storm-based tornado/severe thunderstorm/flash flood/special marine warning
  polygons start 2002-01-01.
- County-based warnings are available back to 1986.
- All VTEC watch/warn products start 2005-11-12.
- Only initial warning polygons are included by default; `addsvs=1` can include
  polygons/metadata from follow-up statements.
- Downloads are limited to one year at a time unless state/WFO/phenomena filters
  are supplied.

Why it is good:

- This is the best practical historical warning polygon source.
- It enables lead-time analysis: compare warning issue time with track begin
  time and spatial overlap.
- It exposes observed/radar/emergency/damage tags that make warning maps more
  meaningful than generic polygons.

Limitations:

- IEM is a processed archive, not the official NWS API.
- CSV output is useful for attributes, but geometry should come from shapefile
  or KML for archived requests.
- Warning data is much larger than tracks; load by selected time window or case.

### 4. Live/recent tornado warnings: NWS API

Recommended role: live overlay only.

Docs:
`https://www.weather.gov/documentation/services-web-api`

Active endpoint:
`https://api.weather.gov/alerts/active?event=Tornado%20Warning`

Date-window endpoint:

```text
https://api.weather.gov/alerts?start=2026-04-27T00:00:00Z&end=2026-04-28T00:00:00Z&event=Tornado%20Warning&status=actual&limit=500
```

Findings:

- GeoJSON is the default format for alert endpoints.
- The API requires a `User-Agent` header identifying the application.
- `/alerts` supports `start`, `end`, `status`, `message_type`, `event`, `area`,
  `point`, `zone`, `urgency`, `severity`, `certainty`, `limit`, and `cursor`.
- Active tornado warnings return CAP-style properties like `sent`, `effective`,
  `expires`, `ends`, `severity`, `certainty`, `urgency`, `headline`,
  `description`, and `instruction`.
- A recent same-day query returned tornado warnings, while an older 2024 query
  did not. Treat this as a live/recent service, not the archive of record.

Why it is good:

- Perfect for a `Live` layer if there are active warnings.
- No pipeline needed for active use.

Limitations:

- Do not rely on it for deep historical warning archive playback.
- Cache lightly and rate-limit requests.

### 5. Tornado/severe watches: IEM SPC watch polygons

Recommended role: phase 2 forecast-context overlay.

Source page:
`https://mesonet.agron.iastate.edu/request/gis/spc_watch.phtml`

Backend docs:
`https://mesonet.agron.iastate.edu/cgi-bin/request/gis/spc_watch.py?help`

Example GeoJSON request:

```text
https://mesonet.agron.iastate.edu/cgi-bin/request/gis/spc_watch.py?sts=2024-05-21T00:00:00Z&ets=2024-05-22T00:00:00Z&format=geojson
```

Useful sampled fields:

- `ISSUE`, `EXPIRE`, `SEL`, `TYPE`, `NUM`
- `TYPE`: `TOR` or `SVR`
- `P_TORTWO`: probability of 2 or more tornadoes
- `P_TOREF2`: probability of 1 or more strong EF2-EF5 tornadoes
- `P_WIND10`, `P_WIND65`, `P_HAIL10`, `P_HAIL2I`, `P_HAILWND`
- `MAX_HAIL`, `MAX_GUST`, `MAX_TOPS`
- `MV_DRCT`, `MV_SKNT`
- `IS_PDS`

Archive notes:

- IEM has SPC watch polygons since 1997.
- Associated watch probabilities go back to about May 2006.
- SPC watch polygons are no longer the official watch geography; official watch
  coverage is issued by county/zone. They are still useful and generally close
  to the actual watch extent.

Why it is good:

- Adds the pre-warning risk window.
- The probability fields make excellent detail-panel content.
- GeoJSON output avoids shapefile conversion for this layer.

### 6. Official watch/watch-by-county coverage: IEM VTEC archive

Recommended role: optional accuracy layer for exact official coverage.

Use the same IEM watch/warning service with:

- Tornado Watch: `phenomena=TO&significance=A`
- Severe Thunderstorm Watch: `phenomena=SV&significance=A`

This is more official for watch coverage than the SPC polygon boxes after watch
products moved to watch-by-county, but it is visually less elegant than the SPC
watch polygon and requires county/zone geometry handling.

### 7. SPC convective outlooks and tornado probabilities

Recommended role: phase 3 forecast-risk context.

Source page:
`https://mesonet.agron.iastate.edu/request/gis/outlooks.phtml`

Backend docs:
`https://mesonet.agron.iastate.edu/cgi-bin/request/gis/spc_outlooks.py?help`

Example request:

```text
https://mesonet.agron.iastate.edu/cgi-bin/request/gis/spc_outlooks.py?d=1&type=C&sts=2024-01-01T00:00Z&ets=2025-01-01T00:00Z
```

Findings:

- IEM processes and archives SPC convective outlooks from 1987 onward.
- Fields include `ISSUE`, `EXPIRE`, `PRODISS`, `TYPE`, `DAY`, `THRESHOLD`,
  `CATEGORY`, and `CYCLE`.
- Geometry can be returned as overlapping `cake layers` or non-overlapping
  `cookie cutters`.
- IEM reports approximately 99.9% archive coverage.
- Backend currently documents shapefile output, so conversion is needed.

Why it is good:

- Lets users compare forecast risk to eventual tracks.
- Day 1 tornado probabilities, categorical outlooks, and later outlook cycles
  can become a very strong `Forecast Context` mode.

### 8. SPC mesoscale discussions

Recommended role: optional event-story overlay.

Source page:
`https://mesonet.agron.iastate.edu/request/gis/spc_mcd.phtml`

Backend docs:
`https://mesonet.agron.iastate.edu/cgi-bin/request/gis/spc_mcd.py?help`

Findings:

- IEM archives SPC Mesoscale Convective Discussion polygons since 2003.
- Metadata includes issue/expire times, SPC MCD number, watch issuance
  confidence, concern heading, and most-probable intensity tags for tornado,
  hail, and gusts.
- The `PROD_ID` can be used to fetch raw NWS text from IEM, and `YEAR`/`NUM` can
  construct stable SPC URLs.

Why it is good:

- Best as a story/context layer for selected outbreaks, not as a default layer.
- It gives forecaster reasoning between broad outlooks and issued watches.

### 9. Damage Assessment Toolkit (DAT)

Recommended role: modern high-resolution survey overlay.

Viewer:
`https://apps.dat.noaa.gov/StormDamage/DamageViewer/`

ArcGIS services:
`https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit`

Sample MapServer:
`https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit/DamageViewer/MapServer`

Layers sampled:

- `0`: Damage Points SDE
- `1`: Damage Lines SDE
- `2`: Damage Polygons SDE

Useful sampled line fields:

- `stormdate`, `starttime`, `endtime`
- `startlat`, `startlon`, `endlat`, `endlon`
- `length`, `width`, `injuries`, `fatalities`
- `efscale`, `efnum`, `maxwind`, `qc`, `wfo`
- `cropdamage`, `propdamage`, `comments`

Sample count:

- Querying damage lines with `efnum >= 0` returned 10,925 records.

Why it is good:

- More detailed lines than start/end StormEvents tracks for modern surveyed
  events.
- Can add damage polygons and points for selected case studies.

Limitations:

- NOAA labels DAT data as quality-controlled but preliminary and points to NCEI
  Storm Data for official severe-weather statistics.
- Best used as an optional overlay or selected-event enhancement, not the main
  historical source.

### 10. Additional context layers worth considering

- SPC 30-year tornado climatology netCDF from the SPC WCM page: useful as a
  background density/reference layer.
- SPC watch frequency county data (`watches_fips_2006-2025.zip`): useful to
  compare observed tracks with watch climatology.
- SPC mobile-home percentage county ZIP from SVRGIS: useful for vulnerability
  context.
- U.S. Census/ACS county population or population density: useful for exposure,
  fatalities per population, and urban/rural comparison.
- NCEI StormEvents `fatalities` and `locations` CSVs: useful for more detailed
  casualty or location tables.
- SPC preliminary storm reports: useful for current-year freshness, but final
  visualizations should clearly distinguish preliminary from final Storm Data.

## Recommended data architecture

### MVP generated files

Under `public/data/tornadoes/`:

- `tracks.geojson`: compact LineString tornado tracks for all years.
- `track-points.geojson`: start points for low-zoom point/heatmap modes.
- `annual-summary.json`: year, count, EF0-EF5 counts, fatalities, injuries,
  track miles, median width, state counts.
- `state-summary.json`: state-by-year counts and EF2+ counts.
- `notable-events.json`: curated or algorithmically selected events for the
  right-side detail browser.

For performance, consider splitting tracks by decade or year:

```text
public/data/tornadoes/tracks/1950s.geojson
public/data/tornadoes/tracks/1960s.geojson
...
public/data/tornadoes/tracks/2020s.geojson
```

### Phase 2 generated files

- `warnings/{year}.geojson` or `warnings/{year}/{month}.geojson`
- `watches/{year}.geojson`
- `outlooks/{year}.geojson` or selected case-only outlook slices
- `mcd/{year}.geojson` or selected case-only MCD slices

Warning and outlook polygons should not all load on page start. Load only the
selected year/month/case or query a precomputed index first.

### Track feature model

Minimal properties for `tracks.geojson`:

```json
{
  "id": "ncei-2024-1216653",
  "year": 2024,
  "month": 11,
  "date": "2024-11-05",
  "beginTime": "2024-11-05T11:01:00-06:00",
  "endTime": "2024-11-05T11:02:00-06:00",
  "state": "IA",
  "stateName": "IOWA",
  "county": "DAVIS",
  "wfo": "DMX",
  "scale": 0,
  "scaleLabel": "EF0",
  "lengthMiles": 0.32,
  "widthYards": 50,
  "deaths": 0,
  "injuries": 0,
  "propertyDamage": 120000,
  "cropDamage": 0,
  "source": "NWS Storm Survey",
  "narrative": "..."
}
```

Keep long narratives out of the default GeoJSON if file size gets large. A good
split is `tracks.geojson` for map rendering and `events/{id}.json` for detail
panel narratives fetched on click.

## UI/UX design direction

### First screen

Open directly into the usable map, not a landing page. The route
`/projects/tornado-tracks` can be the about page, but `/projects/tornado-tracks/map`
should be the primary experience.

Default view:

- Dark basemap centered on the CONUS, slightly biased toward the Midwest/Plains.
- Tracks from 1950-present visible as subdued lines.
- A bottom timeline with annual bars, selected range, play button, and decade
  shortcuts.
- A compact top-left toolbar with `Projects`, mode segmented control, and active
  filter summary.
- A right-side summary/detail panel on desktop; bottom sheet on mobile.

### Main modes

Use a segmented control, not a long layer checklist:

- `Tracks`: individual paths, colored by F/EF rating or year.
- `Density`: heatmap or binned density showing corridors by selected period.
- `Trends`: map plus charts for annual counts, EF2+ counts, fatalities, track
  miles, and Midwest share.
- `Warnings`: warning polygons and tracks for the selected time window.
- `Forecast`: outlooks/watches/MCDs for selected days or curated events.

The user should be able to switch modes without losing the selected time range.

### Timeline interaction

The timeline is the signature control.

Desktop:

- Bottom horizontal histogram of tornado counts by year.
- Brush/range handles for year range.
- Play/pause button animating through years, months, or days.
- Step controls: previous/next year or outbreak day.
- Presets: `All`, `1950-1979`, `1980-1999`, `2000-2026`, `EF2+`, `Midwest`.

Mobile:

- Bottom sheet timeline with large touch targets.
- Single active year by default, with an expandable range mode.
- Swipe left/right to step years, matching the existing flights swipe pattern.

URL state:

```text
?start=1950&end=2026&scale=ef2plus&region=midwest&mode=density&color=scale
```

### Midwest focus

Make the Midwest a first-class preset without trapping the whole product there.

Suggested presets:

- `CONUS`
- `Midwest`: IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI
- `Plains`: CO, KS, MT, NE, NM, ND, OK, SD, TX, WY
- `Dixie Alley`: AL, AR, GA, LA, MS, TN
- `Custom state/county/WFO`

The map should also include a quick search for state, county, city, or WFO.

### Detail panel

Clicking a track opens a panel rather than relying only on a popup. Popups are
good for hover previews; the panel is better for long StormEvents narratives.

Track detail should show:

- F/EF rating and normalized scale.
- Date/time and duration.
- County/state/WFO.
- Length, width, max wind when available.
- Fatalities, injuries, property/crop damage.
- Source and official/preliminary status.
- Event narrative and episode narrative.
- Matched warning/watch/outlook context when available.

When warning matching is available, add:

- Warning issue time vs tornado begin time.
- Whether the warning was radar-indicated, observed, PDS, emergency, or had a
  considerable/catastrophic damage tag.
- Spatial overlap summary.

### Visual encoding

Avoid a one-note red danger map. Use red sparingly for the most intense or
urgent features.

Recommended F/EF color scale:

- EF0: muted cyan or slate-blue
- EF1: green
- EF2: yellow
- EF3: orange
- EF4: red
- EF5: magenta or near-white pink
- Unknown: neutral gray

Track styling:

- Low zoom: thin, translucent lines or heatmap only.
- Medium zoom: tracks colored by scale, with EF3+ slightly brighter.
- High zoom: width expression based on `TOR_WIDTH`, still capped so wide paths
  do not dominate the map.
- Fatal tracks can receive a subtle halo only when selected or filtered.

Warning/watch styling:

- Tornado warnings: transparent red/orange fill, brighter outline.
- Observed warnings: solid outline.
- Radar-indicated warnings: dashed outline if feasible, or lower opacity.
- PDS/emergency: distinct magenta/white outline and explicit label in the panel.
- Watches: amber/purple transparent fill below warnings.
- Outlooks: muted categorical fills below tracks and warnings.

Density mode:

- Use a multi-hue ramp from cool teal to amber to red/pink.
- Give users an `EF2+ only` toggle because all-tornado density is heavily shaped
  by reporting bias and population/road access.

### Charts

The map should not be the only way to see change over time.

Recommended compact charts:

- Annual count line/bar chart, with EF2+ overlay.
- Stacked decadal count by scale.
- Track-mile total by year.
- Fatalities/injuries by year.
- Monthly seasonality heatmap by decade.
- Midwest share of U.S. tornadoes over time.

Charts should interact with the map: hovering a decade or year highlights the
corresponding tracks.

### Accessibility

- Do not rely on color alone: use stroke width, opacity, halo, labels, and
  legend text.
- Keep keyboard-accessible controls for timeline stepping and mode switches.
- Use live-region text for active filters and selected counts.
- Provide a reduced-motion path where playback updates discretely and does not
  animate continuously.
- Keep map labels and toolbar text within stable dimensions so controls do not
  jump as counts change.

### Performance UX

- Show skeleton/loading states per layer, not a full-screen blocker after the
  base map is ready.
- If a selected range is huge and warning polygons are enabled, show a clear
  `Load warnings for selected year` affordance rather than freezing the map.
- Preload summaries immediately; lazy-load geometry.
- Default to density or simplified tracks when the selected range is very broad,
  then increase detail as the user zooms in.

## Implementation plan

### Phase 1: Track MVP

Data pipeline:

- Add `projects/tornado-tracks/scripts/syncTornadoes.js`.
- Scrape NCEI CSV directory and choose the newest `StormEvents_details` file for
  each year.
- Download 1950-current details CSVs, filter `EVENT_TYPE === 'Tornado'`.
- Normalize dates, F/EF scale, damage shorthand, deaths/injuries, length/width,
  state abbreviations, and coordinates.
- Generate track LineStrings from begin/end coordinates.
- Generate annual/state summaries and a lightweight point file.
- Add tests for parsing damage values like `120.00K`, rating normalization,
  coordinate validation, and annual summaries.

Frontend:

- Add `src/pages/TornadoTracksAbout.tsx` and `src/pages/TornadoTracks.tsx`.
- Add routes:
  - `/projects/tornado-tracks`
  - `/projects/tornado-tracks/map`
- Add `src/features/tornadoes/` with:
  - `components/TornadoMap.tsx`
  - `components/TornadoTimeline.tsx`
  - `components/TornadoSummaryPanel.tsx`
  - `hooks/useTornadoData.ts`
  - `hooks/useTornadoFilters.ts`
  - `constants.ts`
  - `types/index.ts`
  - `utils/parseDamage.ts`
- Add project metadata in `src/content/projects.ts` only after a usable map
  route exists.

### Phase 2: Warning/watch context

- Add an IEM sync script for tornado warnings, partitioned by year or month.
- Add watch polygon sync from IEM `spc_watch.py` GeoJSON.
- Build temporal matching between track begin time and active warnings/watches.
- Add `Warnings` mode and selected-event warning playback.
- Compute warning lead time for matched events where possible.

### Phase 3: Forecast context and stories

- Add selected-day outlook and MCD downloads for notable events.
- Build curated story presets:
  - 2011 Super Outbreak
  - 2011 Joplin
  - 2020 Easter outbreak
  - 2021 December Midwest/South outbreak
  - Recent Midwest high-impact days from NCEI/IEM
- Add playback through outlook -> watch -> warning -> track -> survey.

### Phase 4: Survey/exposure overlays

- Add DAT survey lines/polygons for modern cases.
- Add Census/ACS population or SPC mobile-home percentage county data.
- Add exposure summaries: people/county density near track, fatalities per
  population, mobile-home vulnerability context.

## Repo integration notes

This project can reuse existing conventions:

- MapLibre is already in `package.json`.
- Full-screen pages already work because `Layout` checks
  `location.pathname.endsWith('/map')`.
- Use the temperature feature as the closest UI template, but split the tornado
  map into more components earlier. The temperature map is large; this project
  will grow if warnings/outlooks are added.
- Reuse `fetchWithCache` from the flights feature or promote it to a shared util
  later if multiple feature folders depend on it.
- Match the existing dark, restrained data-tool style.

Potential npm additions:

- None required for Phase 1 if using NCEI CSVs directly; `csv-parse` already
  exists.
- For shapefile conversion in later phases, choose one path deliberately:
  - `shpjs` for JavaScript ZIP shapefile parsing, or
  - a build-time GIS tool like `ogr2ogr`/`mapshaper` if the deployment
    environment can support it.

## Suggested first build slice

The first useful version should be small but complete:

- Track map for 1950-current.
- Timeline range brush and year playback.
- Midwest preset.
- EF scale filter with `All`, `EF1+`, `EF2+`, `EF3+`.
- Color by scale/year toggle.
- Density mode.
- Clickable track detail panel with NCEI metadata and narrative.
- Annual summary chart linked to map filtering.

That gives the project a clear identity before adding the heavier warning and
forecast archives.