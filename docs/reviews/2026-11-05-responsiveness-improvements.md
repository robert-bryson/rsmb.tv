# Responsiveness improvements: November 5, 2026

Implemented changes for filtered tornado Trends, Flights animation controls, and homepage loading.
The baseline is checkout `b031e4b`, including the earlier analysis documents.
This report records the initial implementation and its measurements.
The [quality review](2026-11-05-pending-changes-quality-review.md) adds validation, independent chart recovery, and a release gate.

## Measured results

| Case | Baseline | Final implementation |
| --- | --- | --- |
| Filtered tornado Trends, one displayed year | 77 yearly geometry requests | One geometry request and one shared aggregate request |
| Historical chart dependency | 44,202,461 raw geometry bytes | 1,218,145 raw aggregate bytes; 144,945 bytes with local gzip |
| Flights, maximum across six trusted taps | 470.9 ms | 389.3 ms in the final run |
| Flights, median across six trusted taps | 354.5 ms | 324.1 ms |
| Homepage, median LCP | 3,332 ms | 2,264 ms |
| Homepage, median first contentful paint | 1,008 ms | 1,100 ms |
| Homepage, measured CLS | 0.12515 | 0 |
| Leading homepage image, selected phone variant | 299,414 bytes, WebP | 155,346 bytes, AVIF |

LCP measures when the largest visible content appears. CLS measures unexpected layout movement.
Flight samples include two animation frames following a click. They are not field INP measurements.
Earlier final-design flight runs reached 356.9 ms and 395.5 ms maximum; final verification reached 389.3 ms.
These samples show variability rather than a guaranteed maximum on every device.

Timings use local production previews, Chromium 156.0.8078.4, and Pixel 7 emulation.
The limits were 4× CPU slowdown, 150 ms latency, 1.6 Mbps downloads, and 0.75 Mbps uploads.
Each homepage variant used three cold-cache samples. Each flight comparison used six trusted taps and 334 flights.
Timing runs were serial. The initial run with competing profiling and image work was excluded.

The [raw evidence](../performance/2026-11-05-responsiveness.json) retains all final measurements and relevant homepage experiments.

## Tornado Trends: separate chart data from geometry

### Cause

The map expanded its geometry range to the entire archive whenever Trends had a state, region, or intensity filter.
The browser reconstructed annual chart data from every county-segment feature.
The existing six-request concurrency limit reduced bursts but did not reduce total downloads or parsing.

### Design and implementation

[`shared/tornadoTrends.ts`](../../shared/tornadoTrends.ts) owns the versioned aggregate format, validation, and filtered summarization.
The generator groups normalized county segments by year, state, and intensity.
Each group retains counts, deaths, injuries, distance, and a width histogram.

Histograms preserve the combined median. Averaging group medians would produce incorrect results.
Widths of zero remain excluded, matching the previous implementation.
Unknown intensity and zero-result years also retain their existing meanings.

[`syncTornadoes.js`](../../projects/tornado-tracks/scripts/syncTornadoes.js) now writes `trend-index.json` during its existing staged publication.
The current workflow uploads all summary JSON and invalidates the tornado prefix, so it includes the new artifact.

[`useTornadoData`](../../src/features/tornadoes/hooks/useTornadoData.ts) loads aggregates only when a filtered Trends view requires them.
The index is cached and reused across filters. Retry invalidates a failed or malformed response.
[`TornadoMap`](../../src/features/tornadoes/components/TornadoMap.tsx) keeps geometry limited to the selected map years.
Unfiltered national Trends continues to use the existing small annual summary.

### Correctness and size verification

A read-only comparison downloaded the 80,221 public county-segment records across 77 years.
The new index contains 9,553 groups.
Its unfiltered annual output exactly matched all 77 published annual summaries, including width medians and distances.

Fixtures also compare state, region, intensity, unknown-intensity, empty-selection, and zero-year results with the original geometry summarizer.
Browser fixtures distinguish Kansas historical counts from national counts while historical geometry remains unrequested.
They cover WebGL, SVG fallback, phone controls, failed aggregate requests, and Retry in Chromium and WebKit.

For one displayed year, total raw geometry-plus-aggregate data falls from about 44.2 MB to about 2.1 MB.
That estimate combines the measured 905,249-byte 2025 object with the new index.
Raw sizes and local gzip sizes are not observed browser transfer measurements.

### Release requirement

Publish the updated tornado sync output before deploying the frontend.
The new required artifact is `https://data.rsmb.tv/tornadoes/trend-index.json`.
The normal sync and backfill publication paths already include it.
Both release builds now run `npm run verify-tornado-publication` before imports or bundling.
The check rejects unavailable files, malformed payloads, and incompatible annual totals.
The quality review confirmed that the current index URL returns HTTP 403.
No remote upload, workflow dispatch, or deployment was performed during this work.
The separately generated verification index is available locally at `/tmp/rsmb-tornado-trend-index.json`.

## Flights: retain rendering inputs and bound mobile buffers

### Cause

