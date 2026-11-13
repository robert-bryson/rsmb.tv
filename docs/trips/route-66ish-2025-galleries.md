# Route 66ish 2025 starter media

The [manifest](../../src/content/trips/route-66ish-2025.json) contains 57 selected photos, eight tracks, nine photographed stops, and 26 galleries.
The [writing outline](route-66ish-2025-outline.md) follows the existing trip reports: opening, preparation, dated chapters, and reflections.
The hero is `r004114`, the motorcycle on a narrow road beside open grassland.

## Source locations

The Drive destination is `projects/rsmb.tv/trips/route-66ish-2025` in the `robby@rsmb.tv` account.
The Markdown outline and this guide are also copied there for writing alongside the source media.

| Path within the trip folder | Use |
| --- | --- |
| `route-66ish-2025-outline.md` | Editable writing prompts and working media placements |
| `route-66ish-2025-galleries.md` | This media reference |
| `trip-manifest.json` | Snapshot of the Git manifest; edit the repository copy for application changes |
| `source-inventory.json` | Archive provenance, original photo/video hashes, EXIF dates, photo coordinates, and uncertainties |
| `photos/originals/` | 57 unchanged original JPG files |
| `photos/selects/` | The same 57 starter selections, ready for a later editorial cut |
| `photos/processed/` | 173 fingerprinted WebP derivatives and 173 compatibility aliases |
| `videos/originals/` | Two unchanged MP4 files from the ZIP |
| `references/` | Route screenshot, four labeled contact sheets, and a copy of the old trip notes |
| `gps/originals/` | Eight unchanged GPX files with their original filenames |
| `gps/source-inventory.json` | Original GPX locations, hashes, timestamps, endpoints, and recorded waypoint metadata |
| `gps/processed/` | Complete route and eight individual track GeoJSON files |
| `asset-metadata.json` | Generated photo dimensions, filenames, file sizes, route distances, and warnings |

The photo source is `Downloads/Back Roads Valley Center to St. Louis-1-001.zip`, downloaded October 30, 2026.
Its 60 entries contain 57 trip photographs, two videos, and one Geo Tracker screenshot.
The screenshot is a reference rather than a selected trip photo.
The original ZIP remains in Downloads.

The tracks came from `Fog of World/Import/Archive` in the `rsmbryson@gmail.com` Drive account.
The source inventory retains their exact original paths and SHA-256 hashes.
No archive files were moved or renamed.

The preview cache is `public/data/trips/route-66ish-2025/`, which Git ignores.
The manifest uses the production CDN URL pattern; creating this groundwork does not upload public assets.

## Route and timeline

The manifest retains May 9–19, 2025 as the provisional requested window.
The available recordings reach St. Louis on May 17.
May 18–19 remain explicit writing placeholders, without invented routes or photos.

| Day | Manifest day ID | Recorded route | Miles | Kilometers | Selected photos |
| --- | --- | --- | ---: | ---: | ---: |
| May 9 | `may-09` | Valley Center to Prescott | 368 | 592.9 | 6 |
| May 10 | `may-10` | Prescott to Springerville | 284 | 457.8 | 11 |
| May 11 | `may-11` | Springerville to Tucumcari | 496 | 798.6 | 10 |
| May 12 | `may-12` | Short Tucumcari evening loop; travel mode unconfirmed | 1 | 1.6 | 2 |
| May 13 | `may-13` | Tucumcari to Shamrock | 372 | 598.7 | 9 |
| May 14 | `may-14` | Shamrock to McAlester | 402 | 646.4 | 9 |
| May 15 | `may-15` | No recording found; endpoints on neighboring days suggest a McAlester layover | — | — | 0 |
| May 16 | `may-16` | McAlester to Harrison | 353 | 567.5 | 7 |
| May 17 | `may-17` | Harrison to St. Louis | 342 | 550.6 | 3 |
| May 18 | `may-18` | Confirm whether this belongs to the trip | — | — | 0 |
| May 19 | `may-19` | Route screenshot saved; confirm actual trip end | — | — | 0 |

