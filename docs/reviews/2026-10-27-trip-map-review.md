# Trip map review and regression fixes: 2026-10-27

## Scope

The review baseline is commit `c2c64e1943df852b13b154e53eb03caf97b268a3`.
The reviewed changes were uncommitted at the start of this review.
They add day groups, map controls, story shortcodes, route previews, resource cleanup, and Boise content.
The review also covers the route loader, manifest checks, importer tests, and authoring instructions.

Two independent reviews checked code standards and the recorded requirements.
The [research report](2026-10-27-trip-day-map-research.md) and [authoring guide](../trips/TRIP-AUTHORING-README.md) supplied the behavior requirements.

The initial suite passed all 1,363 tests. It still missed seven distinct behavior defects.
The main weakness was incomplete state-transition coverage.
High line coverage did not establish correct behavior across loading, reset, failure, and restoration.

## Standards

### P2: An earlier reset suppressed a later day selection

Delay the map load. Select one day, reset the route, then select another day.
The old reset flag caused the load effect to skip the latest camera request.
The map retained the full-trip extent while its controls showed a selected day.

The map now records the exact selection applied to each instance.
A reset records its completed camera change. A later button press creates another camera request.
Tests cover this sequence with reduced motion enabled and disabled.

### P2: Changing days hid an unresolved map failure

Map errors used the selected overview day as part of their identity.
Changing that day hid the error without recovering the failed map.
Returning to the previous day restored the old error.

Errors now follow the route data and the map's requested scope.
Overview selection does not clear an error. Retry loads the route again and creates a new map.
The regression checks the error, retained day, retry action, and instance removal.

### P2: Inline maps initially showed other days' geometry

The initial style filtered the route line, but left the halo and direction layers outside the day filter.
The load effect corrected these layers later.
Unrelated routes could therefore appear before the map finished loading.

All three layers now receive their day filter during construction.
The regression checks the constructor style before it sends the load event.

### Maintainability: Repeated geometry conversion caused drift

Bounds construction appeared in initialization, selection, and reset paths.
Stop-feature construction also appeared in initialization and later updates.
This duplication was a judgment call, rather than a separate behavior failure.

Shared helpers now construct bounds, stop features, and track filters.
Tests check behavior through the public component. They do not repeat the helper implementation.

Standards result: three behavior defects and one maintainability finding. The delayed-load reset was the worst standards defect.

## Spec

### P2: Map failures discarded the usable preview

The research requires: "Keep a route download and preview available after interactive failures."
The error panel retained a download, but did not show the SVG route.
Day maps without a static image lost their visual fallback even when valid geometry remained available.

Failed maps now release their resources and show the route preview, day controls, error, retry action, and download.
The preview receives the parent map's route state.
It does not start an automatic retry or a duplicate request.
Tests cover successful recovery and HTTP failures that must make only one request.

### P2: Initial inline layers violated the day boundary

The research requires: "Limit inline day maps to the referenced day tracks."
The standards finding above also violates this requirement.
The correction applies before the first map load event.

Spec result: two gaps. Losing the usable preview was the worst spec gap. No clear scope expansion was found.

## Additional review findings

### P2: Selecting the current day did not restore its extent

Focus a stop, then press the already selected day button or `All days`.
The old code cleared the selected stop, but compared only day IDs before fitting the camera.
The camera therefore stayed focused on the stop.

Each button press now creates a camera request, including a press on the current selection.
Two regressions verify the camera fit and cleared stop selection.

### P3: Restored maps initially painted an outdated stop selection

Map construction used the original `stopId` property instead of the retained selection.
The load effect corrected the marker later.
Restored maps now use the current selection in their initial marker paint.
The restoration test checks both the constructor style and the later camera position.

### P3: Preview context and track colors disagreed with the interactive map

The selected overview preview removed other tracks. The interactive overview retained them in gray.
A focused track preview also used its day color while the interactive track used amber.

Overview previews now retain gray route context.
Focused track previews use the same amber selection as the interactive map.
Inline day previews continue to show only their assigned tracks.
Tests cover separate segments, context opacity, track colors, and scoped stops.

## Tests and coverage

Fifteen new cases cover the defects and their surrounding lifecycle behavior.
They include deferred loading, fullscreen retention, keyboard focus, unmount cleanup, static fallbacks, and retry.
The original heading hash test now wraps its state change in React's `act` helper.

The coverage comparison uses the same final source, V8 provider, compiler, and three trip-map test files.
The control run excludes the 15 new cases. The comparison run includes them.
Both runs measure these five modules:

- `shared/tripManifestSchema.ts`
- `src/blog/TripMdxBlocks.tsx`
- `src/features/trips/tripMapView.ts`
- `src/features/trips/components/TripRouteMap.tsx`
- `src/features/trips/components/TripRoutePreview.tsx`

| Measure | Control: 41 cases | With additions: 56 cases |
| --- | --- | --- |
| Statements | 90.42% | 92.87% |
| Branches | 87.16% | 89.86% |
| Functions | 88.97% | 92.91% |
| Lines | 93.93% | 96.21% |
| Preview branches | 81.92% | 96.38% |

The full suite measures loaded files. It does not measure every repository file.
Its final coverage is 77.78% statements, 71.22% branches, 75.79% functions, and 80.02% lines.
The original and final full-suite percentages use different source versions. They are not a controlled coverage comparison.

## Verification

| Check | Result |
| --- | --- |
| Complete Vitest suite with V8 coverage | 1,378 passed across 99 files |
| Python temperature pipeline | 17 passed |
| ESLint | Passed with zero warnings |
| TypeScript project checks | Passed |
| Dependency audit | Zero reported vulnerabilities |
| Production trip browser suite | 57 passed across desktop Chromium, phone Chromium, and phone WebKit |
| Final day-selection and restoration browser checks | Nine passed after the last state correction |
| Browser smoke suite | 16 passed in Chromium |
| Production fixture compilation and article JavaScript budgets | Passed |

The browser fixtures use synthetic content and fixed map tiles.
The complete trip browser suite passed before the last selection correction.
All nine day-map cases passed again after that correction.
The smoke suite also passed. It covers routing, post rendering, project layouts, and measurement failures.

The authoring guide now explains preview context, retained errors, and explicit retry behavior.
The documentation index links this review. The earlier research results remain historical.
`TODO.md` contains incomplete work only.

## Remaining limits

Stop-marker selection and all three basemap styles still need dedicated fixed-tile browser coverage.
These tasks remain in [TODO.md](../../TODO.md#browser-checks).
Unit tests verify their state and map calls, but do not prove rendered behavior in every browser.
This review does not verify live tile availability, real-device GPU use, private source records, or deployment.

Seven distinct behavior defects were fixed. Initial layer filtering appears in both review axes.
