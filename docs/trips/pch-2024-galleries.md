# PCH 2024 starter galleries

The [manifest](../../src/content/trips/pch-2024.json) contains 99 photos and 23 galleries.
The hero is `dscf9177`: the motorcycle above the Mendocino coast.
Each day uses its matching full-day gallery through `days[].galleryId`.

## Source locations

The Drive trip folder is `projects/rsmb.tv/trips/pch-2024`.
Keep the writing source and image files there.

| Path within the trip folder | Use |
| --- | --- |
| `pch-2024-outline.md` | Writing prompts and media placements |
| `photos/originals/` | Original photos with unchanged filenames and contents |
| `photos/selects/` | Photos selected for processing |
| `photos/processed/` | Generated WebP files |
| `gps/originals/` | Original GPX files |
| `gps/processed/` | Generated route files |
| `asset-metadata.json` | Generated filenames, dimensions, file sizes, and processing warnings |

The local preview cache is `public/data/trips/pch-2024/`.
Git ignores this cache.
The application loads the `.json` manifest for local preview.

## Use in the story

Replace the outline prompts with your own account.
Paste each shortcode into a separate Normal text paragraph in the source Google Doc.
Use a full-day gallery or its smaller scene galleries at each story location.
This choice prevents repeated photos.
Day assignments do not insert galleries automatically.

| Shortcode | Photos | Suggested placement |
| --- | ---: | --- |
| `{{trip-gallery:day-one}}` | 4 | October 3 — Seattle to Centralia |
| `{{trip-gallery:day-two}}` | 12 | October 4 — Centralia to Reedsport |
| `{{trip-gallery:day-three}}` | 34 | October 5 — Reedsport to Fort Bragg |
| `{{trip-gallery:day-four}}` | 42 | October 6 — Fort Bragg to Bridgeport |
| `{{trip-gallery:day-five}}` | 7 | October 7 — Bridgeport to northern San Diego County |
| `{{trip-gallery:oregon-coast-overlooks}}` | 6 | October 4 — Beaches, headlands, and wooded overlooks |
| `{{trip-gallery:lakeside-reflections}}` | 3 | October 4 — Lake, dock, and reflections |
| `{{trip-gallery:oregon-coast-morning}}` | 5 | October 5 — Rivers, lighthouse, and sea stacks |
| `{{trip-gallery:southern-oregon-coast}}` | 10 | October 5 — Lunch, harbor, and southern Oregon beaches |
| `{{trip-gallery:langlois-lunch}}` | 2 | October 5 — The lunch stop before Port Orford |
| `{{trip-gallery:port-orford}}` | 2 | October 5 — Harbor and motorcycle details beside the separate bay panorama |
| `{{trip-gallery:southern-oregon-beaches}}` | 4 | October 5 — Sea arch, misty coast, and beach stops after Port Orford |
| `{{trip-gallery:california-and-redwoods}}` | 7 | October 5 — California border, coast, Victorian house, and redwoods |
| `{{trip-gallery:mendocino-coast-evening}}` | 12 | October 5 — Coastal riding and the evening arrival |
| `{{trip-gallery:inland-california}}` | 7 | October 6 — Leaving the coast, lake, foothills, and ranchland |
| `{{trip-gallery:sierra-crossing}}` | 13 | October 6 — Granite peaks, mountain lake, and autumn color; panorama placed separately |
| `{{trip-gallery:eastern-sierra-valleys}}` | 6 | October 6 — River stop and open valleys; panorama placed separately |
| `{{trip-gallery:bridgeport-evening}}` | 14 | October 6 — Motel arrival, town walk, sunset, and night |
| `{{trip-gallery:eastern-sierra-morning}}` | 4 | October 7 — Autumn trees, lake view, and granite mountains |
| `{{trip-gallery:desert-homeward}}` | 3 | October 7 — Park stop and open desert |
| `{{trip-gallery:highlights}}` | 9 | A first edit of the whole trip |
| `{{trip-gallery:motorcycle-stops}}` | 10 | Rider, motorcycle, roadside stops, and changing landscapes |
| `{{trip-gallery:panoramas}}` | 6 | All six panorama exports |

The `highlights`, `motorcycle-stops`, and `panoramas` galleries are optional selections.
They overlap the daily galleries.
Remove unused definitions after you finish the story's media placements.

The outline uses the lunch, harbor, and beach galleries in place of `southern-oregon-coast`.
It places all six panorama exports separately.
It omits two related source frames: `dscf9130` and `r003242`.
Those alternatives remain in the manifest and full-day galleries.
The outline does not repeat photo IDs across its media placements.

Use these photo shortcodes for panoramas across the full page width:

| Shortcode | Visible subject | Largest prepared width |
| --- | --- | ---: |
| `{{trip-photo-pano:dscf9130-pano}}` | A wide panorama of a blue bay, offshore rocks, a distant headland, and a harbor pier. | 3200 px |
| `{{trip-photo-pano:dscf9240-pano}}` | A wide mountain panorama with granite ridges, forested valleys, and a winding roadside guardrail. | 3200 px |
| `{{trip-photo-pano:dscf9279-pano}}` | A wide panorama of grazing cattle in an open valley beneath cloud-covered mountains. | 3200 px |
| `{{trip-photo-pano:r003242-pano}}` | A wide panorama of golden autumn trees, open sagebrush, and rounded mountain peaks. | 3200 px |
| `{{trip-photo-pano:r003247-pano}}` | A broad valley descending toward a blue lake with a mountain wall along one side. | 1600 px |
| `{{trip-photo-pano:r003254-pano}}` | A wide panorama of a pale granite mountain above a dry valley and scattered trees. | 3200 px |

## Dates and order

Photo dates cover October 3–7, 2024.
The photo inventory follows recorded camera times.
The October 4 gallery puts the coast and lake stops before the motel arrival.
This order follows the GPS route.

The Ricoh files have no timezone offset.
Their clock appears approximately two hours ahead of local GPS time.
This difference is an inference.
Original timestamps and photo dates are unchanged.

Some Fujifilm GPS positions repeat across different scenes.
Confirm exact place names from the route, visible landmarks, and your own records.

## Publication checks

Use [TODO.md](../../TODO.md#pch-2024-trip) to track completion.

1. Replace the outline prompts. Remove author notes and unused media placements.
2. Verify place names, photo dates, captions, and gallery order.
3. Review size warnings in `asset-metadata.json`.
4. Create the source Google Doc. Set its ID in the Sheet's `google_doc_id` column.
5. Apply the Google Docs styles from the [authoring guide](TRIP-AUTHORING-README.md#1-write-the-story).
6. Publish the processed assets. Verify each public photo and route URL.
7. Import the source document. Check the story at phone and desktop widths.
8. Keep the Sheet's `published` value `false` until the checks pass.

Use the [import review](../reviews/2026-10-29-pch-content-review.md) for completed processing checks and their limits.
