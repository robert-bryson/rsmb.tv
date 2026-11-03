# Flight camera CI review

Review date: November 3, 2026.
Baseline: `f3c1938` and the pending flight-controls test change.

## Scope

The pending change adds startup waits before a browser test reads the camera URL.
The review covers that test, its camera hooks, and their existing application tests.
It does not establish the quality of unrelated site features.

Two independent reviews checked repository standards and documented map behavior.
The [flight guide](../../projects/flights/readme.md#map-code) supplies the behavior requirements.
The [documentation index](../README.md#writing-rules) supplies the writing rules.
No separate issue or acceptance document was supplied.

## Standards

The original diff has no confirmed documented-standard breach or security finding.
Its startup waits follow neighboring browser tests.
Extracting that short sequence would add little value.

The expanded browser cases share the existing typed flight and airport factories.
Both required datasets now use fixed responses.
The test no longer depends on a matching row in generated flight data.
The scripts TypeScript project includes Vite's client types for the factories' application type dependencies.

## Spec

### P2: URL targets did not prove camera recovery

The guide requires a populated year to fit again after an empty year.
The old browser case recorded the first nonempty URL camera and compared later URL values against it.
Camera navigation writes its target before the renderer completes its animation.
Canvas visibility and texture preload completion do not prove that animation has finished.
The assertions could therefore pass when the renderer failed to move.

The browser cases now assert a known target for fixed Seattle and Los Angeles coordinates.
They advance the browser clock through camera and globe animations.
They then record airport label positions projected by the actual renderer.
A reset must change those positions.
Returning from an empty year must restore the original fitted positions.

Three startup cases cover normal loading, delayed flights, and delayed textures.
Request gates control each delay.
Navigation waits for DOM content, so a held texture request cannot block the step that releases it.
The delayed-texture case also runs the year-fit timer before renderer readiness.

### P2: Late callbacks could publish after unmount

The guide requires unmount to cancel pending camera synchronization.
Cleanup cancelled existing timers and removed listeners.
However, a retained callback still captured the previous ready state.
Calling it after unmount scheduled another timer and could write camera parameters into a later page's URL.

Both scheduling and publishing now require a mounted camera.
The regression invokes retained zoom and gesture-end callbacks after unmount.
It checks that neither callback creates a timer or publishes a view.
This lifecycle defect predates the pending browser test change.

Additional cases reject non-finite renderer coordinates and check double-click fallback outside the globe.
An application case retains an initial year fit when data arrives before renderer readiness.

## Validation

The late-callback regression failed before the fix because it created a timer after unmount.
It passes with the mounted guards.

A temporary mutation disabled imperative camera movement while preserving URL writes.
The browser case failed at its reset label-position assertion.
This confirms that the new check detects missing renderer movement.
The original navigation source was restored before final validation.

| Check | Result |
| --- | --- |
| Full Vitest suite with V8 coverage | 156 files; 2,250 tests passed |
| Temperature pipeline | 17 Python tests passed |
| Flight controls with the actual renderer | 28 passed across Chromium and WebKit |
| Complete Chromium smoke suite | 68 passed; one optional performance check skipped |
| Production fixture bundle | Passed with `vite build --mode trip-test` |
| Full ESLint, TypeScript, and diff whitespace | Passed |

The coverage comparison uses the same Vitest configuration.
The default report measures executed source files.

| Scope | Metric | Before | After |
| --- | --- | --- | --- |
| Overall | Lines | 84.18% | 84.20% |
| Overall | Branches | 78.00% | 78.08% |
| Overall | Functions | 80.70% | 80.77% |
| Camera hook | Lines | 98.86% | 100.00% |
| Camera hook | Branches | 89.09% | 100.00% |

The browser suite used a dedicated local Vite server and existing generated geography.
The standard wrapper could not download state boundaries in the network sandbox.

## Limits

Browser checks use local fixed responses and installed browsers.
They do not measure field performance or physical phone behavior.
The review found no confirmed injection defect in the changed paths.
It does not replace a repository-wide security audit.

The review found zero Standards defects and two Spec defects.
The highest Spec severity is P2.
