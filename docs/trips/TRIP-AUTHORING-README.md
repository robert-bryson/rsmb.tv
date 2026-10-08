# Trip story authoring guide

A trip story has four source parts:

1. A Google Doc with the story and shortcodes.
2. A row in the `Blog Posts` Google Sheet.
3. A JSON manifest with trip dates, photos, route tracks, and stops.
4. Source files in Google Drive and processed files at `data.rsmb.tv`.

The public story URL is `https://rsmb.tv/trips/<trip-slug>`.

## Source files

Use one lowercase trip ID, such as `ozarks-2012`, in all source locations.

```text
rsmb.tv/
├── publishing/
│   ├── rsmb.tv blog.gsheet
│   ├── trip authoring README
│   └── trip story template
├── posts/<post-slug>/<post-title>.gdoc
└── trips/<trip-id>/
    ├── <trip-title>.gdoc
    ├── trip-metadata.gdoc
    ├── photos/
    │   ├── originals/
    │   ├── selects/
    │   └── processed/
    └── gps/
        ├── originals/
        └── processed/
```

Keep original files unchanged. Put selected photos in `selects`. Put only generated files in `processed`.

Google Drive contains the source archive. Git contains manifests and application code.
The private S3 bucket contains backup copies of original files.
The public S3 bucket and CDN contain processed photos and routes.

## 1. Write the story

Copy the [story template](TRIP-STORY-TEMPLATE.md) into a Google Doc.
Replace each prompt. Delete unused sections and author instructions.

Use a section for each important route segment or event.
Give the location, action, and result. Add photos and maps where they help explain the event.

Use these Google Docs styles:

| Content | Google Docs style | Site result |
| --- | --- | --- |
| Chapter | Heading 2 | Section heading and table-of-contents link |
| Section in a chapter | Heading 3 | Section heading and table-of-contents link |
| Distance or other supporting text | Subtitle | Small gray paragraph below the heading |
| Story text | Normal text | Body paragraph |
| Shortcode | Normal text in a separate paragraph | Trip map, photo, gallery, or facts |

Place a subtitle directly after its heading. Subtitles have no heading ID or table-of-contents entry.
The importer retains inline emphasis and links in subtitles.
Do not use a heading style for distance text such as `(339 mi. / 545 km.)`.

The site creates the story title from the Sheet. Do not repeat that title in the document body.
The Google Docs Title style becomes a level-one heading if you include it in the body.

The importer treats document text as content. It does not execute text inside braces or text that starts with `import` or `export`.
Use a code block for code examples. The importer also accepts matching code fences on separate lines.

### Shortcodes

Put each shortcode in its own paragraph. Highlighting, bold, and italic formatting are allowed.
Use lowercase letters, numbers, and hyphens in IDs. Shortcodes inside code examples remain literal.

| Shortcode | Result |
| --- | --- |
| `{{trip-map}}` | Complete available route and numbered stops |
| `{{trip-map:stop-id}}` | Route map centered on a manifest stop |
| `{{trip-map:track:track-id}}` | Selected track with the other tracks dimmed |
| `{{trip-photo:photo-id}}` | One photo and its caption |
| `{{trip-gallery:gallery-id}}` | Gallery from the manifest |
| `{{trip-facts}}` | Another copy of the trip facts |

Trip facts appear before the first map, after the opening text.
If the story has no map, facts appear after the story body.
Use `{{trip-facts}}` only if the story needs another copy.
Each referenced ID must exist in the manifest.
Each track ID must also match a `trackId` in the route GeoJSON.

## 2. Prepare photos and routes

Put original photos in `photos/originals`. Copy the selected photos into `photos/selects`.
Put original GPX files in `gps/originals`. Use one GPX file for each day or route segment.

Run this command after you copy the trip folder to the local computer:

```bash
npm run prepare-trip-assets -- \
  ozarks-2012 \
  --source "/path/to/rsmb.tv/trips/ozarks-2012"
```

The command prepares photos and routes. It writes `asset-metadata.json` at the trip root.
It uses existing photo derivatives when the source and processing settings have not changed.
The source bytes and processing settings determine the filename fingerprint.
Add `--force` to regenerate an existing version.

### Photo output

The command corrects orientation, removes metadata, and retains the aspect ratio.
It creates WebP files at quality 84. It does not enlarge the source image.

| Width | Use |
| --- | --- |
| 480 px | Phone display and gallery thumbnail |
| 960 px | Inline photo |
| 1600 px | Header photo and full-screen display |

