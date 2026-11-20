# ski-status interface review

November 20, 2026

The interface helps people find open ski areas. It also helps them check pass access and compare mountains. The review tested these tasks on a phone and a desktop.

## Findings

| Task | Observed friction | Change |
| --- | --- | --- |
| Find resorts for a group with different passes | Selecting a pass replaced the previous pass. It also cleared a selected product and ski date. | Each pass toggles independently. The Filters dialog mirrors the shortcuts with checkboxes. |
| Browse today or plan a trip | Both operating modes and views used the same row of standalone buttons. On a phone, the two groups wrapped onto separate lines. | **Ski today** and **All resorts** share a control. **Map**, **Results**, and **Compare** share a second control. The groups can sit side by side or stack when space is tight. |
| Search the map | A full-width toolbar took space from the map. The area-search action looked primary even when the visible area was already applied. | **Search this area** floats over the map and shows a check when the area is applied. **Fit results**, **Layers**, and zoom sit together. |
| Confirm and remove filters | The header repeated the selected pass. Other applied filters looked like text links. | Checked pass buttons show the selection. Removable chips show the region, product, date, searched area, and other additional filters. |
| Share a view or dismiss a panel | Text buttons used space needed by the search field and long resort names. The details close action scrolled away. | Filters, Share, and Close use named icons. The details heading stays visible as the panel scrolls. |
| Recover from an empty **Ski today** result | The message explained why the results were empty. Switching to the catalog required finding the status control again. | **Show all statuses** appears in the empty state and keeps the other search criteria. |

## Research and design decisions

### Passes and products

Baymard found that shoppers expect one filter to match any selected value. Separate filters narrow the results together. The ski map uses these rules for passes, region, search text, and operating status. [Baymard research on combining filters](https://baymard.com/research-articles/allow-applying-of-multiple-filter-values)

Select Ikon and Epic in Utah. Alta and Park City qualify. Add Mountain Collective. Alta still appears once. Ski Pass Compare also lists several pass memberships for each resort. [Ski Pass Compare resort explorer](https://skipasscompare.com/resorts)

A product and ski date apply to their pass family. Snowbird can qualify through Mountain Collective on an Ikon Base blackout date. The map gives priority to a selected membership that qualifies. A share link carries all selected passes. Existing single-pass links still open with that pass.

The shortcuts mark each active pass with a check. The header gives other applied filters a named removal control. This follows Baymard’s finding that visible selections help people understand and revise a narrowed result set. [Baymard research on applied filters](https://baymard.com/research-articles/how-to-design-applied-filters)

### Map actions and icons

Searching an area changes which resorts qualify. Fitting results changes the camera. Layers changes how the map displays those resorts. The layout gives the geographic search a labeled primary button and puts the display actions beside zoom. Google Maps uses a dedicated Layers control, and Esri’s design system uses compact icons for actions within a map or panel. [Google Maps Layers](https://support.google.com/maps/answer/3092439?co=GENIE.Platform%3DDesktop) · [Esri Calcite actions](https://developers.arcgis.com/calcite-design-system/components/action/)

Icon recognition depends on context. Filters sits beside search, Share sits in the header, and Close sits by the resort or dialog heading. Each icon has a stable accessible name and a mouse tooltip. The main controls have 44 CSS pixel target heights. Pass toggles expose their pressed state, and dialogs support Escape. [Nielsen Norman Group on icon interpretation](https://www.nngroup.com/articles/how-to-test-digital-icons/) · [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) · [W3C button and dialog patterns](https://www.w3.org/WAI/ARIA/apg/patterns/)

## Viewport measurements

Chromium opened **All resorts** with **United States** selected and a local basemap fixture. The values are map canvas heights in CSS pixels.

| Viewport | Before | After |
| --- | ---: | ---: |
| 1440 × 900 | 633 | 718 |
| 1024 × 768 | 501 | 586 |
| 768 × 900 | 633 | 718 |
| 390 × 844 | 477 | 586 |
| 320 × 700 | 333 | 388 |
| 640 × 360 | 43 | 172 |

## Verification

All 47 ski-status Chromium tests passed. They cover the map, Results, Compare, repeated pass values in share links, keyboard focus, and camera history. The browser also exercises the real MapLibre renderer and resort terrain archive. [Browser checks](../../tests/e2e/ski-status.spec.ts)

An axe scan reported zero violations in the phone map, Filters dialog, and details panel. The 18 release-validator browser tests passed on local fixtures. The repository passed 3,849 Vitest tests and 32 Python tests. TypeScript checks and a fixture-mode Vite build passed.

## Next usability question

Compare opens with several current-report columns. Many catalog rows show dashes when reports are sparse. Track the comparison test in the [ski-status task list](../../TODO.md#ski-status).
