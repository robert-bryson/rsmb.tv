# Pins quality review — November 12, 2026

## Scope and result

The review covered the uncommitted Pins project, its generated data, and its shared integrations.
The original patch had confirmed data, validation, and recovery defects.
Those defects are fixed.
The project includes the national pole, 56 state jurisdictions, and 3,235 county equivalents.

The review also checked routing, intent prefetch, metadata, preview images, shared geography, and Atlas compatibility.
See the [project guide](../../projects/pins-of-inaccessibility/readme.md) for operation and code ownership.
The [measurement record](../performance/2026-11-12-pins-review.json) retains coverage totals, source checks, and publication checksums.

## Confirmed findings

### P1: A published county outline was invalid

Weld County, Colorado, had a self-intersection near longitude -104.97991 and latitude 40.03197.
Independent coordinate rounding had damaged a narrow boundary junction.
The browser contract accepted the outline.
An invalid polygon can produce incorrect fills or fail later geometry processing.

The generator now uses a precision grid that preserves valid output.
It repairs polygon inputs before precision reduction and rejects empty or invalid final outlines.
The corrected county publication passes all 3,235 outline checks.
A small enclave fixture reproduces the rounding failure.
The Python suite also checks every published state and county outline.

See [`display_geometry`](../../projects/pins-of-inaccessibility/generate.py) and the [Shapely precision modes](https://shapely.readthedocs.io/en/stable/reference/shapely.set_precision.html).
Precision reduction can remove collapsed small pieces.
It is a display operation; the solver still uses the full source boundary.

### P1: Validation accepted incomplete and inconsistent publications

A truncated county list passed when its claimed total was reduced to match.
Unsupported vintages, inconsistent bearings, incorrect nearest points, and points outside their own bounds also passed.
An unbounded radius could request an impractical amount of spoke geometry.
Boundary validation accepted duplicate features, inconsistent identities, and collapsed rings.

The new contract fixes the snapshot to the checked 2025 sources.
It requires exact totals and county counts for each jurisdiction.
It checks IDs, FIPS codes, jurisdiction names, abbreviations, bounds, contact spacing, and geodesic endpoints.
A radius cannot exceed the supported two-million-meter limit.
File-specific readers reject a county file served as state boundaries.

Nine rejection tests failed against the original contract.
They pass after the fixes.
Browser ring checks remain cheaper than full topology checks.
The Python publication checks enforce full polygon validity before replacement.

See [`shared/pins.ts`](../../shared/pins.ts), the [snapshot](../../shared/geography/census2025.json), and [rejection tests](../../scripts/__tests__/pinsValidation.test.ts).

### P1: Worker failures could leave a blank map without recovery

The map handled graphics context loss but ignored worker and application-source errors.
A worker that stayed alive without answering requests could leave the canvas unusable indefinitely.
Background recovery cannot fix a failed application renderer.

The renderer now reports worker, graphics, and application-source errors.
A 15-second deadline detects pins that never become ready.
The deadline also covers startup before `style.load`.
A background change does not restart an existing deadline.
Readiness uses the pin source instead of global `idle`.

Retry recreates the renderer with the current data, selection, and camera request.
The data panel remains available during the failure.
Tests use both reported errors and a real inert worker.
They verify recovery through **Retry map** without a page reload.

See [`mapRenderer.ts`](../../src/features/pins/mapRenderer.ts), [lifecycle tests](../../scripts/__tests__/pinsMap.test.tsx), and [browser tests](../../tests/e2e/pins-map.spec.ts).

### P2: Fullscreen retry left the control in the wrong state

After graphics loss and retry, native fullscreen remained active.
The new button said **Enter fullscreen** and could not exit the current fullscreen view.
This was reproduced in Chromium before the fix.

Pins now shares the existing Atlas recovery behavior through a generic fullscreen control.
An active target retains its control during renderer replacement.
A target that exited fullscreen while detached receives a fresh control.
Atlas retains its own tooltip text through an adapter.
Native, prefixed, and simulated fullscreen regressions remain covered.
Browser tests enter fullscreen, retry the renderer, and exit through the restored control.

See [`ResilientFullscreenControl.ts`](../../src/maps/ResilientFullscreenControl.ts) and the [Atlas regressions](../../src/test/AtlasFullscreenControl.test.ts).

### P2: Publication writes and source provenance were too weak

The original writer replaced files separately without a rollback for later failures.
A fixed temporary filename also allowed concurrent writers to interfere.
Cached source archives were not required to match a shared pinned snapshot.
Python dependencies were unpinned, and the documented minimum version was incorrect.

The writer now validates and stages every selected output before replacement.
Unique temporary files prevent filename collisions.
An exclusive publication lock rejects another active writer.
The writer restores previous files after an I/O error or handled interruption.
It rejects nonfinite JSON and checks source checksums before reading either archive.
Pinned packages require Python 3.12 or later.
New pin publications record the writer's Python, GEOS, and package versions.

Each replacement is atomic; the set of files is not one atomic transaction.
A forced kill or power failure can still leave mixed files or a stale lock.
The guide gives recovery and validation instructions.
CI now runs the geometry and publication tests with the pinned packages.

See the [publication tests](../../projects/pins-of-inaccessibility/tests/test_publication.py) and [CI workflow](../../.github/workflows/ci.yml).

### P2: Lint failed and lifecycle responsibilities were mixed

The original map set React state synchronously in its setup effect.
Its resource effect also omitted a filename dependency.
The repository lint command failed.

The React component now owns UI state and renderer lifetime.
The renderer owns map events, deadlines, source updates, and cleanup.
Layer definitions live in a separate module.
Cancelled mounts allocate no WebGL context.
Partial initialization failures remove the map.
Source identity checks prevent duplicate GeoJSON writes during unrelated UI updates.
Lint and type checks pass.

### P3: Smaller behavior and test defects

- A tooltip could retain the old unit after the unit control changed. Its hover signature now includes the unit.
- Fixed camera padding could consume a short viewport. Padding now scales with the available width and height.
- Alphabetical results claimed to be ranked by radius. Their status now names the actual order.
- An untyped mixed array supplied the radius cards. Named objects now keep pins and labels typed.
- A browser image selector matched two screenshots. It now identifies the overview by its accessible name.
- The map-click test used device pixels as CSS coordinates. It now scales the pointer position for the browser's pixel density.

## Reuse and maintenance

Pins uses the existing worker entry, CARTO styles, background recovery, validated fetch cache, preference hooks, navigation, and project presentation.
Atlas and Pins share screen clipping and collision geometry.
They also share fullscreen recovery.
Geodesic drawing and endpoint validation use one direct WGS84 calculation.
Python and TypeScript share source checksums and jurisdiction counts through the snapshot contract.

The existing map monitor now includes Pins readiness, failure, and recovery.
The analytics allowlist accepts its feature value.
Tests verify that selected pin IDs and query values are omitted.
Local and preview hosts retain the existing analytics restrictions.

The project guide now separates coverage, calculation, publication, interface behavior, recovery, ownership, and validation.
The new text uses short sentences and active instructions.
Historical reports remain unchanged.
TODOs contain only open work, grouped by project or release check.

## Verification

All 3,082 JavaScript tests pass across 213 files.
All 18 temperature Python tests and 17 Pins Python tests pass.
Lint, type checking, the test-mode bundle, and the dependency audit pass.
The audit reports no known vulnerabilities in the installed npm dependency tree.

The focused Pins suite has 47 tests.
It covers real publication contracts, lazy resources, retries, cache reuse, rankings, preferences, labels, and renderer lifetime.
Shared regressions also check Atlas fullscreen, geography subsets, analytics privacy, and map monitoring.
The Pins Python suite has 17 tests.
It covers analytic geometry, source verification, all published outlines, checksums, locks, invalid values, and rollback.

| Focused V8 metric | Before | After |
| --- | --- | --- |
| Lines | 18.08% — 81/448 | 99.05% — 525/530 |
| Statements | 18.27% — 106/580 | 96.66% — 667/690 |
| Branches | 22.69% — 74/326 | 92.25% — 405/439 |
| Functions | 20.97% — 30/143 | 96.47% — 164/170 |

Both measurements use Vitest 5.1.0 and V8.
The measured scope includes the feature and its publication contract.
The final scope also names the direct geodesic helper moved out of the feature.
Both measurements include that calculation.
The source changes increased the denominator.
The focused report does not measure the entire repository or Python execution.
The lazy module wrapper remains outside direct focused coverage.
Navigation and browser checks exercise its behavior separately.

Browser scenarios use the real MapLibre renderer and published files.
All ten scenarios pass in Chromium and in WebKit.
They substitute fixed tiles and glyph responses.
They check rendered markers and circles, national selection, shared links, county loading, malformed-data recovery, units, badge collisions, and accessibility.
They also check mobile layout, fullscreen retry, background failure, and stalled-worker recovery.
The WebKit test setup uses cached local libraries through the repository's existing WPE launcher.
CI uses installed browser system packages.

The full source verification checks all 3,292 pins and 237,024 circle samples.
The largest radius difference is 0.674 meters.
The largest contact offset from its source boundary is 0.736 meters.
Both remain below the one-meter verification limit.
Circle samples use a two-meter inward margin for rounded coordinates.
The [measurement record](../performance/2026-11-12-pins-review.json) includes source and publication checksums.

Repeat the source comparison with:

```bash
.venv-pins/bin/python projects/pins-of-inaccessibility/generate.py --verify-only
```

The comparison reuses the generator's projection helpers.
It checks agreement with source boundaries, not independent proof of the global maximum.

## Remaining limits

The solver is an approximate geodesic search.
Its tolerance does not establish source accuracy or a certified global optimum.
A finite set of circle samples cannot prove containment between samples.
An independent search should check large, irregular, and nearly tied jurisdictions.

Fixed browser tiles do not verify a production CARTO key or its origin restrictions.
Physical-phone transfer, parsing time, memory, and assistive-technology checks remain open.
A passing automated accessibility scan does not replace a screen-reader check.
The initial pin index is about 1.9 MB before compression.
County display outlines add about 6.7 MB on first use.
Those sizes need device measurements before a claim about mobile performance.

Track these checks in [TODO.md](../../TODO.md#pins-of-inaccessibility).
