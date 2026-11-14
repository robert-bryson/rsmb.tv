# Site quality review — November 13, 2026

This review covers the pending map, trip media, heading, and document-import changes.
It also covers their build scripts, manifests, shared modules, and direct consumers.
The site version changes from 0.3.1 to 0.3.2.

## Findings and corrections

### High: the release build included the local trip cache

Vite copied every file from `public/`, including the ignored development trip mirror.
That mirror occupied 16 GB in the reviewed workspace.
A local release build would package these files, including unused versions and draft media.
Hosted stories already use media URLs from the content delivery network (CDN).

The [public asset plugin](../../scripts/public-assets-plugin.ts) excludes `public/data/trips/` before it traverses that directory.
It preserves other public assets, bundled trip animations, generated HTML, and the local source cache.
Production and hosted development builds use this rule.
Fixture builds retain their explicit option to skip public file copying.

Real build tests cover both modes, custom public directories, disabled copying, missing directories, and disabled output.
They also verify that public files cannot overwrite generated HTML.
An output directory inside the public source is rejected to prevent recursive copies.

The actual production bundle completes with no trip mirror in its output.
The [measurement record](../performance/2026-11-13-site-quality-review.json) gives its size and validation results.

### Medium: the manifest command ignored extra arguments

An unsupported `--dry-run` argument did not prevent a manifest write.
The command silently ignored that argument and reported success.
This behavior could overwrite content when the caller expected a preview.

The [command](../../scripts/update-trip-manifest-assets.js) now requires its exact argument form.
Unknown or extra arguments stop the command before it reads or writes a manifest.
Process-level tests verify successful updates, rejected arguments, and unchanged files after validation failures.

### Medium: image sets could contain conflicting proportions

The updater checked image dimensions but did not compare all image proportions.
A square native export could pass with a landscape page image.
That mismatch gives the viewer incorrect slide geometry.
Conflicting page candidates could also change the displayed image proportions.

The updater now checks page, viewer, and native image proportions.
The shared manifest schema also checks manually authored native-image geometry.
A [shared comparison](../../shared/responsiveImage.ts) permits one pixel of rounding at the candidate's size.
Native images must be at least as large as their page images.

### Medium: Google Docs class rules used the wrong order

The importer resolved conflicting rules in HTML class-attribute order.
CSS rules with equal specificity must follow stylesheet order.
Repeated rules also need to preserve the order of each property declaration.

The [importer](../../scripts/sync-blogs.js) now retains and applies exported class rules in stylesheet order.
Inline declarations still take precedence.
Compilation tests cover reversed class names, repeated rules, emphasis, first-line indents, and exported tab spaces.

### Medium: local URL rewriting was too broad

The browser replaced every occurrence of the media hostname in responsive source strings.
That operation could alter a lookalike hostname or a URL inside a query value.
The build and browser also maintained separate photo-mapping logic.

The [shared URL module](../../shared/tripAssetUrls.ts) maps only CDN trip URLs at the start of a candidate.
Other origins, query values, width descriptors, and whitespace retain their original values.
Both page images and fullscreen viewer images use this module.
Unit tests verify these boundaries and confirm that mapping does not mutate authored photo data.

### Medium: an image test failed under normal suite load

The new high-resolution encoder test exceeded the default five-second limit during the full suite.
Its complete run used real encoders and checked cache reuse.
The fixture remains large enough to exercise every ordinary viewer width.
That test now has a 20-second limit.
Other tests retain their configured limits.

### Low: malformed reports produced incidental exceptions

Some malformed image arrays failed during sorting or property access.
Duplicate prepared photo IDs were silently reduced to the first match.

The updater now validates image records before sorting them.
It rejects duplicate photo IDs and builds one lookup for the prepared records.
The manifest remains unchanged when validation fails.
Tests include null records, invalid dimensions, duplicate IDs, and native-only viewer sets.

### Low: paragraph styling had two sources

