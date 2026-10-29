# Tornado Tracks quality review — October 29, 2026

Reviewed the map, SVG fallback, mobile controls, URL state, data loader, trend calculations, NOAA/IEM normalization, sync publication, caching, documentation, and tests. Confirmed defects were fixed locally. The earlier OpenFreeMap basemap repair is retained. No deployment, production data upload, or archive regeneration was performed.

## Findings fixed

| Priority | Finding and impact | Resolution |
| --- | --- | --- |
| P1 | The summary panel was permanently hidden below 768px. Phone users could not reach scale/region/color filters, track details, or Trends charts. | Added a scrollable mobile controls panel, automatic opening for selections, Escape/focus restoration, and details above filters. Mobile starts with the timeline collapsed. |
| P1 | SVG pointer capture retargeted ordinary clicks to the SVG, making fallback tracks and states unselectable. | Capture begins only when dragging. Screen-to-map conversion now respects SVG cropping/scaling, and boundary paths are memoized during pan/zoom. Fallback honors color modes and explains the unavailable density renderer. |
| P1 | A missing historical source file could result in a successful sync with empty/incomplete output, replacing existing summaries. | Missing historical years and empty normalized archives now fail before publication output is replaced. Invalid year ranges are rejected before enumeration. |
| P2 | Map click handlers retained the initial URL callback and could discard filters selected after mount. | Track selection uses the latest callback, as state selection and viewport changes already do. |
| P2 | Clicking a notable event could leave incompatible state, region, or EF filters active, hiding the event. | Navigation selects its year and clears incompatible filters atomically through the existing URL draft. |
| P2 | Optional warnings/notable events blocked required metadata. Warning analytics were downloaded even outside Trends. | Required annual metadata loads independently; warning analytics load only for Trends. Optional failures do not block tracks. |
| P2 | Default national Trends fetched decades of track geometry to recompute an existing summary. | Unfiltered national comparisons use the published annual summary and retain only the selected map-year geometry. Filtered comparisons still load history. |
| P2 | Density downloaded a second copy of start-point geometry already present in tracks. | Heatmaps reuse the loaded track start points. The generated point archive remains available for other consumers. |
| P2 | Historical fetches launched every year concurrently and continued queuing obsolete selections. | At most six year requests run per active load; cancellation or failure stops queued work. Already active shared-cache requests can finish. |
| P2 | Shared URLs with reversed ranges produced inconsistent map filtering, and unpublished years could be requested. Data failures required reload. | Ranges are ordered, geometry waits for the available-year metadata, requests are clamped to published years, and errors expose Retry without blocking controls. |
| P2 | Decade and comparison percentages averaged annual ratios, giving a one-record year the same weight as a large year. | EF2+ percentages and deaths per 100 segments use summed numerators and denominators. A 1/1 year plus a 0/99 year now yields 1%, rather than 50%. |
| P2 | Stable IEM cache filenames were reused indefinitely despite weekly syncs. Impossible NOAA dates/times were accepted. | Warning/watch cache entries expire after six days. Calendar and clock validation rejects impossible values. Versioned NOAA gzip files remain cached. |
| P2 | Labels implied unique tornado counts or fatality rates per tornado. Warning totals appeared to follow geography/intensity filters. | Copy identifies mappable county segments, reports publication lag and changing observation practices, and labels warning/watch statistics as national, approximate context. Current-year WFO rows are excluded consistently with comparison totals. |
| P3 | The default “CONUS” label suggested a geographic filter, although the archive includes Alaska, Hawaii, and Puerto Rico. | The display label is “U.S. archive”; the existing `conus` URL remains compatible and the initial camera still covers CONUS. |
| P3 | Interactive timeline buttons were hidden from assistive technology, and toggle state was visual only. | Histogram buttons expose year/count and pressed state, use one tab stop with arrow navigation, and filters/modes/playback expose selected state. |
| P3 | The loader invented `generatedAt` from the viewer's clock when published metadata omitted it. Renderer initialization could throw after capability detection. | Source timestamps remain optional and are never fabricated. Initialization failure activates the existing track overview. Map-background loading has visible status. |