A source named `Camp at Dusk.jpg` produces files such as `camp-at-dusk-012345abcdef-480.webp` (the fingerprint varies).
Use clear, stable filenames. The command checks all photo IDs before it writes files.
It stops if two source names produce the same photo ID.
It retains versioned files so published URLs remain usable.
It also writes compatibility aliases without fingerprints for older manifests. It removes stale aliases.
The report records each file size. Review files above these limits:

- 100 KB at 480 pixels.
- 300 KB at 960 pixels.
- 800 KB at larger widths.

Copy the largest output width and height from `asset-metadata.json` into the manifest.
Do not assume that each source can produce a 1600-pixel image.

Add alt text that describes the visible content. Add a caption that supplies other useful information.
Do not repeat the caption in the alt text.

### Route output

The command writes these files in `gps/processed`:

- `route.geojson`: All available tracks.
- `track-<track-id>.geojson`: One source GPX file per output file.

The source filename determines the public track ID.
A filename that starts with `YYYY-MM-DD` also supplies the track date.
Do not put private information in source filenames.

The command removes generated route files that no longer have a GPX source.
It does not remove other files from `gps/processed`.

Each route feature retains its track ID, source order, distance, and optional date.
The command removes timestamps, embedded names, and device data.
It does not remove private coordinates.

The command calculates surface distance from the GPX points with the Haversine formula.
It does not include elevation gain. It reports whole miles and kilometers to one decimal place.
The GeoJSON features also contain unrounded distances for later calculations.

The command rejects invalid coordinates. It removes consecutive duplicates and elevation.
It rounds output coordinates to six decimal places.
It calculates distance from the cleaned full-resolution geometry before simplification.
It simplifies each route segment with a 5-meter tolerance. It retains segment endpoints.
Use `--route-tolerance <meters>` to change the tolerance.
Use `--route-tolerance 0` to retain all cleaned coordinates.
`asset-metadata.json` reports the original and output point counts for the complete route and each track.

Review the route before publication:

1. Open `route.geojson` in a GIS tool.
2. Remove private home coordinates and unrelated track segments from the source.
3. Run the preparation command again after source changes.
4. Confirm the start, end, stops, and overnight locations.
5. Confirm that each track contains the expected route segment.

You can add a static map at `gps/processed/route-fallback.webp`.
Add `route.staticImage` to the manifest only when this file exists and is available at its public URL.

## 3. Create the manifest

Copy `src/content/trips/_template.json.draft` to `src/content/trips/<trip-id>.json.draft`.
Replace all placeholder values.

The application loads files with the `.json` suffix.
Rename a structurally complete manifest to `.json` when you need a local preview.
The suffix does not confirm publication. Keep the Sheet `published` value `false` until the public assets pass review.

Set these required fields:

- `id`: The Sheet `trip_id` value.
- `dates.start` and `dates.end`: Dates in `YYYY-MM-DD` format.
- `hero`: An existing photo ID.
- `route.geoJson`: The public route URL.
- `stops`: Route stops with unique IDs and `[longitude, latitude]` coordinates.
- `photos`: Photo IDs, public URLs, dimensions, and alt text.

You can also set `ridingDays`, `distanceMiles`, `motorcycle`, `regions`, and `galleries`.
The motorcycle and region facts link to post filters.
The registry adds these fact tags automatically. It uses lowercase text and replaces spaces with hyphens.
For example, `Honda CB500X` adds `motorcycle` and `honda-cb500x`. `New Mexico` adds `new-mexico`.
Explicit Sheet tags keep their original text.

An optional `days` entry requires `id`, `title`, and `headingId`.
It can also contain `date`, `trackIds`, `stopIds`, and `galleryId`.
Set `headingId` to the generated story heading ID. Referenced tracks, stops, and galleries must exist.
An optional `series` requires `id`, `title`, and a positive integer `order`.
If posts share a manifest, use the Sheet series columns to set each post's order.
Use positive integer values for photo dimensions and riding days.
Use a positive number for total distance. Count only days with motorcycle travel as riding days.

Keep the full-trip distance separate from a partial recorded route distance.
Do not invent a missing date or route segment.
List regions in travel order.
List gallery photos in story order.
Use lowercase letters, numbers, and hyphens in gallery IDs.
Include at least one photo in each gallery.
Include each photo ID only once within a gallery.