Indented imported paragraphs copied the ordinary MDX paragraph classes.
Future typography changes could update one copy and leave the other unchanged.
The [shared typography constant](../../shared/blogTypography.ts) now supplies both render paths.
Browser tests compare their color, line height, spacing, and wrapped-line alignment.

## Validation

The measurement record contains the final test totals and coverage comparison.

| Check | Result |
| --- | --- |
| Unit tests | 3,257 pass across 225 files; 35 tests added |
| Trip reading browsers | 99 pass across three browser profiles |
| Pins browsers | 62 pass across two browsers |
| Pins Python | 48 pass |
| Historical temperature Python | 18 pass |
| Line coverage | 88.36% → 88.38% |
| Branch coverage | 82.85% → 82.90% |
| Manifest updater branch coverage | 86.95% → 87.80% |
| New shared image and URL helpers | 100% line, branch, and function coverage |
| npm audit | No known vulnerabilities |
| Production output | 148,835,025 bytes; no local trip cache |

The baseline and final coverage runs use the same four-worker limit and 20-second test limit.
The final image test also passes with its own explicit limit.

The browser runs cover all trip-reading scenarios in desktop Chromium, phone Chromium, and phone WebKit.
Pins scenarios run in Chromium and WebKit with fixed service responses.
They exercise zoom stages, western counties, selection, disclosure controls, history, fullscreen recovery, and accessible controls.

The npm advisory audit reports no known vulnerabilities in the lockfile.
Lint, TypeScript, the production bundle, and the tornado publication check pass.
The Python checks cover both Pins and the historical temperature pipeline.

## Documentation and remaining work

The active authoring, publication, test, and repository guides now describe the implemented behavior.
The TODO index separates release, editorial, device, and later engineering work.
Each incomplete task remains in [TODO.md](../../TODO.md).
Dated reports retain their measurements and original review scope.

The language cleanup follows the repository's ASD-STE100 writing rules.
Instructions use short sentences, active voice, and consistent terms.
Technical identifiers, commands, and source names retain their exact spelling.
The Markdown check measures sentence length and relative file links.
That check does not certify vocabulary or complete ASD-STE100 conformity.

Hosted analytics, physical-phone memory, and source editorial facts still need their recorded checks.
No deployment or push is part of this review.
The user's development server remains on `http://localhost:5173/`.

## Release follow-up

