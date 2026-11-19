# ski-status quality review

November 19, 2026

The review covers the `feature/ski-status` changes from `main` at `2b9dfa1` through the pilot at `0e0d3e5`. The pilot has 25 areas. The review examined the catalog, filters, map, keyboard controls, and route integration. Current condition data comes from operator links. [Project guide](../../projects/ski-status/readme.md)

## Corrected defects

| Area | Defect | Correction |
| --- | --- | --- |
| Map selection | Clicking Snowbird could select Alta when Alta's marker covered it. The click handler used the renderer's layer order. | Select the nearest eligible marker to the click or tap. Ignore resort markers that the current filter excludes. |
| Map camera | A delayed cluster response could move the camera away from a resort selected in the table. | Discard old camera results after a new selection, map action, or data change. |
| Map readiness | The map reported ready when only the style had loaded. | Wait for the area source and the basemap. Show the degraded state when the fallback map is ready. |
| Keyboard focus | Closing the detail panel removed the focused control. | Return focus to the selected table row. Use the Map button when the table is hidden. |
| Phone layout | Hidden table text extended the document beyond its 320-pixel width. | Contain the text in the table scroll region. Keep horizontal scrolling inside the table. |
| Catalog joins | The loader used the first matching point. It could skip orphan pass records and accept duplicate memberships. | Index records by ID. Reject duplicates and missing references. Check eligibility and conflicting values before rendering. |
| Source links | The HTTPS check accepted URLs with embedded credentials. | Reject usernames and passwords in source URLs. |
| Search | A full country name such as Canada could return zero areas. | Include the country name in the search text. |

The route redirect and link prefetch use the same alias file. This removes a second list of redirect targets. [Route aliases](../../src/content/siteAliases.json)

## Verification

Four Chromium tests failed on the original pilot. The narrow-screen test also found the scroll defect after the focus check passed. All four tests now pass with the real MapLibre renderer and fixed map inputs. The suite checks overlapping markers, a delayed cluster response, slow tiles, and mobile fallback. [Browser tests](../../tests/e2e/ski-status.spec.ts)

The catalog tests cover missing references, duplicate rows, entry rules, invalid fields, and source URLs. The browse tests cover country search, filters, units, lower bounds, and unknown values. [Unit tests](../../src/test/skiStatus.test.ts)

Type checking and lint passed. The full Vitest suite passed 3,635 tests, including the clean build. The Python suite passed 18 tests.

V8 coverage for `browse.ts` and `catalog.ts` increased with the new unit tests.

| Measure | Pilot | After review |
| --- | ---: | ---: |
| Statements | 83.07% | 96.11% |
| Branches | 50.00% | 80.53% |
| Lines | 92.00% | 97.59% |

## Open work

The first release still needs exact pass products, scheduled conditions, and more eligible areas. The backlog lists the release work and the version 2 work. [ski-status tasks](../../TODO.md#ski-status)
