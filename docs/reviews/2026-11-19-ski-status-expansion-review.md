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

The catalog at the end of this review had 197 areas and 48 conditions links. See the guide for the latest totals. [Catalog](../../projects/ski-status/readme.md#catalog)

## Review after the worldwide roster updates

The follow-up review covers the branch from `main` at `2b9dfa1` through the Indy update at `3d17865`. It checks the catalog, pass filters, map and table, source links, and release entry points.

### Defects and corrections

| Defect | Correction |
| --- | --- |
| The Indy discounts filter showed a Mountain Collective icon for Whiteface. | Use the selected access type for the map color. Show an orange marker and the Indy discount legend when the user selects this filter. |
| The country filter used only the country of the map point. It hid shared ski areas from the other country. | Save the other countries with the area record. Use them in the filter and region text. Keep one pin and one comparison row for each shared area. |
| Resort details repeated some links. A pass link could appear again as the statistics source. | Keep the labeled pass link. Show each other source once. Combine the website and conditions labels when both use the same address. |
| The compact table gave two areas with the same name identical accessible labels. | Include the town and region in the button description. |

The review also compared reported vertical drops with mapped elevations. It used the operator sources to correct four conflicts.

| Ski area | Previous vertical | Corrected vertical | Basis |
| --- | ---: | ---: | --- |
| Pitztal Glacier / Rifflsee | 8,498 ft | 5,774 ft | Elevation range from Mandarfen to the upper glacier station. [Operator trail map](https://www.pitztaler-gletscher.at/media/2025_2026_pt_fo_winter_eng_panorama.pdf) |
| Pizol | 7,726 ft | 5,636 ft | Published ski descent to Wangs. [Operator statistics](https://pizol.com/unternehmen/unternehmen/) |
| Corralco | 4,052 ft | 2,854 ft | Published ski area drop. [Operator statistics](https://resort-de-montana.corralco.com/preventa-invierno/) |
| Skeetawk | 1,236 ft | 300 ft | Published vertical for the chairlift terrain. [Operator history](https://skeetawk.com/history) |

### Follow-up checks

The four UI regression tests failed before the fixes. All 18 Chromium tests passed with MapLibre and controlled CARTO responses. The repository unit suite passed 3,706 tests. The Python suite passed 18 tests. Type checks, lint, and a Vite build in fixture mode passed. [Unit tests](../../src/test/skiStatus.test.ts), [Component tests](../../src/test/skiStatusComponents.test.tsx), [Browser tests](../../tests/e2e/ski-status.spec.ts)

The focused unit coverage includes ski-status and its shared search hook. It rose from 39.31% to 46.11% for lines and from 39.05% to 49.83% for branches. The Chromium suite covers map and page interactions.

The guide uses short instructions, active verbs, and the app's terms. The task list keeps the checks for each season with the release work. [ASD-STE100 writing rules](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf), [ski-status tasks](../../TODO.md#ski-status)
