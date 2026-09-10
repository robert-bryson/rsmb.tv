# Trip Story Authoring Guide

This guide explains how to publish a motorcycle trip story on rsmb.tv. Each trip combines four pieces:

1. A Google Doc containing the story and layout shortcodes.
2. A row in the `Blog Posts` Google Sheet.
3. A JSON manifest describing the trip, photographs, route, and stops.
4. Source assets organized in Google Drive, backed up to private S3, and processed public assets served through `data.rsmb.tv`.

The finished story appears at `https://rsmb.tv/trips/<trip-slug>`.

## Drive Folder Structure

Use one canonical lowercase trip ID everywhere, such as `ozarks-2012`.

```text
rsmb.tv/
├── publishing/
│   ├── rsmb.tv blog.gsheet
│   ├── trip authoring README
│   └── trip story template
├── posts/
│   └── <post-slug>/
│       └── <post-title>.gdoc
└── trips/
  └── <trip-id>/
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

`originals` contains untouched source files. `selects` contains the photographs chosen for the story. `processed` contains reproducible, publishable derivatives only. Never place originals in a processed directory.

Drive is the working editorial archive. Git stores the trip manifest and application code. A private, non-CDN S3 bucket backs up untouched originals; the public S3/CDN bucket stores only processed media and routes.

## 1. Plan the Story

Organize the trip around meaningful scenes or route legs rather than recording every stop. A strong structure is:

- An opening scene that establishes the trip's mood or central memory.
- A short explanation of why the trip happened.
- A route overview.
- Five to ten chronological chapters.
- An ending that explains what remains memorable.

For each chapter, include a place, a decision or change, a specific detail, and a transition. Use photographs and maps only when they add information.

## 2. Create the Google Doc

Copy the companion **Trip Story Template** into a new Google Doc. Replace all bracketed prompts and remove sections that do not fit the trip.

Use normal Google Docs formatting:

- Document title: Title style
- Major chapters: Heading 2
- Subsections: Heading 3
- Body copy: Normal text
- Shortcodes: A standalone line in Normal text

Do not type the story title as a Heading 1 in the body. The site creates the title, hero photograph, description, tags, and trip facts automatically.

### Available shortcodes

Place each shortcode on its own line with no surrounding text.

| Shortcode | Purpose |
| --- | --- |
| `{{trip-map}}` | Shows the complete route and numbered stops. |
| `{{trip-map:stop-id}}` | Shows the route map focused on one manifest stop. |
| `{{trip-photo:photo-id}}` | Shows one significant photograph with its caption. |
| `{{trip-gallery:gallery-id}}` | Shows a lightbox gallery defined in the manifest. |
| `{{trip-facts}}` | Repeats the trip facts. Usually omit this because facts appear below the hero. |

IDs may contain lowercase letters, numbers, and hyphens. Every photo, gallery, and stop ID used in the Doc must exist in the trip manifest.

## 3. Prepare the Photographs

Place untouched files in:

```text
rsmb.tv/trips/<trip-id>/photos/originals/
```

Copy the photographs chosen for publication into `photos/selects/`. The preparation command writes optimized derivatives into `photos/processed/`; the uploader publishes that directory to:

```text
https://data.rsmb.tv/trips/<trip-id>/photos/
```

Create these sizes when the original is large enough:

| Width | Use |
| --- | --- |
| 480 px | Phone and gallery thumbnail |
| 960 px | Normal inline display |
| 1600 px | Hero and lightbox display |

Use WebP at approximately quality 80–84. Preserve the original aspect ratio, correct orientation, and strip metadata. Review GPS metadata before publishing.

Run the preparer after syncing the trip folder locally:

```bash
npm run prepare-trip-assets -- \
  ozarks-2012 \
  --source "/path/to/rsmb.tv/trips/ozarks-2012"
