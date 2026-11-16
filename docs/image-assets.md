# Image delivery

Use this guide for project previews and trip card thumbnails.
Keep the original images available. They are the last source used after an optimized image fails.

## Project previews

1. Store the source screenshot in `public/images/<project-slug>/`.
2. Use compressed WebP. Do not commit unused JPEG or PNG sources.
3. Set `previewImage` in `src/content/projects.ts`.
4. Run `npm run prepare-project-previews`.
5. Review the generated images at their display sizes.
6. Commit `src/content/project-previews.json` and the files in `public/images/previews/`.

Use a landscape composition for a card. Prepare a landscape source if the screenshot is portrait.
The generator produces 480-, 960-, and 1440-pixel candidates. It does not enlarge small sources.
WebP uses quality 82. AVIF uses quality 35.
Original screenshots remain available on project pages and during error recovery.
Each manifest record stores `sourceHash`, the SHA-256 hash of the source file.
Asset tests compare this hash with the current screenshot.
Replace the generated previews when you change a source, even if its path and dimensions stay the same.

The generator resolves source paths before it reads files.
It rejects sources outside `public/images/` and sources inside its output directory.
Keep the output directory as a regular directory. Do not replace it with a symbolic link.

For each new web capture:

1. Use the production app or a production build with published data.
2. Open a fresh browser context. Use reduced motion and a device scale factor of one.
3. Wait for required data, visible images, fonts, and map tiles.
4. Move the pointer away from controls. Keep map attribution visible.
5. Save WebP at quality 88. Use the dimensions listed below.
6. Update the gallery dimensions, alt text, and caption together.

Use a configured CARTO basemap for site map captures.
Check the image itself. A successful request does not prove that the app has finished rendering.

### Pins screenshot views

Refresh these screenshots after changes to map navigation, controls, or circle presentation.
Capture the running application with its published geographic files and a configured CARTO basemap.

| File in `public/images/pins-of-inaccessibility/` | Map view | Viewport |
| --- | --- | --- |
| `overview.webp` | Default U.S. overview with the explorer and layer dock open | 1440 × 960 |
| `radius-detail.webp` | `?pin=county-51610`, with the explorer hidden and one zoom step out | 1280 × 720 |
| `canada.webp` | `?country=CAN`, with the explorer open | 1440 × 960 |

Use `/projects/pins-of-inaccessibility/map` for these views.
Wait for pins and boundaries.
Open **Map layers** for the overview. Collapse the dock for the other captures.
Keep provider attribution visible.
Check that the location trail and parent action are readable.
The county view must show selected distances and muted surrounding pins.

Update the gallery captions and alt text in `src/pages/PinsOfInaccessibilityAbout.tsx` together.
Run `npm run prepare-project-previews` to refresh the card images and their hashed references.
Keep the project summary and metadata descriptions current with those views.

### ADV Atlas screenshot views

Refresh these screenshots after publishing a report or changing atlas controls, trip cards, or route styling.
Run `npm run sync-blogs` first to verify the published collection.
Capture the production app or a production build with published content, its real route files, and a configured CARTO basemap.
Development previews include drafts and must not be used for these images.

| File in `public/images/adv-atlas/` | View at `/projects/adv-atlas/map` | Viewport |
| --- | --- | --- |
| `adv-atlas.webp` | Default overview, compact cards, all published routes, newest trip first | 1600 × 900 |
| `selected-trip.webp` | `?trip=pch-2024`, compact cards, selected West Coast route with day breaks and endpoint pins | 1600 × 900 |
| `trip-comparison.webp` | `?panel=expanded&results=table`, all published trips and columns in the comparison table | 1800 × 1000 |

