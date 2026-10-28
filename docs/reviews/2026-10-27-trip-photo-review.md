# Panorama and photo failure review: 2026-10-27

## Scope and assessment

The baseline is commit `c49e4df05132aac7774ec865ab80543480928067`.
The review covers the pending panorama feature and its shared rendering, import, preparation, and publication paths.
It also covers the shared page layout and affected test fixtures.

The initial unit suite passed 1,421 cases across 99 files.
The initial production trip browser suite passed 69 cases.
Those results missed four photo defects.
Successful loading was well covered. Failure, source replacement, and unlinked keyboard focus were not.

The implementation has useful boundaries.
Panorama placement belongs to the story component, rather than the photo manifest.
The existing manifest, responsive sources, captions, and PhotoSwipe viewer remain shared.
Ordinary photos retain their preparation settings and filename fingerprints.
The remaining problems were state ownership, CSS precedence, and incomplete regression coverage.

Independent standards and specification reviews used the repository guide, trip authoring guide, and initial panorama research.
The findings below retain those two review axes. One defect appears in both axes.

## Standards

### P2: A failed photo could not recover after responsive source changes

`TripPhotoFigure` recorded the failed fallback URL alone.
After an error, replacing `srcSet` or `sizes` retained that URL and kept the placeholder mounted.
The browser had no image element with which to try the new source selection.
Changing the URL and returning to the original URL also restored stale failure state.

The internal `TripPhotoImage` component now owns image failure state.
Its React key includes `src`, `srcSet`, and `sizes`.
Changing that selection remounts the image and starts a new load attempt.
An unchanged failed selection remains failed; unrelated renders do not create a retry loop.

Three regressions cover fallback URLs, responsive sources, and slot widths.
Each checks failure, an unchanged rerender, source replacement, and a return to the original selection.
All three failed before the fix.

### P2: The placeholder changed the height of phone panoramas

The old placeholder used `min-h-40` and normal-flow padding.
A `3200 × 560` image occupies about 66 pixels at a 375-pixel page width.
Its placeholder occupied at least 160 pixels.
Chromium and WebKit measured a 94.375-pixel increase after failure.

The placeholder now uses the photo's aspect ratio without a minimum height.
Its message uses absolute positioning, so text and padding cannot enlarge the reserved image area.
Hero and gallery frames retain their existing crop rules.
The browser regression measures the frame before and after an error.
It requires a height difference below one CSS pixel.

### P2: Unlinked failed photos lost their accessible caption description

Successful unlinked images used `aria-describedby` to reference supplemental captions.
The replacement `role="img"` element omitted that reference.
Assistive technology therefore lost caption information after an image error.

The image component now gives both states the same accessible description.
Two regressions check ordinary and panorama placements.
They also check unlinked focusability and explicit priority loading.
Both failed before the fix.

### Maintainability: Two photo shortcode branches repeated validation

The ordinary and panorama replacements repeated the same photo-reference checks.
This was a duplication concern, rather than a hard documented-standard violation.
One expression now recognizes the optional `-pano` suffix.
Both forms use the same reference validation and fenced-code handling.

Standards result: three runtime defects and one duplication concern.
Persistent failure after source replacement was the worst standards finding.
The shared-renderer defects existed before this feature; panorama placement exposed the height defect more clearly.

## Spec

### P2: Unlinked panorama focus extended beyond the page

The design requires "a focus outline inside the page edges."
The panorama selector and a later generic focus selector had equal specificity.
The later desktop rule restored an external three-pixel outline on unlinked figures.
Both panorama edges could therefore clip the focus indicator.

A shared CSS custom property now controls the outline offset.
Panoramas set `-3px`; ordinary figures retain the `3px` default.
Linked and unlinked focus use the same rule, outside pointer-specific caption styles.
The desktop regression failed before the fix and now passes.
Phone Chromium and WebKit also check the unlinked placement.

### P2: Failure invalidated the reserved image dimensions

The design says intrinsic dimensions "let the browser reserve space before the image loads."
The minimum-height placeholder defeated that reservation on narrow panoramas.
The standards finding above describes the correction and its measured browser regression.

Spec result: two behavior gaps, including one overlap with the standards findings.
The clipped focus indicator was the worst specification finding.
No missing shortcode syntax or derivative-width requirement was found.

## Additional findings

### P2: Malformed source shortcodes silently became story text

The fresh Boise import contained `{{trip-gallery:2024-05-18_2}}`.
Its underscore did not match the manifest's hyphenated gallery ID.
The paragraph detector accepted only valid ID characters.
It therefore escaped this tag before reference validation could reject it.
The build succeeded while displaying literal shortcode text in the article.

