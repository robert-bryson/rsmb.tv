# Temperature publication and map review

## Scope

The review starts at commit `3227e91f04faa86d944fd68b61b5006f374b5222`.
It covers the pending temperature update and its shared MapLibre worker changes.
The working tree already contained these changes when the review started.
No issue or separate specification was supplied.
The [map guide](../temperature-map.md) provides the behavior contract.

Lint and TypeScript passed before the fixes. The incoming Vitest suite passed 2,335 tests.
Those results did not detect the seven defects below.
Thirteen new regression cases failed before their corresponding fixes and passed afterward.

## Standards

The independent standards review found three P2 defects.
These are documented-contract violations, not style preferences.

### P2: A state without usable observations could appear complete

`fetchStateForDate` accepted any nonempty ACIS station array.
An array containing only missing observations returned success with no observations.
The caller then assigned complete coverage to that state.
Other states could supply enough rows to publish the archive with a false completion claim.

The numeric parser also accepted prefixes such as `90junk` through `parseFloat`.
Non-finite values could reach observation archives.

The sync now uses the same finite-number parser for observations, historical extremes, and monthly extremes.
It rejects a state with no usable observations.
The tests distinguish this failure from a valid day with no broken records.
They also retain zero temperatures and permit one missing companion observation.

This check does not prove that every station reported.
State completion means that the required responses succeeded and the state supplied usable observations.

### P2: Closing station history could lose keyboard focus

Opening station history unmounted `SummaryPanel`.
That panel stored its visible-row count in local state, with an initial limit of 25.
After **Show more**, selecting row 26 and closing history reset the list to 25 rows.
The focus-restoration query could not find the selected row.

The records panel now stays mounted and hidden while station history is open.
This preserves its expanded rows and scroll position.
The component and phone browser tests select row 26 and check focus after closing history.
Marker selection also clears the previous list-row focus target.

### P2: Invalid calendar dates could crash the seven-day status

The date schema checked only the `YYYY-MM-DD` pattern.
It accepted `2026-99-99` and invalid month-end dates.
The seven-day status called `toISOString()` on the resulting invalid date and could throw `RangeError`.

The shared date schema now validates calendar dates with `z.iso.date()`.
This covers snapshot dates, observation-date lists, coverage keys, and record dates.
The tests reject invalid leap days and month ends. They accept a valid leap day.
Previous-record date text retains its existing escaped fallback behavior.

## Spec

The independent behavior review found two P2 defects.

- The focus defect above violated: “Closing station history returns keyboard focus to the list row.”
- A state filter with one station violated: “The state filter frames its stations.” The camera used the state centroid instead. A lone El Paso station could fall outside a phone viewport. The camera now centers on the station. A component regression checks its coordinates.

No separate issue specification was available.
The review did not infer additional product requirements.

## Additional defects

### P2: A failed record feed detached the live map

The component replaced its complete map tree with an error message when a record feed failed.
This removed the canvas container without unmounting the component or destroying the MapLibre instance.
After returning to a working view, the initialization effect did not run again.
Its existing map still targeted the detached container.

The map now keeps its container and view controls mounted and displays an error overlay.
The component regression fails on the original detached-container behavior.
A browser regression fails the county request, returns to recent records, and checks that the same canvas remains connected and renders its marker.

### P2: Repeated viewport fits counted the toolbar padding twice

The camera stored padding for the toolbar and records panel.
It also supplied that complete padding to `fitBounds`.
MapLibre's default fit behavior adds requested fit padding to the camera's existing padding.
Returning from a failed county view therefore reduced the usable viewport again.
At a 1,280 by 720 viewport, the camera reached its minimum zoom and displayed two world copies of one station.

Viewport fits now set `absolutePadding: true`.
This replaces the camera padding with the requested values.
The installed MapLibre `camera.ts` implementation confirms this behavior.
The unit regression checks the fit option. The production recovery regression checks that only one station marker renders.

### P2: February requests used the wrong year's month length

The monthly historical query ends in the year before the observation.
Its last-day calculation used the observation year.
For a 2024 observation, it requested the invalid end date `2023-02-29`.
For a 2025 observation, it omitted `2024-02-29`.
The stricter upstream failure handling made invalid requests fail the complete sync.

The calculation now uses the historical year in UTC.
Two request-level tests check the exact February end dates across the leap-year boundary.

## Maintainability and documentation

The review retains the shared MapLibre entry point and independent per-view record requests.
Summary metadata remains optional. Its failure cannot block the active record feed.
The production browser configuration now participates in TypeScript checks.
Map readiness uses source and render events instead of a queued state update after the effect.

The browser pixel helper masks the actual records panel as well as other overlays.
The preserved panel has an unpositioned wrapper with no useful mask bounds.
Without the explicit panel mask, colored sidebar text was counted as map markers.
The fixture also gives each station its own history name.

The map guide now states the publication boundary precisely.
Upstream fetch or validation failures leave prior record files in place.
Final replacements are atomic per file. The complete file set is not one transaction.
The workflow starts its upload only after the sync script succeeds.
An interrupted upload can still leave different object versions visible together.

The guides use short instructions, active verbs, and consistent terms.
Exact commands, code identifiers, and quoted contract text retain their spelling.
This is a simplified technical writing pass, not an ASD-STE100 certification.

## Validation

| Check | Result |
| --- | --- |
| Complete Vitest suite with V8 coverage | 2,355 tests passed in 163 files |
| Historical pipeline | 17 Python tests passed |
| TypeScript | Passed |
| ESLint | Passed with zero warnings |
| Dependency audit | Zero reported vulnerabilities |
| Production temperature browser suite | 12 tests passed in Chromium and WebKit |
| Production trip browser suite | 537 passed, 17 skipped, one startup timeout; the timed-out case passed three isolated repeats |
| Other map browser checks | 31 passed; five WebKit performance cases skipped because they require Chromium's DevTools Protocol |
| Local documentation targets | 148 targets exist |
| Whitespace | `git diff --check` passed |

### Coverage comparison

These are full-suite runs before and after this review.
Both use the V8 provider. Source code and test counts changed between runs.
The percentages cover loaded files, not every repository file.

| Measurement | Before | After |
| --- | ---: | ---: |
| Statements | 82.51% | 83.31% |
| Branches | 77.40% | 78.60% |
| Functions | 80.77% | 81.29% |
| Lines | 84.31% | 85.10% |
| Sync script statements | 32.62% | 45.23% |
| Data-status statements | 88.10% | 100.00% |
| Data-status branches | 88.89% | 98.41% |

The new tests cover calendar validation, finite observations, valid zero-record days, leap-year request bounds, single-station framing, expanded-list focus, per-date coverage, freshness timers, persistent map containers, and camera padding.
The trip timeout occurred during concurrent browser suites, before the replacement-tile interaction began.
The unchanged case passed three consecutive isolated runs. Its assertion and timeout remain unchanged.
Subprocess publication tests check output preservation. Their subprocess execution is not part of Vitest's coverage measurement.
Browser fixtures do not verify production data completeness, live provider availability, or CARTO authorization.
California data still requires the full sync listed in [TODO.md](../../TODO.md).

Independent review totals: Standards — three P2 findings; Spec — two P2 findings.
Focus restoration appears in both axes. The primary review found the additional February request, map recovery, and repeated-padding defects.
