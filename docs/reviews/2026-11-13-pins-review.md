# Pins code review — November 13, 2026

## Scope and result

This review covers the recent Pins implementation, global expansion, and dependency changes through `703cd00`.
Four defects were reproduced and fixed.
The published geographic files did not need changes.
All source checks still pass.

The existing tests covered the normal workflows well.
They did not establish that publication validation matched the browser contract, that readiness applied to each data update, or that a hidden layer could fail without blocking the map.
The new regressions cover those gaps.

## Findings and fixes

### P2 — The world publisher accepted files that the browser rejects

The world validator checked pin IDs and selected distance values, but omitted several required fields and numeric constraints.
It also used Shapely validity as the main display-geometry check.
A valid Shapely object can be a point, and Shapely can close an open polygon ring while reading it.
Neither result proves that the original GeoJSON meets the browser contract.

Five direct counterexamples passed the old validator:

- A longitude shifted by 360 degrees.
- Inverted geographic bounds.
- A negative mapped area.
- A point substituted for a polygon.
- A country index with no verification metadata.

These are valid JSON values.
The JSON writer's nonfinite-number guard does not reject them.
The publication writer could therefore replace a usable file with data that the browser refuses to load.
This review found no such corruption in the committed data.

The Census and world generators now share coordinate, bounds, contact, and raw polygon checks in [`generate.py`](../../projects/pins-of-inaccessibility/generate.py).
The checks reject invalid coordinate ranges, booleans in numeric fields, nonfinite values, duplicate contact directions, open rings, and unsplit date-line edges.
They check each pin and contact against its declared bounds.
Polygon topology remains a separate Shapely check after the raw structure passes.

The world validator also checks administrative level, parent country, mapped area, solver limits, timestamp format, source labels, and verification totals.
Both generators share timestamp checks. The Census validator also rejects invalid method metadata and boolean publication counts.
New tests check malformed data in both publications.
A publication test confirms that invalid country data cannot replace another selected output file.

### P2 — The map could report ready while replacement pins were still loading

[`PinsMap`](../../src/features/pins/PinsMap.tsx) set its rendered flag after the first successful point batch.
It did not clear that flag for later point-source updates.
After changing country or scope, the map could report ready while the worker still held the previous points.
A later worker stall was reported only when its deadline expired.

The renderer now reports the start of each point batch.
The React wrapper returns to loading until the current point source is loaded.
Style recovery follows the same rule.
An existing deadline is retained while a batch is pending, so repeated style changes cannot postpone a stalled-worker error indefinitely.

The regression starts from a ready map, holds a replacement batch, verifies loading, then resolves it.
It also checks a later stalled replacement.

### P2 — Hidden province outlines still blocked the country view

The province checkbox changed display visibility, but the outline reader remained enabled.
A failed province outline could keep the map in error even after the user hid that layer.
The hidden layer also caused requests that the visible country map did not need.

[`useWorldPinsData`](../../src/features/pins/data.ts) now enables province outlines only while the layer is on.
Province pins remain available for rankings and selection.
A disabled outline reader suppresses its loading and error state.
Enabling the layer again reads the current resource and can recover a rejected response.

Hook, interface, and browser regressions cover this behavior.
The browser test starts with malformed Canadian outlines, hides the layer, verifies a ready country map, and then restores valid outlines.

### P2 — Hover details survived changes that made them stale

The popup was updated only on a later mouse-move event.
It could retain the previous country, scope, or distance units after the displayed data changed.
Leaving the map or pressing Escape did not close it.

The renderer now closes hover details when the point batch or units change, when the camera starts moving, or when the pointer leaves the map container.
Escape also closes them when the canvas does not have keyboard focus.
The document listener is removed when the renderer is disposed.
Moving from the canvas onto popup content does not count as leaving the map container.
The canvas description now includes countries and provinces.

The existing safe text rendering remains in place.
Tests retain the malicious-name case and add dismissal, reopening, country changes, and unit changes.
The browser regression uses the rendered national marker rather than a hard-coded screen coordinate.

## Validation

| Check | Result |
| --- | --- |
| JavaScript suite | 3,105 tests pass in 215 files |
| Focused Pins suite | 67 tests pass |
| Pins Python suite | 30 tests pass |
| Temperature Python suite | 18 tests pass |
| Chromium Pins browser suite | 15 scenarios pass |
| WebKit Pins browser suite | 15 scenarios pass |
| U.S. source comparison | 3,292 pins and 237,024 circle samples pass |
| Added global source comparison | 4,799 pins and 345,528 circle samples pass |
| Lint, TypeScript, and Vite bundle | Pass |
| npm and Python advisory scans | No known advisories |

The focused V8 scope is unchanged between measurements:
`src/features/pins/**`, both pin contracts, the shared geometry contract, and the WGS84 destination helper.

| Coverage | Before | After |
| --- | --- | --- |
| Lines | 99.06% — 639 / 645 | 99.24% — 659 / 664 |
| Branches | 93.00% — 678 / 729 | 93.49% — 690 / 738 |
| Statements | 96.51% — 832 / 862 | 96.83% — 856 / 884 |
| Functions | 97.23% — 211 / 217 | 97.73% — 216 / 221 |

The [measurement record](../performance/2026-11-13-pins-review.json) retains source checks, counterexamples, coverage, tests, and file fingerprints.

## Documentation and open work

The Pins guide now states when province outlines load and when changed pins are ready.
It describes the shared publication checks and the two circle-sampling margins.
Cache wording now matches the implementation: the shared cache stores raw JSON, readers validate before use, and a rejected current value is discarded.

The TODO list separates source and calculation work from hosted release checks.
Phone memory and parsing measurements are grouped with physical-device work.
Historical review reports retain their original evidence.

Natural Earth still has generalized boundaries and mixed administrative dates and levels.
The source comparisons check numerical consistency with those boundaries.
They do not certify a global geodesic optimum or current legal geography.
An independent geodesic search, hosted origin checks, phone measurements, and assistive-technology checks remain open in [TODO.md](../../TODO.md).

Use the [Pins validation guide](../../projects/pins-of-inaccessibility/readme.md#validation) to reproduce the focused checks.
The browser tests retain the real renderer and geographic files, with fixed basemap responses.
