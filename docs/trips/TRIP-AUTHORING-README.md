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
| Shortcode | Normal text on a separate line | Trip map, photo, gallery, or facts |

Place a subtitle directly after its heading. Subtitles have no heading ID or table-of-contents entry.
The importer retains inline emphasis and links in subtitles.
Do not use a heading style for distance text such as `(339 mi. / 545 km.)`.

The site creates the story title from the Sheet. Do not repeat that title in the document body.
The Google Docs Title style becomes a level-one heading if you include it in the body.

The importer treats document text as content. It does not execute text inside braces or text that starts with `import` or `export`.
Use a code block for code examples. The importer also accepts matching code fences on separate lines.

### Shortcodes

Put each shortcode on its own line. Use lowercase letters, numbers, and hyphens in IDs.

| Shortcode | Result |
| --- | --- |
| `{{trip-map}}` | Complete available route and numbered stops |
| `{{trip-map:stop-id}}` | Route map centered on a manifest stop |
| `{{trip-map:track:track-id}}` | Selected track with the other tracks dimmed |
| `{{trip-photo:photo-id}}` | One photo and its caption |
| `{{trip-gallery:gallery-id}}` | Gallery from the manifest |
| `{{trip-facts}}` | A second copy of the trip facts |

The header already contains trip facts. Use `{{trip-facts}}` only if the story needs a second copy.
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
Add `--force` to replace existing generated files.

### Photo output

The command corrects orientation, removes metadata, and retains the aspect ratio.
It creates WebP files at quality 95. It does not enlarge the source image.

| Width | Use |
| --- | --- |
| 480 px | Phone display and gallery thumbnail |
| 960 px | Inline photo |
| 1600 px | Header photo and full-screen display |

A source named `Camp at Dusk.jpg` produces files such as `camp-at-dusk-480.webp`.
Use clear, stable filenames. The command stops if two names produce the same output name.
It removes generated WebP files that no longer have a selected source.

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
Use positive integer values for photo dimensions and riding days.
Use a positive number for total distance. Count only days with motorcycle travel as riding days.

Keep the full-trip distance separate from a partial recorded route distance.
Do not invent a missing date or route segment.
List regions in travel order. List gallery photos in story order.

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
Overview maps show the route and track distances. Focused maps show the selected track distance.

Example photo entry:

```json
{
  "id": "camp-at-dusk",
  "src": "https://data.rsmb.tv/trips/ozarks-2012/photos/camp-at-dusk-1600.webp",
  "srcSet": "https://data.rsmb.tv/trips/ozarks-2012/photos/camp-at-dusk-480.webp 480w, https://data.rsmb.tv/trips/ozarks-2012/photos/camp-at-dusk-960.webp 960w, https://data.rsmb.tv/trips/ozarks-2012/photos/camp-at-dusk-1600.webp 1600w",
  "width": 1600,
  "height": 1067,
  "alt": "A tent beside the motorcycle under a red sky.",
  "caption": "The first dry campsite after two days of rain.",
  "date": "2012-05-19"
}
```

The application validates dates, coordinates, dimensions, duplicate IDs, and photo references when it loads the manifest module.
Blog sync checks the file, trip ID, asset URLs, and shortcode references.
It does not compare track IDs with GeoJSON features. Complete that check before publication.

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
Set `TRIP_ASSETS_ON_DEV=false` to skip preparation.

Open `http://localhost:5173/trips/<trip-slug>`.
After an importer change, run `npm run sync-blogs:dev` to replace generated MDX.
Do not edit generated MDX as the content source.

Check desktop and phone widths:

- Confirm that subtitles use small gray text and stay out of the table of contents.
- Open each heading link.
- Confirm that photos load with the correct dimensions and captions.
- Confirm that each map shows the intended track or stop.
- Open and close galleries with a mouse, keyboard, and touch.
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