The combined recording measures 2,619 mi / 4,214.1 km.
This includes the short May 12 loop and movement around overnight stops.
Individual rounded mileage values need not sum to the rounded combined value.
The manifest uses `distanceMiles: 2619` from the combined recording and `ridingDays: 8` as confirmed by the author.
The distance is a GPS measurement. It is not an odometer total.

Original GPX filenames are not ISO dates. Their IDs are derived from those filenames.
Manifest track dates were checked against embedded timestamps, accounting for the local travel date.
Manifest day order restores chronology even though alphabetical filename order places May 9 last.
No GPX was found for May 15, 18, or 19 in the Import folder or its Archive.

Routes were cleaned and simplified with the existing 5-meter pipeline: 169,821 source points became 15,120 output points.
The combined GeoJSON is 353,701 bytes.
The pipeline strips timestamps, device metadata, and source waypoint names from public route outputs.
Private coordinates still need review before publication.

The nine authored stops use coordinates from photo EXIF, not invented geocoding.
Confirm their precise labels and freshness of the Ricoh GPS fixes against the route.
Photos without usable GPS have no invented map markers.

## Shortcodes

Use `{{trip-map}}` for the overview.
Use `{{trip-map:day:may-09}}`, replacing the ID with the relevant recorded day, for a day map.
The outline includes day maps for all eight actual recordings.
May 15, 18, and 19 have no inline map placements.

Each full-day gallery below is an alternative to its scene galleries and separate image placements.
The outline uses the smaller scenes, placing each of the 57 selected stills once.
Do not insert a full-day gallery alongside all of its scene galleries unless you intend to repeat the photographs.

| Shortcode | Photos | Suggested placement |
| --- | ---: | --- |
| `{{trip-gallery:may-09}}` | 6 | Complete May 9 selection |
| `{{trip-gallery:may-10}}` | 11 | Complete May 10 selection |
| `{{trip-gallery:may-11}}` | 10 | Complete May 11 selection |
| `{{trip-gallery:may-12}}` | 2 | Complete May 12 selection |
| `{{trip-gallery:may-13}}` | 9 | Complete May 13 selection |
| `{{trip-gallery:may-14}}` | 9 | Complete May 14 selection, including the panorama |
| `{{trip-gallery:may-16}}` | 7 | Complete May 16 selection, including the standalone overlook photo |
| `{{trip-gallery:may-17}}` | 3 | Complete May 17 selection |
| `{{trip-gallery:california-desert}}` | 3 | May 9 — Lake, grassy valley, and desert vegetation |
| `{{trip-gallery:dunes-to-arizona}}` | 3 | May 9 — Motorcycle, dunes, and the road east |
| `{{trip-gallery:jerome-and-mountain-overlook}}` | 3 | May 10 — Mountain overlook, brick building, and mining cart |
| `{{trip-gallery:mogollon-rim}}` | 4 | May 10 — Cliffs and forested valleys |
| `{{trip-gallery:arizona-evening}}` | 4 | May 10 — Lodge stop, pines, meadow, and motel |
| `{{trip-gallery:arizona-to-new-mexico}}` | 4 | May 11 — Mountain overlooks and open country |
| `{{trip-gallery:tucumcari-evening}}` | 6 | May 11 — Roadside signs, wildflowers, old buildings, and Motel Safari |
| `{{trip-gallery:tucumcari-layover}}` | 2 | May 12 — Storefront and Tee Pee Curios |
| `{{trip-gallery:texas-plains-and-wildflowers}}` | 2 | May 13 — Open plain and orange flowers |
| `{{trip-gallery:texas-canyons}}` | 4 | May 13 — Canyon overlooks, picnic shelter, and salt flat |
| `{{trip-gallery:shamrock-evening}}` | 3 | May 13 — Mural, painted door, and U-Drop Inn |
| `{{trip-gallery:oklahoma-backroads}}` | 2 | May 14 — Farmhouse and lake; panorama follows separately |
| `{{trip-gallery:wichita-mountains}}` | 3 | May 14 — Cattle, granite hills, and curving mountain road |
| `{{trip-gallery:oklahoma-evening}}` | 3 | May 14 — Storefront, pond, and downtown |
| `{{trip-gallery:arkansas-mountains-and-river}}` | 3 | May 16 — Misty hills, river, and roadside building |
| `{{trip-gallery:ozarks-evening}}` | 3 | May 16 — Open field and ornate storefronts |
| `{{trip-gallery:ozarks-rivers}}` | 3 | May 17 — Ferry crossing, picnic stop, and river |
| `{{trip-gallery:highlights}}` | 9 | Optional shorter edit of the whole trip |

