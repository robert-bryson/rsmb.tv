# PCH 2024 photos and publication

The [manifest](../../src/content/trips/pch-2024.json) contains 108 photos and 32 galleries.
The hero is `dscf9177`: the motorcycle above the Mendocino coast.
Each day uses its matching full-day gallery through `days[].galleryId`.
Day heading IDs match the current city-to-city chapter titles.

## Source locations

The Drive trip folder is `projects/rsmb.tv/trips/pch-2024`.
Keep the writing source and image files there.

| Path within the trip folder | Use |
| --- | --- |
| `pch-2024-outline.md` | Writing prompts and media placements |
| `photos/originals/` | Original photos with unchanged filenames and contents |
| `photos/selects/` | Photos selected for processing |
| `photos/processed/` | Responsive WebP files and full-resolution JPEG/PNG exports |
| `gps/originals/` | GPX source files, with the final privacy cut applied |
| `gps/processed/` | Generated route files |
| `asset-metadata.json` | Generated filenames, dimensions, file sizes, and processing warnings |

The local preview cache is `public/data/trips/pch-2024/`.
Git ignores this cache.
The application loads the `.json` manifest for local preview.

For privacy, the October 7 GPX source omits the last two miles and the endpoint waypoint.
The daily and combined GeoJSON routes use that trimmed source.
Keep this cutoff when preparing or publishing the trip again.

## Verified assets

The November 15, 2026 check covered all 108 photo sets and six GeoJSON route files.
The photo sets contain 1,283 responsive images and full-resolution files.
All files are hosted under `https://data.rsmb.tv/trips/pch-2024/`.
Hosted file hashes match the prepared files.
Public URL, content type, cache, and CORS checks passed.
The final-day privacy cutoff remains intact.
The full-resolution photo exports contain no EXIF, XMP, or IPTC metadata.
Repeat the asset checks after changing a source file or processing setting.

## Use in the story

The source Google Doc contains the current report.
Use the placement tables below when editing its photos.
Paste each shortcode into a separate Normal text paragraph in the source Google Doc.
Use a full-day gallery or its smaller scene galleries at each story location.
This choice prevents repeated photos.
Day assignments do not insert galleries automatically.

| Shortcode | Photos | Suggested placement |
| --- | ---: | --- |
| `{{trip-gallery:pre-trip}}` | 4 | October 1 — Seattle before departure |
| `{{trip-gallery:day-one}}` | 6 | October 3 — Seattle to Centralia |
| `{{trip-gallery:day-two}}` | 13 | October 4 — Centralia to Reedsport |
| `{{trip-gallery:day-two-2}}` | 2 | October 4 — Beach and forested headland |
| `{{trip-gallery:day-three}}` | 34 | October 5 — Reedsport to Fort Bragg |
| `{{trip-gallery:day-three-1}}` | 2 | October 5 — Morning river views |
| `{{trip-gallery:day-three-2}}` | 2 | October 5 — Coastal headlands and Victorian house |
| `{{trip-gallery:day-three-3}}` | 5 | October 5 — Beach stops, tree arch, and evening bridge |
| `{{trip-gallery:day-four}}` | 43 | October 6 — Fort Bragg to Bridgeport |
| `{{trip-gallery:day-four-1}}` | 2 | October 6 — Lake views after the two inline morning photos |
| `{{trip-gallery:day-four-2}}` | 3 | October 6 — Forest, granite ridges, and mountain lake |
| `{{trip-gallery:day-four-3}}` | 3 | October 6 — Pass sign, mountain lake, and autumn trees after the panorama |
| `{{trip-gallery:day-five}}` | 7 | October 7 — Bridgeport to Valley Center |
| `{{trip-gallery:oregon-coast-overlooks}}` | 3 | October 4 — Beaches, headlands, and wooded overlooks |
| `{{trip-gallery:lakeside-reflections}}` | 3 | October 4 — Lake, dock, and reflections |
| `{{trip-gallery:oregon-coast-morning}}` | 3 | October 5 — Lighthouse and sea stacks |
| `{{trip-gallery:southern-oregon-coast}}` | 10 | October 5 — Lunch, harbor, and southern Oregon beaches |
| `{{trip-gallery:langlois-lunch}}` | 2 | October 5 — The lunch stop before Port Orford |
| `{{trip-gallery:port-orford}}` | 2 | October 5 — Harbor and motorcycle details beside the separate bay panorama |
| `{{trip-gallery:southern-oregon-beaches}}` | 4 | October 5 — Sea arch, misty coast, and beach stops after Port Orford |
| `{{trip-gallery:california-and-redwoods}}` | 4 | October 5 — Redwood forest and roadside motorcycle |
| `{{trip-gallery:mendocino-coast-evening}}` | 6 | October 5 — Coastal riding and motorcycle overlook |
| `{{trip-gallery:inland-california}}` | 4 | October 6 — Foothills, stream, and ranchland |
| `{{trip-gallery:sierra-crossing}}` | 7 | October 6 — Mountain meadows, roads, and roadside buildings |
| `{{trip-gallery:eastern-sierra-valleys}}` | 6 | October 6 — River stop and open valleys; panorama placed separately |
| `{{trip-gallery:bridgeport-evening}}` | 9 | October 6 — Motel room, town walk, church, and sunset |
| `{{trip-gallery:bridgeport-night}}` | 4 | October 6 — Cow sculpture, river, bar, and motel at night |
| `{{trip-gallery:eastern-sierra-morning}}` | 4 | October 7 — Autumn trees, lake view, and granite mountains |
| `{{trip-gallery:desert-homeward}}` | 2 | October 7 — Open desert after the inline park photo |
| `{{trip-gallery:highlights}}` | 9 | A first edit of the whole trip |
| `{{trip-gallery:motorcycle-stops}}` | 10 | Rider, motorcycle, roadside stops, and changing landscapes |
| `{{trip-gallery:panoramas}}` | 6 | All six panorama exports |

