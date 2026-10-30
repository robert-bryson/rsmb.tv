# ADV Atlas session review: 2026-10-30

## Scope

The review compares `main` at `f27cb01` with branch commit `d5353ef`.
The working tree was clean before this review.
The branch contains 20 commits and changes 63 files.

The review covers atlas data, rendering, navigation, publication, tests, and related documentation.
Independent agents checked documented standards and the atlas specification.
The full automated suite supplied a repository-wide regression baseline.
This was not a complete audit of every project or deployed service.

## Standards

The independent standards review found no confirmed new violations in the branch.
Publication filtering, hosted asset URLs, and fixed test data follow the repository instructions.
The review found no new security defect in these paths.
The dependency audit reported zero known vulnerabilities.
These results do not establish the security of deployed services or authored content.

The map component owns renderer lifecycle, camera fitting, hover feedback, shared-road choices, and recovery.
This concentration makes future changes harder to isolate.
Keep extraction tied to specific behavior and regression coverage.
The session change now gives persisted state a separate owner.

Two concerns were investigated without raising branch defects:

- Direct Vite production builds can copy stale draft social images after development generation. This behavior already exists on `main`.
  The documented production command replaces the registry and regenerates those images.
- Fixed camera padding can prevent route fitting in unusually short windows.
  A collapsed phone panel leaves insufficient space below 274 pixels of map height.
  The normal phone landscape sizes remain above this threshold.

Standards result: zero confirmed new violations. Renderer complexity remains the principal maintenance concern.

## Specification

### P2: A report reload discarded the saved atlas view

The design requires restoration of the previous view during the same session.
It explicitly calls for session storage.
See [the return-state requirement](2026-10-30-adv-atlas-research.md#questions-to-ask-during-implementation).

The implementation stored views only in a module-level `Map`.
The failure sequence was simple:

1. Move the atlas camera and scroll the cards.
2. Open a trip report.
3. Reload the report in the same tab.
4. Select **Back to map**.

The return URL survived, but the saved camera, panel state, and card position disappeared.
The browser history retained the navigation context. Reloading discarded the JavaScript module state.

The original session test saved and read state through one module instance.
The original browser test returned without reloading.
Neither test exercised the required browser lifecycle.
Four new session tests failed before the fix.

The replacement module stores bounded state in `sessionStorage`.
It loads only validated records and retains an in-memory fallback when browser storage fails.
It saves independent copies, including camera coordinates.
Callers cannot mutate a saved view through an input or returned object.
Updated destinations move to the end of the bounded history before older records are removed.

The page saves state during navigation and `pagehide`.
The latter event preserves current state before a page reload.
The page removes its event listener during cleanup.
Fresh visits still use URL selection. They do not restore an unrelated saved URL.

Specification result: one P2 defect corrected. Reloading a report was the worst confirmed failure.

## Tests and coverage

Twenty session cases and one page lifecycle case replace the previous single session test.
They check reloads, independent copies, malformed records, blocked storage, full storage, and bounded history.
They also check wrapped map coordinates, optional cameras, and listener removal.

The report-return browser test now pans the map before opening and reloading the report.
It compares the restored card position and painted route bounds.
A separate browser test reloads the atlas with a moved camera and collapsed panel.
Both sequences pass in desktop Chromium, phone Chromium, and phone WebKit.

The initial repository measurement passed 1,716 tests and reported 82.97% line coverage.
That source differs from the final implementation, so use the controlled comparison below to assess the new tests.
Both controlled runs use the final source, compiler, and V8 coverage provider.
The control excludes the new session file and page lifecycle case.
The complete run includes both.
The control passes 1,715 tests and skips the page lifecycle case.
The complete run passes 1,736 tests.

| Measure | Control | Complete |
| --- | ---: | ---: |
| Statements | 80.73% | 80.91% |
| Branches | 74.78% | 75.34% |
| Functions | 78.80% | 79.08% |
| Lines | 82.91% | 83.08% |

Coverage measures source loaded by Vitest. It does not measure every repository file.
Browser checks provide additional renderer coverage outside this report.

## Documentation changes

The new [atlas guide](../trips/ADV-ATLAS.md) owns current URLs, navigation behavior, storage limits, and module responsibilities.
The testing guide now links to it and documents the reload checks.
The research report retains its dated history and links to the current guide.
The repository index and TODO link to current instructions.
The repository guide separates flight URL parameters into a table and shortens panel instructions.
Edited instructions use short sentences, active verbs, and consistent terms.
This is an approximate ASD-STE100 cleanup, without a formal vocabulary certification.

## Validation

| Check | Result |
| --- | --- |
| Full Vitest suite | 1,736 passed in 117 files |
| Python temperature tests | 17 passed |
| Atlas browsers | 57 passed; six expected phone skips |
| Article JavaScript budgets | 12 passed across three browser projects |
| Repository browser smoke suite | 79 passed; five expected WebKit skips |
| Heading keyboard check | Six focused repetitions passed |
| TypeScript project checks | Passed |
| ESLint | Passed with no warnings |
| Dependency audit | Zero reported vulnerabilities |
| Documentation file links | Passed in seven changed Markdown files |
| Patch whitespace | Passed |

Browser checks use fixed content and map tiles.
The six atlas skips exclude desktop hover and keyboard-panning cases on phone projects.
The five smoke skips exclude performance checks that require Chromium's DevTools Protocol.
One earlier smoke run failed the existing heading keyboard check after Enter navigated to `/posts`.
Six focused repetitions and the final complete run passed.
No application change was made for that result.
Real-phone transfer measurements and content publication checks remain in [TODO.md](../../TODO.md).