```

The command corrects orientation, strips image metadata, preserves aspect ratio, and creates WebP derivatives at 480, 960, and 1600 pixels without enlarging smaller originals. Filenames are derived from the selected filename, so `Camp at Dusk.jpg` becomes `camp-at-dusk-480.webp`. Use stable, descriptive selected filenames; duplicate normalized names fail the command.

Review `asset-metadata.json` at the trip root and record the largest derivative's actual width and height in the manifest. These dimensions prevent the page from shifting while images load. Existing derivatives are reused; pass `--force` to rebuild them.

### Alt text and captions

Alt text describes meaningful visual content for someone who cannot see the image:

> The motorcycle parked beside wet Highway 19 beneath dark storm clouds.

A caption adds context that is not obvious from the pixels:

> Waiting out the heaviest rain south of Salem.

Avoid repeating the caption in the alt text. Decorative collection thumbnails use the same source metadata but are hidden from screen readers where the surrounding title already supplies context.

## 4. Prepare the Route

Place untouched GPX exports in `gps/originals/`. The preparation command combines their track and route geometry into `gps/processed/route.geojson`, removes timestamps, names, device details, and all other GPX properties, and preserves only route geometry.

After preparing:

1. Inspect `route.geojson` in QGIS or another trusted GIS tool.
2. Remove private home locations and unrelated track segments.
3. Optionally simplify a very dense track while preserving road geometry.
4. Optionally export a static fallback map as `gps/processed/route-fallback.webp`.

Property removal does not make the coordinates private. Always inspect the start, end, stops, and overnight locations before publishing.

The uploader publishes those files to:

```text
https://data.rsmb.tv/trips/<trip-id>/geo/
```

The route must contain `LineString` or `MultiLineString` geometry. GeoJSON coordinates are ordered `[longitude, latitude]`, not `[latitude, longitude]`.

Important story locations belong in the manifest's `stops` array. Use stable IDs such as `mount-magazine` or `night-one-camp`, then reference them with `{{trip-map:mount-magazine}}`.

## 5. Create the Trip Manifest

Copy:

```text
src/content/trips/_template.json.draft
```

to:

```text
src/content/trips/<trip-id>.json
```

The `id` must match the Sheet `trip_id` value. Add these required fields:

- Trip start and end dates
- A hero photo ID
- GeoJSON and optional static map paths
- Important route stops
- Photograph metadata

You can also add the total distance, motorcycle, broad regions or states, and named gallery groups.

Use these manifest rules:

- Use `YYYY-MM-DD` for each date. The end date must not be before the start date.
- Set `hero` to a photo ID from the `photos` array.
- Use a unique lowercase ID for each photo and stop.
- Put longitude before latitude in each stop coordinate pair.
- Use positive integer values for photo width and height.
- Reference only photo IDs that exist in the manifest when you define a gallery.
- Use a positive number for `distanceMiles` when you include that field.

The blog sync checks each trip shortcode against the matching manifest. The application also validates the complete manifest schema during the build. Both checks stop publication when they find invalid data.

Example photograph entry:

```json
{
  "id": "camp-at-dusk",
  "src": "https://data.rsmb.tv/trips/ozarks-2012/photos/camp-at-dusk-1600.webp",
  "srcSet": "https://data.rsmb.tv/trips/ozarks-2012/photos/camp-at-dusk-480.webp 480w, https://data.rsmb.tv/trips/ozarks-2012/photos/camp-at-dusk-960.webp 960w, https://data.rsmb.tv/trips/ozarks-2012/photos/camp-at-dusk-1600.webp 1600w",
  "width": 1600,
  "height": 1067,
  "alt": "A small tent beside the motorcycle under a red evening sky.",
  "caption": "The first dry campsite after two days of rain.",
  "location": "Buffalo National River, Arkansas",
  "date": "2012-05-19"
}
```

The site validates dates, coordinates, dimensions, duplicate IDs, hero references, and gallery references. An invalid manifest stops the build.

## 6. Prepare, Review, and Publish Assets

Media processing and S3 upload are intentionally separate from `build-blog`. A normal text edit should not require the private Drive archive, image/GPS processing dependencies, AWS credentials, or a large upload.

Prepare the local assets:

```bash
npm run prepare-trip-assets -- \
  ozarks-2012 \
  --source "/path/to/rsmb.tv/trips/ozarks-2012"
```

Review every generated photograph, `gps/processed/route.geojson`, and `asset-metadata.json` before uploading.

Preview the upload:

```bash
TRIP_SOURCE_BUCKET=<private-source-bucket> \
TRIP_ASSET_BUCKET=<public-data-bucket> \
npm run publish-trip-assets -- \
  ozarks-2012 \
  --source "/path/to/rsmb.tv/trips/ozarks-2012" \
  --dry-run