The detector now preserves every standalone trip tag without nested braces or line breaks.
The existing expansion step rejects unsupported syntax and invalid IDs.
Inline and fenced code examples remain literal.
Three regressions cover underscores, uppercase letters, and spaces. All failed before the correction.
A fourth test retains malformed tags in code examples.
Ordinary post imports disable trip expansion and escape shortcode text for literal display.
Two compilation regressions and a complete sync test check that boundary.

The final strict import now stops on this source typo.
The source Google Doc must use `{{trip-gallery:2024-05-18-2}}` before publication.
The manifest already uses that valid ID and was not rewritten by this review.

### P3: Page coverage depended on locally generated content

Page tests imported the local generated post registry.
A production import changed which branches they exercised without changing those tests.
A checkout without generated posts could also skip their per-post assertions.
Passing tests therefore did not establish a stable set of page scenarios.

Page tests now use two fixed posts and a fixed trip summary.
Dedicated status tests cover production hiding, missing metadata, readiness, source links, missing sources, issues, and preview totals.
Registry tests check retained series metadata, development metadata, successful article loading, and missing article errors.
These tests do not require a local Google import.

The preparation suite now checks the original ordinary-photo fingerprint contract explicitly.
It checks the pipeline version, quality, width list, and Sharp version used by the previous filename policy.
Existing tests cover panorama thresholds, source orientation, smaller sources, and the 3200-pixel output limit.

## Coverage

The controlled photo comparison uses identical final source, compiler, and V8 coverage provider.
The control uses the 23 starting story cases. The second run adds five regression cases.
Both runs measure only `TripPhoto.tsx`, including its internal image component.

| Measure | Control: 23 cases | With regressions: 28 cases |
| --- | --- | --- |
| Statements | 91.30% | 95.65% |
| Branches | 85.71% | 97.61% |
| Functions | 100% | 100% |
| Lines | 100% | 100% |

Coverage measures loaded files. It does not establish complete repository coverage.
The new failure tests provide stronger evidence than the initial declared-aspect-ratio assertion.
Browser measurements remain necessary because jsdom does not perform page layout.

The final full suite reports 78.46% statements, 72.82% branches, 76.69% functions, and 80.65% lines.
The starting suite reported 78.41% statements, 72.48% branches, 76.52% functions, and 80.62% lines.
Source and fixtures changed between those full runs; only the focused comparison above holds source constant.
The development-status component now has 100% branch coverage from fixed scenarios.

## Verification

| Check | Result |
| --- | --- |
| Complete Vitest suite with V8 coverage | 1,448 passed across 100 files |
| New unit cases since review start | 27 added |
| Python temperature pipeline | 17 passed |
| Complete production trip browser suite | 75 passed |
| Browser smoke suite | 16 passed |
| Focused WebKit map repetitions | Six passed |
| Article JavaScript budgets | Passed without budget changes |
| ESLint | Passed with zero warnings |
| TypeScript project checks | Passed |
| Dependency audit | Zero reported vulnerabilities |
| All three checked-in trip manifest schemas | Passed |
| Production build before malformed-tag enforcement | Passed with fresh Google content |
| Final production build | Correctly rejected the malformed Google Doc tag |

Five new photo unit cases failed before their fixes.
The placeholder browser regression failed in Chromium and WebKit before its correction.
The unlinked focus regression failed on desktop Chromium before its correction.
Three malformed-tag regressions also failed before the importer correction.

The complete browser run uses a production fixture build and synthetic content.
It passed after the photo corrections.
The later importer correction passed its conversion and compilation tests; it does not change fixture rendering.

## Browser run limits

One run started the trip suite and smoke suite concurrently on the same host.
Two WebKit map cases failed while the photo cases passed.
One map remained a static preview. Another restored route bounds with a three-pixel difference.

Both map cases passed three isolated repetitions each.
The complete trip suite then passed all 75 cases when run without the smoke suite.
These results did not provide a repeatable map defect.
Shared browser graphics resources are a possible cause, rather than a verified explanation.
No map implementation or assertion was changed to conceal these failures.
The reproduction task remains in `TODO.md`.

## Documentation, content, and limits

The authoring guide defines panorama syntax, placement, source resolution, and publication order.
The repository guide records the new browser checks and fixed unit-test inputs.
The research note links to current instructions and this later review.
Short sentences, active voice, and consistent terms approximate the requested ASD-STE100 style.
This review does not claim formal certification.

The user's Boise gallery edits were preserved.
The user corrected an invalid gallery ID during the review.
A fresh Google import and complete production build then passed, before the later malformed-tag check was added.
The imported story includes the panorama shortcode and the revised May 12 gallery references.
The remaining source shortcode correction is recorded in `TODO.md`.

No direct security defect was found in the reviewed changes.
The importer retains manifest-reference checks and literal code examples.
The viewer retains text escaping for captions.
The dependency audit reported no known vulnerabilities at review time.

The browser tests use synthetic photos, route data, and tiles.
They do not verify real-device graphics behavior or deployment.
The review did not publish assets or change remote documents.
