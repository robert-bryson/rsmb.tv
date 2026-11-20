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

## Follow-up review

The follow-up started at `ae78812`, with independent pass toggles and icon buttons already in place. The review walked through finding Utah resorts for an Ikon and Epic group, searching a new map area, comparing mountain statistics, and opening and closing resort details by keyboard and touch.

### Passes and search

The top shortcuts showed which passes were selected. The list only explained each resort’s access when the map was colored by pass. With several passes selected, Results now names the matching passes beside each resort’s location. Add Mountain Collective to Ikon and Epic in Utah and Alta shows both of its matching passes. Park City shows Epic. A product and date qualify the selected family’s access. The Filters icon displays the count of additional criteria, and each applied filter can be removed beside the result count. [Baymard research on combining filters](https://baymard.com/research-articles/allow-applying-of-multiple-filter-values) · [Baymard research on applied filters](https://baymard.com/research-articles/how-to-design-applied-filters)

The narrow phone layout gave operating status and view selection two rows. They now fit side by side at 320 pixels. The solid segmented control shows the status scope. The underlined view shows which workspace is open. Short landscape layouts use the pass logos beside search. Report coverage appears when an operating-status filter is active, where it helps explain a short or empty result list. [Apple guidance on segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls)

### Map and details

On a phone, Search this area, Fit results, Layers, and zoom crowded the top edge of the map. The geographic action now has its own prominent button. It shows a check once the visible area is applied. Fit results and Layers share a panel. The phone uses icons in that panel and places zoom near the bottom right to leave the map’s upper-right markers visible. The Layers icon also indicates when the map display has been customized. [Google Maps Layers](https://support.google.com/maps/answer/3092439?co=GENIE.Platform%3DDesktop) · [Esri map actions](https://developers.arcgis.com/calcite-design-system/components/action/)

The Filters, Share, Layers, Fit results, and Close details icons have accessible names and 44-pixel targets. Close details is aligned with the sticky resort title. The browser checks exercise focus return, the share dialog fallback, and the distinction between moving the camera and applying a new area. [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) · [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)

### Compare

The first screen of the All resorts table was dominated by missing daily reports. It now shows skiable area, vertical drop, lifts, trails, and summit elevation after resort and region. The numbers align to the right, and the resort name stays visible during horizontal scrolling. Operating-status views lead with report fields, consistent with a same-day lookup. Column preferences control which fields appear. [GOV.UK table guidance](https://design-system.service.gov.uk/components/table/) · [OnTheSnow’s Utah open resorts table](https://www.onthesnow.com/utah/open-resorts)

### Map height

Measured in local Chromium with a fixture basemap. All resorts was selected in each run. The landscape case included a United States filter, and the other cases included Ikon and Epic.

| Viewport | Starting branch | Follow-up | Gain |
| --- | ---: | ---: | ---: |
| 1440 × 900 | 785 px | 790 px | 5 px |
| 768 × 900 | 780 px | 789 px | 9 px |
| 390 × 844 | 636 px | 648 px | 12 px |
| 320 × 700 | 438 px | 504 px | 66 px |
| 640 × 360 | 201 px | 250 px | 49 px |

### Verification

All 49 ski-status Chromium tests passed using local fixtures. They cover combined passes, map scope and camera history, touch and keyboard focus, share links, and comparison. Axe found zero violations across the phone map, landscape map, Filters, Layers, resort details, and phone Compare. [Browser checks](../../tests/e2e/ski-status.spec.ts)

The open usability question is how quickly first-time visitors can find and compare mountains or discover the fit icon on a phone. [ski-status task list](../../TODO.md#ski-status)
