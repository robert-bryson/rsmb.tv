# Temperature sync review

## Scope

The baseline is commit `3af2ec40e755ea444d8bf2bf14dc896ab4806166`.
The review covers four pending temperature-sync files and their request, cache, archive, and publication paths.
It does not represent an audit of every project feature.

The incoming change addressed a failed recent-record sync for Delaware on November 3, 2026.
The failure was `No station observations returned`.
Six existing daily archives also required regeneration because their state coverage was unverified.
The [temperature map guide](../temperature-map.md) defines the behavior contract.

## Findings and fixes

### P2: Response validation bypassed retries

The original request helper retried HTTP failures, JSON failures, and request timeouts.
An HTTP 200 response passed that boundary even when its payload contained an error or no station data.
The caller rejected that payload after the retry loop had returned.
A temporary upstream failure could therefore stop the complete sync after one attempt.

The pending fix moved validation into the retry loop.
The review retained this design and the existing three-attempt limit.
Warnings now identify the state, observation date when available, failure reason, and actual wait.
Persistent failures still stop publication.

### P2: Malformed station summaries escaped validation and entered the cache

A nonempty `data` array did not prove that its station rows were usable.
One regression combined a null station row with a valid observation.
Daily validation accepted the response. Later parsing threw outside the retry loop.
Another regression supplied a null historical summary and reached the same late failure.

A monthly response without summaries was silently accepted and cached.
It could remove the monthly classification from a broken record.
An empty dated summary could suppress record detection by converting absent limits to null.
Existing S3 cache reads used the same weak nonempty-array check.
One bad cached object could therefore affect later runs.

Shared validation now checks station metadata and the required summary structures.
Dated summaries must contain a value entry. Monthly summaries must contain scalar entries.
The same validator checks S3 cache reads and fresh responses inside each retry attempt.
Invalid cache entries cause a replacement request. Failed replacements do not enter the cache.
Redundant checks after this boundary were removed.

The [ACIS reference](https://docs.rcc-acis.org/acisws/) defines `M` as the missing-data marker.
Live requests confirmed missing dated summaries such as `["M", "M"]` and scalar monthly values.
Tests preserve missing historical values, usable daily observations, and zero temperatures.
Missing historical data does not make a usable daily observation invalid.

### P2: Archive reconstruction retained duplicate and obsolete records

The archive path rebuilt records when the previous summary lacked verified coverage.
It then combined the rebuilt rows with previous rows for the same skipped date.
The merge did not distinguish summary reuse from archive reconstruction.

The regression produced 49 rows where the archive contained 48 broken records.
A second case retained one old summary record when the rebuilt archive contained no broken records.
This could inflate record counts and retain obsolete station details.

Each date now contributes records from one selected source.
Verified summary reuse copies its rows. Archive reconstruction supplies replacement rows.
A zero-record reconstruction supplies an empty replacement.
The change removes the extra merge array and skipped-date filter.

## Standards

The independent standards review reported one P2: empty dated summaries passed the new validator.
Fresh-response and cached-response regressions now cover this case.
The reviewer confirmed that the finding was resolved.
No unresolved standards findings remain.

The review also checked duplication, naming, speculative abstractions, module ownership, and test isolation.
Subprocess fixtures now direct `GITHUB_OUTPUT` to their temporary directories.
This prevents a successful fixture sync from writing to the parent workflow's output file.

## Spec

The independent behavior review reported one P2: malformed summaries could still enter the cache.
This overlaps the validation defect described above.
The final validator rejects empty dated arrays and non-scalar monthly entries while accepting `M`.
The reviewer confirmed that the partial requirement was resolved.
No unresolved behavior findings remain.

Verified state coverage remains mandatory for archive reuse.
The new seven-day fixture checks all 48 daily state requests for every date in the reported window.
Daily, historical, and monthly failures preserve the previous published records after all retries fail.

## Tests and coverage

The incoming focused suite passed 53 tests.
The final focused suite contains 69 tests, including 16 added during this review.
Seven new regression cases were observed failing before their fixes.
They covered duplicate rows, obsolete rows, malformed metadata, malformed historical summaries, and malformed monthly summaries.

The archive suite calls the real recent-record orchestrator with fixed time and a simulated S3 store.
It exercises verified summary reuse, archive reconstruction, legacy regeneration, and historical cache replacement.
The CLI suite runs isolated subprocesses and checks files written to temporary directories.
Subprocess execution does not contribute to Vitest coverage.

### Controlled coverage comparison

Both measurements use the same final source and the V8 provider.
The measured file is `scripts/sync-temperatures.js`.
The control runs the existing three request and publication suites, including the new retry cases.
The expanded run adds the seven archive and cache cases through the complete suite.
Only these four test files directly import or execute the temperature sync.

| Measurement | Control | Expanded |
| --- | ---: | ---: |
| Statements | 47.05% | 67.69% |
| Branches | 47.40% | 59.44% |
| Functions | 59.34% | 83.51% |
| Lines | 45.40% | 67.49% |

Incoming source and tests measured 45.80% statement coverage for this script.
That earlier measurement is not the controlled comparison because the source also changed.
The complete suite reports 84.49% statements, 79.54% branches, 82.15% functions, and 86.34% lines for loaded files.
These percentages do not include every repository file.
Uncovered code remains, including portions of the full-sync and command-entry paths.

## Validation

| Check | Result |
| --- | --- |
| Complete Vitest suite with V8 coverage | 2,433 tests passed in 164 files |
| Historical Python pipeline | 17 tests passed |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Production bundle with fixture content | Passed with `vite build --mode trip-test` |
| Whitespace | `git diff --check` passed |

The operational guide now separates map freshness from sync recovery.
It describes retry limits, cache rejection, archive replacement, and the publication boundary.
Sentences use active voice and consistent terms where practical.
This is a simplified technical writing pass, not an ASD-STE100 certification.

No S3 publication or hosted workflow run was performed.
Production verification remains in [TODO.md](../../TODO.md).
File replacements remain atomic per file. The complete output set and S3 uploads are not one transaction.
Browser tests were not rerun because this change modifies the sync and its tests, without changing browser behavior.

Independent review totals: Standards — one P2 finding, resolved. Spec — one P2 finding, resolved.
