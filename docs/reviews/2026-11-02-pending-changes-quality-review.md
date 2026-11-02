# Pending changes quality review

Review date: November 2, 2026.
Baseline: `6b3689cd50806e9e1b7a2663e49c68116b1b89a4`.

## Scope

The initial working tree contained site metadata changes and Mississippi–Wisconsin trip additions.
The review included tracked changes, new source files, generated social cards, and related routing, hosting, and publication code.
Independent reviewers checked code standards and documented behavior.

The behavior sources were the repository guide, blog publishing guide, trip authoring guide, and initial metadata audit.
The [documentation index](../README.md#writing-rules) supplied the writing rules.
There was no separate originating issue.

The initial test suite passed 2,032 tests. Passing tests did not establish correct direct navigation or production rewrite coverage.
The four defects below affected paths outside those assertions.

## Standards

### P2: Generated HTML files rendered the missing-page component

The build generated `/about.html`, `/projects/parc.html`, and other page files.
React recognized only clean route paths. A direct HTML-file request therefore loaded correct initial metadata, then rendered `NotFound` and set `noindex`.
The canonical helper removed `.html` only from metadata. It did not affect route matching.
`/index.html` also produced the incorrect canonical path `/index`.

[Path normalization](../../src/utils/siteMetadata.ts) now supplies both routing and canonical URL generation.
[AppRoutes](../../src/App.tsx) normalizes HTML-file paths and trailing slashes before it matches a route.
It maps `/index.html` to Home and replaces the history entry.
It retains query parameters, heading fragments, and navigation state.

This was a correctness finding. No additional documented coding-standard violation was confirmed.
The review found no confirmed injection defect in HTML attributes or JSON-LD serialization.
Existing escaping regressions remain in the suite.

## Spec

### P2: Page indexing rules weakened the development policy

The repository guide requires development HTML to retain `noindex, nofollow`.
Previously, opening a draft or missing page replaced that policy with `noindex, follow`.
The original tests checked creation and removal of page rules without an existing site rule.

[useDocumentHead](../../src/hooks/useDocumentHead.ts) now retains existing restrictions while adding `noindex`.
It removes conflicting `index` and `all` directives and recognizes `none`.
Cleanup restores the original tag content.
Tests cover development restrictions, uppercase directives, additional restrictions, navigation, and unmount.

Google documents directive combination and the `none` alias in its [robots metadata specification](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).

### P2: Amplify mishandled trailing slashes and article HTML paths

The repository guide requires public metadata before JavaScript runs.
The initial rules matched `/about` but omitted `/about/`.
The build emitted `about.html`, not `about/index.html`.
The preview removed the trailing slash, so local checks concealed the hosting difference.

[Amplify rules](../../infra/main.tf) now cover clean and trailing-slash forms for public pages, legacy paths, and article collections.
The rules remain before the application fallback.
A [mocked Terraform test](../../infra/tests/page-rewrites.tftest.hcl) checks every registry path and article collection.
It also checks fallback ordering and unique source paths.

The final independent review found another edge in the generic article rules.
An HTML filename could bind to `<slug>`, producing a target such as `/blog/coastal-test.html.html`.
Article HTML-file redirects now precede those rules and select the clean collection path.
The mocked test checks these targets and their ordering for both collections, including trailing-slash variants.

AWS describes directory lookup in its [clean URL guidance](https://docs.aws.amazon.com/amplify/latest/userguide/redirect-rewrite-examples.html#trailing-slashes-and-clean-urls).
This finding came from source review and documented hosting behavior.
The new rules passed mocked tests; production hosting was not changed.

### P2: Legacy post indexes discarded fragments and return state

The blog guide requires collection redirects to retain query parameters, heading fragments, and navigation state.
The legacy `/blog` and `/trips` index redirects retained only query parameters.
The new browser check reproduced the missing fragment in all three browser projects.

[LegacyPostsRedirect](../../src/App.tsx) now passes the fragment and navigation state to `/posts`.
The existing type filter remains in place.
Router tests check both legacy indexes. Browser tests check the generated `/blog.html` alias through the complete redirect sequence.

The behavior review found no substantive mismatch in the trip additions.

## Trip and documentation checks

The Mississippi–Wisconsin manifest contains 40 photos across five dated galleries.
The review checked all 122 referenced local derivatives, image dimensions, and gallery dates.
The prepared images contain no EXIF, XMP, or ICC metadata.
The manifest and outline tests check photo placement, IDs, responsive filenames, route references, and inventory totals.

The machine inventory now records the November 2 partial review accurately.
The photo review uses shorter sentences and separates source-document edits from asset publication.
The [metadata guide](../site-metadata.md) now owns current maintenance instructions.
README links to that guide. Historical test results remain in their dated reports.

## Validation

All results below use the final local source, unless marked as the baseline.

| Check | Result |
| --- | --- |
| Vitest baseline | 139 files; 2,032 tests passed |
| Vitest final | 139 files; 2,043 tests passed |
| Metadata and reading browser suites | 186 cases passed across desktop Chromium, phone Chromium, and iPhone WebKit |
| Temperature pipeline | 17 Python tests passed |
| TypeScript and ESLint | Passed |
| Production and development Vite builds | Passed with the existing local post registry |
| Social images, RSS, and sitemap generation | Passed |
| Dependency audit | Zero known vulnerabilities |
| Terraform | Formatting and validation passed; all four mocked tests passed |
| Diff whitespace | Passed |

Coverage used the same installed compiler and V8 provider for both full-suite runs.
The source changed during the review; these measurements describe the complete suite at each stage.

| Metric | Baseline | Final |
| --- | ---: | ---: |
| Statements | 82.51% | 82.74% |
| Branches | 77.39% | 77.54% |
| Functions | 81.39% | 81.82% |
| Lines | 84.46% | 84.65% |

The added assertions exercise direct route loading, history preservation, crawler restrictions, and manifest-driven RSS timestamps.
The browser suite checks crawler responses with JavaScript disabled and checks React navigation separately.
Reading checks retain the existing JavaScript budgets and cover photos, route failures, galleries, and return navigation.

## Limits

Validation did not import Google documents, upload trip assets, apply Terraform, or deploy the site.
The production build used the existing local content registry.
Deploy the generated HTML with the revised hosting rules.
Review the trip publication tasks in [TODO.md](../../TODO.md) before publishing the new content.

Page bodies still require JavaScript.
Unknown paths can receive fallback metadata until React identifies the missing page.
The current missing-page exclusion therefore depends on JavaScript for those requests.

Standards: one confirmed finding, fixed; generated HTML routing was the highest-impact issue on this axis.
Spec: three confirmed findings, fixed; missing hosting rewrites had the broadest crawler impact on this axis.
