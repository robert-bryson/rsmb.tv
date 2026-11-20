# ski-status first-release work

November 20, 2026

## Eligibility

The review uses the November 16 OpenSkiData build and the checksum in the guide. It covers 848 candidates across 57 region entries.
Source IDs and location checks match candidates to the existing catalog. Additional operator and agency checks cover Washington, British Columbia, and selected remaining candidates.
The log gives a source, decision, and next check for each unresolved case. This derivative inventory uses ODbL. [Candidate log](../../projects/ski-status/research/north-america-2026-11-16.csv), [Regional counts](../../projects/ski-status/research/north-america-2026-11-16-summary.csv), [OpenSkiData license](https://www.openskidata.org/#license)

| Region | Candidates | Already cataloged | Added | Duplicate | Excluded | Unresolved |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Washington | 19 | 12 | 1 | 1 | 1 | 4 |
| British Columbia | 44 | 23 | 5 | 1 | 0 | 15 |
| All United States | 571 | 283 | 11 | 2 | 4 | 271 |
| All Canada | 273 | 55 | 6 | 1 | 0 | 211 |
| Mexico | 1 | 0 | 1 | 0 | 0 | 0 |
| Greenland | 3 | 0 | 0 | 0 | 0 | 3 |
| **All candidates** | **848** | **338** | **18** | **3** | **4** | **485** |

Mission Ridge qualifies on published skiable acreage. Its expansion page gives a separate lease area.
Island Lake Catskiing and Bosques de Monterreal qualify as specialty venues. Monterreal's municipal source confirms year-round ski activity. [Visit Wenatchee](https://www.visitwenatchee.org/blog/winter-adventures-in-wenatchee-downhill-thrills-and-snowy-trails), [Mission Ridge expansion](https://expansion.missionridge.com/expansion/), [Island Lake Lodge](https://www.islandlakelodge.com/catskiing/book), [Arteaga municipal gazette](https://arteaga.gob.mx/wp-content/uploads/2025/09/GACETA-MUNICIPAL-JULIO-2025.pdf)

## Catalog coverage

The catalog grew from 565 to 583 areas. Conventional downhill areas grew from 509 to 525.
All six core statistics are present for 132 conventional downhill areas, up from 128.

| Field | Downhill before | Downhill after | All areas before | All areas after |
| --- | ---: | ---: | ---: | ---: |
| Skiable acreage | 238 | 254 | 240 | 256 |
| Vertical drop | 413 | 428 | 437 | 452 |
| Lift count | 440 | 450 | 445 | 455 |
| Trail count | 442 | 456 | 482 | 496 |
| Base elevation | 180 | 191 | 182 | 193 |
| Summit elevation | 201 | 214 | 203 | 216 |
| Highest lift terminal | 22 | 26 | 23 | 27 |
| Lowest lift terminal | 5 | 6 | 6 | 7 |
| Night skiable acreage | 7 | 9 | 7 | 9 |
| Season window | 59 | 61 | 61 | 64 |
| Official conditions link | 319 | 333 | 348 | 362 |

Camelback and Montage publish full-mountain night operations. The night area figures use their published terrain scope. [Camelback facts](https://www.camelbackresort.com/poconos-ski-tube), [Montage facts](https://www.montagemountainresorts.com/experience/)

The rebuilt archive covers 550 areas. All 533 previous matches remain. The new matches came from source IDs or footprints.
The index records 11 shared terrain groups. These include the separate Gore and Manning Park downhill and Nordic entries.
Island Lake Catskiing accounts for one of the 33 areas with no archive coverage. [Terrain index](../../projects/ski-status/data/resort-terrain.json), [Location sources](../../projects/ski-status/data/locations.json)

## Pass product coverage

| Program | Areas with verified product terms | Products in the rules file |
| --- | ---: | ---: |
| Ikon | 112 | 5 |
| Epic | 98 | 16 |
| Indy | 4 | 4 |
| Mountain Collective | 34 | 1 |

Product coverage counts an area with at least one applicable rule. An exact product and ski date can match a smaller set.
The pass comparison and partner terms verify Epic All Resorts day products. The 32- and 22-resort tier lists still need verification. [Epic partner rules](https://www.epicpass.com/regions/partner-resorts.aspx), [Epic restricted dates](https://www.epicpass.com/info/peak-restricted-dates.aspx)

The Indy file uses independently published resort terms. More Indy rules need dated operator sources or permission for roster reuse. [Indy terms](https://www.indyskipass.com/website-terms-of-use), [Berkshire East and Catamount terms](https://berkshireeast.com/?id=8&view=category), [49 North terms](https://www.ski49n.com/promotions-perks/details/packs-of-tickets)

The Mountain Collective roster adds nine catalog entries from its 27-destination program. Banff Sunshine and Lake Louise each have their own allowance. [Mountain Collective destination terms](https://mountaincollective.com/how-to-use-my-pass/), [SkiBig3 terms](https://www.skibig3.com/stay/mountain-collective-perks/)

## Conditions pilot

The first live collection returned three resort reports and three base forecasts. Reported lifts, trails, and base depth were present for all three areas. New snow was present for two areas. None supplied a timestamp for the aggregate operations report.

On the first comparison, Open Data Hub showed one open lift at 3 Zinnen. The operator showed zero. Alta Badia and Val Gardena had zero open lifts on both sources. Some trail and lift totals also differed. Review the scope and source times during the full pilot. [Pilot reports](../../projects/ski-status/data/conditions/pilot-reports.json), [Operator lift and trail counts](https://www.dolomitisuperski.com/en/live-info/lifts)

The pilot uses the publicly licensed Open Data Hub / LTS data and Open-Meteo's noncommercial API. CSV includes the source and license credits. [Open Data Hub reuse terms](https://databrowser.opendatahub.com/dataset-overview/f15d894a-b77f-43cf-a802-e1590fc38068), [Open-Meteo terms](https://open-meteo.com/en/terms)

The production workflow and scoped role are prepared. A full week of hosted observations and the hosted preview check remain open. [Release tasks](../../TODO.md#ski-status)

## Verification

The full run passed 3,762 Vitest tests and 28 Python tests. All 32 ski-status Chromium tests passed on the local server.
The browser checks covered pass dates, saved columns, CSV downloads, and Heavenly terrain byte ranges.
The mocked Terraform test verified the publisher's S3 prefix. A second live fetch updated reports and retained the prior forecast and manifest.
