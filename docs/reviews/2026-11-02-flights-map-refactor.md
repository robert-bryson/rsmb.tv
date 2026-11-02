# Flight map structural follow-up

Review date: November 2, 2026.

## Scope

The [flight and basemap review](2026-11-02-flights-and-basemaps-quality-review.md) left structural work for a separate change.
Its duration and filtered-preview fixes were already present.
This change separates the large map's renderer, camera lifecycle, and optional geography from page controls.

The initial extraction reduced `FlightsMap.tsx` from 1,169 lines to 579 lines.
It retains URL filters, selection actions, statistics, and page controls.
`FlightsGlobe.tsx` owns renderer styling, labels, and hit handling.
`useFlightMapLayers.ts` owns optional geography loading and derived airport and state layers.
`useGlobeCamera.ts` owns camera restoration, rotation, synchronization, and listener cleanup.

The [follow-up review](2026-11-02-flight-map-recovery-and-performance.md) adds camera and texture regressions.
Use that report for final validation and coverage results.

Filtered route counts, duration coverage, phone previews, and hover previews retain their existing behavior.
Optional geography remains deferred until a layer or focused selection needs it.
Static and animated arcs retain separate types.

## Camera fixes

### Filter changes removed control listeners

The old cleanup effect depended on URL-derived callbacks.
A filter change removed the listeners, but only the renderer-ready callback could attach them again.
The ready renderer now owns an effect that attaches and removes its current listeners together.

### Linked camera changes disabled explicit rotation

The old camera-restoration effect also disabled rotation.
Rotation now follows its explicit URL setting and the reduced-motion preference independently.
Direct interaction still pauses rotation.

### A delayed year fit replaced a shared camera

An initial year filter scheduled a fit even when the URL supplied a camera.
The shared camera now takes precedence.
Later year changes wait for airport data.
Cleanup cancels superseded fits and pending camera synchronization.

### Renderer readiness can precede ref assignment

WebKit exposed this ordering during validation of the extraction.
A tile-only globe can report readiness before React assigns its imperative ref.
The camera hook now records readiness first and reads the ref in effects after commit.
A regression reproduces that ordering without WebGL.

## Validation

These results describe the initial extraction. The follow-up report records the final working tree.

Application tests retain real URL navigation, filtering, layer derivation, and controls.
They replace WebGL and asset loading with fixed adapters.
The tests cover readiness, camera synchronization, listener cleanup, shared views, error recovery, selection, optional layers, and filtered state totals.

The added browser case exercises zoom, year selection, drag synchronization, statistics shortcuts, and camera reset with the actual renderer.
The existing browser cases check basemap changes, duration summaries, responsive controls, and deferred geography.

| Check | Result |
| --- | --- |
| Full Vitest suite | 147 files; 2,127 tests passed |
| Temperature pipeline | 17 Python tests passed |
| Flight map application tests | 23 passed |
| Selected browser checks | 42 passed across Chromium and WebKit |
| Production Vite bundle | Passed with a fixture browser key and the existing content registry |
| TypeScript and changed-file ESLint | Passed |
| Diff whitespace | Passed |

No data import, publication, credential change, or deployment occurred.
The [flight guide](../../projects/flights/readme.md#map-code) records current code ownership and focused check commands.
