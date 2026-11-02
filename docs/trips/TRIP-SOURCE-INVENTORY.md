# Trip source inventory and starter structure

Inventory snapshot: October 31, 2026.
PCH photo additions were checked on November 1, 2026.
Mississippi–Wisconsin album additions were checked on November 2, 2026.
Other source entries retain the October 31 review.
The source review used the live `Blog Posts` Sheet and the locally synced source folders.
This file records that snapshot. It does not update when source files or Sheet rows change.
The Sheet contains nine trip report rows covering seven distinct trips.
The three 2026 reports share one trip ID and one manifest.

The [machine inventory](trip-source-inventory.json) records filenames, prepared assets, report rows, route coverage, and remaining gaps.
Source archives remain intact. New media was processed locally and copied into the existing Drive trip folders.
Publication values and source Google Docs were not changed.

## All trips

Photo counts describe manifest entries. Recorded miles describe available geometry, including local activity and possible travel by other modes.
The dates below come from existing manifests or recovered recordings. Sheet dates remain report dates.

| Trip | Working travel dates | GPX files | Photos | Starting structure |
| --- | --- | ---: | ---: | --- |
| [Ocean Shores](../../src/content/trips/ocean-shores-2024.json) | February 17–20, 2024 | 2 | 10 | Existing story: ferry departure, beach stay, rainy return |
| [Boise](../../src/content/trips/boise-2024.json) | May 11–19, 2024 | 6 | 79 | Existing story: Blue Mountains, work in Boise, Hells Canyon, return through the Cascades |
| [Kalaloch](../../src/content/trips/kalaloch-2024.json) | June 21–23, 2024 | 3 | 25 | Existing story: ferry and forest roads, beach camp, peninsula loop |
| [PCH](../../src/content/trips/pch-2024.json) | October 3–7, 2024 | 5 | 107 | Pre-trip Seattle gallery and five riding days: coast, redwoods, Sierra crossing, desert |
| [Route 66ish](route-66ish-2025-outline.md) | May 9–19, 2025; GPS through May 17 | 8 | 57 | Existing dated outline: California and Arizona, New Mexico, plains, Ozarks, St. Louis |
| [Mississippi–Wisconsin](river-wisco-2025-outline.md) | October 7–13, 2025, inferred | 8 | 40 | Seven-day outline: river towns, camp, Wisconsin visits, Madison, Illinois return |
| [ON–QC–New England](on-qc-new-england-2026-part-1-outline.md) | July 10–August 15, 2026, inferred | 35 | 1 | Three-part outline: Upper Peninsula, Canada, New England and return |

The first five manifests already cover their selected source media.
Boise has 82 prepared selections, but three are intentionally excluded duplicates.
Those duplicates remain excluded from its 79-photo manifest.
Boise also has an uncurated 162-JPG folder named `photos/Photos-1-001`.
The inventory identifies that folder without adding its contents to the story.

PCH and Route 66ish retain their existing detailed outlines and gallery references.
The published stories retain their current prose, galleries, and route assignments.

