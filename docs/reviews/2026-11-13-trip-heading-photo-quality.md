# Trip headings, photo quality, and panorama navigation

Review date: November 13, 2026.

## Heading presentation

Sticky chapter headings now have an opaque background across the usable page width.
Their text stays aligned with the article column.
A subtle bottom border replaces the competing purple text underline.
Ordinary subsection headings retain the article width.

This layout follows the compact, opaque treatment recommended in [NN/g's sticky-header guidance](https://www.nngroup.com/articles/sticky-headers/).
The full-width band is an application choice: maps and panoramas extend beyond the text column underneath it.
It is not a requirement for every heading.

Container-relative widths exclude the browser scrollbar.
The existing chapter-height observer still disables sticky positioning when navigation and a heading would occupy over half the viewport.
Phone controls stay beside the title instead of forming their own row.
The decorative permalink marker is omitted when the title itself supplies the section link.
Headings with links in their content retain their separate permalink control.

## Photo processing and delivery

| Use | Previous output | Current output |
| --- | --- | --- |
| Inline images and galleries | WebP quality 84, usually through 1600 pixels | WebP quality 92, through 3840 pixels |
| Wide panoramas | Through 3200 pixels | Through 7680 pixels, limited by source dimensions |
| Fullscreen viewer | Responsive page image | Native-resolution JPEG at quality 99 and 4:4:4 chroma |
| Fullscreen sources with transparency | Responsive page image | Native-resolution lossless PNG |

The pipeline corrects orientation, preserves proportions, removes embedded metadata, and never enlarges the source.
The encoder settings follow [Sharp's output documentation](https://sharp.pixelplumbing.com/api-output/).
Quality 99 is an encoder setting, not a mathematical claim of retaining exactly 99 percent of the original information.

The manifest's optional `full` entry separates fullscreen delivery from page thumbnails.
The viewer uses its native dimensions and omits the smaller page `srcSet`.
Full-resolution files load when requested, with only the next slide prefetched.
JPEG also accommodates panorama widths beyond WebP's dimension limit.

The update applies to all seven current trip manifests.
Authored captions, dates, gallery order, routes, and hero selections remain unchanged, except for the requested PCH addition.
Boise's three intentionally excluded duplicates remain outside its manifest and the public upload.

Processed files use new fingerprints.
Previous published versions remain available with their original URLs.
The local preview mirror and publisher include fullscreen JPEG and PNG files.
Import validation checks the fullscreen URLs along with the responsive files.

## PCH addition

The new file is `20241006_075214.jpg`, with the photo ID `20241006-075214`.
Its original dimensions are 4000 × 3000 pixels.
EXIF records October 6, 2024, at 07:52:14 with a UTC offset of −07:00.
The October 6 route recording starts at 07:53:56.
The image shows a parking area, coastal vegetation, and the Pacific before the departure from Fort Bragg.

It starts the `day-four` and `inland-california` galleries.
The existing scene shortcode therefore includes it without changing the writing source.
PCH now has 108 photos, 43 entries in `day-four`, and eight in `inland-california`.
The inventory preserves the previous import evidence and records the new file's SHA-256 hash.

## Panorama navigation

Inline images previously created independent lightboxes.
The gallery registry therefore omitted the separately placed panoramas.
Linked inline images now register with the same story collection as galleries.
The viewer snapshots the collection in document order, including collapsed gallery photos.
The hero retains its complete manifest collection.

This follows [PhotoSwipe's collection model](https://photoswipe.com/data-sources/): the supplied collection defines the available slides and their order.
Both arrow directions, keyboard navigation, captions, and focus restoration receive regression coverage.

## Measurements and checks

The [measurement record](../performance/2026-11-13-trip-photo-quality.json) contains asset counts, file sizes, and representative image comparisons.
Pixel comparisons decode each original and its fullscreen export into the same sRGB space.

| Photo | Native dimensions | PSNR | RMS channel error, 0–255 |
| --- | --- | ---: | ---: |
| New October 6 photo | 4000 × 3000 | 50.31 dB | 0.779 |
| PCH hero | 6240 × 4160 | 54.76 dB | 0.466 |
| Autumn panorama | 6420 × 1640 | 52.37 dB | 0.614 |

These comparisons establish small re-encoding differences for the sampled files, not every possible image or display.
The sampled exports contain no EXIF, XMP, or IPTC blocks.

The real PCH preview confirms 1440-pixel desktop and 390-pixel phone heading bands without horizontal overflow.
Desktop heading text starts at the article's 360-pixel inset.
Arrow navigation loads the adjacent autumn panoramas at their native 6420- and 4657-pixel widths.
The new photo resolves through the public CDN as JPEG with immutable caching.

Browser coverage includes desktop Chromium, phone Chromium, and phone WebKit.
The targeted suites pass 371 unit checks and 39 browser checks.
TypeScript validation and the browser fixture builds also pass.
The heading test waits for fragment navigation and simulates reader input before checking subsequent scrolling.
This prevents temporary navigation restoration from racing its programmatic scroll.

The website application is not deployed by this work.
Sheet publication values and source Google Docs remain unchanged.
