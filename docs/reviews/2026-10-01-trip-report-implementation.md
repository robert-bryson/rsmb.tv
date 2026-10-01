# Trip report implementation and review - 2026-10-01

This report covers the pending trip changes and the later code review.
The earlier [audit](2026-10-01-trip-report-audit.md) records the initial findings.
Infrastructure and CDN assets have not been deployed.

## Review scope

The review covers content loading, manifests, route geometry, asset processing, publication, article metadata, navigation, and tests.
It does not certify every feature in the repository.
Existing changes were retained. No Google document, Sheet row, or private source file was changed.

## Additional defects and corrections

### P1: invalid routes could pass publication checks

Sync parsed route bodies only when a manifest declared tracks.
A route without declared tracks could return HTTP 200 with HTML or invalid GeoJSON and pass the check.
Readers then received an unusable route.

Sync now parses every published route body and requires valid line geometry.
It still compares declared track IDs with route features.
Regression tests reject HTML and missing coordinates when no tracks are declared.
See [publication checks](../../scripts/sync-blogs.js) and [sync tests](../../scripts/__tests__/syncBlogs.test.ts).

### P1: a missing published body did not stop the build

The Vite plugin omitted loaders for missing MDX files.
The generated registry still listed the published article, but the reader received a placeholder instead of its body.

Production now stops with the post slug in the error message.
Development can still show a placeholder for incomplete content.
Unpublished drafts remain excluded from production.
The plugin also checks slugs before filesystem access and watches the expected MDX file.
See [the content plugin](../../scripts/trip-content-plugin.ts) and [contract tests](../../scripts/__tests__/tripContent.test.ts).

### P2: route validation could throw on unknown input

The shared geometry check assumed that `coordinates` and each line were arrays.
Missing coordinates, strings, and null lines could cause a TypeError instead of returning `false`.
Feature properties were not checked against the GeoJSON contract.

The check now accepts unknown input and checks each object and array before use.
It permits object or null properties. It rejects arrays and missing properties.
Tests cover malformed geometry, coordinate bounds, and valid line collections.
See [route geometry](../../shared/routeGeometry.ts).

### P2: retry left unused route requests active

Retry removed the cache entry before effect cleanup.
Cleanup aborted a request only if that entry remained in the cache.
The unused request could continue until its ten-second deadline.

Cleanup now cancels a pending request when it has no readers.
The cache identity check prevents old cleanup from removing a replacement request.
A regression test checks the old and new request signals.
See [the route hook](../../src/features/trips/useTripRoute.ts) and [loader tests](../../src/test/tripRouteLoading.test.tsx).

### P2: the route cache did not shrink after readers left

Cache eviction ran only when a request completed.
If more than eight requests completed with active readers, release did not remove the excess entries.

The same eviction function now runs on completion and release.
Active readers retain their routes. Unused completed entries are removed until the cache has at most eight entries.
A test opens nine routes, releases them, and confirms eviction.

### P2: asset reports could create incorrect public URLs

The manifest updater checked only the filename suffix.
It accepted path separators, wrong photo IDs, mismatched widths, and duplicate width descriptors.
It checked only the largest derivative's dimensions through the final manifest schema.

Each derivative now requires a filename that matches its photo ID, fingerprint, and width.
Widths must be unique. Width and height must be positive integers.
Tests cover invalid names, paths, dimensions, and duplicate widths.
See [the manifest updater](../../scripts/update-trip-manifest-assets.js).

### P3: emphasized links did not retain the link color

Bold, emphasized, and code text supplied fixed colors inside MDX links.
The link hover color did not apply to those children.

The shared anchor now makes child text inherit its color.
Unit and production browser tests check the contract.
Desktop tests check the hover state. Phone tests check normal text colors.
See [MDX components](../../src/blog/MdxComponents.tsx) and [reading tests](../../tests/trips/reading.spec.ts).

## Reader experience

- The title and hero lead into the opening text. Facts appear before the first map. Contents and shortcut links follow that map.
- Phone cards retain photos, distance, and day counts.
- Inline photos, galleries, and the hero use the same viewer. Keyboard controls and focus return are available.
- Large galleries first show six tiles. The viewer retains all photos.
- Image size hints match each layout. Failed photos retain their dimensions and captions.
- Interactive maps load when their section enters the viewport or the reader selects them.
- Local error boundaries retain the story when WebGL is unavailable.
- Stop buttons support keyboard and touch. They show stop details and move the camera after delayed route loading.
- Map style controls and a full-route reset are available. Recorded distance remains separate from the complete trip total.
- Contents can expand or collapse. The header becomes visible when it receives focus.
- Return links retain list filters. Reports also have return and related-story links at the end.
- Optional day and series records provide links between headings and related posts.

