# Pending-change quality review: November 5, 2026

Reviewed all uncommitted changes against `b031e4b` on `main`.
The scope includes the project audit, three responsiveness changes, generated previews, tests, and documentation.
No dependency versions changed.

The performance design is sound. Its original data validation and failure handling were insufficient for release.
The review corrected those defects and added a publication check.

## Standards review

An independent review checked repository instructions, external-data validation, module ownership, tests, and documentation.

### P2: payload validation accepted a state array

The original state check passed its value directly to a regular expression.
JavaScript converts `['MO']` to `'MO'`, so malformed data passed validation.
Later, the state filter compared that array with a string and silently omitted its records.

The shared parser now requires an actual string.
It also requires safe integer counts, valid intensity values, finite distances, and unique aggregate keys.
Width bins must be positive, sorted, unique, and consistent with the group count.
The annual summary parser rejects duplicate years, invalid metrics, and years outside the supported range.

Regression tests cover coercion, fractional counts, unsafe integers, negative values, invalid widths, and duplicate keys.
This follows the [shared-module contract](../shared-modules.md#tornado-chart-data).

### Test gaps corrected

Renderer tests now cross the phone breakpoint in both directions and check listener removal.
They check both the renderer and post-processing buffers.
They also check that a display with pixel ratio 1 is not enlarged.

Preview tests now inject an AVIF replacement failure.
The previous manifest and its images remain usable, and temporary files are removed.
Browser tests also disable AVIF format selection and verify actual WebP decoding.

The camera test now flushes pending renderer updates before it advances the animation clock.
It then renders the final camera position before comparing label coordinates.
The test retains its camera, URL, and projected-label assertions.

No major standards findings remain after the follow-up review.

## Behavior and specification review

An independent review checked filtered history, publication paths, rendering stability, preview fallback, and failure recovery.

### P2: partial archives produced false historical counts

The original parser accepted an empty index or an index missing published years.
The summarizer then created zero rows for missing data.
Those rows looked like genuine historical observations and changed trend calculations.
Extra index years could also extend the chart beyond the published year selector.

The shared parser now compares aggregate output with every published annual metric and year.
The comparison includes intensity totals, deaths, injuries, distance, and median width.
Missing groups, incompatible cache generations, and additional years fail validation.
A published year with genuinely zero records remains valid.

Tests compare aggregate calculations with the existing geometry summarizer.
They also reject each annual metric mismatch and verify valid zero-record years.

### P2: chart failure recovery could disrupt a working map

The first retry path invalidated unrelated data and reused the map's metadata loading state.
A chart metadata refresh failure could become a global map error.
A separate loading condition also hid chart progress after an unrelated geometry request failed.

Chart requests now own their loading, error, and retry state.
A retry loads and validates the annual summary and index together.
It publishes the pair only after both pass validation.
If either fails, the map retains its last usable metadata and geometry.
Obsolete responses cannot replace the current request state.

The panel shows a scoped error and a **Retry trends** button.
The timeline hides unavailable counts while keeping its year controls usable.
It does not display unavailable data as zero.

Tests cover delayed responses, failed metadata refreshes, incompatible cache generations, and responses received after Trends closes.
They verify that chart retries do not request geometry or optional analytics again.
They also verify chart progress when geometry fails independently.

No major behavior findings remain after the follow-up review.

## Release blocker: the public index is unavailable

The new frontend requires `trend-index.json` for filtered historical charts.
The public URL returned HTTP 403 during this review.
Deploying the frontend first would leave that feature unavailable.

[`verify-tornado-publication.js`](../../scripts/verify-tornado-publication.js) now runs before either normal release build.
It reads the configured annual summary and index, then applies the same shared contract as the browser.
Remote requests have deadlines that include response-body reading.
Local paths must remain inside `public/`, including after symbolic-link resolution.

Tests cover unavailable files, malformed data, mismatched totals, stalled bodies, unsafe URL forms, and local path escapes.
The live check correctly fails for `trend-index.json: HTTP 403`.
The isolated fixture build passes.

Publish the updated tornado sync output and verify access before deploying the frontend.
The task remains in [TODO.md](../../TODO.md#tornado-tracks).
No remote publication or deployment was performed.

## Documentation cleanup

The repository guide now documents the publication command and both build modes.
The tornado guide defines data compatibility and independent chart recovery.
The shared-module guide identifies the parser and producer contract.
The review index links the audit, research, implementation, and this review.

Earlier reports retain their original measurements and test results.
They now link to the implementation and this follow-up.
Current instructions use short sentences, active voice, and consistent terms.
No formal ASD-STE100 certification is claimed.

## Verification

| Check | Result |
| --- | --- |
| JavaScript and TypeScript tests with coverage | 2,589 passed in 168 files |
| Historical temperature Python tests | 17 passed |
| ESLint and TypeScript project checks | Passed |
| Production fixture build | Passed |
| Complete generated tornado archive | 9,553 groups match all 77 published annual summaries under the stricter parser |
| Affected application browser suite | 82 passed in Chromium and WebKit |
| Camera regression repetition | Nine passed across immediate, delayed-data, and delayed-texture startup |
| Reading-route JavaScript budgets | 12 passed across desktop and phone Chromium, and WebKit |
| Live tornado publication check | Correctly blocks release: index returns HTTP 403 |

| Coverage | Before this review | After this review |
| --- | ---: | ---: |
| Repository statements | 84.70% | 84.76% |
| Repository branches | 79.84% | 80.00% |
| Repository lines | 86.52% | 86.55% |
| Shared tornado contract branches | 95.12% | 100.00% |
| Shared tornado contract lines | 96.96% | 98.92% |

The [coverage evidence](../performance/2026-11-05-review-coverage.json) retains counts and relevant module results.
The denominator changed because this review added validation and a publication module.
The increase is modest across the repository; the critical aggregate contract now has complete measured branch coverage.
Coverage does not prove correctness. The mismatch and recovery tests establish the relevant behavior.

Checks used installed dependencies with Node.js 26.12.0 and npm 11.20.0.
Node.js 26 is supported. The configured npm version is 12.2.1.
A clean installation with the configured npm toolchain was not repeated.
Browser checks use local fixture content and do not prove external service availability.

## Remaining work

The [responsiveness report](2026-11-05-responsiveness-improvements.md) retains the measured performance changes and their limits.
The review did not repeat those timing comparisons.

The earlier audit also identified monthly-temperature query errors and failed page-download recovery.
Those are separate defects, outside the pending responsiveness implementation.
Their reproductions and acceptance conditions remain in [the project analysis](2026-11-05-project-analysis.md) and `TODO.md`.
