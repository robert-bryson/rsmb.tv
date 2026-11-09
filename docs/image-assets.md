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

The generator resolves source paths before it reads files.
It rejects sources outside `public/images/` and sources inside its output directory.
Keep the output directory as a regular directory. Do not replace it with a symbolic link.

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

## Homepage preload

The HTML metadata renderer emits one responsive preload for the first homepage project image.
`HOME_PROJECT_IMAGE_SIZES` supplies the same sizes to the preload and the rendered card.
Keep those sizes equal. Otherwise, the browser can download two variants.

The preload has high fetch priority. It selects AVIF when available and WebP otherwise.
It omits `href` so browsers without responsive preload support do not fetch an incorrect fixed candidate.
Those browsers use the normal eager image request.
The renderer replaces its own preload on repeated calls. It removes that preload when rendering another route.
Unrelated template preloads remain in place.

## Checks

Run the image unit tests:

```bash
npx vitest run scripts/__tests__/projectPreviews.test.ts scripts/__tests__/tripThumbnails.test.ts \
  scripts/__tests__/pageMetadata.test.ts src/test/responsivePicture.test.tsx src/test/tripThumbnail.test.tsx
```

Run project image recovery and layout checks:

```bash
npm run test:e2e -- tests/e2e/projects.spec.ts --workers=2
```

Check native preload discovery in a production fixture build:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:page-recovery -- --grep 'homepage image preload'
```

The preload check blocks the app entry script. The image must start before React renders.
After the script resumes, the card must use that same request exactly once.
Browsers without responsive preload support skip this capability check.
Review image quality on a physical phone before release. Automated size and decode checks cannot assess visual quality.
