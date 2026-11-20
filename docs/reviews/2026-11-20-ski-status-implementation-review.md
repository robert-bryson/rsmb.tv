# ski-status implementation review

November 20, 2026

The review covers the first-release changes on `feature/ski-status`. It checks the catalog, pass rules, map, export, and conditions pipeline.

## Findings and fixes

| Priority | Finding | Fix |
| --- | --- | --- |
| High | A concurrent write could replace a newer S3 manifest. A failed write could also change the local pointer or leave misleading history. | Upload snapshots first. Replace the S3 manifest only when its ETag still matches. Archive the prior manifest by checksum. Write history after publication. [S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html) |
| High | The app accepted snapshots with a checksum mismatch. It also ignored a rollback to an older snapshot. | Verify each snapshot. Keep the last valid stream during failures. Accept a rollback when its manifest has a new timestamp. |
| High | Indy Add-On results could show access at the home ski area. Ski Arlberg appeared to offer unconditional access. | Apply the Indy home-area exclusion and published season dates. Show the required Ski Arlberg booking with its shared allowance. [Indy Pass rules](https://www.indyskipass.com/this-is-indy/how-it-works), [Ski Arlberg pass terms](https://www.epicpass.com/regions/europe/austria/ski-arlberg.aspx) |
| Medium | The minute clock could reset a manually panned map while the results stayed the same. | Compare result IDs before fitting the map. Update report colors independently. |
| Medium | Empty resort observations could replace valid data. The forecast adapter accepted data with misaligned values and timestamps. | Reject empty reports and mismatched arrays. Preserve zero values. Use source counts only when they support the derived status. |
| Medium | Multi-use runs could display the wrong activity for cross-country and touring areas. | Assign run geometry to the owners that support each activity. Rebuild the archive and check the index and checksum. |
| Medium | CSV protection missed some spreadsheet formula prefixes. An operator statistic could also receive unrelated OpenSkiData credits. | Escape additional formula prefixes. Add the OpenSkiData credits only when the export contains mapped values. |

Pass rule validation also rejects inconsistent dates, conflicting shared day limits, and products without verified rules.
The candidate tests check that each row has evidence and that the regional counts match the review log.

## Verification

The focused Vitest run covers the ski-status feature modules, route, and TypeScript scripts. It increased from 141 to 169 tests.
The browser tests exercise the map renderer. Their coverage is separate from these figures.

| Coverage | Before | After |
| --- | ---: | ---: |
| Lines | 56.96% | 65.58% |
| Branches | 54.93% | 63.42% |
| Functions | 59.93% | 68.49% |
| Statements | 56.33% | 64.80% |

The repository passed 3,790 Vitest tests and 32 Python tests. Lint, type checks, and the mocked Terraform IAM test passed.
All 34 Chromium tests passed. They checked the Heavenly archive byte ranges and tooltips on the local server.
The Vite production bundle built with a test CARTO key. The build skipped the large public media copy.

Two live collector runs wrote to a local directory. The first received three reports and three forecasts. The second updated three reports and kept the prior forecasts.
The provider supplied no aggregate report times. The app therefore uses gray for those operating-status markers. [Pilot source comparison](2026-11-20-ski-status-first-release-work.md#conditions-pilot)

## Open release checks

The role and workflow still require hosted activation. Collect one week of report ages and field counts. Compare pilot reports with the operator.
Verify the Heavenly lift and run tooltips and the archive byte ranges on the hosted preview for the release revision.
The product rules and regional eligibility review still have open cases. [Repository tasks](../../TODO.md#ski-status)