Wait for every route and visible trip photograph.
Review the [atlas guide](trips/ADV-ATLAS.md#published-collection-and-screenshots) and update its collection notes and screenshot descriptions together.
Run `npm run prepare-project-previews` to replace the card variants and their fingerprinted references.
Keep the project description, summary, page metadata, and feature changelog current with the app.
Use feature commit dates for changelog entries; a screenshot or report refresh does not change the feature release date.

### Other project screenshot views

The [November 15 presentation review](reviews/2026-11-15-project-presentation-refresh.md) records the checked revisions, feature dates, and capture views.
These web galleries use 1600 × 1000 captures.

| Project | Capture views |
| --- | --- |
| Through Routes | Ozarks curvature map; open basemap and POI layer menu; selected paved road with its loaded profile |
| Bookend | Public demo dashboard; Booker Prize list table; Lincoln in the Bardo detail; reading profile |
| Flights | Atlantic overview; Seattle airport filter; United Kingdom filter using `country=GB` |
| Temperature Records | Recent observations; state extremes using `view=state`; record ages using `view=freshness` |
| Tornado Tracks | Default U.S. archive; selected St. Louis county segment; Trends with charts scrolled into view |
| Status Dashboard | Current Ink compact and detailed views, including a scrolled resource view; labeled example responses |

For Flights, use `anim=false&rotation=false` to keep the globe still.
Bookend captures use `/demo` routes and retain the visible demo label.
For Through Routes, dismiss onboarding, wait for road data, and wait for the selected profile to load.
Its selected-road image must contain the complete highlighted road and a loaded chart.
For Tornado Tracks, wait for the Trends charts independently of map readiness.
Scroll the controls panel to show the annual-count and deaths-per-100-segments charts.
Keep recent temperature counts out of alt text and captions; those counts change with each publication.

Dashboard images use 1280 × 980 frames around actual Ink output from a 112-column, 42-row terminal.
Provide fixed example responses through the polling boundary and keep the real dashboard components and renderer.
Label the images and captions as sample data. Do not present example costs or provider statuses as live measurements.

Update gallery dimensions, alt text, captions, project descriptions, and metadata together.
Run `npm run prepare-project-previews` after replacing source images so cards use new fingerprinted variants.
Projects with no new feature release can retain their feature date and existing representative images after review.

## Social cards

Run `npm run build-og` after changing project titles, summaries, or descriptions.
The generator reads project copy from `src/content/projects.ts`.
It uses `summary` when present, then `description`.
Other page cards use `DEFAULT_PAGES` in `scripts/generate-og-images.js`.
Commit the static PNG and SVG files in `public/og/`.
Blog cards come from the generated post registry and are not committed.

The generator validates both card lists before it changes output.
Slugs must contain lowercase letters, numbers, and single hyphens between words.
Each list must have unique slugs. Titles must contain text. Subtitles must be strings.
Output paths must be directories. The output and blog directories cannot be symbolic links.

All cards must render before the first file write.
Each file uses a temporary file and an atomic rename.
A failed write leaves that target's previous file intact. It also removes the temporary file.
Earlier successful writes can remain if a later write fails. The batch is not a single transaction.
Cleanup runs only after all writes succeed. It removes stale blog PNG and SVG cards with valid generated names.
It preserves other files, directories, and symbolic links.
Invalid metadata or a render failure leaves all previous cards intact.

## Trip card thumbnails

Home and Posts display small trip images. Article photos retain their full responsive CDN sources.

After you publish a trip or change its hero photo:

1. Refresh `src/content/posts.json` with `npm run sync-blogs`.
2. Check the hero URL in `src/content/trips/<trip-id>.json`.
3. Mirror the published hero file under `public/data/trips/<trip-id>/photos/`.
4. Run `npm run prepare-trip-thumbnails`.
5. Review the result at standard and high pixel density.
6. Commit `src/content/trip-thumbnails.json` and `public/images/trip-thumbnails/`.

Trip asset preparation can populate the local media directory. Use the exact file referenced by the manifest.
A changed source fingerprint requires a new local file. An older compatibility alias is not a substitute.
The generator does not download files or write to the CDN.

The generator reads published trip records. It removes duplicate trip IDs and excludes unpublished records.
An empty published list produces an empty registry. It does not require a media cache.
Hero URLs must use HTTPS and the trip's photo path on `data.rsmb.tv`.
Credentials, query parameters, fragments, unsafe IDs, and source links outside the media directory are rejected.
Invalid URLs are reported without their credentials or query values.

The command produces 160- and 320-pixel WebP candidates at quality 75.
It does not enlarge small sources. Home and Posts use the same candidates with their own display sizes.
New heroes use the original responsive photo until their thumbnails are generated.
Local development maps `/data/trips/` hero paths to the matching registry entry.

## File publication and recovery

Both commands write image files through temporary files and atomic renames.
They replace the registry only after all required images are complete.
They remove obsolete generated images after the registry is replaced.
An image or registry write failure retains the previous published references.
Temporary files are removed after a failed write.

Each filename includes a hash of its encoded bytes.
The AVIF hash also includes the `avif-v2:` prefix. Keep this prefix to avoid URLs that cached HTML during the first AVIF release.

`ResponsivePicture` owns browser recovery:

| Image | Request order after a failure |
| --- | --- |
| Project preview | AVIF, WebP, original screenshot |
| Trip thumbnail | Bundled WebP, original responsive photo |

The component advances through each recovery stage once. A failed original stops recovery.
A new image source resets recovery. Alt text, dimensions, loading priority, and display sizes remain in place.
The browser can skip an unsupported image format without a failed request.

## Page image preloads

The HTML metadata renderer emits one responsive preload for the first homepage project image.
`HOME_PROJECT_IMAGE_SIZES` supplies the same sizes to the preload and the rendered card.
Keep those sizes equal. Otherwise, the browser can download two variants.

The preload has high fetch priority. It selects AVIF when available and WebP otherwise.
It omits `href` so browsers without responsive preload support do not fetch an incorrect fixed candidate.
Those browsers use the normal eager image request.
The renderer replaces its own preload on repeated calls. It removes that preload when rendering another route.
Unrelated template preloads remain in place.

Article HTML also preloads the initial trip hero from its validated manifest.
The preload uses the same responsive candidates and `100vw` sizes as `TripHeroGallery`.
It starts before the article module and manifest imports finish.
The metadata renderer owns both hints. It replaces its hint when it renders another route.
Article browser checks block the entry script.
They require one hero request at phone and desktop widths.
They test pixel densities 1 and 2.

## Checks

Run the image unit tests:

```bash
npx vitest run scripts/__tests__/projectAssets.test.tsx scripts/__tests__/projectPreviews.test.ts \
  scripts/__tests__/generateOgImages.test.ts scripts/__tests__/tripThumbnails.test.ts \
  scripts/__tests__/pageMetadata.test.ts src/test/responsivePicture.test.tsx src/test/tripThumbnail.test.tsx
```

Run project image recovery and layout checks:

```bash
npm run test:e2e -- tests/e2e/projects.spec.ts --workers=2
```

Check native preload discovery in a production fixture build:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:page-recovery -- --grep 'image preload|hero preload'
```

The preload check blocks the app entry script. The image must start before React renders.
After the script resumes, the card must use that same request exactly once.
Browsers without responsive preload support skip this capability check.
Review image quality on a physical phone before release. Automated size and decode checks cannot assess visual quality.
The asset tests check every committed gallery's real dimensions and all responsive candidates.
They check source hashes, file hashes, formats, widths, aspect ratios, full decoding, and unused variants.
