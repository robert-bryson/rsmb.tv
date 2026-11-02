# Flight map quality review

Review date: November 2, 2026.
Baseline: `094b812` and all pending files, including new files.

## Scope

The pending work separates the globe renderer, camera lifecycle, and optional geography from page controls.
It also changes texture recovery, clipboard fallback, camera bounds, and animation performance.
The [structural report](2026-11-02-flights-map-refactor.md) records the initial extraction.

Independent reviews checked repository standards and documented behavior.
The behavior sources were the [flight guide](../../projects/flights/readme.md) and the pending implementation notes.
No separate issue or acceptance document was supplied.

The initial suite passed all 2,140 tests.
Those tests did not cover later shared-camera navigation, empty-year bookkeeping, or repeated basemap visits.
The camera adapter also applied transitions immediately, which concealed a transition feedback defect.
Passing tests did not establish correct behavior on those paths.

## Standards

### P2: Camera URL updates stopped active transitions

`useZoomNavigation` started a camera transition and immediately wrote its target to the URL.
`useGlobeCamera` then applied that URL with a zero-duration `pointOfView` call.
The installed globe implementation ends its active camera tween whenever that setter runs.
Route selection, reset, and double click could therefore jump to their targets.
Gesture synchronization also moved the camera again after rounding its coordinates.
This defect was present before the extraction.

The navigation hook now records its requested target.
The camera hook recognizes URL updates from its own navigation and gesture callbacks.
It applies external views while allowing an existing transition to finish.
`globeView.ts` compares coordinates at the URL's four-decimal location and three-decimal altitude precision.
The default-view serializer uses the same comparison.

Regression tests check route transitions, double click, and rounded gesture updates.
They reject a second imperative camera update after the original command.

### P2: A repeated basemap visit reused old loading state

The texture hook identified a batch by its image URLs and retry count.
Consider this sequence: Night finishes, Day starts loading, then Night is selected again before Day finishes.
The stored Night key still matched the new visit.
The hook reported the previous success or failure while the new Night images were loading.
A previous failure could therefore restore an obsolete error overlay.

Each visit now has a separate batch identity.
Returning to the same URLs starts with zero progress and no error.
Callbacks from abandoned batches remain cancelled.
Tests cover prior success, prior failure, abandoned callbacks, and completion of the replacement batch.

### Maintainability and security

The layer hook built focused country and region airports separately for labels and point meshes.
It now calculates one focused airport set and shares it across both outputs.
This removes duplicate filtering, coordinate conversion, and an unnecessary non-null assertion.
Navigation commands also share one transition and URL-update function.

These are engineering judgments, not breaches of a separately documented coding standard.
The review found no confirmed injection defect in the changed renderer or tooltip paths.
The dependency audit reported zero known vulnerabilities.
That result applies to the audited lockfile and advisory response on the review date.

## Spec

### P2: A delayed year fit replaced camera navigation

The guide requires camera navigation to cancel a pending year fit.
The old code remembered a year only after its 100 ms timer fired.
A camera URL change cancelled that timer, but the next effect scheduled the same fit again.
The fit then replaced the incoming camera.
External navigation that changed the year also triggered a fit despite supplying a camera.

The map now tracks the observed year, observed camera, local year request, and pending fit separately.
External year navigation retains its supplied camera, including unchanged coordinates.
Selecting a year in the controls requests a fit.
An incoming camera, navigation command, reset, or gesture start cancels a pending fit.
Gesture cancellation happens before the 250 ms camera synchronization delay.
Data loading delays a valid fit without discarding it.
Timer cleanup still handles superseded work and unmount.

Tests cover shared views with changed and unchanged coordinates, reset, camera-only navigation, gesture start, delayed data, and unmount.

### P2: Returning from an empty year skipped fitting

The guide requires later year changes to fit their airports after data loads.
The old effect did not remember a year with no airport points.
After a populated year, an empty year, and reset, returning to the populated year looked unchanged.
The camera stayed at its default position.

