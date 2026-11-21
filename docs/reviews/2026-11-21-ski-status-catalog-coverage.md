# ski-status catalog coverage

November 21, 2026

This update added 81 statistics and report links to 57 catalog records. It also added eight season plans and snow data for seven areas.
In total, 62 ski areas gained data. The catalog still covers 583 areas.
The comparison uses `68e4f21` as its starting point. [Catalog](../../projects/ski-status/readme.md#catalog)

| Field | Before | After |
| --- | ---: | ---: |
| Downhill areas with all six comparison fields | 288 | 297 |
| Skiable acreage | 377 | 382 |
| Vertical drop | 463 | 464 |
| Lift count | 483 | 491 |
| Base elevation | 395 | 412 |
| Summit elevation | 404 | 416 |
| Downhill trail length | 86 | 91 |
| Highest lift terminal | 43 | 52 |
| Lowest lift terminal | 14 | 23 |
| Official conditions link | 535 | 547 |
| Planned season dates | 139 | 147 |
| Average annual snowfall | 165 | 167 |
| Average monthly snowfall | 61 | 65 |
| Monthly snow depth series | 80 | 81 |

## Mountain statistics and conditions

- Nekoma reports terrain area and elevations for its linked north and south sectors. The source also gives separate season dates for each sector. [Nekoma lift and course guide](https://www.nekoma.co.jp/liftguide/)
- The Snowriver conditions report lists four lifts at Black River Basin and six at Jackson Creek Summit. Each catalog point uses the count for its sector. [Snowriver lift report](https://www.snowriver.com/mountain-info/mountain-report)
- The Dolomiti records use public CC0 lift data for terminal elevations. Each citation names the lift and the terminal. [Open Data Hub inventory](https://databrowser.opendatahub.com/dataset-overview/ad42b408-e5eb-412b-8b0a-f7e8e9dab2b7)
- The catalog subtracts Alpental's 825 acres from the operator's combined 1,994 acres. The result covers the three Summit sectors. [The Summit at Snoqualmie](https://www.summitatsnoqualmie.com/), [Alpental](https://www.summitatsnoqualmie.com/alpental)
- Kitzsteinhorn's 2026/27 press kit gives 62.5 km for Kitzsteinhorn and Maiskogel. The previous 41 km figure covers Kitzsteinhorn alone. [2026/27 press kit](https://www.kitzsteinhorn.at/de/service/backstage/presse/winter-2026-27-pr15634)
- Twelve areas gained official conditions links. The Corralco operator links to its report on Mountain.Live. [Corralco site](https://corralco.com/montana/), [Corralco report](https://mountain.live/report/7d088178-39c3-4439-bd72-664bcb16bc7b?locale=es_ES)

## Snow measurements

The Québec network supplies monthly snowfall near Centre Vorlage, Le Massif, Mont Rigaud, and Mont Sutton.
Each winter month uses at least 20 years of readings. Le Massif keeps its separate annual figure from the resort. [Québec monthly normals](https://www.donneesquebec.ca/recherche/dataset/normales-climatiques-mensuelles)

The Whitehorse federal composite supplies snow depth near the Nordic centre. All its station locations meet the distance and elevation limits. [Canadian Climate Normals](https://climate.weather.gc.ca/climate_normals/index_e.html?e=1)

Rusutsu and Corralco now have annual snowfall from their operators. [Rusutsu resort guide](https://rusutsu.com/en/blog/032/), [Corralco resort guide](https://corralco.com/montana/)

## Verification

The audit checked the area IDs, source dates, and lift elevation order. The full repository suite also checked the updated records. [Test results](2026-11-21-ski-status-season-and-catalog-review.md#verification)

## Remaining gaps

At the time of this review, 228 downhill areas had comparison gaps. There were 36 areas without conditions links. [Catalog tasks](../../projects/ski-status/TODO.md#catalog-and-report-gaps)
