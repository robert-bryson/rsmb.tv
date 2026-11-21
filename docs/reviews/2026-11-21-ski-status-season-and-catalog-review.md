# ski-status season and catalog review

November 21, 2026

The review covered the ski-status changes since `68e4f21`.
It checked the new catalog entries, season selection, snow charts, and map shortcut. [Catalog counts and evidence](2026-11-21-ski-status-catalog-coverage.md)

## Findings

| Impact | Finding | Correction |
| --- | --- | --- |
| Medium | A fresh opening report could appear next to a closing date from a later season. A reported opening could also remain in Compare after a recorded opening. | Details, Compare, and CSV use the same plan selection. The selected plan must fit the reported opening. A recorded opening clears the planned opening. [Date rules](../../projects/ski-status/readme.md#opening-and-closing-dates) |
| Medium | Cannon Mountain's details showed its November to April season. The month filter and comparison columns read a different set of season data. | Details, filters, display values, and sort order use the same typical season. The resolver uses the operator's catalog month range when the calendar lacks a typical season. [Season resolver](../../src/features/ski-status/seasons.ts) |
| Medium | Keyboard focus stayed on the outer map section when **Show runs and lifts** loaded the phone map for the first time. | The map canvas receives focus when it loads if focus is still on the map section. The details stay visible. [Map display](../../projects/ski-status/readme.md#map-display) |
| Low | A snow source stored as a URL could disappear from **Snow sources**. Identical annual and monthly citations could appear twice. | The list keeps the URL citation and uses its host name as the label. Annual and monthly snowfall share a link when the URL, provider, site, and period match. [Snow history](../../projects/ski-status/readme.md#season-and-snowfall) |
| Low | The Summit acreage calculation cited the combined area. The separate Alpental figure lacked a direct link. | Both inputs now have operator links. [Catalog evidence](2026-11-21-ski-status-catalog-coverage.md#mountain-statistics-and-conditions) |

## Verification

Five unit tests reproduced the season and snow citation defects before the fixes. The tests also cover a closing plan that precedes a reported opening.
The phone test reproduced the focus defect with a keyboard. It now checks focus, terrain byte ranges, the open details, and reload behavior.
The snow chart browser test checks keyboard controls and runs axe on the expanded chart.

The V8 baseline uses the incoming working tree before the review fixes. Both runs use the same source and test paths. [Coverage command](../../projects/ski-status/readme.md#local-checks)

| V8 measure | Before | After |
| --- | ---: | ---: |
| Tests | 281 | 289 |
| Lines | 71.81% | 71.95% |
| Branches | 70.29% | 70.46% |
| Statements | 70.82% | 70.91% |
| Functions | 74.16% | 74.36% |

| Check | Result |
| --- | ---: |
| Repository Vitest | 3,911 passed |
| Repository Python | 36 passed |
| Ski-status Chromium | 54 passed |
| TypeScript and ESLint | Passed |

## Open checks

The task list tracks the remaining catalog gaps and the checks for the hosted release. [Project tasks](../../projects/ski-status/TODO.md)
