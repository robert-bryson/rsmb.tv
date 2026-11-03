# Basemap and camera test reliability review

Review date: November 3, 2026.
Baseline: `9777d05` and the pending basemap browser-test changes.

## Scope

The pending changes separate basemap authentication checks from globe rendering transitions.
The review covers those tests, their fixtures, shared basemap configuration, and related documentation.
It follows the renderer and tile-cache code where those tests depend on it.
The complete browser run also exposed a startup race in the existing camera recovery test.
The review therefore includes that test's renderer synchronization.

Independent reviews checked repository standards and documented behavior.
The [basemap guide](../carto-basemaps.md) and [flight guide](../../projects/flights/readme.md#map-code) supply the behavior requirements.
The [documentation index](../README.md#writing-rules) supplies the writing rules.
The original CI timeout supplies the failure to correct.

## Standards

### P2: The fixture could accept the wrong rendered style

The initial mock returned red tiles for the starting style and green tiles for every other CARTO path.
The Night texture was also green.
An incorrect CARTO style could therefore satisfy the Night pixel assertion.

A temporary renderer mutation selected CARTO Light while the controls and URL selected Night.
The initial test passed in 3.7 seconds.
This demonstrates a false positive in the test. It does not establish a production rendering defect.

The fixture now accepts three explicit CARTO tile paths.
It rejects other paths instead of giving them a success texture.
Light tiles are red, Voyager tiles are green, and the Night texture is magenta.
Each transition requires its selected color and rejects the previous color.

The same renderer mutation now fails because the selected texture is absent.
The production renderer was restored before final validation.

This finding concerns test quality. No separately documented coding rule requires these fixture colors.
The final review found no confirmed security issue in the scoped changes.

## Spec

### P2: Camera recovery could compare against an unfinished startup animation

The first complete software WebGL run failed in the delayed-texture camera recovery case.
Its reference labels were clustered near the globe center.
The final labels had the correct fitted separation, so comparison with that unfinished reference failed.

The test advanced its clock before waiting for the renderer to attach airport labels.
Texture preloading and the camera URL could complete before the renderer's own image-load callback.
That callback starts the globe's growth and rotation animations.
A clock jump before that callback cannot complete those later animations.

The test now waits for both labels before advancing animation time and recording its reference positions.
Label attachment establishes that the renderer's scene is visible and its startup animations have begun.
The same ordering applies when the filtered year returns.
The reset-position and restored-position assertions remain active.
This is a pre-existing test synchronization defect, not a confirmed camera recovery defect.

### P3: OpenStreetMap attribution could disappear without a test failure

The guide requires visible CARTO and OpenStreetMap attribution on CARTO maps.
The initial browser assertions checked only CARTO.
Removing OpenStreetMap independently would pass those assertions.
This coverage gap predates the pending changes.

The browser checks now require both provider links and their exact destinations.
They cover the flight globe, temperature map, and temperature trends map.
The Voyager transition retains both links. The Night transition removes both CARTO attribution links.

New unit cases check an authenticated raster source, encoded keys after trimming, and both provider links.
They also check neutral raster and vector fallback styles with blank or whitespace-only keys.

## CI timeout

The [failed CI run](https://github.com/robert-bryson/rsmb.tv/actions/runs/41692970094) preserved its trace and screenshot.
The trace recorded 29,938 milliseconds before the last pixel assertion began.
Only 62 milliseconds remained in the 30-second test budget.
The failure screenshot already showed Night and contained zero pixels that matched the old red-tile predicate.

The original test combined authentication, attribution, and two style changes under one timeout.
Its first canvas screenshot took about 4.9 seconds in CI.
Menu interactions and tile loading consumed the remaining time.

Authentication remains a separate check for each map.
Light to Voyager and Voyager to Night rendering now run in separate cases.
Each case uses a fresh page, an 800 × 600 viewport, reduced motion, empty flight data, and fixed texture responses.
The actual globe renderer and tile-cache behavior remain active.
The default timeout and retry settings remain unchanged.

## Validation

| Check | Result |
| --- | --- |
| Full Vitest suite with V8 coverage | 156 files; 2,253 tests passed |
| Temperature pipeline | 17 Python tests passed |
| Basemap checks in Chromium and WebKit | 10 passed |
| Repeated software WebGL basemap checks | 20 passed |
| Repeated software WebGL camera recovery cases | 12 passed |
| Camera recovery cases in WebKit | 3 passed |
| Complete software WebGL Chromium smoke suite | 70 passed; one optional performance check skipped |
| Production fixture bundle | Passed with `vite build --mode trip-test` |
| Full ESLint, TypeScript, and diff whitespace | Passed |

The renderer mutation passed before the fixture correction and failed after it.
The failure identified the missing selected texture rather than a navigation or request error.
A second mutation disabled imperative camera movement while preserving URL updates.
The corrected camera recovery case failed at its reset-position assertion.
No mutation remains in production source.

Browser checks used a dedicated Vite server, existing generated geography, and a fixture browser key.
They ran Playwright directly because the standard wrapper downloads U.S. state boundaries and requires network access.

## Coverage

Both focused measurements use the same final source module, V8 provider, and explicit file set.
The file set contains `src/maps/cartoBasemaps.ts`.
The first measurement uses the original two unit cases. The second includes three additional cases.

| Metric | Before | After |
| --- | --- | --- |
| Statements | 100% | 100% |
| Branches | 80% (12/15) | 86.66% (13/15) |
| Functions | 100% | 100% |
| Lines | 100% | 100% |

The remaining uncovered branches select the module-level key and missing-key attribution during import.
This comparison is scoped coverage. Browser checks do not contribute to V8 coverage.

## Limits

The review covers the pending changes and their direct dependencies.
It does not establish the quality or security of every repository feature.
Fixed provider responses do not verify production CARTO authorization.
The Night fixture checks selection and rendering, not NASA image content.
Local software WebGL results do not measure physical devices or every CI machine.

Standards: one test-quality finding, fixed. Spec: one synchronization defect and one attribution coverage gap, fixed.
The highest severity is P2 under each axis.
