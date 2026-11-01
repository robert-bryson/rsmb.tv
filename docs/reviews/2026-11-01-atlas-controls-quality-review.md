# Atlas controls and content review

Date: November 1, 2026.
Branch: `feature/motorcycle-trip-atlas`.
Comparison: `main` at `f27cb017633c13aec8980ba07b3edc98831adc4f` through the working tree.
The review includes pending source, tests, content, and documentation.

The pending changes were not ready to commit.
The initial unit run failed two authoring checks.
The first browser run passed 337 cases, failed 12, and skipped 17.
Some failures exposed application defects. Others exposed outdated test assumptions.

## Standards

The standards pass found two confirmed tooltip defects.
Both affect keyboard access and the information exposed to assistive technology.
It found no separate hard breach of a documented coding rule.
Style heuristics alone did not justify a broad refactor.

### P2: A focused control retained an obsolete tooltip

`AtlasControlTooltips.tsx` copied the control's tooltip text when the hint opened.
It did not detect later changes to `data-atlas-tooltip`.
Browser Back could restore the newest-first sort while its focused tooltip still described ascending mileage.
The accessible description retained the same incorrect text.

The tooltip now observes relevant attribute and DOM changes.
It updates text when the current action changes.
It removes hints for removed or hidden controls.
Cleanup retains any description that existed before the tooltip.

Unit checks cover updates, removal, empty text, description cleanup, and unmounting.
A browser regression retains focus through Back and checks the visible and accessible text.

### P2: Delayed hover events replaced keyboard guidance

Focusing a column control can scroll the editor beneath a stationary pointer.
The resulting pointer events could replace the focused control's hint with another control's hint.
The phone Chromium failure trace showed this sequence after focusing **Reset columns**.

Keyboard focus now takes priority while its target remains focused.
Unrelated pointer transitions cannot clear that target's hint.
A unit regression covers these transitions. Browser checks retain the original focus-and-scroll sequence.

## Spec

The behavior pass used the current atlas guide and the browsing research.
It found three confirmed application defects and outdated documentation.
Marker loading and recovery passed independent browser probes.

### P2: Resizing during a drag retained the previous layout

`useAtlasPanelDrag.ts` measured orientation and panel sizes when the pointer pressed the handle.
It retained those measurements after the viewport crossed the 768-pixel phone breakpoint.
A desktop width then became a phone sheet height. Vertical movement continued using a horizontal pointer delta.

Window resizing and lost window focus now cancel an active drag.
Cancellation restores the starting panel state and removes temporary styles.
Cleanup also releases pointer capture when the panel unmounts.
Tests check breakpoint changes, subsequent clicks, unrelated pointer IDs, and capture cleanup.

### P2: Safari could ignore Escape during a pointer drag

Safari can leave a pointer-pressed button unfocused.
The former handle-level key listener then missed Escape events sent to the page body.
Releasing the pointer committed the resized panel instead of restoring its starting state.

A document listener now handles Escape while a drag is active.
It cancels the gesture before other dismissal handlers run.
It does not intercept Escape when no panel drag exists.
Tests cover an unfocused handle, cancellation, native clicks, and the next drag.

### P2: Location sorting compared regions before all countries

`sortAtlasEntries` sorted the display label, which interleaves countries and regions.
This violated the required order: country names first, then region names.
For example, Ontario could place a Canada–United States trip before a Canada-only trip in Quebec.

Sorting now uses separate country and region keys.
It normalizes and sorts both lists before comparison.
It computes each trip's key once per sort operation.
Unknown locations remain last in both directions. Existing title and ID tie-breakers remain deterministic.
A regression checks both directions with cross-border, single-country, and missing locations.

### Content and documentation corrections

The author confirmed that `20241003-150610` now appears inline in the PCH report.
Its shortcode is `{{trip-photo:20241003-150610}}`.
Removing it from `day-one` correctly prevents duplication.
The manifest must retain the photo.

The authoring tests now check 98 gallery placements plus the separate inline placement.
They also verify that the importer expands that shortcode.
The gallery guide now lists three October 3 gallery photos and explains the inline placement.
These checks validate the declared placement. They do not fetch or inspect the current source Google Doc.

The atlas guide now describes both arrow controls, dragging, and interrupted gestures.
It documents the two-thirds desktop panel, column settings, saved preferences, and keyboard commands.
Day-break wording now excludes the final day with recorded tracks.
Later itinerary entries without tracks do not create another recorded endpoint.
The testing guide includes the new controls and focused commands.
Current procedures use shorter sentences and consistent terms.
The source inventory now reflects the motorcycle models already recorded in the two recovered-trip manifests.
Historical review results retain their original dates and scope.

### Browser test corrections

Six initial failures came from empty-map clicks at the Share button's new position.
Those clicks now target uncovered canvas space.
They still check deselection, route pixels, and the camera.

Two WebKit traversal failures used plain Tab where macOS requires Option+Tab to include buttons.
Those tests now use the platform-specific key and retain their focus assertions.
Two drag measurements assumed fractional injected pointer positions.
WebKit delivers integer coordinates. The measurements now allow one CSS pixel for that rounding.
Panel state, final size, URL state, and camera checks remain in place.

The next full run exposed route measurements contaminated by the new pins and control hints.
The screenshot helper now hides those DOM overlays while it counts route pixels.
It disables opacity transitions during capture. MapLibre's 200-millisecond marker fade otherwise leaves partly visible symbols.
It retains their pointer targets and restores their visible styles after capture.
A colored overlay with the same transition verifies this behavior.
The deselection and shared-road checks also compare exact saved cameras.

## Validation

| Check | Result |
| --- | --- |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Vitest | 1,958 passed across 133 files |
| Python temperature pipeline | 17 passed |
| Focused controls: desktop Chromium, phone Chromium, iPhone WebKit | 61 passed; 5 input-specific cases skipped |
| Route pixel and camera regressions, repeated three times in each browser project | 27 passed |
| Full trip browser suite: desktop Chromium, phone Chromium, iPhone WebKit | 358 passed; 17 browser/input-specific cases skipped |
| Site smoke suite: Chromium and WebKit | 79 passed; 5 Chromium-only performance cases skipped in WebKit |
| Dependency audit | Zero vulnerabilities reported by `npm audit --audit-level=moderate` |
| Production fixture build and JavaScript budgets | Passed in the full trip browser suite |

The npm audit required network access. Browser servers required local listening access.
Both checks completed after the sandbox restrictions were lifted for their commands.
No production deployment or source-document write formed part of this review.

### Coverage

Both measurements below use the same final application source, compiler, and V8 provider.
The reference excludes the 14 new review regression tests.
The complete run includes them.
Both measure the same 8,717 loaded source lines. They do not measure every repository file.

| Metric | Reference | Complete suite |
| --- | ---: | ---: |
| Lines | 82.45% | 83.12% |
| Statements | 80.37% | 81.05% |
| Branches | 75.47% | 76.13% |
| Functions | 79.11% | 79.55% |

The drag hook increased from 25.33% to 100% line coverage.
Its branch coverage increased from 4.83% to 83.87%.
Browser checks provide separate evidence for real pointer input, Safari focus, layout, and rendering.

Use the [testing guide](../trips/TESTING.md#adv-atlas) to repeat the behavior checks.
Use [TODO.md](../../TODO.md) for remaining publication checks and real-phone validation.

Standards: two confirmed defects, led by stale accessible guidance.
Spec: three confirmed application defects, led by incorrect drag handling across layouts.
