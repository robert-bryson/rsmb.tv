# Flight display quality review

Date: 2026-11-03.
Baseline: `769953d`, with the flight display changes present in the working tree.

## Scope

The review covers the pending flight display changes and their immediate consumers.
It checks statistics, status totals, route details, HTML tooltips, tests, and current documentation.
Independent reviewers checked repository standards and the user's display request.

The request removes **Est.**, **Estimated**, timing-basis counts, and the estimate method note from flight displays.
This request replaces the label proposal in the older duration research.
Duration calculations, timing kinds, source values, and aggregation counts remain available in the data model.

## Standards

### P3: Current instructions described removed behavior

The [flight guide](../../projects/flights/readme.md#flight-duration) still promised visible coverage, method tooltips, and estimate labels.
The [repository test guide](../../README.md#testing-notes) also described visible timing coverage on phones.
These instructions contradicted the changed interface.

The current guides now describe the simplified labels, retained source details, and partial totals.
Long sentences in the affected flight-guide sections were split into shorter instructions.
The dated research and older reviews remain historical records.
The current flight guide explicitly identifies the older label proposal as historical.

The independent Standards review found no hard code-standard violation or demonstrated security defect.
It identified the stale documentation as a maintenance issue.

### Maintenance: Shared presentation rules had separate owners

React details and HTML details each tested the duration kind before showing its source.
Route, airport, and state tooltips also contained separate duration summary templates.
Updating one copy could leave another display inconsistent.

[`flightDurationSourceLabel`](../../src/features/flights/utils/flightDuration.ts) now controls source visibility for both renderers.
The HTML builders share one duration summary template in [`tooltipHtml.ts`](../../src/features/flights/utils/tooltipHtml.ts).
This template also gives unavailable totals one clear label, without a second **Unavailable** value.
The unused timing-coverage formatter and method constant were removed.
The summary's numeric counts remain unchanged.

These changes address local duplication. They do not introduce a general rendering framework.

## Spec

### P2: Removing coverage also hid incomplete totals

The user requested removal of estimate text and the highlighted notes.
The first change also removed unavailable-flight counts from compact hover text, screen reader text, and HTML summaries.

For example, one usable flight and one unavailable flight produced a time without identifying the omitted flight.
The bottom status could announce two flights beside a total that covered only one.
The main statistics section retained its partial count, but other displays lost this context.

[`flightDurationAvailability`](../../src/features/flights/utils/flightDuration.ts) now identifies partial totals.
[`FlightTimeValue`](../../src/features/flights/components/shared/FlightTimeValue.tsx) uses it for hover and screen reader text.
Route, airport, and state HTML summaries use the same rule.
The note reads **Time available for 1 of 2 flights**.
It appears only when some flights have usable time and some do not.
Complete totals retain their short text. Entirely unavailable totals retain their unavailable label.
The estimate labels, timing-basis breakdown, and method note stay removed.

Two new regression cases failed before this correction and passed afterward.
The independent Spec reviewer confirmed that this correction preserves the requested removal.
The existing phone preview already retained its visible partial count through `DurationSummary`.

### Test gaps: Some changed paths had no direct duration assertions

Existing airport and state tooltip fixtures had no duration summary.
They could pass while those duration branches displayed obsolete labels or omitted a total.
Browser fixtures included estimated data, but every duration test selected recorded flights from another year.

The new [presentation suite](../../src/test/flightTimePresentation.test.tsx) adds 15 cases.
It checks actual, scheduled, supplied-estimate, fallback, reported, partial, and unavailable time.
The cases exercise React details and selected-route HTML details with the same source inputs.
They also check unselected routes, airport tooltips, state tooltips, and current hover data.

Source text contains HTML-like input in the security cases.
React must display that text literally. HTML tooltip builders must escape it.
The tests verify that neither path creates the supplied image or script elements.
No source-field injection defect was demonstrated in the reviewed implementation.

Two new browser cases select estimated-only flights at widths of 1,280 and 320 pixels.
They check summaries, individual route details, and status totals.
Both cases run in Chromium and WebKit.

## Validation

| Check | Result |
| --- | --- |
| Complete Vitest suite with V8 coverage | 2,305 tests passed across 160 files |
| Focused flight suite | 179 tests passed across 10 files |
| New presentation regressions | 15 cases; two failed before the partial-total correction |
| Flight browser checks | 18 cases passed across Chromium and WebKit |
| Temperature pipeline | 17 Python tests passed |
| TypeScript | Passed |
| ESLint | Passed with zero warnings |
| Production bundle with fixture content | Passed with `vite build --mode trip-test` |
| Documentation targets and whitespace | 115 relative targets exist; `git diff --check` passed |

The browser checks used an isolated development server on port 4199 and the existing generated flight files.
Provider requests used the fixture browser key and the test suite's fixed responses.
These checks do not verify a live CARTO account.

### Controlled coverage comparison

Both measurements use the same final source, compiler, and V8 coverage provider.
The measured modules are `flightDuration.ts`, `tooltipHtml.ts`, `DurationSummary.tsx`, and `FlightTimeValue.tsx`.
The baseline uses nine existing flight test files, with 164 cases.
The expanded run adds `flightTimePresentation.test.tsx`, for 179 cases.

| Suite | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| Existing focused tests | 95.93% | 85.61% | 92.59% | 100% |
| Expanded focused tests | 98.37% | 94.52% | 96.29% | 100% |

Branch coverage increases by 8.91 percentage points across these four modules.
The tooltip module increases from 60% to 86.66% branch coverage.
The complete suite reports 82.59% statements, 78.30% branches, 80.88% functions, and 84.27% lines for loaded files.
These figures do not measure every repository file or establish complete correctness.

Independent review totals: Standards — one maintenance finding, highest P3; Spec — one documentation finding, highest P2.
The primary review also reproduced and corrected the P2 partial-total regression.
