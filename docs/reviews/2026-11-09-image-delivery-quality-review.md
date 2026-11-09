# Image delivery quality review: November 9, 2026

Baseline: `e12c3e3` and all pending image-delivery changes.
The review covers the generators, card components, HTML metadata, generated assets, tests, and related instructions.

The original optimization improved file size and early image discovery.
Its tests covered successful decoding and the normal publication path.
They did not cover failed optimized requests, an empty publication list, or preload ownership when HTML is reused.

## Findings and fixes

### P2: a failed optimized image left a broken card

`ProjectPreview` offered AVIF and WebP through a `picture` element.
This provides format selection. A failed AVIF request does not itself select the WebP source.
`TripThumbnail` also selected its generated image without a request-failure path.
A missing file or failed request could therefore hide a card image while its original remained available.

[ResponsivePicture](../../src/components/ResponsivePicture.tsx) now owns recovery for both callers.
A project preview advances from AVIF to WebP, then to its original screenshot.
A trip thumbnail advances to the original responsive photo.
Each recovery stage runs once. A failed original stops recovery.
A changed source resets recovery without an effect that writes component state.
Alt text, loading priority, display sizes, and dimensions remain attached to the selected image.

Unit regressions for both failures failed before the fix.
Native Chromium and WebKit tests now fail the AVIF request, or both optimized formats, and verify a decoded replacement.
Original-source recovery can transfer a larger file. It is used only after an optimized request fails.

### P2: a valid empty publication list required a media cache

The thumbnail generator resolved `public/data/trips/` before it processed the selected trip IDs.
A valid registry with no published trips therefore failed on a fresh checkout without that ignored directory.

The [generator](../../scripts/generate-trip-thumbnails.js) now resolves the media cache only when published trips need it.
An empty list writes an empty registry and removes obsolete generated thumbnails.
The regression removes the cache and checks successful empty publication.

### P3: preload ownership was separate from metadata ownership

The initial build hook called a separate exported preload helper once.
That normal build path did not produce duplicate hints.
However, the helper always appended a new hint, and the metadata renderer did not remove it when reusing HTML for another route.
The helpers had no shared cleanup contract.

The [metadata renderer](../../scripts/pageMetadataHtml.ts) now owns the homepage hint.
It marks that link, replaces it on repeated calls, and removes it for other canonical pages.
It preserves unrelated template preloads.
The previous build-hook special case is removed.

Tests cover repeated rendering, route changes, unavailable previews, WebP-only previews, and escaped attributes.
Production browser tests hold the app entry script until the responsive image request starts.
The rendered card must then use that same request exactly once at phone and desktop widths.

### P3: source validation accepted credentials and exposed rejected URL values

The original thumbnail check used `URL.origin` to allow the public data host.
That property does not include URL credentials.
The error also included the full rejected URL, which could contain query values or credentials.

The generator now rejects credentials and reports the trip ID without the rejected URL.
It also rejects malformed registry containers, unsafe trip IDs, and filename/manifest ID mismatches.
Tests cover those inputs, alternate hosts, incorrect trip paths, queries, fragments, and source symlinks outside the media directory.
An output symlink is rejected before image writes or removal.

## Maintainability and publication checks

[ResponsiveImage](../../shared/responsiveImage.ts) defines the common image record.
[Project image lookup](../../src/content/projectImages.ts) supplies the same data to React and HTML generation.
Lookup requires an own property. Prototype property names cannot supply a generated image record.
The card wrappers keep only their source-selection rules.

The generators continue to use the shared atomic writer.
New tests verify image-write failure, registry-rename failure, stable repeated output, pruning order, and retention of unrelated files.
The previous registry and referenced files survive a failed replacement.
Temporary files are removed after failed writes.

The original file-size improvements remain:

| Asset | Before | After |
| --- | ---: | ---: |
| Main 960-pixel AVIF preview | 155,346 bytes | 80,711 bytes |
| All generated AVIF previews | 1,194,935 bytes | 681,566 bytes |
| Three trip thumbnails at standard density | About 54 KiB in the supplied audit | 4,604 bytes |

These are file-size comparisons. They are not a new Lighthouse score or field performance result.

## Tests and coverage

Final validation passed:

- 2,899 JavaScript tests in 194 files.
- 17 Python tests.
- 141 focused image and metadata tests.
- 34 native browser tests in Chromium and WebKit.
- Four additional mobile/desktop checks at pixel density 1 and 2.
- Lint, TypeScript checking, and a production-mode bundle build.
- Dependency audit: zero reported vulnerabilities.

The four density checks verify early discovery, one hero download, the selected thumbnail widths, and absence of console errors.
The browser checks use local assets and the configured content security policy.
The standard WebKit launcher lacked host libraries. The final checks used the existing self-contained WebKit bundle and passed.
The production-mode build used a fixture CARTO key. Live provider authorization and deployment were not part of these checks.

Focused V8 coverage improved as follows:

| Measure | Before | After |
| --- | ---: | ---: |
| Lines | 89.33% | 91.73% |
| Statements | 85.66% | 89.79% |
| Functions | 91.30% | 94.11% |
| Branches | 74.88% | 85.48% |

This is scoped coverage, not whole-repository coverage.
The initial scope has six modules. The final scope also includes the new shared picture component and project lookup module.
All four image UI/lookup modules have 100% line and branch coverage in the focused run.
The generators and metadata renderer retain some uncovered defensive and command-entry paths.
The [coverage record](../performance/2026-11-09-image-delivery-review-coverage.json) contains the counts, file lists, and commands.

## Documentation and remaining checks

[Image delivery](../image-assets.md) is the current guide for source preparation, encoding, recovery, and preload tests.
README, the shared-module guide, the metadata guide, and trip publication steps link to those instructions.
The changed instructions use short, active sentences and direct commands.
Technical identifiers remain unchanged. No formal ADS-STE100 conformance score is claimed.

[TODO.md](../../TODO.md#browser-and-performance-checks) separates physical-device work from automated checks.
Photo and fine map-detail review on a real phone remains open.
The task list retains existing publication and operational work. Completed implementation details stay in this report and Git history.
