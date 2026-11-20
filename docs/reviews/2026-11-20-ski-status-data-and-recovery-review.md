# ski-status data and recovery review

November 20, 2026

This review covers the ski-status branch, its catalog changes, and the shared code that loads its map and search state.

## Findings

### High priority

- Resort marker errors could leave the map in the loading state or display a stale ready state. The background recovery handler skips the resort marker source. The map now handles that source error and shows **Retry map**. The retry restores the filters and selected area. Chromium tests verify the failure and retry. [Map error handling](../../src/features/ski-status/SkiStatusMap.tsx), [Browser tests](../../tests/e2e/ski-status.spec.ts)
- The terrain importer replaced its outputs one at a time. A failed replacement could pair a new archive with an old index. The importer now allows one build per output directory. It saves the previous files and restores them if a replacement fails. A test forces the index replacement to fail after the archive and location file change. [Terrain importer](../../projects/ski-status/scripts/build-resort-terrain.py), [Importer tests](../../projects/ski-status/tests/test_terrain_snapshot.py)

### Medium priority

- Source notes appeared as hover text. The details panel omitted the verification date, season source, and difficulty source. The **Published statistic sources** control now shows the fields, date, and scope for each citation. The conditions link stays visible if its URL also documents pass access. [Area details](../../src/features/ski-status/SkiAreaDetails.tsx)
- The catalog required `statsUrl` even when each statistic had its own citation. It now accepts a set of field citations that covers all published values. A general source still covers uncited fields in existing records. [Catalog validation](../../src/features/ski-status/catalog.ts)
- Marker visibility changes caused the page and table to render again with **In map view** off. The page now keeps the last map view and updates the table only when the filter uses it. Tests also cover the first map view on a narrow screen and duplicate visibility updates. [Map and table page](../../src/pages/SkiStatus.tsx), [Page tests](../../src/test/skiStatusPage.test.tsx)
- The importer escaped attribution HTML but accepted insecure links and links with credentials. It now checks each URL before it writes the archive. It also combines equivalent Unicode trail names when it counts named routes. [Terrain importer](../../projects/ski-status/scripts/build-resort-terrain.py), [Importer tests](../../projects/ski-status/tests/test_terrain_snapshot.py)

## Catalog coverage

The research added statistics or conditions links to 286 of 565 areas. It added 410 values across six main downhill fields. A total of 128 areas now have all six fields.

| Published field | Areas before | Areas after |
| --- | ---: | ---: |
| Skiable acreage | 169 | 240 |
| Vertical drop | 383 | 437 |
| Lift count | 376 | 445 |
| Trail count | 417 | 482 |
| Base elevation | 113 | 182 |
| Summit elevation | 121 | 203 |
| Downhill trail length | 2 | 55 |
| Nordic trail length | 4 | 59 |
| Highest lift terminal | 14 | 23 |
| Lowest lift terminal | 3 | 6 |
| Night skiable acreage | 4 | 7 |
| Difficulty breakdown | 71 | 94 |
| Season window | 56 | 61 |
| Official conditions link | 216 | 348 |

The November 16 OpenSkiData snapshot supplied 466 named downhill counts and 44 named Nordic counts. It supplied elevation ranges for 517 areas. The table labels these values as mapped data. [Catalog and source rules](../../projects/ski-status/readme.md#catalog), [OpenSkiData data definitions](https://www.openskidata.org/#whats-in-the-data)

## Verification

Vitest measured the same ski-status source files, route, and search hook before and after the fixes. The focused tests increased from 131 to 136. The route reached 80.45% line coverage.

| Vitest coverage | Before | After |
| --- | ---: | ---: |
| Lines | 45.91% | 54.54% |
| Branches | 50.11% | 59.97% |
| Functions | 46.63% | 60.37% |

The repository test run passed 3,743 Vitest tests and 28 Python tests. All 29 ski-status Chromium tests passed on a local server. The browser tests cover the map renderer and local archive byte ranges. TypeScript and ESLint passed. The npm audit found zero known advisories in production dependencies.

An isolated rebuild produced the same archive bytes and index as the checked-in files. The archive covers 533 areas. The importer reproduced the named route counts without changing the location file. [Terrain index](../../projects/ski-status/data/resort-terrain.json)

Verify the hosted preview's byte range response before release. The task list also tracks the remaining catalog work and pass rules. [Release tasks](../../TODO.md#ski-status)