Ocean Shores has a date conflict: photo EXIF spans February 16–19, while its manifest uses February 17–20.
The GPX exports contain no per-point timestamps. The existing dates remain pending author confirmation.
The [refresh review](../reviews/2026-10-31-blog-and-trip-asset-refresh.md#source-date-conflict) records the evidence.

## Mississippi–Wisconsin 2025

The [manifest](../../src/content/trips/river-wisco-2025.json) is structurally complete for local development.
The [outline](river-wisco-2025-outline.md) contains dated chapters, day maps, five galleries, and writing prompts.

Eight recovered recordings trace an October 7 departure from St. Louis and an October 13 return.
October 11 has two successive recordings. Both belong to the same day.
Together, the retained recordings measure approximately 1,344 miles.
The manifest uses provisional GPS estimates of seven riding days and 1,344 miles.
All seven dates contain sustained movement consistent with riding, including the shorter October 9 loop.
These values remain estimates until the recordings are checked against recollection.

The photo search found JPG and ARW pairs under `Pictures/2025/YYYY-MM-DD`.
Camera timestamps match October 7–9 and 13.
The starter collection preserves 49 unchanged camera JPGs and originally selected 26 for processing.
Two family portraits were excluded. Raw ARW files remain in their original folders.
Photo membership remains provisional until the report is written.

The November 2 album import adds 29 reviewed still images: 14 additional photo IDs and edited exports for 15 existing selections.
Eleven earlier selections remain, giving 40 manifest photos and 122 fingerprinted WebP derivatives.
All imported bytes are preserved under `photos/originals/album-export-2026-11-02/`, including the HEIC's matching MP4.
The HEIC uses a lossless PNG processing copy because the local Sharp installation cannot decode HEVC.
The [photo review](river-wisco-2025-photo-review.md) records each image, capture time, dimensions, gallery, and description.
The Markdown outlines now include `{{trip-gallery:oct-11}}`; add that shortcode to the source Google Doc before re-importing it.
Processed assets are prepared in Drive and the local preview cache; this import does not upload public CDN assets.

The provisional hero is `dsc01078`, a loaded motorcycle beside a wooded road.
Alt descriptions state visible content without assigning uncertain locations.
The manifest records Honda CB500X. Stop coordinates remain unset.

| Day | Working chapter | Gallery |
| --- | --- | --- |
| October 7 | St. Louis, river towns, wooded roads, camp | `oct-07`, 17 photos |
| October 8 | Morning light, fog, small towns, eastern Wisconsin | `oct-08`, 15 photos |
| October 9 | Local activity in eastern Wisconsin | `oct-09`, 5 photos |
| October 10 | Toward the Milwaukee area | No photos selected |
| October 11 | Milwaukee area to Madison, then local activity | `oct-11`, 1 photo |
| October 12 | Madison to the western Chicago suburbs | No photos selected |
| October 13 | Return to St. Louis | `oct-13`, 2 photos |

Sheet row 7 now links a source Google Doc. Its starter outline imports successfully.
The description remains empty after the October 31, 2026 refresh.
The Sheet remains unpublished.

## ON–QC–New England 2026

The [manifest](../../src/content/trips/on-qc-new-england-2026.json) contains 36 tracks and 37 calendar-day entries.
Day assignments follow timestamps and route continuity.
Thirty-four dates have recordings. Three dates have no source file in the searched archive.

The report has three parts. Its chapter boundaries remain provisional.

| Report | Working chapter dates | Outline |
| --- | --- | --- |
| Part 1: St. Louis to the UP | July 10–16 | [Part 1 outline](on-qc-new-england-2026-part-1-outline.md) |
| Part 2: Canadian Shield, Boreal forest, St. Lawrence | July 17–27 | [Part 2 outline](on-qc-new-england-2026-part-2-outline.md) |
| Part 3: New England, Mid Atlantic, Appalachians | July 28–August 15 | [Part 3 outline](on-qc-new-england-2026-part-3-outline.md) |

The initial recovery added 28 primary recordings to the seven existing files.
The October 31 refresh found and processed `Jul_17,_2026_07_41_40.gpx`, which fills the border-to-Ontario gap.
Its bytes match the GPS archive. Its endpoints are approximately 18 meters and five meters from the neighboring recordings.
Four duplicate exports were excluded after comparing track geometry.
A second July 21 export overlaps the primary recording and reports a different distance.
It is retained under `gps/alternates`, outside the processing input.
The October 11 alternate-style export belongs to Mississippi–Wisconsin and supplies a separate, successive segment.

The combined 2026 route measures approximately 5,578 recorded miles.
That figure includes local activity and does not establish motorcycle mileage.
The manifest uses provisional values of `distanceMiles: 5578` and `ridingDays: 27`.
The riding-day estimate includes likely local rides on July 16, 22, 25, 26, and 28.
It excludes seven dates containing only short local activity and three dates without recordings.
July 17 now contributes one riding day and approximately 440 recorded miles.

### Estimate method

Mileage uses the processor's combined distance, rounded once from the retained full-resolution geometry.
Duplicate and overlapping alternate exports remain excluded.
Missing route segments receive no invented mileage.
Walking and other local activity can slightly increase the recorded totals.

Riding days count distinct dates with at least five miles and ten minutes of sustained movement at 25–160 km/h.
The calculation uses consecutive timestamped fixes no more than five minutes apart.
This working heuristic distinguishes likely rides from short city activity; it cannot identify the vehicle.
The [machine inventory](trip-source-inventory.json) records included and excluded dates for later correction.

| Evidence gap | Current treatment |
| --- | --- |
| July 12 | Chapter prompt; no map or invented route |
| July 14–15 | Recorded endpoints have a discontinuity; retained without joining them |
| July 17 | Recording recovered; day map and outline now cover Sault Ste. Marie through northeastern Ontario |
| July 21 | Primary recording only; overlapping export retained separately |
| August 10 and 13 | Chapter prompts; no assumption that these were rest days |
| Photos | One author-selected July 17 hero; the remaining collection is still needed |
| Motorcycle | The manifest records Honda CB500X |
| Stops | Unset until supplied while writing |

The temporary hero is `20260717-135454`, a loaded motorcycle beside the Arctic Watershed sign.
The original is `Downloads/20260717_135454.jpg`; its EXIF timestamp is July 17, 2026, at 13:54:54.
The unchanged JPG is archived under both `photos/originals` and `photos/selects`.
Processing creates WebP images at 480 × 360, 960 × 720, and 1600 × 1200 pixels.
The manifest supplies responsive URLs and visible-content alt text.
The photograph belongs to the `jul-17` gallery and its matching day entry.
It confirms a photographed stop during the recovered July 17 route.

The manifest now uses the `.json` suffix and supports local atlas and story previews.
The route is available locally at `/data/trips/on-qc-new-england-2026/geo/route.geojson`.

Sheet rows 9–11 have linked source Google Docs and still need complete descriptions.
Use the same `trip_id` for all three reports.
The existing [series columns](TRIP-AUTHORING-README.md#other-manifest-fields) can supply a shared title and orders 1, 2, and 3.
Michigan is absent from the current Sheet tags. Vermont's inclusion needs comparison with the recorded route or recollection.

The imported source Docs retain old `.json.draft` notes. Part 2 still describes July 17 as missing.
The repository and Drive Markdown outlines contain the current hero, gallery, and day-map references.
Apply those changes to the source Docs before publication. Generated MDX remains an import of the source Docs.

## File organization

The destination is `projects/rsmb.tv/trips/<trip-id>` in the `robby@rsmb.tv` Drive account.
Recovered GPS files came from `Fog of World/Import/Archive` in the `rsmbryson@gmail.com` account.
Existing filenames and source bytes were preserved.

| Trip-relative path | Contents |
| --- | --- |
| `source-inventory.json` | Original locations, hashes, timestamps, recovery decisions, and exclusions |
| `gps/originals/` | Eight Mississippi–Wisconsin or 36 Canada/New England primary GPX files |
| `gps/alternates/` | Overlapping July 21 export, excluded from processing |
| `gps/processed/` | Combined route plus one GeoJSON per primary source |
| `photos/originals/` | 49 Mississippi–Wisconsin camera JPGs, 29 album stills and one companion MP4 in its import subfolder, and one 2026 hero JPG |
| `photos/selects/` | 40 Mississippi–Wisconsin selections and one 2026 hero |
| `photos/processed/` | Fingerprinted WebP derivatives and compatibility aliases |
| `asset-metadata.json` | Processing dimensions, file sizes, distances, and warnings |
| `trip-manifest.json` | Snapshot of the repository manifest |
| `*-outline.md` | Starter writing prompts copied from this repository |

The local preview cache is `public/data/trips/<trip-id>`.
Git ignores original media, processed preview assets, and working recovery files under `.cache/trip-inventory`.
Git tracks manifests, outlines, and the source inventory summary.

The atlas reserves orange for Mississippi–Wisconsin and fuchsia for the 2026 loop.
Existing colors retain their assignments.
Seven trips still have named cards, selection outlines, hover titles, and report links for route identification.

## Continuing later

Keep the source Sheet unpublished while drafting.
Use the outlines as prompts; replace bracketed text with your account.
Retain date headings, or update each matching `days[].headingId` after renaming them.

Add future photo originals and selections to the established trip folders.
Run the existing asset preparation command, then update manifest photo entries from `asset-metadata.json`.
The 2026 manifest has a temporary hero; add further photo entries and galleries as selections become available.
Review recorded endpoints, travel modes, photo membership, and public asset availability before publication.

Open work is tracked in [TODO.md](../../TODO.md).