## Architecture and publication

The Vite plugin builds small summaries and asynchronous manifest and MDX registries.
Production excludes unpublished drafts, including invalid draft MDX and incomplete manifests.
Sync and build use the same manifest schema. That schema also supplies TypeScript types.
Features share route geometry, distance calculations, and the reduced-motion hook.

Asset checks use unique URLs, limited concurrency, and combined error messages.
Photo preparation uses source bytes and processing settings for filename fingerprints.
It writes quality-84 WebP and records file sizes and review warnings.
Fingerprinted photos use immutable caching. Legacy aliases use shorter caching.
Published versions are retained. The migration command retains captions and alt text.

Published articles receive title, description, canonical URL, social image, date, and escaped JSON-LD in HTML.
Client navigation updates article metadata without repeating the site name.
The browser still renders article bodies. The generated HTML contains metadata, not a static story body.

## Earlier measurements

These measurements belong to the earlier implementation check.
They used local production preview with local Ocean Shores photos at 1440-pixel and 390-pixel widths.
They are not field Core Web Vitals.

| Measurement | Audit baseline | After implementation |
| --- | ---: | ---: |
| Posts index initial encoded JavaScript | about 932 KB | 85,740 bytes |
| Ocean Shores initial encoded JavaScript | Maps/globe loaded eagerly | 128,793 bytes |
| Initial reading-path WebGL canvases | Map created on report mount | 0 before map activation |
| Horizontal overflow / uncaught browser errors | Failure reproduced without WebGL | None in the reviewed desktop/phone reading paths |

Three 1600px samples compared quality 95 with quality 84:

| Photograph | Quality 95 | Quality 84 | Reduction |
| --- | ---: | ---: | ---: |
| Beach | 334,508 bytes | 71,852 bytes | 79% |
| Bog | 1,125,506 bytes | 722,498 bytes | 36% |
| Seattle skyline | 553,116 bytes | 293,118 bytes | 47% |

Beach gradients and bog detail were inspected.
These are sample results. Current CDN assets have not changed.
Prepare and publish new derivatives to apply these size reductions.

## Validation

The initial review check passed 1,035 Vitest tests and 17 Python tests.
The dependency audit reported zero vulnerabilities.
The initial production trip suite passed 18 desktop and phone Chromium tests.
The later link-color check passed both Chromium projects.
Final verification passed after all changes:

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript | Passed |
| Vitest | 1,048 tests passed in 79 files |
| Python | 17 tests passed |
| Browser smoke tests | 8 tests passed |
| Production trip browser tests | 20 tests passed |
| Dependency audit | Zero vulnerabilities |
| Documentation diagnostics | No errors in the updated documents |
| Patch whitespace | Passed |

This review added 25 unit test cases and two browser test executions.
The production fixture build passed. Full Google-backed publication was not run.
The build still reports a Tailwind source-map warning and a large Flights chunk warning.
These warnings do not stop the build. The reading-page JavaScript limits pass.

The focused coverage run passed 107 tests in five files.
It covered six reviewed source files. These figures are not repository-wide coverage.

| Source | Line coverage | Branch coverage |
| --- | ---: | ---: |
| Route loading hook | 100% | 94.28% |
| Shared route geometry | 97.56% | 89.28% |
| Manifest asset updater | 72.72% | 72.72% |
| Content plugin | 43.03% | 26.66% |
| Blog sync | 90.77% | 78.44% |
| MDX components | 50% | 100% |

Plugin unit coverage remains low. Browser tests also exercise its build output.
The remaining unit gaps include plugin preview and update hooks, CLI entry points, and unrelated MDX elements.
No before-and-after coverage percentage is available for the same source set.
The added regressions cover previously untested failure paths.

WebKit cannot launch on this host because required system libraries are absent.
CI installs browser dependencies and enables WebKit. A local Safari pass is not claimed.

## Rollout and remaining work

1. Review and apply the Amplify article rewrite rules in `infra/main.tf`. Check article metadata on the production host.
2. Prepare and review new photos. Update manifests, upload the files, and then deploy the site.
3. Keep Boise unpublished until its asset and editorial checks pass.
4. Measure LCP, CLS, and INP before setting limits. Photo size warnings currently require manual review.
5. Test successful maps and fixed basemap responses in WebKit. Test list scroll restoration after delayed content loads.
6. Remove distant active maps when safe. Map instances currently remain mounted after activation.

See [open tasks](../../TODO.md). Do not treat a passing fixture build as proof that live CDN assets or infrastructure are ready.