```

Terraform provides the bucket names and the CloudFront distribution ID:

```bash
terraform -chdir=infra output -raw trip_sources_bucket
terraform -chdir=infra output -raw temperature_data_bucket
terraform -chdir=infra output -raw temperature_data_cloudfront_id
```

Use `trip_sources_bucket` for `TRIP_SOURCE_BUCKET`. Use `temperature_data_bucket` for `TRIP_ASSET_BUCKET`. Use `temperature_data_cloudfront_id` for `TRIP_ASSET_CDN_ID`.

Then publish and optionally invalidate CloudFront:

```bash
TRIP_SOURCE_BUCKET=<private-source-bucket> \
TRIP_ASSET_BUCKET=<public-data-bucket> \
TRIP_ASSET_CDN_ID=<distribution-id> \
npm run publish-trip-assets -- \
  ozarks-2012 \
  --source "/path/to/rsmb.tv/trips/ozarks-2012"
```

The publish command does not run preparation. It archives `photos/originals/` and `gps/originals/` in the private source bucket. It uploads only WebP files from `photos/processed/` and GeoJSON or WebP files from `gps/processed/` to the public bucket. It does not upload `selects/`. It does not delete S3 objects.

## 7. Add the Google Sheet Row

Add one row to the `Blog Posts` Sheet:

| Field | Example |
| --- | --- |
| `slug` | `ozarks-2012` |
| `title` | `Three Wet Days in the Ozarks` |
| `date` | `2026-09-09` |
| `description` | `Revisiting a rain-soaked motorcycle loop through Missouri and Arkansas.` |
| `tags` | `Motorcycles, Travel, Missouri, Arkansas` |
| `google_doc_id` | The Google Doc URL or ID |
| `published` | `false` while drafting; `true` when ready |
| `format` | `trip` |
| `trip_id` | `ozarks-2012` |

The Sheet `date` is the publication date. Dates in the trip manifest describe when the trip occurred.

## 8. Review the Layout

Use one significant photograph after several paragraphs rather than creating a wall of images. A practical rhythm is:

- Hero photograph supplied by the manifest
- Two to four opening paragraphs
- Full route map
- One focused photograph or gallery per chapter
- Focused maps only where geography clarifies the story
- A final gallery for worthwhile images that did not fit the narrative

On desktop, photographs and maps break wider than the reading column. On mobile, they fit the viewport. The map uses cooperative gestures so normal page scrolling remains available.

Recommended gallery size is three to nine photographs. Prefer chronological or thematic ordering. Do not place the same photograph both inline and in the immediately adjacent gallery.

## 9. Build and Preview

Run:

```bash
GOOGLE_BLOG_SHEET_ID=<sheet-id> npm run build-blog
npm run dev
```

Open:

```text
http://localhost:5173/trips/<trip-slug>
```

Review desktop and phone widths. Check:

- The opening image loads promptly and is framed well.
- Text remains the primary storytelling surface.
- Every shortcode resolves.
- Captions and dates are accurate.
- Map stops are correctly numbered and located.
- The route does not expose a private home address or unwanted location.
- Galleries open, close, and navigate with mouse, keyboard, and touch.
- There is no repeated title or repeated facts block.

## 10. Publish

Publish processed assets first. Then set `published` to `true`. Run the blog build again, and trigger the Amplify production build. The blog sync stops if the trip manifest is missing, is not valid JSON, or has an incorrect `id`. A Google Doc edit does not deploy the site. A new build must fetch and publish the edit.

## File Checklist

```text
Google Drive/rsmb.tv/trips/<trip-id>/<trip-title>.gdoc
Google Drive/rsmb.tv/trips/<trip-id>/photos/{originals,selects,processed}/
Google Drive/rsmb.tv/trips/<trip-id>/gps/{originals,processed}/
Google Drive/rsmb.tv/publishing/rsmb.tv blog.gsheet
src/content/trips/<trip-id>.json
S3/CDN: trips/<trip-id>/photos/*.webp
S3/CDN: trips/<trip-id>/geo/*.{geojson,webp}
Private S3: trips/<trip-id>/photos/originals/*
Private S3: trips/<trip-id>/gps/originals/*
```
