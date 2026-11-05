# Metadata publication and delivery review — 2026-11-04

Reviewed change: `29bdb12..ecced0b`.
Diff command: `git diff 29bdb12...ecced0b`.
The working tree was clean at the start of this review.
The review therefore used the latest metadata implementation as its scope.
It covered publication state, feed generation, browser identity, resource delivery, and related documentation.

## Spec finding: single-draft preview publication

Severity: P2. Fixed in the importer.

`syncBlogPosts({ previewSlug })` supports importing one unpublished post for local review.
The importer added `development.published` only when `includeUnpublished` was enabled.
A requested preview without that option had no publication marker.

Public discovery builders treat unmarked legacy records as published.
The preview's title, description, and canonical URL therefore appeared in JSON Feed, RSS, and the sitemap.
The normal production CLI does not select this preview option.
This review did not establish an active production disclosure.

The fix marks requested previews as unpublished at the import boundary.
Existing discovery filters then exclude them without separate feed-specific rules.
The preview's local MDX remains available. Other unpublished rows remain excluded from a single-draft import.
Published rows retain their existing metadata shape.
Both preview modes now populate source links and readiness metadata through one shared path.
Validated trip previews retain their manifest status and prepared asset counts.

Four regression cases run the complete importer with mocked Sheet and document responses.
Each case reads the generated registry and runs all three discovery generators.
The cases cover writing and trip previews, both alone and alongside a published post.
They verify local preview content, readiness metadata, and public artifact contents.

Before the fix, the artifact counts were one and two instead of zero and one.
The regression cases verify both the privacy fix and complete preview metadata.

## Standards and testing finding: missing resource delivery checks

Severity: P3. Fixed in the browser test runner.

The metadata browser suite used a fixture build with public-directory copying disabled.
Its assertions checked manifest and feed link attributes, but never requested the linked resources.
Those assertions passed while the local manifest URL returned homepage HTML.
The production build generated these resources; the defect was in automated verification.

The runner now creates both feeds from the same post fixtures as the page HTML.
It generates PNG icons in the temporary build directory.
A three-file allowlist supplies the manifest, SVG favicon, and Apple touch icon.
This keeps the fixture build independent of imported production content.

The new browser case requests the linked resources over HTTP with page JavaScript disabled.
It validates manifest JSON, PNG dimensions, JSON Feed fields, RSS XML, and matching public item identities.
The browser's native XML parser checks RSS syntax.
The case also checks draft exclusion and the feed's referenced branding images.

Before the runner fix, the manifest response had `text/html` instead of `application/manifest+json`.
The new case now passes in Chromium, mobile Chromium, and WebKit.

Vite uses `application/json` for the local JSON Feed response.
The hosting configuration separately declares `application/feed+json` for production.
These local checks do not establish deployed response headers.

## Documentation changes

The publication guide now includes JSON Feed and explains the single-draft preview marker.
It distinguishes ignored article artifacts from committed page cards and branding assets.
The metadata guide describes fixture resource generation and the local media-type difference.
Instructions follow the repository's short-sentence writing rules.

## Review limits

No other actionable correctness, security, or documented-standard violation was found in the reviewed change.
Importer checks already reject invalid dates, unsafe slugs, and missing required published fields.
This review makes no new infrastructure or deployment changes.

## Validation

| Check | Result |
| --- | --- |
| Full Vitest suite | 165 files and 2,477 tests passed |
| Python analysis suite | 17 tests passed |
| Metadata browser suite | 126 checks passed across Chromium, mobile Chromium, and WebKit |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Diff whitespace | Passed |

The new coverage includes four importer-to-artifact cases and one resource-delivery case in each browser project.
Both findings had failing regressions before their fixes.
Read-only follow-up reviews found no remaining correctness issue in the updated importer or tests.
