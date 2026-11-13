# Pins zoom quality review — November 13, 2026

## Scope and result

This review covers the pending changes after `a699c4c`.
They include staged county detail, world navigation, project source links, and PCH gallery edits.
The review found defects in drawing limits, label placement, marker input, camera behavior, and repeated geometry work.
The PCH reference guide also failed its existing consistency test.

Five new regressions failed before the implementation fixes.
Additional tests cover camera limits, preparation budgets, cancellation, import behavior, and source-link events.
The [measurement record](../performance/2026-11-13-pins-zoom-quality-review.json) stores the results and source fingerprints.

## Findings and fixes

### P2 — Four published pins could never show their ordinary measurements

The map stops at zoom 16.
The new fade required zoom 16.75 for measurements whose size threshold was 16.
Those spokes retained zero opacity at the maximum zoom.
Their badges also remained hidden.

The affected records are Bajo Nuevo Bank, Scarborough Shoal, Serranilla Bank, and Vaavu Atoll.
Their published data is valid.
The defect was in the display policy.

[`radii.ts`](../../src/features/pins/radii.ts) now ends the opacity ramp at the map's maximum zoom.
The native layer filter still excludes a feature before its readable-size threshold.
The badge threshold uses the same maximum.
Features that require zoom levels above 16 remain hidden unless selected.

The tests evaluate the actual paint expressions and native filters.
A browser test opens Bajo Nuevo Bank without selecting it and verifies its badges at zoom 16.

### P2 — Unchanged geometry left badges behind new controls and error messages

[`radiusLabels.ts`](../../src/features/pins/radiusLabels.ts) returned immediately when its data object was unchanged.
That skipped placement work when an overlay appeared without camera movement.
A previously valid badge could remain behind a boundary error message.

Repeated data now schedules one animation frame without rebuilding the geographic bounds.
Existing frame coalescing prevents duplicate work in that frame.
When no radius is eligible, the renderer removes old badges without measuring layout.

The regression inserts an overlay across an existing badge and resubmits the same data object.
It verifies that the badge moves.
Additional cases check invalid projection coordinates and cleanup after zooming out.

### P2 — Selected counties lost hover details when ordinary counties were hidden

Click picking included `selected-pin`, but hover picking did not.
With County Off, the selected marker remained visible but could not show its tooltip.

The cursor also lost its pointer state on the first hover event.
The handler assigned the pointer before calling the popup dismissal routine, which cleared it.

[`mapRenderer.ts`](../../src/features/pins/mapRenderer.ts) now shares one marker-layer list between click and hover picking.
It assigns the pointer after validating the hovered pin.
Tests check tooltip content and pointer state on the first event.
The county browser scenario also checks hover details with County Off.

### P2 — World navigation could zoom in or discard a pending country pan

The world camera always used the fitted globe zoom.
For a camera already at zoom 0.25, that could zoom in to approximately 1.82 on a 900-by-640 viewport.

The camera now uses the smaller of the current zoom and the fitted globe zoom when returning to the world.
It preserves the current center and clears local padding.
Direct world entry retains its initial globe framing.

The renderer also records whether it opened directly on the world.
This prevents a first world request from discarding a pan made while country data was still loading.

Tests cover ordinary animation, reduced motion, wrapped longitude, pending data, and an already distant camera.
Browser tests verify both the first return and a repeated World action.

### P3 — Selected measurements rebuilt at an unrelated county threshold

Crossing zoom 9 changed the county preparation flag.
That flag invalidated the selected radius memo even though its inputs had not changed.
The worker received a second copy of the same selected measurements.

[`PinsMap.tsx`](../../src/features/pins/PinsMap.tsx) now separates the overview pin set from selected measurement generation.
The selected batch depends on the selection and distance units.
Crossing ordinary detail thresholds no longer replaces it.
The regression crosses zooms 6, 7, 8, 9, 10, and 16 and checks for one source write.

### P3 — Two county inputs and a dead helper obscured the real policy

`PinsMapProps` accepted both `showCounties` and an optional `countyMode`.
The fallback converted a true visibility flag into forced On behavior.
This created two representations of one setting.

The map now requires one county mode.
The layer controls still derive a visibility message for the current zoom.
Native drawing and geometry preparation use the required mode.

The old `visibleRadiusPins` helper was no longer called by the application.
Its tests could pass while the renderer behaved differently.
The helper and its obsolete assertions were removed.
Visibility checks now exercise renderer data and native style expressions.

### P2 — The PCH gallery guide did not describe the changed manifest

The pending manifest added four gallery IDs and changed several scene memberships.
The guide still listed 24 galleries and stale photo counts.
The existing importer consistency test failed.

The [PCH guide](../trips/pch-2024-galleries.md) now lists all 28 galleries and their current counts.
Descriptions follow the selected photo subjects.
The manifest retains 107 photos and passes its existing date, identity, panorama, and importer checks.

## Test coverage

The before and after measurements use the same source scope.
That scope includes the Pins feature, project page, pin contracts, and WGS84 destination helper.

| Measure | Before | After |
| --- | ---: | ---: |
| Focused tests | 134 | 153 |
| Lines | 99.45% — 908 / 913 | 99.78% — 917 / 919 |
| Statements | 97.16% — 1,167 / 1,201 | 97.92% — 1,181 / 1,206 |
| Branches | 95.22% — 1,038 / 1,090 | 95.54% — 1,030 / 1,078 |
| Functions | 98.31% — 292 / 297 | 98.98% — 293 / 296 |

The denominator changed because the implementation removed an unused visibility function and added current policy logic.
The before measurement used Node 26.13.0.
Final validation used the supported Node 26.13.1 runtime.

| Final check | Result |
| --- | --- |
| JavaScript suite | 3,174 tests pass across 220 files |
| Focused coverage suite | 153 tests pass across 15 files |
| Pins Python suite | 48 tests pass |
| Temperature Python suite | 18 tests pass |
| Chromium Pins scenarios | 30 pass |
| WebKit Pins scenarios | 30 pass |
| Lint and TypeScript | Pass |
| Production Vite bundle | Pass |
| npm and Python dependency audits | No known vulnerabilities |

## Security and verification limits

The source-data links retain isolated external navigation and fixed analytics fields.
Tests check both links and their event payloads.
Tooltips continue to assign text through DOM text nodes.
The review added no dependency.

The npm and pinned Python dependency audits report no known vulnerabilities.
The browser scenarios use the real renderer and geographic files with fixed external-service responses.
WebKit uses the existing local WPE browser and cached libraries.
Each browser run uses a separate artifact directory.

The circle time budget covers geometry preparation.
It does not cover GeoJSON serialization, worker indexing, graphics work, or network transfer.
The earlier [zoom transition measurements](2026-11-13-pins-zoom-transitions.md) retain their original scope and source fingerprints.

Physical-phone measurements, hosted-origin checks, and an independent geodesic search remain in [TODO.md](../../TODO.md).
Phone acceptance checks now have one location instead of separate navigation and performance lists.
The edited guides use short instructions and consistent technical terms.
The prose sentence-length check passes for the five edited maintained documents.
This check measures sentence length, not formal STE vocabulary compliance.
Historical review records retain their dated findings.