Every observed year now updates the bookkeeping, including an empty year.
An empty result completes its fit request without moving the camera.
Returning to a populated year creates a new request.
Both application and real-renderer browser tests reproduce this sequence with fixed flight data.

### Preserved behavior

- Camera listeners remain attached after URL filter changes and are removed on unmount.
- A shared initial camera takes precedence over the initial year fit.
- Reduced motion prevents automatic rotation and animated route dashes.
- Pacific routes use the smallest enclosing longitude interval across the date line.
- Texture errors remain visible. Retry loads fresh images and mounts a fresh renderer.
- Clipboard feedback requires successful copying. Failed clipboard methods offer manual copying.
- Optional airport and state geography remains deferred until needed.
- Route previews and state totals continue to use current filtered flight data.

The review found two correctness defects under Standards and two requirement defects under Spec.
The highest severity is P2 in each axis.

## Animation measurement

Pause and play retain the renderer's arc objects and accumulated dash movement.
The installed renderer stores that movement separately from each arc's initial dash offset.
Thin arcs use 24 curve segments and four tube sides.
The display resolution remains unchanged.

The initial exploratory maximum was 915.9 ms.
The first optimized run reached 456 ms.
The review run reached 440.2 ms across six trusted taps.
Each run used 332 flights, Pixel 7 emulation, and 4× CPU slowdown.
The network used 150 ms latency, 1.6 Mbps download, and 0.75 Mbps upload.
Each sample ends after two animation frames following the click.

The 600 ms limit detects the initial regression and allows variation between local runs.
It is a regression ceiling, not evidence of acceptable field INP.
The initial 250 ms exploratory target remains unmet.
These local browser samples do not establish performance on a physical phone.

The [initial samples](../performance/2026-11-02-flight-animation-before.json),
[first optimized samples](../performance/2026-11-02-flight-animation-after.json),
and [review samples](../performance/2026-11-02-flight-animation-reviewed.json) retain the measurements.
The [flight guide](../../projects/flights/readme.md#animation-performance) gives the check command.
Run the measurement alone against a production preview with one worker.

## Coverage

The coverage comparison uses the full suite and the same Vitest configuration.
The default report measures executed source files; it does not prove complete repository coverage.
The review added 21 unit and application tests, plus one browser case executed in both browsers.

| Metric | Initial | Final |
| --- | --- | --- |
| Overall lines | 83.25% | 84.05% |
| Overall branches | 76.48% | 77.65% |
| Overall functions | 80.05% | 80.84% |
| Globe renderer lines | 50.00% | 66.12% |
| Map page lines | 50.78% | 64.56% |
| Layer derivation lines | 87.50% | 100.00% |
| Zoom navigation lines | 65.57% | 100.00% |

Renderer tests check focused visited and unvisited airports, endpoint styling, connected labels, transitions, and missing-data behavior.
Navigation tests cover reset, single points, empty sets, missing renderers, and date-line connections.
Texture tests check repeated visits as well as Retry.

## Validation

| Check | Result |
| --- | --- |
| Full Vitest suite with V8 coverage | 148 files; 2,161 tests passed |
| Temperature pipeline | 17 Python tests passed |
| Flight controls, durations, and CARTO browser checks | 42 passed across Chromium and WebKit |
| Mobile animation budget | Passed; 440.2 ms maximum across six taps |
| Dependency audit | Zero known vulnerabilities |
| TypeScript and full ESLint | Passed |
| Production Vite bundle | Passed with a fixture browser key and local generated content |
| Diff whitespace | Passed |

Browser tests used a dedicated local production preview and fixed responses where specified by each test.
The standard browser wrapper could not download state boundaries inside the network sandbox.
The review used existing generated geography and ran Playwright directly against its own preview.
The audit completed with network access.
The full unit suite still emits existing React `act` warnings in unrelated atlas and post tests.

The documentation uses short sentences, active voice, and consistent terms.
The current guide separates procedures from dated measurements.
This is a practical application of the repository's ASD-STE100 rules, without a formal compliance claim.

No external content was imported, published, or deployed.