The `highlights`, `motorcycle-stops`, and `panoramas` galleries are optional selections.
They overlap the daily galleries.
Keep full-day galleries referenced by `days[].galleryId`.
Remove a gallery definition only when no day or story placement uses it.

The report places `{{trip-photo:20241003-150610}}` separately in the October 3 text.
Keep this photo in the manifest. Exclude it from `day-one` to prevent a repeated photo.
The full-day galleries contain 103 photos. The inline placement supplies the remaining trip-day photo.
The separate `pre-trip` gallery contains four October 1 photos.
Place `{{trip-gallery:pre-trip}}` in the preparation section, before the October 3 chapter.
For an inline forest-road photo, place `{{trip-photo:r003203}}` between the restaurant and coastal overlooks.
If you use this placement, omit that photo from other galleries in the same story.

The source story uses the lunch, harbor, and beach galleries instead of `southern-oregon-coast`.
It places all six panorama exports separately.
It omits three scene photos: `dscf9130`, `20241006-173636`, and `r003242`.
These photos remain in the manifest, full-day galleries, and hero viewer.

### October 6 and 7 scene placements

The October 6 edit splits the lake and mountain scenes into three smaller galleries.
Use these inline photos with those scene galleries:

| Shortcode | Placement |
| --- | --- |
| `{{trip-photo:20241006-075214}}` | Morning coast, before departure from Fort Bragg |
| `{{trip-photo:20241006-085052}}` | Road inland, before `day-four-1` |
| `{{trip-photo-pano:dscf9240-pano}}` | Mountain panorama, between `day-four-2` and `day-four-3` |
| `{{trip-photo-pano:dscf9279-pano}}` | Open valley, after `eastern-sierra-valleys` |
| `{{trip-photo:r003259}}` | October 7 park stop, before `desert-homeward` |

The scene galleries exclude these inline photos.
The complete `day-four` and `day-five` galleries retain them.
Use either the complete day gallery or its scene placements in one story.
Check the imported story for repeated or missing photo IDs after each source edit.

Use these photo shortcodes for panoramas across the full page width:

| Shortcode | Visible subject | Largest prepared width |
| --- | --- | ---: |
| `{{trip-photo-pano:dscf9130-pano}}` | A wide panorama of a blue bay, offshore rocks, a distant headland, and a harbor pier. | 7672 px |
| `{{trip-photo-pano:dscf9240-pano}}` | A wide mountain panorama with granite ridges, forested valleys, and a winding roadside guardrail. | 7680 px |
| `{{trip-photo-pano:dscf9279-pano}}` | A wide panorama of grazing cattle in an open valley beneath cloud-covered mountains. | 7680 px |
| `{{trip-photo-pano:r003242-pano}}` | A wide panorama of golden autumn trees, open sagebrush, and rounded mountain peaks. | 6420 px |
| `{{trip-photo-pano:r003247-pano}}` | A broad valley descending toward a blue lake with a mountain wall along one side. | 3840 px |
| `{{trip-photo-pano:r003254-pano}}` | A wide panorama of a pale granite mountain above a dry valley and scattered trees. | 6716 px |

The fullscreen viewer selects a quality-99 image for the display and zoom level.
Native dimensions remain available when zooming, including the 8505-pixel mountain panorama.
Linked panoramas join the galleries in story order when readers use the viewer arrows.

## Dates and order

Photo dates cover October 1–7, 2024.
The four October 1 photos belong only to `pre-trip`.
The riding dates remain October 3–7, 2024.
The photo inventory follows recorded camera times.
The November 13 addition, `20241006-075214`, starts `day-four`.
The source story now places it inline, outside `inland-california`.
Its camera timestamp is October 6 at 07:52:14, with a recorded UTC offset of −07:00.
It shows the coast before the morning departure from Fort Bragg.
The October 4 gallery puts the coast and lake stops before the motel arrival.
This order follows the GPS route.

The Ricoh files have no timezone offset.
Their clock appears approximately two hours ahead of local GPS time.
This difference is an inference.
Original timestamps and photo dates are unchanged.

Some Fujifilm GPS positions repeat across different scenes.
Confirm exact place names from the route, visible landmarks, and your own records.

## Publication checks

Use [TODO.md](../../TODO.md#pch-2024) to track completion.

The imported Sheet row was marked published on November 15.
The asset check did not deploy the site.
Earlier copy errors and the Clear Lake and Ridgecrest descriptions are corrected in the current imported source.
Two references still describe other 2024 trips as occurring “last year.”
The final-day subtitle still states 430 miles, while the public route omits the last two miles.
The hero also shows a readable motorcycle plate.

Before the next content deployment:

1. Resolve the two chronology references in the source Google Doc.
2. State whether the final-day distance describes the complete ride or the public route.
3. Decide whether the visible plate fits the intended image privacy level.
4. Verify photo dates, captions, gallery order, and the final GPS cutoff.
5. Import the source with `npm run build-blog:dev`.
6. Check the story at phone and desktop widths.

Assets are already processed and published.
After changing assets, repeat preparation, upload, public URL checks, and manifest validation.
Use the [authoring guide](TRIP-AUTHORING-README.md#6-publish-assets) for those steps.

Use the [import review](../reviews/2026-10-29-pch-content-review.md) for completed processing checks and their limits.