The outline uses `{{trip-photo:20250516-142741}}` for the standalone overlook image on May 16.
Every photo also remains accessible through its date gallery and the hero viewer.
Remove unused optional galleries after choosing the final story placements.

## Panorama and video choices

Use `{{trip-photo-pano:r004251}}` for the straight Oklahoma road across green fields on May 14.
The source is already wide at 6000 × 2342; it produces 480, 960, 1600, 2400, and 3200-pixel derivatives.
The largest is 3200 × 1249.
The panorama shortcode places this existing photograph across the page width without changing the original crop.
No new stitched panoramas were created.

`r003940` is another broad landscape, but its source ratio is below the panorama processing threshold.
It remains in the May 9 scene gallery with outputs through 1600 pixels.

The two videos are `20250510_132140.mp4` and `20250513_162552.mp4`.
They remain unchanged in `videos/originals/`.
The outline marks possible positions near the rim views and Texas salt flat.
Review the clips before choosing edits, audio treatment, posters, or animation manifest entries.
There are no placeholder animation IDs or broken video embeds.

## Dates, ordering, and file sizes

Photo dates use EXIF `DateTimeOriginal`, not ZIP download timestamps.
Gallery order follows recorded camera times within each date.
Samsung photos include timezone offsets; Ricoh files do not.
Many Ricoh photos have no usable GPS fix.
The original bytes, filenames, and metadata are unchanged.
There are no byte-identical duplicates among the 57 stills.

The old Obsidian notes label the initial departure and the Springerville departure one day later than the GPX and image evidence.
Their descriptions remain useful prompts, with the date conflict called out in the outline.
The May 19 screenshot establishes its capture date rather than another travel day.

The versioned images total 28,216,900 bytes, excluding compatibility aliases.
The processor reports five size advisories across two leafy images:

- `20250517-151118`: 308,234 bytes at 960 px and 893,570 bytes at 1600 px.
- `r004357`: 130,840 bytes at 480 px, 520,602 bytes at 960 px, and 1,400,526 bytes at 1600 px.

Review those images when making the final selection. Existing processing settings were retained.

## Publication checks

Track remaining work in [TODO.md](../../TODO.md#route-66ish-2025).

1. Confirm the trip end date, May 15 activities, and May 18–19 membership.
2. Confirm the motorcycle and distance used in the final story.
3. Replace the outline prompts with your account.
4. Confirm named places, mixed-camera order, stop coordinates, and captions.
5. Review route endpoints for private coordinates.
6. Remove unrelated movement before regenerating public route files.
7. Review the five photo-size advisories.
8. Choose final galleries, the hero, and any video edits.
9. Continue the source Google Doc already linked in the unpublished Sheet row.
10. Add a final description to that row.
11. Import the document.
12. Verify heading links and media placements.
13. Check the story at phone and desktop widths.
14. Upload processed assets.
15. Verify every public URL before changing the Sheet's `published` value from `false`.

Suggested description: “A motorcycle ride from Valley Center to St. Louis through desert roads, Route 66 towns, canyon country, and the Ozarks.”

The Markdown outline provides starter structure. Continue the story in the source Google Doc linked in the Sheet.
The importer generates the ignored MDX copy and unpublished local registry entry for preview.
Run `GOOGLE_BLOG_SYNC_ON_DEV=0 TRIP_ASSETS_ON_DEV=0 npm run dev`.
Open `/trips/route-66ish-2025`.
Google Docs sync owns the generated blog files and can replace local edits.
Make story changes in the linked source document.
The local description is a suggestion; the source Sheet still needs its final description.