A gallery first shows up to nine photos.
Its viewer includes all photos from mounted story galleries, including collapsed photos.
Next and Previous follow the gallery order in the story.
The hero viewer contains every manifest photo, with the hero first.
An inline photo has its own viewer.
Each viewer slide retains the manifest alt text.
Expanding or collapsing the gallery does not change viewer captions or photo order.
Changing the gallery ID starts the new gallery in its collapsed state.
The map retains its instance when only the requested stop changes.
The camera, marker highlight, and stop selection follow that stop.
After a track change, the replacement map restores the selected stop when it loads.
The selected stop can differ from the requested stop after user input.
The full-route action clears the selected stop. A later map load does not restore that stop.
Loading another route clears the previous user selection.

For each entry in `route.tracks`, copy the exact ID from `asset-metadata.json`.
Add a clear name. Add a date only after verification.
Identify reconstructed tracks in their names.

```json
{
  "id": "2026-05-19-day-one",
  "name": "Day one: coastbound",
  "date": "2026-05-19"
}
```

Use the ID in a focused map shortcode: `{{trip-map:track:2026-05-19-day-one}}`.
Overview maps show all available tracks. Focused maps highlight one track.
The facts show the authored trip distance in miles and kilometers. Maps do not calculate a displayed trip total.

Example photo entry:

```json
{
  "id": "camp-at-dusk",
  "src": "https://data.rsmb.tv/trips/ozarks-2012/photos/camp-at-dusk-012345abcdef-1600.webp",
  "srcSet": "https://data.rsmb.tv/trips/ozarks-2012/photos/camp-at-dusk-012345abcdef-480.webp 480w, https://data.rsmb.tv/trips/ozarks-2012/photos/camp-at-dusk-012345abcdef-960.webp 960w, https://data.rsmb.tv/trips/ozarks-2012/photos/camp-at-dusk-012345abcdef-1600.webp 1600w",
  "width": 1600,
  "height": 1067,
  "alt": "A tent beside the motorcycle under a red sky.",
  "caption": "The first dry campsite after two days of rain.",
  "date": "2012-05-19"
}
```

Blog sync and the production build use the same checks for dates, coordinates, dimensions, duplicate IDs, and references.
Sync also checks public asset URLs and shortcode references.
Each route must contain valid line geometry. Declared track IDs must match route features.
Sync checks each unique asset URL with a limited number of concurrent requests.
Invalid drafts do not stop other development content. Production excludes drafts.
Production stops if a published post has no MDX file or a trip has no manifest ID.
Production also stops if the generated post registry is absent.
Run blog sync before a direct Vite production build.
Post slugs must be unique. Post slugs and manifest IDs must use lowercase letters, numbers, and hyphens.

For an existing manifest, apply prepared photo URLs and dimensions without changing captions or alt text:

```bash
npm run update-trip-manifest-assets -- ozarks-2012 --source "/path/to/rsmb.tv/trips/ozarks-2012"
```

Review the manifest diff. Publish the prepared assets before you deploy the manifest.
Each derivative filename must match its photo ID and width.
Derivative widths must be unique. Width and height must be positive integers.
The update command stops if these checks fail. Run preparation again instead of editing the report.

## 4. Add the Sheet row

Add one row to the `Blog Posts` tab:

| Field | Example |
| --- | --- |
| `slug` | `ozarks-2012` |
| `title` | `Three Wet Days in the Ozarks` |
| `date` | `2026-09-09` |
| `description` | `A motorcycle trip through Missouri and Arkansas.` |
| `tags` | `Motorcycles, Travel, Missouri, Arkansas` |
| `google_doc_id` | Google Doc URL or ID |
| `published` | `false` until publication checks pass |
| `format` | `trip` |
| `trip_id` | `ozarks-2012` |
| `series_id` | Optional shared series ID, such as `western-loop` |
| `series_title` | Required with series ID, such as `Western Loop` |
| `series_order` | Required with series ID; positive integer for this post |
| `drive_folder_url` | Optional Drive folder URL for the development panel |

Make the Sheet and Doc accessible through their public export URLs.
Keep asset uploads separate from text changes.

## 5. Preview locally

Set `TRIP_ASSETS_ROOT` in `.env.local` to the local `trips` directory.
WSL also checks `/mnt/g/My Drive/projects/rsmb.tv/trips`.

```bash
npm run dev
```