Arc objects already retained their geometry when animation timing changed.
However, each React render replaced unrelated styling and label callbacks.
The upstream HTML layer explicitly clears its labels when its `htmlElement` callback changes.
The points layer also rebuilds materials during unnecessary digests.

The structural probe found 521 unchanged arc geometry identifiers across six taps.
It also found 282 label removals and 282 insertions: all 47 labels were recreated on every tap.
See the [primary-source research](2026-11-05-flight-responsiveness-research.md) for installed library versions and implementation references.

### Design and implementation

[`FlightsGlobe`](../../src/features/flights/components/FlightsGlobe.tsx) now uses stable rendering callbacks and attribute-name accessors where appropriate.
The label factory has stable module identity.
Selection-dependent styles update only when the relevant selection changes.
Animation timing continues through the existing public renderer accessor, preserving dash positions.

Callback stabilization alone gave only a modest timing improvement.
Profiling also identified ongoing scene-rendering costs, so the mobile canvas and post-processing buffers now share a 1.5 pixel-ratio cap.
The desktop cap remains 2. HTML labels retain native display resolution.
The rendering module owns this policy; the camera hook only exposes its readiness state.
Both GPU buffers update together when the viewport crosses 768 CSS pixels.

This reduces mobile buffer pixels by approximately 44% relative to the previous 2× ratio.
It trades some canvas detail for lower rendering cost. It does not change geographic data or HTML label resolution.

The integration test verifies stable renderer inputs across pause and play.
The production performance check verifies that the actual label nodes survive all six taps.
It also checks the existing 600 ms limit and the mobile render-scale cap.
Camera recovery, keyboard controls, reduced motion, optional layers, filters, and duration presentation retain browser coverage.

## Homepage: reduce image bytes and remove the loading swap

### Cause

The leading preview was a dense map screenshot. Its selected 960-pixel WebP variant cost about 299 KB.
The homepage also arrived through a lazy route module after the initial shell rendered.
Replacing that loading placeholder moved the visible footer and caused the measured layout shift.

### Design and implementation

[`App.tsx`](../../src/App.tsx) imports the small homepage module with the entry code.
The visualization routes remain lazy.
This avoids the homepage route waterfall and loading-placeholder swap.
The existing reading-route byte budgets remain unchanged and pass.

[`generate-project-previews.js`](../../scripts/generate-project-previews.js) now creates fingerprinted AVIF variants alongside the existing WebP files.
[`ProjectPreview`](../../src/components/ProjectPreview.tsx) selects AVIF through a `picture` source and retains WebP as the format fallback.
Dimensions, responsive sizes, loading modes, and image priority remain explicit.
The original project screenshots remain unchanged.

All generated variants retain their source aspect ratio and avoid enlargement.
Generator tests verify decodable dimensions for both formats and preserve the existing atomic-write and directory-safety checks.
Manual comparison of the leading screenshot confirmed that the compact preview retains readable controls and map detail.
Phone and desktop browser checks verify decoding, image dimensions, and absence of horizontal overflow in Chromium and WebKit.

The browser format selection follows the [HTML picture model](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/picture).

### Why the final design has no image preload

Responsive preloads can start image requests before JavaScript discovers them.
The [browser guidance](https://web.dev/articles/preload-responsive-images) describes this mechanism and its matching `srcset` selection.
In this local connection model, the preload also competed with entry delivery.

| Homepage design | Median first paint | Median LCP | CLS |
| --- | ---: | ---: | ---: |
| Original lazy homepage and WebP | 1,008 ms | 3,332 ms | 0.12515 |
| AVIF and image preload; lazy homepage | 1,484 ms | 1,792 ms | 0.12515 |
| AVIF and image preload; eager homepage | 1,508 ms | 1,916 ms | 0 |
| Final: AVIF, eager homepage, no preload | 1,100 ms | 2,264 ms | 0 |

A low-priority preload did not materially improve the first-paint tradeoff in this test.
The final design preserves prompt initial content, improves the leading image, and removes the measured layout movement.
No preload code remains in the final application.

## Initial verification

| Check | Result |
| --- | --- |
| Full JavaScript/TypeScript suite | 2,521 tests passed in 167 files |
| Historical temperature Python suite | 17 tests passed |
| ESLint and TypeScript | Passed |
| Production fixture build | Passed |
| Chromium and WebKit application regression checks | 80 passed |
| Focused startup, recovery, filtered-history, and image checks | 14 passed |
| Reading-route JavaScript budgets | 12 passed across desktop Chromium, mobile Chromium, and WebKit |
| Serial flight performance check | Passed; retained labels, bounded resolution, and existing interaction budget |
| Full public tornado archive comparison | All 77 annual summaries match |
| Generated preview formats | Dimensions, decoding, fallback markup, and responsive layout verified |

Checks used the installed dependencies, Node.js 26.12.0, and npm 11.20.0.
A clean installation with the configured npm 12 toolchain was not repeated.
No dependencies or security overrides changed.

These results describe local laboratory conditions. They do not establish physical-phone or population performance percentiles.
The response fixes and data generator are implemented; the tornado artifact still requires publication before frontend rollout.
