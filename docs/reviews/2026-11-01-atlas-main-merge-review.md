# ADV Atlas main merge review

Date: November 1, 2026.

## Scope

The review compares `feature/motorcycle-trip-atlas` at `37737b7` with `main` at `f27cb01`.
The comparison includes 32 commits and 157 changed files.
Fetched `origin/main` matched the local baseline.

Standards and specification checks used independent reviews.
The references were the repository guide, documentation rules, [Atlas guide](../trips/ADV-ATLAS.md), and [testing guide](../trips/TESTING.md).
The review also inspected map lifecycle, URL state, report returns, publication boundaries, trip manifests, and dependency changes.

## Standards

No actionable documented-standard violation or significant maintainability defect was confirmed.
The changes retain the documented summary boundary and module responsibilities.

## Specification

Two behavior defects were confirmed and corrected before merging.

### Shared-road choices exceeded short viewports

The menu required a top offset of at least 120 pixels, without a height limit or scrolling.
At 568 × 280 pixels, an expanded panel leaves a 140-pixel map.
A long trip title extended the menu below the viewport and clipped its final choice.

The menu now stays within the map and scrolls when necessary.
Browser regressions check short and narrow map bounds, choice visibility, and selection.
A separate long-title reproduction verified scrolling, pointer targets, and selection after the fix.

### An excluded selection lost its visible name

Applying filters could hide the selected card while retaining its selection.
The warning did not identify that trip, contrary to the testing guide.

The warning now includes the selected trip's title.
Existing unit and browser assertions now require that name.
The excluded route remains absent from the map.

## Validation

| Check | Result |
| --- | --- |
| Full Vitest suite | 1,994 passed across 138 files |
| Python temperature tests | 17 passed |
| General browser smoke tests | 42 passed |
| Full trip browser suite before fixes | 397 passed; 17 skipped |
| Affected browser checks after fixes | 176 passed; 10 skipped |
| Focused unit checks after fixes | 53 passed |
| Lint and TypeScript checks | Passed before and after fixes |
| Production build with content sync | Passed |
| Production rebuild after fixes | Passed |
| Dependency audit | Zero reported vulnerabilities |
| Installed dependency tree | No invalid dependencies |
| Isolated npm 12.2.1 installation | 590 packages installed; lifecycle scripts disabled |
| Whitespace check | Passed |

Trip browser checks used Chromium, mobile Chromium, and WebKit.
The existing test conditions skip interactions that do not apply to a browser or input mode.
The affected rerun includes atlas navigation, browsing, route choices, short viewports, and tooltip placement.

## Merge assessment

No unresolved merge blocker was found after these corrections.
Existing editorial and real-phone follow-ups remain in [TODO.md](../../TODO.md).