The user later requested a push, deployment monitoring, and hosted verification.
The first [CI run](https://github.com/robert-bryson/rsmb.tv/actions/runs/43544240009) stopped before the preview or production release.
Five browser cases failed. Their traces identified test setup and timing assumptions.

The county zoom test now waits for the lazy boundary source to finish loading and parsing.
It then checks rendered outlines, radii, badges, request counts, and source-write counts.
Three long map scenarios have a 60-second total limit for camera changes, history, reloads, and real drag input.
The application's startup deadline remains unchanged.

The heading rotation fixtures now measure their size before expecting static placement.
Compact headings can fit within half of a 320-pixel screen.
The fixtures use a shorter screen, then verify that rotation restores sticky placement.
They also measure the combined height after increasing text size.

A two-CPU retest also exposed tile cancellation during WebKit reloads.
The shared-link and history cases now wait for the renderer to finish its camera and tile work before replacing the document.
The prior `networkidle` event did not cover later requests from the map.
The test still rejects page errors and verifies readiness after the reload.

All 14 focused cases pass in Chromium and WebKit with two CPUs and two workers.
Lint, TypeScript, and the changed documents' relative links also pass.

The [next CI run](https://github.com/robert-bryson/rsmb.tv/actions/runs/43548022723) passed the Chromium suite, then found five WebKit failures.
One exposed a layout defect: the contents header could exceed a phone screen by four pixels at 200% text size.
Its title and button can now wrap onto separate rows.
The browser check covers 320- and 390-pixel screens, complete tap targets, and collapse/expand behavior.

The remaining failures checked map pixels before rendering settled or checked a data error before its injected response arrived.
Camera checks now wait for the renderer's loaded state.
Project navigation checks wait for application readiness before comparing pixels.
The retry case waits for its invalid response before checking the error control.
Feature, source-write, request-count, and pixel assertions remain in place.

All 18 focused browser cases pass with two CPUs and two workers.
The 25 heading and contents unit tests also pass, along with lint and TypeScript.
A separate control restores the old contents layout in each browser.
At 200% text size, it produces a 375-pixel page on a 320-pixel screen.
The corrected layout stays at 320 pixels in both browsers.

The local production temperature suite then exposed an application race during background recovery.
A data update could add sources after the old style was removed, while its replacement was still loading.
MapLibre rejected that write and the page showed its error boundary.
The map now tracks style readiness separately from its style version.
Data effects wait between `styledataloading` and `style.load`, then restore the latest records and settings.
The transition also clears the previous rendered-data state.

The map test double now rejects source writes while its style is loading, as MapLibre does.
Four new regressions cover recent, state, county, and freshness views.
All four reproduce the crash before the fix and pass afterward.
All 44 related map and basemap unit checks pass.
All 40 production temperature browser cases pass in Chromium and WebKit.
They cover failed and stalled backgrounds, retry, station selection, filters, worker startup, and data-feed recovery.
Lint and TypeScript also pass.

The [following CI run](https://github.com/robert-bryson/rsmb.tv/actions/runs/43551662078) exposed two remaining WebKit assumptions.
DejaVu Sans made one chapter-title word exceed the phone's text column at 200% text size.
This produced a 334-pixel page on a 320-pixel screen.
Shared headings now permit long words to wrap.
The browser checks cover the default font and DejaVu Sans at both phone widths.
A separate layout probe confirms no overflow with Ubuntu, DejaVu Sans, Arial, or generic sans-serif.

A map screenshot took longer than the five-second DOM assertion limit.
Pixel comparisons now use one helper with a 20-second capture and decode budget.
All pixel thresholds remain unchanged.
The national selection and reload case also waits for its territory camera to settle before capturing pixels.

All 22 focused cases pass in Chromium and WebKit with two CPUs and two workers.
The 25 heading unit tests, lint, and TypeScript also pass.

The final unit coverage run passes 3,261 tests across 225 files.
It uses the original four-worker limit and 20-second test limit.
Line coverage increases from the review baseline of 88.36% to 88.39%.
Branch coverage increases from 82.85% to 82.92%.
The measurement record retains both the original review and these release checks.

The [next CI run](https://github.com/robert-bryson/rsmb.tv/actions/runs/43554486665) passed all checks through Chromium and all but one WebKit case.
The Ontario reload case checked its selected card while the application still showed its pin-loading state.
All Pins reloads now share the renderer-settle and application-readiness helper.
Initial coverage checks also wait for application readiness before reading data counts.

The full local WebKit run then identified the same five-second assumption in other data-driven assertions.
Pins tests now use one 20-second assertion budget and one 60-second limit for each complete case.
This replaces ten repeated case limits and several separate wait settings.
The application's 15-second startup deadline and its explicit failure checks remain unchanged.
The renderer capture also clears its old handle before waiting for a new camera callback.
Independent local browser processes use separate artifact directories.

Thirteen review screenshots were also captured during every normal map run.
They did not assert image contents and used shared paths outside the test artifact directories.
These extra captures now require `PINS_REVIEW_SCREENSHOTS=1` and attach to their own test's output.
Functional pixel assertions and automatic failure evidence remain enabled.

The complete 66-case WebKit run passes under two CPUs and two workers: 65 pass and one Chromium-only measurement is skipped.
This includes all Pins, heading, gallery, and post-rendering cases.
Three Chromium cases also pass under the same CPU and worker limits.
They cover both revised reload paths and the zoom stages with optional review images enabled.
All three review images are present in the correct test artifact directory.
Lint and TypeScript pass.
