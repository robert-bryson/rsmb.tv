# Next-task implementation and verification

Review date: November 9, 2026, America/Chicago.
Base revision: `8bf2902`.
This report records implementation and publication checks before the [code review](2026-11-09-next-tasks-quality-review.md).
Use that review for the final fixes and test results.

## Historical temperature cutoff

The CLI now bounds cohort observations to the baseline start through `--analysis-end`, inclusive, before reconstructing events.
The regression uses an event on the cutoff, another on the following day, and a later-year event.
It covers selected and frozen station cohorts, both temperature directions, exported dates, annual years, and the manifest.
Both cohort cases exported six events before the fix and the expected two afterward.

## Tornado Tracks

Failed styles, failed tiles, and a 15-second startup deadline now select a plain background.
**Retry background** requests a fresh hosted style.
Data layers are restored on each style load. Interaction handlers remain registered once.
Camera position, track selection, state, EF filters, and color mode survive recovery without another track download.
Data-request and background errors have separate, stacked recovery actions.
Disposal removes recovery listeners and cancels the deadline and pending resize frame.
WebGL failures retain the SVG overview.

A native **State** selector supports keyboard selection and opens Trends, as map selection does.
Expandable tables expose annual, decade, state, national warning, and weather-office data.
Completed-year tables exclude the current year and retain genuine zero-count rows.
An empty result offers **Reset filters**. It clears geographic and EF filters, selects all available years, and clears the track.
The action preserves camera, color, and view mode. Focus returns to the controls panel.

Phone and desktop browser fixtures fail styles and tiles independently, select a track on the plain background, retry, and inspect actual rendered provider pixels.
The interaction fixtures also check keyboard state selection, filtered table values, empty-result recovery, and focus.
They wait for the first keyboard navigation to commit before sending the next selection key.
Historical geometry fixtures now match the aggregate counts and use unique track IDs and matching dates.
The browser checks reject React duplicate-key errors.

## Operational temperature sync

The [hosted full-sync attempt](https://github.com/robert-bryson/rsmb.tv/actions/runs/42721006438) failed after three 60-second California request deadlines.
No upload step ran.
A bounded, read-only request with identical parameters completed in approximately 63 seconds and returned 1,302 stations.

County-history requests now have a 120-second deadline per attempt.
Validated local responses for the exact request are reused after interruption.
All-missing responses fail validation, including existing local cache entries.
The regression accepts a 70-second response, verifies cache reuse, and replaces an unusable cached response.
Its slow-response and unusable-cache assertions failed before their respective fixes.

The local full sync completed with 48 validated county-cache hits and no county-cache misses on resumption.
Read-only S3 access reused all seven verified recent dates. No daily archive or station catalog was rewritten.
Inspection confirmed that the sync script's AWS calls are `head-object` and `get-object`; uploads remain separate.
The earlier S3-disabled attempt was stopped after the successful resumable run.

The independent `verify-temperature-publication` command checks all five generated files.
It validates actual high and low county coverage, summary counts, every declared recent date, monthly threshold version, and generation times.
It reconciles annual standing-record counts with county records and requires all years from 1890 through the as-of year.
It checks the original history payload because the frontend schema normalizes legacy sparse years and aggregates.
Fixed-response tests cover missing states, duplicate coverage, stale timestamps, mixed outputs, missing years, HTTP failures, malformed JSON, MIME types, and stalled response bodies.

The [retained verification](../performance/2026-11-09-next-tasks-verification.json) records the results:

| Check | Previous production objects | Published snapshot |
| --- | ---: | ---: |
| Actual county states | 47 | 48 |
| County records | 5,966 | 6,080 |
| California county records | 0 | 114 |
| State records | 138 | 138 |
| Recent per-date state coverage | 48 on all seven dates | 48 on all seven dates |
| Standing-history calendar years | Not independently checked in the backup | 137 |

Five production objects were downloaded as rollback copies.
Their original ETags and the staging SHA-256 digests are retained locally.
Automatic approval review initially required explicit authorization for the production overwrites.
The user approved publication of the five JSON files and their CDN invalidation.
A fresh preflight verified all original production ETags and all approved staging hashes before the conditional writes.
All five uploaded objects matched the approved bytes at the S3 origin and through `data.rsmb.tv`.
Public verification confirmed California, all recent per-date state counts, summary counts, and 137 annual history rows.
CloudFront invalidation `I7YC5VHLKFZRWQ71T7TYBP0CAE` completed for exactly those five paths.
Daily archives and the station catalog were preserved. The rollback copies remain available locally.

## Legacy daily thresholds

The [ACIS comparison](../performance/2026-11-09-temperature-threshold-check.json) retains exact requests and responses for all twelve legacy disagreements.
The requests compare historical calendar-day and calendar-month predecessors over 1950–2025.
All twelve current monthly values match the November 5 audit. All twelve current daily values differ from the legacy archive values.
None of these current single-station comparisons retains the daily/monthly conflict.
A representative four-element `MultiStnData` request agrees with its single-station result.
The other eleven stations were not cross-checked through that endpoint.

This comparison does not establish why the older daily values differ.
It does not independently certify historical observations or approve an archive refresh policy.
Raw observations and legacy `rh` and `rl` remain unchanged.

## Infrastructure inspection

The configured remote Terraform state owns SPF, DKIM, and DMARC records.
The refreshed plan proposes no mail changes. No DNS writes or imports were needed.
Both sync OIDC roles are absent.
The full plan creates four IAM resources and updates four other resources.
The targeted role/policy plan still includes one CloudFront photo-cache update through its dependencies.
Neither plan was applied. OIDC deployment, live role verification, credential retirement, and Gmail signing remain open.

## Validation

- Complete unit suite: 2,932 JavaScript tests across 198 files passed.
- Historical estimator: 18 Python tests passed.
- Tornado browser suite: 14 Chromium/WebKit checks passed; the six interaction checks passed again after focus and keyboard-readiness changes.
- ESLint, TypeScript, production-format fixture build, and diff whitespace checks passed.
- Local independent publication verification passed for all five staged files.
- Approved publication: all five origin and public CDN hashes matched; the complete public data contract passed and CDN invalidation completed.

WebKit used an isolated runtime and temporary launcher under `/tmp` because the bundled launcher replaces library search paths.
System package installation was not required.
An overlapping browser/build run exceeded the existing build deadlines. The isolated complete unit run passed without changing those budgets.
The complete suite also exposed an unrelated trip-hover fixture race.
That fixture now delays renderer load explicitly and waits for hover-handler readiness; all existing hover assertions remain.

These browser fixtures do not replace physical-phone or field-performance checks.
Historical signal publication and trip-source authoring remain separate open work.
