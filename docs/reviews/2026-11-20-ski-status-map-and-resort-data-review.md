# ski-status map and resort data review

November 20, 2026

The review covers the pending ski-status changes and their data readers. It checks the map, pass filters, detail panel, and terrain importer.
The dated interface review records the layout changes. [Interface review](2026-11-20-ski-status-interface-review.md)

## Findings

| Impact | Finding | Correction |
| --- | --- | --- |
| High | The sidebar used an older date when a fresh operator report changed the planned opening. The comparison table and CSV could give a different date. | The three views use the same report date check. The sidebar keeps recorded dates and links to the chosen source. |
| High | The terrain importer kept verified entrances after their area IDs left the catalog. A rebuild could produce records that the catalog rejects. | The importer keeps an entrance only when the area and terrain point still exist. |
| Medium | The base ranking counted lift arrivals as departures. An upper transfer with a nearby arrival could rank as the main base. | The ranking counts lower terminals where elevations identify them. It then checks the number of nearby operating lifts. |
| Medium | The season selector chose the newest plan when several plans were valid. It could also drop the winter season label after a January opening. | The selector uses the nearest applicable plan. It keeps the year of the recorded closing when it estimates the next season. |
| Medium | Attribution relied on MapLibre's internal state classes. A drag could hide the panel and leave the native disclosure open. | A native disclosure controls visibility and keyboard focus. MapLibre supplies the provider credits. The download links stay in place after a source update. |
| Medium | The details reader accepted orphan area IDs and incomplete snow or icon records. Object property lookup could also return an inherited value for a missing ID. | The reader checks the catalog, measurements, sources, and bundled files. It stores lookup data in maps. |
| Low | A product-only selection could filter the correct resorts and still display a different pass badge. | The filter, marker, and result list share the pass selection rules. |

## Terrain and base points

The rebuilt archive uses the November 16 OpenSkiData snapshot. It contains terrain for 550 catalog areas and uses the same four feature types.
The base file has 298 points. It includes 15 verified entrances and 283 inferred lift bases.
The new ranking moved 45 inferred points. For 16 areas, the map now uses the catalog point because the lift data gives insufficient evidence.

The importer keeps the coordinates of the verified entrances. It stages the archive, manifest, and base index before it starts to replace files.
If a replacement fails, the importer restores the previous files.
See the build and review steps in the [ski-status guide](../../projects/ski-status/readme.md#runs-and-lifts-at-resort-zoom).

## Verification

The tests cover plan order, local dates, report expiry, missing measurements, invalid data, and pass badges.
The map tests cover keyboard access, touch layout, successful downloads, and disclosure state after a drag.
The archive tests check the tile checksum and the build date of the base index.

| Check | Result |
| --- | ---: |
| Repository Vitest tests | 3,863 passed |
| Repository Python tests | 36 passed |
| Ski-status Chromium tests | 49 passed |
| Release-validator tests with local fixtures | 18 passed |
| Firefox attribution and season chart check | Passed |
| TypeScript, ESLint, and fixture-mode Vite build | Passed |

The same unit test selection ran before and after the corrections. It measures the ski-status feature files and page module.
The totals exclude the separate browser suite. [Test commands](../../projects/ski-status/readme.md#local-checks)

| Metric | Before | After |
| --- | ---: | ---: |
| Unit tests | 190 | 203 |
| Lines | 63.21% | 66.88% |
| Branches | 64.04% | 66.30% |

WebKit could not start because the Linux host lacks the required GTK 4 and media libraries.

## Documentation

The edits use short active sentences and one instruction per sentence. The prose length check uses limits of 20 words for instructions and 25 for descriptions.
The writing pass uses the repository's 80% target as a guide. [ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf)

## Open work

The hosted preview check and the Rockies pilot remain release tasks.
Track data coverage, verified entrances, and resort links in the [ski-status task list](../../TODO.md#ski-status).
