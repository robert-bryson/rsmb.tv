# Flight years and article previews: quality review

Review date: November 3, 2026.
Baseline: `0a4bc7b`, including the working changes present before this review.
Scope: flight date presentation, image metadata, blog import, screenshots, tests, and related instructions.

## Assessment

The pending changes passed their existing tests but contained incorrect preview behavior.
The tests covered straightforward inputs. They missed removed content, relative URLs, malformed dates, and truncated year summaries.
Passing tests did not establish those input contracts.

The corrections share document normalization and year presentation rules.
They preserve the pending screenshot refresh and public metadata changes.
The review did not identify another blocking defect in the inspected code.

## Standards

Two findings were corrected. Neither required a new dependency.

1. **P3: contradictory publication instructions.**
   `docs/blog-publishing.md` said ordinary posts always used generated PNG cards.
   `docs/site-metadata.md` specified article images with generated cards as a fallback.
   The guides now describe the same selection rules.
   This corrects inconsistent terminology and procedures under the writing rules in `docs/README.md`.

2. **P3: duplicated year summaries with different ordering.**
   The phone overlay retained the oldest three years. The desktop tooltip retained the newest five years.
   A route spanning 2021–2026 could omit 2026 from its phone summary.
   This was a judgment-call consistency issue, rather than a documented requirement violation.
   Both displays now use `formatFlightYears` and retain recent distinct years first.
   The displays keep their existing size limits.

No additional documented architecture violation was found.
The final independent review found no remaining concrete regression in the corrected modules.

## Spec

No originating issue or formal specification was supplied.
The review used the current publication and metadata guides as the behavior contract.
Three findings affected that contract.

1. **P2: preview images could come from removed content.**
   The importer selected an image from raw HTML before removing unsupported elements.
   Images inside forms, buttons, and objects could become previews despite being absent from the article.
   Images inside code examples had the same problem during Markdown conversion.
   The importer now selects from the normalized document and excludes code examples.
   The article and its preview share the same removal rules.

2. **P2: fragment references could displace usable images.**
   The link URL validator accepted `#heading` as an image source.
   The preview then referenced a page fragment instead of an image.
   Media validation now rejects fragment references. Ordinary fragment links remain valid.
   Selection continues to the next retained image.

3. **P2: relative images used the wrong base URL.**
   `./coast.jpg` became `https://rsmb.tv/./coast.jpg` instead of the article's `/blog/coast.jpg`.
   Article images now resolve against the canonical article URL.
   Unusable hero URLs fall back to post images, then generated cards.
   Only HTTP and HTTPS image URLs enter article metadata.

These corrections implement the documented usable-image requirement.
Open Graph, Twitter, and JSON-LD receive the same resolved image URL.

## Additional input checks

- **P3: invalid dates produced plausible years.**
  The new formatter accepted values such as `2/29/2023` and `1/1/2024<script>`.
  It now uses the existing calendar validator and displays `Unknown year` for invalid dates.
- **P3: fractional image dimensions entered metadata.**
  Imported dimensions now require positive safe integers.
  Missing or invalid dimensions remain absent.

Full flight dates remain available for ordering and first and last visits.
The state statistics test verifies mixed date formats without locale conversion.
Year precision changes presentation; the public data still contains full dates.

## Regression evidence

The first focused regression run produced 19 failures before the fixes.
Those cases covered image selection, image dimensions, URL resolution, fallbacks, and invalid dates.
A separate code-image regression failed before its selector fix.
The focused tests passed after correction.

Additional cases check recent-year truncation, fragment links, registry image retention, and state visit dates.
Browser tests compare the loaded article image with its metadata URL.
They also check image dimensions after navigation and crawler output with JavaScript disabled.

## Validation

| Check | Result |
| --- | --- |
| ESLint with zero permitted warnings | Passed |
| TypeScript project checks | Passed |
| Vitest | 2,406 tests passed across 163 files |
| Temperature pipeline | 17 tests passed |
| Dependency audit | Zero reported vulnerabilities |
| Metadata browsers | 120 cases passed across desktop Chromium, mobile Chromium, and iPhone WebKit |
| Enhanced article image check | Three browser cases passed after adding loaded-image assertions |
| Flight duration and project screenshots | 38 cases passed across Chromium and iPhone WebKit |
| Reading styles and production JavaScript budgets | 15 cases passed across the three trip browser configurations |
| Production fixture build | Passed through the trip browser runner |
| Whitespace checks | Passed |

The production checks use fixed content and intercepted map or image responses where required.
They do not verify current Google document access or production hosting configuration.
No infrastructure or dependency files changed.

### Coverage

Both measurements used the installed compiler, V8 coverage provider, and complete Vitest suite.
The comparison includes implementation changes and new tests.

| Metric | Before | After |
| --- | --- | --- |
| Statements | 83.36% (11,024/13,224) | 83.39% (11,037/13,234) |
| Branches | 78.72% (8,114/10,307) | 78.81% (8,134/10,320) |
| Functions | 81.34% (2,533/3,114) | 81.40% (2,539/3,119) |
| Lines | 85.15% (9,433/11,078) | 85.17% (9,443/11,087) |

The suite gained 34 tests. The overall percentage increase is small.
Coverage measures loaded source files, rather than every repository file.
Subprocess execution and browser execution do not contribute to these V8 totals.

### Repeat the checks

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run test:temperature-records
npm run audit
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser -- tests/trips/metadata.spec.ts --workers=3
PLAYWRIGHT_WEBKIT=1 npm run test:e2e -- tests/e2e/flight-duration.spec.ts tests/e2e/projects.spec.ts --workers=3
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser -- tests/trips/reading.spec.ts \
  --grep 'reading routes exclude visualization code|emphasis and code inherit' --workers=3
git diff --check
```

## Documentation cleanup

The metadata, publication, and flight guides now describe the corrected behavior.
The documentation index links this report.
The completed Flights screenshot task was removed from `TODO.md`.
New prose uses short sentences, active voice, and consistent terms.

Standards: two findings, worst P3. Spec: three findings, worst P2. All five findings were corrected.
