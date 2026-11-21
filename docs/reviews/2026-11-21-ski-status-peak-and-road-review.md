# ski-status peak and road data review

November 21, 2026

The review covers changes after `fc5e430` on `feature/ski-status`. The changes add mountain peaks, season length, Results icons, and new resort records. Snow depth fades near resort terrain.

## Findings and fixes

| Impact | Finding | Fix |
| --- | --- | --- |
| High | The peak overlay assumed every vector road source had a points-of-interest layer. A valid road-only style entered background recovery. | Wait for the source metadata. Add nearby peaks when that source supports them. Draw the trail-map peaks from their own source. |
| Medium | The catalog showed the Nordic trail minimums at Chapleau and Kenora as exact lengths. | Store the lower bound. Show the `+` suffix and round converted lower bounds down. Cite the club's trail inventory for Kenora's length. [Chapleau profile](https://skiontario.ca/resorts/resort/36/), [Kenora trail inventory](https://www.skikenora.ca/cross-country/about-kenora-nordic-biathlon-club/) |
| Medium | The road records relied on a manual check of their links to passes and ski areas. | Validate route identity, catalog IDs, coordinates, dates, and HTTPS sources. Check that each pass is on a road in its approach. |
| Low | Results, details, and the map selected resort images in three places. | Use one ordered list of image URLs. Prefer the small file for the map and Results. Prefer the larger file in details. |
| Low | The comparison test still expected the old Park City lift count. | Use the 42 lifts in the dated 2026/27 operator guide. Keep its published lower bounds and record their source. [Park City 2026/27 guide](https://news.vailresorts.com/the-2026-27-guide-to-a-larger-than-life-winter-at-park-city-mountain) |

## Tests and coverage

Chromium reproduces the road-only style failure with a local TileJSON response. The test checks the active background and the trail-map peak marker. Unit tests cover source readiness, layer removal, and peak labels at their visible zoom levels. Road tests check both a verified route without a pass and a route with a pending pass check.

The V8 comparison uses the same ski-status feature paths in both runs. It includes the ski-status unit and terrain map tests.

| Measure | Before | After |
| --- | ---: | ---: |
| Tests | 264 | 274 |
| Lines | 62.95% | 66.91% |
| Branches | 65.27% | 66.69% |
| Statements | 62.75% | 66.25% |
| Functions | 73.38% | 75.19% |
| Peak layer lines | 0% | 100% |

| Check | Result |
| --- | --- |
| Repository tests | 3,994 JavaScript tests and 37 Python tests passed. |
| Ski-status Chromium | 74 cases passed on the first run. The attribution case passed on a single-worker retry. |
| Production build | Passed with the local runtime assets and their checksums. |
| Dependency audit | npm reported zero vulnerabilities. |

## Documentation

The guide uses the current catalog and visitor files for its counts. The task list gives separate actions for collecting road records and adding them to the map. The data-quality skill calls the automated road test and records the evidence for gates and boundaries. [Project tasks](../../projects/ski-status/TODO.md), [Project guide](../../projects/ski-status/readme.md)

The edits use short sentences, active voice, and direct instructions. At least 96% of the measured sentences in each edited file have 20 words or fewer. Sentence length is the measured part of the writing target. [ASD-STE100 guidance](https://asd-ste100.org/STE_faq.html)
