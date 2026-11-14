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
