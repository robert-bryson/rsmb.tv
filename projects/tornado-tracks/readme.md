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

