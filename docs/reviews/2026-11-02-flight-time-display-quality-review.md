# Flight time display quality review

Review date: 2026-11-02.

## Scope

The baseline is `b66cf3475904b36fa63c34ebcf11db4b1be1aafd`.
The review covers the pending flight-time changes and their supporting code.
The pending changes replace decimal-hour totals with compact days and hours.
They also add the longest and shortest flight times to each statistics view.
Those features are retained.

The behavior sources are the [flight guide](../../projects/flights/readme.md#flight-duration),
[duration proposal](2026-11-02-flight-duration-research.md), and
[previous statistics review](2026-11-02-flight-statistics-quality-review.md).
No separate issue or product specification was supplied.
The review includes independent Standards and Spec checks.
It does not establish that every existing module in the repository is defect-free.

## Corrected defects

### P2: Touch users could not inspect timing coverage

The pending `DurationSummary` removed the visible coverage and estimate method.
The information remained in a native `title` attribute and visually hidden text.
An ordinary phone user could not inspect those details through the expanded section.
This recreated a defect corrected in the previous statistics review.

The modified unit and browser tests required the visible text to be absent.
Those assertions preserved the regression instead of detecting it.
The section now shows coverage and the method when it is open.
The compact total retains its hover details and full spoken time.
One shared method description supplies both displays.

### P3: Time records inherited the wrong timing basis

The pending summary stored the longest and shortest values as numbers.
The interface applied the aggregate estimate flag to both records.
An actual 165-minute flight and a scheduled 180-minute flight therefore labeled the actual shortest time as estimated.

Each record now retains its minutes and timing basis together.
The resolver's type also keeps usable minutes and a usable timing basis together.
A missing duration has both a null value and a null basis.
Each displayed record supplies **Actual**, **Scheduled**, or **Estimated** text.
Only scheduled and estimated records receive an **Est.** label.
The labels include **Flight Time** to distinguish them from distance records.

For tied values, the selector prefers actual data, then scheduled data, then estimated data.
This rule is independent of input order.
Totals and averages still use all resolved matching legs.
Missing durations do not contribute to the average or either record.

### P3: An accessibility assertion could succeed without accessible text

The pending browser test iterated over the result of a locator's `.all()` call.
If the duration text was absent, the loop ran no assertions.
The test could therefore pass after the accessible flight duration was removed.

The test now locates the actual flight detail and requires its spoken duration text.
The class assertion fails if that element is absent.
It also avoids matching the same duration in the shortest-time statistic.

## Standards

The independent review found one documented behavior violation and one test-quality issue.
The flight guide requires visible coverage in expanded sections, including on touch devices.
The browser loop weakened the guide's full-unit wording check.
The highest severity on this axis was P2.
Both findings are corrected.

No additional abstraction was added solely to satisfy a code-smell heuristic.
The record selector handles both extrema and their tie rule.
The duration-method text has one definition.

## Spec

The independent review found two behavior mismatches.
The duration proposal requires ordinary touch access to coverage and an explicit basis for time records.
The pending interface lost both guarantees.
The highest severity on this axis was P2.
Both findings are corrected.

## Documentation

The flight guide now describes rounded totals, decimal-hour hover text, precise spoken time, and record provenance.
It defines the tie rule and explains which flights contribute to averages and records.
The test commands include the new regression file.
The repository guide and documentation index point to the current behavior and this report.
The revised prose uses short sentences, active voice, and consistent terms.

## Validation

| Check | Result |
| --- | --- |
| Vitest with V8 coverage | 2,242 tests passed across 156 files |
| New regression file | 17 cases; seven failed before the corrections |
| Focused duration suite | 71 tests passed |
| Temperature pipeline | 17 Python tests passed |
| Browser checks | 44 cases passed across Chromium and WebKit |
| TypeScript | Passed |
| ESLint | Passed with zero warnings |
| Production bundle with fixture content | Passed |
| Dependency audit | Zero reported vulnerabilities |
| Documentation links and whitespace | 102 relative links checked; whitespace passed |

The browser set covers duration summaries, phone layouts, globe controls, texture recovery, and authenticated basemap requests.
It used an isolated server on port 4198.
The bundle check used `npx vite build --mode trip-test` and committed synthetic content.
The browser checks used a fixture CARTO key and provider responses.
These checks do not verify a live CARTO account or its allowed websites.

### Coverage comparison

Both measurements use the same final source, compiler, and V8 coverage provider.
The measured files are `flightDuration.ts`, `DurationSummary.tsx`, and `FlightTimeValue.tsx`.
The first run includes the four existing duration and summary test files, with 54 cases.
The second also includes `flightTimeRegressions.test.tsx`, with 17 cases.

| Suite | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| Existing focused tests | 96.51% | 93.69% | 100% | 98.57% |
| Complete focused tests | 97.67% | 97.29% | 100% | 100% |

Branch coverage increases by 3.60 percentage points. Line coverage increases by 1.43 percentage points.
The comparison includes tied record selection and rounding boundaries.
The complete repository suite reports 82.47% statements, 78.01% branches, 80.77% functions, and 84.19% lines for loaded source files.
These percentages do not measure every file in the repository.

Independent review totals: Standards — two findings, highest P2; Spec — two findings, highest P2.