NOAA explicitly distinguishes tornado county segments from unique tornadoes and describes the delay in publishing StormEvents data. The app's aggregate universe is narrower still: rows without usable coordinates are excluded by the generator. These are now stated in the UI and project documentation. [NOAA StormEvents FAQ](https://www.ncdc.noaa.gov/stormevents/faq.jsp).

## Measured performance

Measurements use the published CDN objects on October 29, 2026. Sizes below are object content lengths, not compressed browser transfer totals or latency measurements.

| Resource/path | Before | After |
| --- | --- | --- |
| Geometry for default national Trends, 1950–2025 | 76 files; 79,089 segments; 43,559,186 bytes across the archive | Selected year only: 2025 is 905,249 bytes. Opening Trends adds no historical geometry requests. |
| 2025 density point geometry | Additional 397,326-byte point file | No point-file request. |
| Warning/watch analytics on initial Tracks view | 949,426-byte JSON file | Deferred until Trends is opened. |
| Historical geometry request fan-out | All requested years at once | Six active requests per load; queued obsolete work stops. |

Live browser checks at 390px and 1440px recorded one selected-year geometry request across Tracks → Density → unfiltered Trends, zero point-file requests, one warning request when Trends opened, and no browser errors.

## Remaining improvements, in priority order

1. **P2 — Precompute filtered trend aggregates.** State, region, and EF comparisons still need historical geometry. Extend sync outputs with year/state/scale totals so chart calculations do not need tens of megabytes of lines. The existing `state-summary.json` lacks the complete scale breakdown. Consider PMTiles separately if broad historical map rendering itself becomes the bottleneck.
2. **P2 — Publish source coverage and quality metadata.** Add per-year last event date, source CSV version, sync time, and counts of omitted/repaired coordinates. The inspected 2026 track file ended June 30 despite its October 26 upload date: upload freshness is not observation coverage. Expose those separately in the UI. Decide explicitly whether future aggregate charts include unmappable source records.
3. **P2 — Add basemap network-failure recovery.** GPU initialization/context failures have an overview path; a style-service outage still needs a dedicated degraded-mode/retry interaction and browser regression. This is separate from the repaired CARTO authentication failure. The live OpenFreeMap style also emits a nonfatal missing `circle-11` sprite warning.
4. **P3 — Add state selection and chart data alternatives.** A state search/dropdown would make exact geography accessible without clicking a polygon. Accessible chart tables or CSV downloads would expose the series currently available mainly as visual sparklines. An explicit zero-results/reset state would also help narrow-filter exploration.
5. **P3 — Separate renderer and analysis responsibilities.** The main map and summary components remain large. Extract lifecycle/selection behavior and trend presentation behind smaller interfaces after preserving the new integration coverage; avoid changing the data model and renderer simultaneously.

Warning report matches remain WFO/time approximations; watch matches use bounding boxes/time. Formal verification would require the warning/watch polygons and consistent spatial/time rules. The UI now states the current scope. [IEM archive documentation](https://www.mesonet.agron.iastate.edu/request/gis/watchwarn.phtml).

## Validation

- Full suite: 105 Vitest files, 1,523 tests; 17 Python tests passed.
- Tornado browser coverage: phone WebGL, desktop WebGL, and desktop SVG fallback. Exercises real rendering/hit testing with fixed data, production map security restrictions, preserved URL filters, notable-event navigation, lazy analytics, no redundant point fetch, failed-request retry, and timeline keyboard navigation.
- Type checking, focused ESLint, production Vite build, and whitespace checks passed.
- Live NOAA/CDN and OpenFreeMap checks covered desktop/mobile Tracks, Density, Trends, and mobile Escape/focus behavior.
- Pipeline freshness/publication tests use temporary files and mocked upstream responses; the production sync and S3 upload were not run. Cache and normalization corrections take effect at the next data sync.