The command prepares local assets and imports published and unpublished Sheet rows.
It copies WebP and GeoJSON files to `public/data/trips/<trip-id>` for local preview.
This cache is ignored by Git. An incomplete trip does not stop preparation of other trips.
Trips with no selected photos or original GPX files are skipped without changing existing outputs.
The command stages both preview directories before replacement. A failed copy retains the previous preview.
It restores the previous preview if installation fails.
If restoration fails, the backup remains in a hidden directory under `public/data/trips`.
On Drive-backed mounts, native file copying can fail. The fallback uses a temporary file and ordinary reads and writes.
Other copy errors still stop preparation.
Set `TRIP_ASSETS_ON_DEV=false` to skip preparation.

Direct Vite development starts without a generated post registry or trip directory.
An absent post registry produces an empty post list. An absent trip directory produces an empty trip list.
This fallback does not import content. Run `npm run sync-blogs:dev` to create the local post registry.
The development loader watches existing source files only.

Open `http://localhost:5173/trips/<trip-slug>`.
After an importer change, run `npm run sync-blogs:dev` to replace generated MDX.
Do not edit generated MDX as the content source.

Check desktop and phone widths:

- Confirm that subtitles use small gray text and stay out of the table of contents.
- Open each heading link.
- Confirm that photos load with the correct dimensions and captions.
- Confirm that each route preview shows the intended track.
- Scroll the map into view.
- Check its initial stop or track focus.
- Test the basemap icon, stop buttons, and download icon.
- On a focused map, select **Show full route** before you move the map.
- Pan or zoom the map. Check that **Show full route** appears again.
- Open the attribution information button. Check that it closes again.
- Cause a route request to fail. Check that the download link remains available below the map.
- Open and close photos with a mouse, keyboard, and touch.
- Check that focus returns to the opening control.
- Check hover captions and keyboard focus on desktop devices.
- Press Escape while the photo link has focus. Confirm that its caption closes.
- Enable reduced motion. Confirm that captions do not animate.
- Confirm that phone captions remain visible below their photos.
- For galleries with more than nine photos, open the viewer.
- Check that collapsed photos retain their alt text in the viewer.
- Use Next and Previous to move between story galleries.
- Expand the gallery. Confirm that each viewer caption retains the same text and location.
- Open each motorcycle and region link. Check that the result includes this trip.
- Check the previous and next article links. Check that the return link retains the list filter.
- Remove repeated titles and repeated facts.

## 6. Publish assets

Review each processed photo, `route.geojson`, and `asset-metadata.json` before upload.

Read the deployment values:

```bash
terraform -chdir=infra output -raw trip_sources_bucket
terraform -chdir=infra output -raw temperature_data_bucket
terraform -chdir=infra output -raw temperature_data_cloudfront_id
```

Use these values for `TRIP_SOURCE_BUCKET`, `TRIP_ASSET_BUCKET`, and `TRIP_ASSET_CDN_ID`, respectively.

Preview the upload:

```bash
TRIP_SOURCE_BUCKET=<private-source-bucket> \
TRIP_ASSET_BUCKET=<public-data-bucket> \
npm run publish-trip-assets -- \
  ozarks-2012 \
  --source "/path/to/rsmb.tv/trips/ozarks-2012" \
  --dry-run
```

Remove `--dry-run` to upload the files.
Set `TRIP_ASSET_CDN_ID` if the command must invalidate the CDN cache.

The command backs up original photos and GPX files to private S3.
It uploads processed photos to `https://data.rsmb.tv/trips/<trip-id>/photos/`.
It uploads processed routes and static maps to `https://data.rsmb.tv/trips/<trip-id>/geo/`.
It does not prepare files, upload `selects`, or delete S3 objects.
Fingerprinted photos use one-year immutable caching. Legacy aliases and routes use one-hour caching.
A CDN invalidation cannot remove older immutable aliases from browser caches.
Update manifests to use fingerprinted URLs.

## 7. Publish the story

1. Confirm that each public asset URL is available.
2. Set the Sheet `published` value to `true`.
3. Run `GOOGLE_BLOG_SHEET_ID=<sheet-id> npm run build-blog`.
4. Correct each reported error.
5. Start the production build in AWS Amplify.

The asset check tries `HEAD`, then `GET` if necessary. Each request has a 10-second timeout.
Each URL must use `https://data.rsmb.tv/trips/<trip-id>/`.
An unavailable asset stops the production blog sync.
A Google Doc edit does not deploy the site. A new build must import the edit.
