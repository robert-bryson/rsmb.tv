# Trip CI quality review: 2026-10-30

## Scope

The baseline is commit `046e09445146e1818ffa2aefc076441e9580e637`.
The review started with six uncommitted files for nine reported trip-browser failures.
Independent standards and specification reviews examined the patch and related map code.
The review also checked MapLibre's installed event dispatcher and render scheduler.

## Standards

No documented-standard violations or security defects were found in the pending changes.
The changes introduce no new credential handling or HTML injection paths.

The previous unit test invoked captured callbacks directly.
It checked coalescing and disposal, but did not exercise one-time event delivery or listener removal through MapLibre's dispatcher.
A new test uses the actual `Evented` implementation with a synthetic map.
It verifies coalescing, repeated render events, ignored raster-source events, and listener removal.
The existing direct-callback test retains checks for callbacks delivered after disposal.

Another test replaces the renderer, then delivers stop events from the removed renderer.
Those events must not change the replacement map's hover feedback, selection, or camera.
The test also checks a stop event with an invalid identifier.

Standards result: no hard violations; two test-quality improvements completed.

## Specification

### P2: Pending raster requests blocked marker recovery

The testing guide requires stop visibility to update immediately.
The proposed fix queued its additional frame on `idle`.
MapLibre emits that event only after movement and all visible source requests finish.
An already-loaded map can therefore apply stop visibility changes without ever running the recovery frame.

A Linux WebKit regression loads an inline map, switches to Terrain, and holds the replacement tile responses.
It toggles Stops twice and checks marker pixels before releasing those responses.
The original scheduler failed with zero marker pixels after re-enabling Stops.

Changing the callback to `render` alone was insufficient.
That frame could run before the GeoJSON tile arrived.
The final scheduler follows style changes and data events from `trip-route` and `trip-stops`.
It coalesces those events into one follow-up frame after rendering.
Raster-source events do not schedule recovery frames.
Cleanup removes both data listeners and any pending render listener.
An extra frame does not dirty the style or sources, so it cannot perpetuate this event sequence.

### P3: The overflow regression did not isolate the gutter guard

The 500-pixel body exceeded both the viewport and the usable page width.
That case could not prove that the added body-width check protected content inside a reserved gutter.

The layout checks and adversarial cases now share one overflow guard.
A new case uses a 375-pixel viewport, a 360-pixel page, and 365 pixels of content.
The root extent fits inside the viewport, but content exceeds the usable page.
Removing the body-width condition from a temporary test copy made this regression fail.
Restoring the condition made it pass.
The oversized-body browser case still verifies the DOM measurements.

Specification result: one product defect and one coverage gap corrected.

## Coverage

Both measurements use the final application source, compiler, and V8 coverage provider.
They include only `src/features/trips/components/TripRouteMap.tsx`.
The control runs 76 map tests and excludes the two new unit cases.
The complete run includes all 78 map tests.

| Measure | Control | Complete |
| --- | --- | --- |
| Statements | 97.79% | 99.37% |
| Branches | 94.29% | 96.97% |
| Functions | 98.50% | 100% |
| Lines | 99.60% | 100% |

These percentages do not describe the complete repository.
Browser results measure scenario coverage separately.

## Verification

The focused Linux WebKit run passed all six original input and motion combinations and the delayed-raster regression.
The complete Vitest suite passed 1,656 tests across 112 files.
The Python temperature suite passed 17 tests.
The complete trip-browser suite passed 127 cases on Linux and 127 cases on macOS.
Each browser run skipped two unsupported desktop touch cases.
ESLint, TypeScript, and the production fixture build passed.
All 49 local links in the affected documentation resolved.

The [trip testing guide](../trips/TESTING.md) contains the current commands and renderer checks.
Completed reproduction work was removed from [TODO.md](../../TODO.md).
