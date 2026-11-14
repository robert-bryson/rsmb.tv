# Trip photo quality and responsive delivery

Review date: November 13, 2026.

## Scope and result

All 320 manifest photos have quality-99 viewer exports sized for the display and zoom level.
This includes the 212 photos outside PCH, across six additional trips and eight other reports.
The three ON–QC–New England reports share one manifest and its single selected photo.

The six other trips are Boise, Kalaloch, Ocean Shores, Mississippi–Wisconsin, Route 66ish, and ON–QC–New England.
PCH receives the same delivery policy.
Boise's three excluded duplicate selections stay outside its manifest and this publication.

Inline photos and galleries retain WebP quality 92.
Each viewer JPEG uses quality 99 with 4:4:4 chroma subsampling.
Transparent images use PNG.
Original source files, authored captions, photo order, hero choices, and route data remain unchanged.

## Research and policy

[Google's image-performance guidance](https://web.dev/learn/performance/image-performance) recommends dimensions that match the rendered area and device pixel ratio.
It also explains responsive source selection and modern image formats.
The relevant optimization here is delivery size while preserving the requested encoder quality.

[Google's responsive-image guidance](https://web.dev/learn/design/responsive-images) also supports lazy loading, explicit dimensions, and restrained fetch priorities.
Only the opening hero receives eager loading and high priority.
Article images retain lazy loading, reserved dimensions, and source sizes matched to their actual slots.

[PhotoSwipe's responsive-image API](https://photoswipe.com/getting-started/#responsive-images-with-srcset) updates source sizes as readers zoom.
Its image dimensions describe the largest available source.
The implementation uses that API for the separate quality-99 viewer set.
Page WebP thumbnails remain outside this set.

The [Sharp encoder documentation](https://sharp.pixelplumbing.com/api-output/#jpeg) defines JPEG quality and chroma subsampling independently.
Quality 99 is an encoder setting; it does not establish a fixed percentage of retained source information.
The existing native-resolution exports remain available through zooming and the image link.

| Use | Encoding | Delivery |
| --- | --- | --- |
| Inline photos and galleries | WebP, quality 92 | Responsive source sizes; lazy loading |
| Opening fullscreen view | JPEG, quality 99, 4:4:4 chroma | Size selected for the display and pixel density |
| Zoomed details | Same viewer quality | Larger source selected automatically, through native resolution |
| Transparent viewer images | PNG | Same responsive selection, with alpha preserved |

Viewer widths are 960, 1600, 2400, 3200, and 3840 pixels, below the original width.
Wide panoramas also receive 4800- and 6400-pixel sizes when possible.
Every viewer set ends with its native export.
The manifest updater omits a resized candidate when the native export uses fewer or equal bytes.
The native export then supplies greater resolution with no download penalty.

The viewer prefetches only the next slide.
Content-addressed filenames retain immutable caching.
Existing quality-92 page URLs and native quality-99 URLs remain unchanged.

## Processing and validation

Pipeline revision 4 adds the viewer variants.
Encoding revision 3 retains the existing page and native filenames because their encoded bytes do not change.
The new viewer files use a distinct `view-<width>` suffix.
The local mirror, publisher, importer, manifest updater, and development URL mapper support these files.

The manifests keep viewer sources in `full.srcSet`.
Import validation checks those URLs along with the page and native sources.
The updater rejects mismatched fingerprints, duplicate widths, invalid geometry, and incomplete viewer reports.

The [measurement record](../performance/2026-11-13-trip-responsive-photo-quality.json) contains per-trip file counts, publication checks, and real browser observations.
The manifests reference 1,506 new viewer variants.
Another 74 generated candidates are omitted because their native exports use fewer or equal bytes.
File references were checked against the generated sizes in the local cache and public media bucket.
Representative viewer URLs were checked through the CDN.
Generated files and reports were saved to the existing Drive folders.
Previous processing reports were preserved.

Targeted validation passes 300 unit tests and 12 browser fixture tests.
TypeScript validation also passes.
The browser suites cover desktop Chromium, phone Chromium, and mobile WebKit.
Separate real-report checks cover six reports at two screen profiles, including native-resolution zooming.
The gallery guide also reflects the current three-photo `oregon-coast-overlooks` selection.

## Measured local results

The desktop profile uses a 1440 × 1000 viewport at device pixel ratio 2.
The phone profile uses a 390 × 844 viewport at device pixel ratio 3.
These are encoded file sizes, not network timing predictions.

| Report hero | Native file | Desktop opening | Phone opening |
| --- | ---: | ---: | ---: |
| Boise | 6.80 MB | 5.50 MB | 1.46 MB |
| Kalaloch | 13.48 MB | 4.19 MB | 1.05 MB |
| Ocean Shores | 16.11 MB | 4.65 MB | 1.02 MB |
| Mississippi–Wisconsin | 21.64 MB | 9.76 MB | 2.78 MB |
| Route 66ish | 13.07 MB | 4.76 MB | 1.24 MB |
| ON–QC–New England | 9.80 MB | 7.73 MB | 2.35 MB |

The measured opening sources are 3200 pixels wide on desktop and 1600 pixels on the phone.
Each source covers the rendered dimensions at the tested pixel density.
The native hero was not requested when opening any of these viewers.
Zooming loaded the native source in all 12 checks.
No page errors were observed.

The local development server remains available at `http://localhost:5173`.
Application code was not deployed by this work.
