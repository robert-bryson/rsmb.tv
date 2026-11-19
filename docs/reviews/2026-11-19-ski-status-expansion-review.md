# ski-status catalog and layout review

November 19, 2026

The review covers `feature/ski-status` through `2307eeb`. It checks the expanded catalog, the focused views, and the shared route and build entry points. See the [pilot review](2026-11-19-ski-status-quality-review.md) and the [current guide](../../projects/ski-status/readme.md).

## Corrected defects

| Area | Defect | Correction |
| --- | --- | --- |
| Background retry | A selection during CARTO style load could leave the map at the previous region. The selected resort appeared in the details. | Keep the camera change pending until the resort layer is ready. Apply the latest filter and selection state. |
| Phone map | A filter change in the table could fit results to the hidden map's default size. In the regression test, an edge resort came within 6 pixels of the visible edge. | Fit to the visible map. Reduce the padding when the viewport is too small for the default. |
| Acreage colors | The acreage color for a value such as `200+` could imply that the resort had fewer than 250 acres. | Use gray if a minimum leaves more than one possible range. Keep the minimum in the table. |
| Catalog validation | The catalog accepted some statistics without a source. It accepted conflicting elevations and acreage. Some HTTPS strings could resolve differently in the browser. | Require a source for published statistics. Check elevation order and exact acreage. Require absolute HTTPS links without usernames or passwords. Check location attribution and the pass season end year. |

## Verification

The two camera regressions failed at `2307eeb` and passed after the corrections. All eight Chromium tests passed. The tests use MapLibre with controlled CARTO and terrain responses. [Browser tests](../../tests/e2e/ski-status.spec.ts)

The 31 ski-status unit tests cover catalog sources, pass season dates, map colors, filters, and sort order. The tests accept negative elevations and acreage with a lower bound. [Unit tests](../../src/test/skiStatus.test.ts)

The unit coverage compares the same three modules before and after the review. The modules validate the catalog, prepare table results, and choose map colors.

| Measure | Before | After |
| --- | ---: | ---: |
| Statements | 96.59% | 98.78% |
| Branches | 84.86% | 95.18% |
| Functions | 100% | 100% |
| Lines | 98.26% | 100% |

Type checks and lint passed. Vitest passed 3,650 tests, including the clean build. The Python suite passed 18 tests.

## Guide and tasks

The guide explains how the map fits results and how it shows acreage limits. The repository task list puts each idea in first release, version 2, or later work. The documentation uses short sentences and the same terms as the app. [ASD-STE100 writing guidance](https://www.asd-ste100.org/about_STE.html), [ski-status tasks](../../TODO.md#ski-status)

The release still needs more catalog coverage, exact pass product rules, and scheduled conditions reports. The current catalog includes 197 areas and 48 links to official conditions reports. [Catalog](../../projects/ski-status/readme.md#catalog)
