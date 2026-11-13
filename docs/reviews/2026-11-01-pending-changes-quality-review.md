# Pending changes quality review

Review date: November 1, 2026.
Baseline: `aef1d91e7da6876225786da0216ee1197b4753f4`.

## Scope

The initial working tree contained 15 changed files.
Changes covered PCH photos, atlas repaint scheduling, browser checks, dependencies, and the Terraform provider lock.
The review included those changes and their immediate callers.
Both code defects below existed in surrounding code at review start.

Standards came from the repository guide, documentation index, trip testing guide, and trip authoring guide.
No external issue or specification was supplied.
The behavior review used the documented atlas and authoring contracts.
Independent standards and behavior reviews found no further confirmed defects after the fixes.

## Standards

### P2: Responsive photos could combine different source revisions

Affected module: [update-trip-manifest-assets.js](../../scripts/update-trip-manifest-assets.js).

The updater validated each derivative's filename, width, and height separately.
It accepted different fingerprints within one photo's responsive image set.
A combined or stale asset report could therefore show different source revisions at different screen widths.

The fix compares each derivative's fingerprint with the first accepted derivative.
A mismatch stops the update before the CLI writes the manifest.
Existing filename, positive-dimension, unique-width, and trip-ID checks remain active.

The regression supplies every fixture photo, with conflicting fingerprints at 480 and 1600 pixels.
It failed before the fix because the updater accepted the report.
It passes after the fix.
Existing valid-report tests still check sorting, dimensions, captions, and alt text.

## Spec

### P2: Stale rendered features could select excluded trips

Affected module: [TripAtlasMap.tsx](../../src/features/trips/atlas/TripAtlasMap.tsx).
Contract: map interactions use the same filtered trip set as cards and table rows.

MapLibre updates GeoJSON sources through a worker.
Rendered feature queries can return the previous source while that update is pending.
The hit test trusted every nonempty `tripId` from the renderer.
An excluded trip could therefore remain clickable or appear in shared-road choices during that interval.

The fix checks each candidate against the current entries and available route data.
It rejects unknown, malformed, excluded, and unavailable IDs.
It retains unique choices and the selected route's hover priority.

The regression removes a trip while the renderer continues returning its old feature.
Before the fix, clicking that feature selected the removed trip.
After the fix, the click follows the normal empty-map action and hover feedback clears.
Additional tests cover duplicate features, shared-road previews, and keyboard or pointer selection.

## Test reliability

The first complete trip browser run passed 404 tests and failed two existing story-map checks.
Both checks passed all 18 isolated repetitions across Chromium, mobile Chromium, and WebKit before adjustment.

The lazy-map check used scripted scrolling while navigation restoration could still move the page.
It now sends keyboard input before scrolling, as the existing map-suspension check already did.
This ends restoration before the test approaches the map.

The route-reset check compared exact painted bounds without first excluding hover feedback.
Hover changes stroke width and can change the measured bounds without changing the camera.
The check now moves the pointer away and verifies that feedback has cleared.
Exact pixel comparisons and JavaScript budgets remain unchanged.

The repaint tests now cover camera movement, style changes, route updates, and day-break updates.
They use MapLibre's actual event dispatcher to check event coalescing and cleanup.
They also verify that background-tile updates do not request the extra route paint.

## Content and documentation

The PCH manifest contains 107 photos and 24 galleries.
Four photos precede departure. Day galleries contain 102 photos. One trip-day photo has an inline placement.
Tests check gallery references, dates, responsive URLs, and inventory totals.
The new import-evidence check connects added photo IDs to selected filenames and recorded capture dates.
It checks SHA-256 syntax; it does not re-hash source files.

Current guides describe fingerprint consistency, stale-feature rejection, and browser setup requirements.
The PCH guide now states how to prevent repeated photos when using the optional forest-road inline placement.
The documentation uses short sentences, active voice, and consistent terms.

## Validation

| Check | Result |
| --- | --- |
| Clean install with configured npm 12.2.1 | Passed |
| Dependency tree validation | Passed |
| npm audit | No known vulnerabilities reported |
| ESLint | Passed |
| TypeScript | Passed |
| Vitest | 2,004 tests passed in 138 files; 1,995 tests before review |
| Historical temperature pipeline | 17 tests passed |
| Production build | Passed |
| Chromium and WebKit site smoke tests | 79 passed; 5 skipped |
| Complete trip browser suite | 406 passed; 17 skipped across Chromium, mobile Chromium, and WebKit |
| Terraform format and validation | Passed with Terraform 1.17.1 and locked AWS provider 6.71.0 |
| Mocked Terraform tests | 3 passed |
| Whitespace checks | Passed |

Coverage uses the same 275 instrumented files before and after the review.
No files were excluded to improve these results.

| Coverage | Before | After |
| --- | ---: | ---: |
| All lines | 83.95% | 84.37% |
| All statements | 81.99% | 82.42% |
| All functions | 80.65% | 81.18% |
| All branches | 76.88% | 77.17% |
| Atlas map lines | 77.46% | 89.30% |
| Atlas map branches | 70.12% | 78.38% |

Validation used Node.js 26.12.0, which satisfies the declared engine range.
Browser checks used macOS and emulated phone viewports.
They do not replace real-phone or Linux WebKit checks.
PCH publication and source-review tasks remain in [TODO.md](../../TODO.md#pch-2024).

Standards: one fixed finding. Spec: one fixed finding.
