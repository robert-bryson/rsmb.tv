# Post rendering review — 2026-09-30

This report records the checks on 2026-09-30. Its test counts and validation limits are historical.
Use the [trip implementation report](2026-10-01-trip-report-implementation.md) for the later schema and route checks.

## Scope

This review covers the pending subtitle changes, the Boise manifest, generated flight data, and the related import and navigation code.
It also covers the related tests, dependencies, authoring instructions, and TODOs.
It is not a full security audit of every project in this repository.

## Findings and corrections

### High: document text could become executable MDX

The importer removed script elements but did not protect the MDX text boundary.
A normal paragraph containing `{globalThis.unexpected = 1}` compiled into a JavaScript expression.
A paragraph containing `export const injected = 1` compiled into a module statement.
Literal angle brackets could also become JSX or cause a compilation error.

The importer now escapes braces, angle brackets, and literal entities in text.
It protects module statements after HTML conversion, including statements split across spans.
It retains code samples and validated trip shortcodes.
It converts typed code fences before text escaping, so code samples keep their original characters.

The tests compile and render the output. They check literal text, code samples, unsafe URLs, active HTML, and stripped event attributes.
See [the importer](../../scripts/sync-blogs.js) and [the compilation tests](../../scripts/__tests__/googleDocsMdx.test.tsx).

### Medium: subtitles had heading semantics

The importer converted `p.subtitle` to `h2`.
This caused large bold text, heading links, and unwanted table-of-contents entries.

Subtitles now use `p.blog-subtitle` and the shared safe HTML serializer.
They use 15-pixel gray text, normal weight, and a smaller gap below a heading.
Inline emphasis and links remain available.
The serializer name now describes its use outside table cells.

The browser tests check semantics, computed styles, and navigation at 390-pixel and 1000-pixel widths.
A compilation test keeps the browser fixture equal to the importer output.
See [the browser tests](../../tests/e2e/post-rendering.spec.ts).

### Medium: heading IDs were unstable and could collide

The original allocator changed shared counters during render.
React Strict Mode consumed extra IDs.
A generated suffix could also collide with another heading's base ID.
For example, repeated `First Stop` headings and `First Stop 1` could share an ID.

The allocator now reserves IDs when React commits a heading node.
It checks the complete set of reserved IDs and releases IDs when nodes are removed.
The table of contents sees a heading only after its final ID is available.
This also prevents a reload from using the wrong initial hash target.

The table of contents observes text and ID changes.
A different post gets a new heading provider, so navigation state does not carry across posts.
Tests cover Strict Mode, numeric suffixes, explicit IDs, removal, remount, malformed hashes, reload, and browser history.
See [heading allocation](../../src/blog/LinkedHeading.tsx) and [table-of-contents updates](../../src/blog/PostTableOfContents.tsx).

### Medium: coverage dependencies were incompatible

The manifest paired Vitest 4.1.11 with the Vitest 5 coverage provider.
After dependency installation, coverage failed with `coverageFilesDirectory is required`.
Both packages now use the 4.1.11 release series.
The MDX compiler is also a direct test dependency.

### High advisory: vulnerable development dependency

The dependency audit reported denial-of-service advisories for `brace-expansion` 5.0.9.
The lockfile now selects version 5.0.12.
The final audit reports zero vulnerabilities.
This finding concerns a development dependency. It does not prove an exploitable path in the deployed site.

### Medium: Boise route references were incorrect

The manifest referred to `2024-05-11-day-one`, which does not exist in the available route.
It also referred to a fallback image that is not available in the local preview.

The manifest now lists the five actual route IDs.
Reconstructed tracks have explicit labels. The unsupported fallback image reference is removed.
All 46 photo dimensions agree with the processed local images.
Unverified track dates remain unset.

The public route and one sampled photo returned HTTP 403 during this review.
The Sheet already marks Boise as unpublished.
The local manifest supports preview, but the trip is not ready for publication.
See [the manifest](../../src/content/trips/boise-2024.json) and [publication tasks](../../TODO.md#boise-trip).

### Low: generated data and documentation caused review noise

The three flight GeoJSON changes contained only new `generatedAt` values.
Their features and other metadata were unchanged. These timestamp-only changes were removed.

The authoring guide and template now use short instructions and consistent terms.
The revised text follows the procedural style in [ASD-STE100](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf).
The README now describes subtitle behavior and the actual manifest validation boundary.
The TODO file separates publication blockers, automated checks, project content, and project prerequisites.
Completed browser navigation work was removed from the TODO file.

## Validation

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript | Passed |
| Vitest | 981 tests passed in 77 files |
| Python | 17 tests passed |
| Playwright | 8 tests passed |
| Production build | Passed |
| Final production bundle after navigation fix | Passed |
| Dependency audit | Zero vulnerabilities |
| Local documentation links | Passed |

Coverage uses the same three source files before and after the review:
`sync-blogs.js`, `LinkedHeading.tsx`, and `PostTableOfContents.tsx`.
These figures are not repository-wide coverage.

| Metric | Before | After |
| --- | --- | --- |
| Statements | 87.03% | 88.06% |
| Branches | 78.94% | 80.76% |
| Lines | 90.73% | 91.45% |

The production build still reports a Tailwind source-map warning.
It does not stop the build. This review does not change the source-map plugin.

## Remaining work

Publish and verify Boise assets before publication.
Verify source dates, missing route segments, unknown distances, repeated day numbers, and story facts.

The application validates the full manifest schema when its module loads.
Blog sync checks JSON, trip IDs, asset URLs, and shortcode references.
A complete schema check during sync and a comparison with published route features remain follow-up improvements.
The [TODO file](../../TODO.md) records these tasks.
