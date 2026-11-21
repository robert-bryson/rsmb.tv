# ski-status engineering review

November 21, 2026

The review compared ski-status at `77c2395` with `origin/main` at `0ec3dfd`.
It covered the collector, publication, report dates, terrain records, map navigation, and release checks.

## Findings

| Impact | Finding | Correction |
| --- | --- | --- |
| High | The collector read entire stored objects into memory before it checked their size. It also parsed an active manifest above the 64 KiB limit. | Local reads and S3 downloads stop at the applicable size limit plus one byte. An oversized active manifest stops publication before any provider request. An oversized snapshot can recover from a valid refresh. [Conditions publication](../../projects/ski-status/readme.md#conditions-publication) |
| High | A later terrain retrieval could replace a newer observation with an older cached state. A source URL match could also merge inventories with different export terms. | The latest retrieval sets the inventory. For matching sources and export terms, the merge uses the latest timed observation for each item in that inventory. [Terrain merge](../../src/features/ski-status/conditions.ts) |
| Medium | The date-only report check used the date written in the deadline. An equivalent UTC deadline could fail. A deadline on the wrong local day could pass. | The check uses the resort time zone for the retrieval and deadline. [Report rules](../../projects/ski-status/readme.md#report-and-forecast-rules) |
| Medium | The app could show a forecast before its recorded retrieval time. The collector could also include it in current coverage. | Both use the same availability check. A forecast becomes available at retrieval and expires at the end of its period. [Forecast check](../../src/features/ski-status/conditions.ts) |
| Medium | A slow cluster lookup could move the camera after new filters loaded or after a later movement ended. | A newer click, camera movement, marker update, view change, or style load invalidates the pending zoom. [Map behavior](../../projects/ski-status/readme.md#map-display) |

## Verification

The publication tests check byte limits, missing and empty snapshots, transient read failures, and conditional manifest writes.
The report tests check UTC deadlines, license boundaries, terrain changes, and forecast availability.
The Chromium tests delay a cluster response until after a filter change or camera movement.
Both camera tests reproduced the incorrect jump before the fix.

The V8 check uses the same source paths before and after the review.
It includes the ski-status feature, page, collector scripts, and terrain release verifier. [Coverage command](../../projects/ski-status/readme.md#local-checks)

| V8 measure | Before | After |
| --- | ---: | ---: |
| Tests | 270 | 280 |
| Lines | 71.44% | 71.52% |
| Branches | 69.38% | 69.82% |
| Statements | 70.45% | 70.56% |
| Functions | 74.06% | 74.07% |

| Check | Result |
| --- | ---: |
| Repository Vitest | 3,902 passed |
| Repository Python | 36 passed |
| Ski-status Chromium | 54 passed |
| TypeScript and ESLint | Passed |

## Hosted checks

The preview returned revision `0ec3dfd` for Amplify job 22 on November 21.
The candidate still needs a hosted byte-range and tooltip check. [Preview deployment record](https://release-preview.d38ki8k4lanh8s.amplifyapp.com/deployment.json), [Terrain release checks](../../projects/ski-status/readme.md#release-checks)

The sync workflow was absent from `origin/main`. The public manifest returned HTTP 403.
Track the first scoped sync and its manifest archive in the release tasks. [Conditions manifest](https://data.rsmb.tv/ski-status/manifest.json), [Release tasks](../../projects/ski-status/TODO.md#release-checks)

## Rockies spot checks

On November 20, the Banff Sunshine feed matched the operator report. Both showed 3 of 12 open lifts and 4 of 139 open trails.
The Mt. Norquay feed returned HTTP 500.

At 13:57 UTC on November 21, Sunshine's 11:08 UTC report matched the operator page. Both showed 3 of 12 open lifts and 8 of 139 open trails.
The Lake Louise feed and operator page showed four open lifts and six open runs.
The Norquay feed returned HTTP 500. Its operator page showed two open lifts and two open runs. [SkiBig3 API](https://www.skibig3.com/api/), [Sunshine terrain report](https://www.skibanff.com/the-mountain/mountain-report/lifts-trails-report), [Lake Louise conditions](https://www.skilouise.com/snow-conditions/), [Mt. Norquay conditions](https://banffnorquay.com/conditions/)

The local **Ski today** check showed Sunshine and Lake Louise. Both left the results at the local ski-day cutoff.
The test also checked that the app kept an undated report out of current results.

The API describes the XML format and update schedule. Public display and archive storage still need operator terms for Sunshine and Norquay.
The seven-day check remains open. [SkiBig3 terms](https://www.skibig3.com/terms-of-use/), [Norquay terms](https://banffnorquay.com/terms-conditions/), [Rockies tasks](../../projects/ski-status/TODO.md#rockies-report-pilot)
