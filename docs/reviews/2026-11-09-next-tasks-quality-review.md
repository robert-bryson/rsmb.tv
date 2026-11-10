# Next-task code review

Review date: November 9, 2026, America/Chicago.
Base revision: `8bf2902`.

This review covers the pending temperature, tornado-map, test, and documentation changes.
The [implementation report](2026-11-09-next-tasks.md) retains the earlier production checks.
Production data was not republished during this review.

## Findings and fixes

### High: county conversion lost numeric zero and accepted invalid cache data

The cache check required only one numeric summary value.
The converter then used truthiness and `parseFloat` on each value.
A numeric zero disappeared. A string such as `-5 degrees` became a valid temperature.
Invalid companion dates and station locations also passed the cache check.
An interrupted run could reuse these responses without another request.

Cache validation and output conversion now use one function.
It checks both dated values, station coordinates, county FIPS prefixes, and state identity.
It rejects observations outside the request period and malformed station names.
It preserves numeric zero and explicit missing values.
Stations without a county or location remain excluded from map records.
Existing plausibility checks still apply.

Regressions cover numeric zero, invalid cached values, invalid dates, future dates, and invalid locations.
They also cover valid missing data and a fresh response that succeeds on retry.

### High: the publication verifier could approve incomplete or inconsistent data

An empty state-record file passed when its summary count was also zero.
Decade and rolling aggregates were shape-checked but not compared with annual counts.
The frontend schema repairs these fields, so schema success did not prove publication integrity.
Duplicate county rows and inconsistent recent lists also lacked checks.

The verifier now requires high and low records for all 50 states.
County coverage still requires the 48 contiguous states.
It rejects duplicate county/type pairs, invalid geography, and invalid record dates.
County marker centroids and source station coordinates are checked separately.
These coordinates can differ under the existing publication contract.

The verifier bounds and checks the raw year sequence before schema normalization.
It counts county records once by year, then compares every annual row.
This removes repeated full-array scans for each calendar year.
It compares raw decade totals, decade ratios, and rolling ten-year values with the normalized result.
It checks recent station identity, coordinates, and duplicate station/date/type rows.
The yesterday list must equal the matching rows in the seven-day list, regardless of row order.
Complete zero-record dates and declared backfill dates remain valid.
Invalid request deadlines fail before a network request starts.

Fixed-response regressions cover these cases and retain the existing HTTP, JSON, and body-timeout checks.
The strengthened verifier also passed against the retained published snapshot:
6,080 county records, 138 state records, 114 California county records, and 137 annual rows.
No network request or production write was needed for that check.

### Medium: unrelated map work could cause a false background failure

The background deadline waited for MapLibre's global `idle` event.
That event also waits for camera motion and application GeoJSON work.
A valid provider background could therefore be replaced after 15 seconds.
The old code also notified React on every later idle event.
Renderer errors left the background timer active.

Recovery now checks provider source readiness on rendering and source events.
It excludes the five application data sources.
State notifications occur only when the recovery state changes.
Context loss and fatal renderer errors cancel the background deadline.
A restored context resumes a pending deadline.
Worker failures use the existing SVG recovery path.
Disposal removes all recovery listeners and timers.

Regressions keep application data pending while provider sources finish.
They also check unfinished provider tiles, context restoration, and worker failure.
Existing retry and disposal checks remain.

### Medium: keyboard and pointer state selection had different behavior

The native selector changed state and mode through separate callbacks.
It kept the selected track, while pointer selection cleared it.
The URL parser also accepted unknown two-letter codes such as `ZZ`.
The selector could display All states while the map applied an unknown-state filter.

Both selection controls now use the existing atomic state-selection action.
Selection clears the track and opens Trends in the same URL update.
The parser uses the shared jurisdiction list.
Alaska, Hawaii, and Puerto Rico remain valid selections.
Browser checks start with a selected track and verify that keyboard selection clears it.

## Documentation and open work

The current temperature and tornado guides describe the stricter contracts.
The review index links this report and the earlier publication evidence.
The implementation report identifies its earlier validation scope.
The TODO list no longer asks for an already published zero-year history repair.
It distinguishes that operational dataset from the unpublished historical estimator.
The intermittent flight-control item now states that its cause remains unconfirmed.
Map refactoring items identify separate temperature and tornado work.

Updated prose uses short sentences and direct verbs where practical.
Exact source facts, commands, and technical names are retained.
Dated reviews and raw evidence remain historical records.

## Validation

- JavaScript unit suite: 2,984 tests passed across 202 files.
- Historical estimator: 18 Python tests passed.
- Added review coverage: 52 tests in four suites.
- Tornado browser suite: 14 checks passed, seven each in Chromium and WebKit.
- Retained publication: all five files passed the strengthened verifier.
- ESLint, TypeScript, the production-format fixture build, and diff whitespace checks passed.
- A local HTTP smoke test checked CLI arguments, freshness, stdout, report-file output, and failure exit status.

The [coverage evidence](../performance/2026-11-09-next-tasks-coverage.json) records source hashes, commands, versions, and counts.
Both measurements used the same final source, compiler configuration, and V8 provider.
The baseline ran 2,932 tests in 198 files. It excluded only the four new review suites.
The second run included those suites.
The table covers three reviewed source files. It does not describe repository-wide coverage.

| Source | Line coverage before | Line coverage after | Branch coverage before | Branch coverage after |
| --- | ---: | ---: | ---: | ---: |
| Temperature sync | 80.07% | 80.34% | 78.94% | 79.34% |
| Publication verifier | 83.80% | 93.33% | 78.57% | 93.65% |
| Tornado background recovery | 96.29% | 100.00% | 81.81% | 87.87% |
| Scoped total | 81.46% | 82.98% | 78.99% | 81.67% |

The verifier's CLI entry point remains outside this imported-function coverage.
The local smoke test covers its success path and invalid-URL failure path.

Browser checks use fixed responses at phone and desktop widths.
They cover failed styles, failed tiles, selection through recovery, keyboard state changes, chart tables, and empty-result reset.
WebKit used the isolated runtime described in the [implementation report](2026-11-09-next-tasks.md#validation).

Physical-phone checks, historical source extraction, source-document edits, OIDC deployment, and Gmail signing remain open.
Their prerequisites are listed in [TODO.md](../../TODO.md).
