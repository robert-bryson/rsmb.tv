# ski-status release assets and map review

November 21, 2026

The review covers changes after `e165ab1` on `feature/ski-status`. It includes the peak display, state and province lines, and data through batch 25.

## Findings and fixes

| Impact | Finding | Fix |
| --- | --- | --- |
| High | The Amplify SPA rewrite could replace terrain archive responses with HTML. | Exclude `.pmtiles` from the rewrite. Test the exclusion and keep the browser check for terrain byte ranges. [Terraform change](../../infra/main.tf), [Rewrite test](../../infra/tests/page-rewrites.tftest.hcl) |
| Medium | The build read a full mirror response into memory before it checked the checksum. | Check the size while reading. Limit icons to 1 MiB and terrain to 64 MiB. Cancel oversized mirror responses and use the existing response reader. [Asset build](../../scripts/ski-assets-plugin.ts), [Response reader](../../shared/readResponseBytes.ts) |
| Medium | The local archive accepted a different file at the old checksum URL when the byte counts matched. | Stream a SHA-256 check through the open file handle. Share the result while file metadata matches. Return HTTP 404 for a mismatch. The largest indexed trail map is 323 MB. [Archive regression](../../scripts/__tests__/skiAssets.test.ts) |
| Medium | Grand Targhee's mountain report gave the revised opening date. The planned closing date used the same source. | Use the ticket calendar for April 18. Keep the mountain report for the November 22 opening. [Mountain report](https://www.grandtarghee.com/the-mountain/cams-conditions/mountain-report), [Ticket calendar](https://www.grandtarghee.com/tickets-passes/lift-tickets/winter-lift-tickets) |
| Medium | The main-lot route from Hood River counted Bennett Pass after the Mt. Hood Meadows exit. | Record no named crossing for that north approach. Keep Barlow and Bennett passes on the southern routes. [USGS field guide, Stop 12](https://pubs.usgs.gov/sir/2017/5022/g/sir20175022g.pdf), [ODOT corridor map](https://www.oregon.gov/ODOT/Planning/TPOD/facility_plan/corridor/OR_35_mt_hood_corridor_plan_vol1_1999.pdf) |
| Medium | Both Kremmling approaches to Steamboat omitted Muddy Pass. | Record Muddy Pass before Rabbit Ears Pass. Place the marker near milepoint 157.35 using the state road inventory. [CDOT camera locations](https://www.codot.gov/projects/statewidecameras), [CDOT milepoints](https://dtdapps.codot.gov/server/rest/services/Webapps/open_data_sde/FeatureServer/38) |

The map draws state and province boundaries above snow depth and terrain relief. Their opacity reaches 50% at zoom level 4. Peak labels show names. Popups show available elevations on a second line, rounded to whole meters or feet. [Map guide](../../projects/ski-status/readme.md#map-display)

## Verification

A local production build fetched all 38 indexed runtime files from an HTTPS mirror. These include 15 new resort icons. The NAS path was empty. All 38 output checksums matched. The files contain 13,029,252 bytes in total. The terrain check verified eight byte ranges and the Heavenly Gondola and Cloud 9 tooltips. [Icon index](../../projects/ski-status/data/runtime-icons.json), [Terrain verifier](../../scripts/release-ski-terrain.ts)

The archive served a verified byte range from the 323 MB Whitefish trail map. Its next HEAD request used the existing checksum check. The regression tests cover wrong bytes, changes in length, and recovery when the correct bytes return.

| Check | Result |
| --- | --- |
| Repository tests | 4,004 JavaScript tests and 37 Python tests passed. |
| Ski-status Chromium | All 76 cases passed. The archive and terrain cases passed again after the checksum buffer change. |
| Release validator | All 22 Chromium cases passed. |
| Terraform | The rewrite and release-gate tests passed. |
| Static checks | ESLint, TypeScript, and the whitespace check passed. npm reported zero known dependency vulnerabilities. |

The coverage comparison uses the same feature, road data, and release asset paths. It starts from the working tree before review fixes.

| Measure | Before | After |
| --- | ---: | ---: |
| Focused tests | 298 | 305 |
| Lines | 68.29% | 69.59% |
| Branches | 67.91% | 68.26% |
| Statements | 67.47% | 68.53% |
| Functions | 75.83% | 76.09% |

The updated instructions use short sentences and direct commands. More than 99% of measured sentences fit the ASD-STE100 sentence limits. This check measures sentence length. [ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf)

## Open work

The production and preview sites still reported revision `0ec3dfd`. The public conditions manifest returned HTTP 403. The first hosted release needs the asset mirror, rewrite, preview validation, and scoped conditions sync. [Release tasks](../../projects/ski-status/TODO.md#release-checks)

The route file contains 181 approaches for 61 areas and 27 named passes. It supplies the data for the planned winter road layer. Mount Washington Alpine Resort is the next area in the acreage queue. [Road records](../../projects/ski-status/research/road-approaches.json), [Batch 25](../../projects/ski-status/research/data-quality-log.md#batch-25--2026-11-21)
