# Post filters and trip presentation review: 2026-10-29

The initial patch passed 1,590 unit tests. It still had incorrect filters, phone overflow, a lint failure, and failing browser checks.
The confirmed defects below are corrected.

## Scope

The baseline is `f4b1db5a6642db7277aad0506a15751a7d148b1e`.
The review covers the pending tracked changes and new files present at its start.
The patch adds grouped post filters, a full-width trip hero, photo selection, and animation presentation changes.
It also changes Kalaloch content, the About page, tests, and authoring instructions.

There is no originating issue or separate specification.
The behavior contract comes from the blog publication guide, trip authoring guide, and existing tests.
Independent agents reviewed standards and documented behavior. The main review reproduced defects, applied corrections, and ran the checks.

## Standards

The independent review found four behavior defects. It found no separate documented-standard violation after excluding checks enforced by tooling.

### P2: A visible topic could exclude its own post

`separatePostGeography` retains a writing post's `Japan` tag when that post has no Japanese country group.
Another post can have a JP country group.
`Posts` previously passed every tag through a geographic alias lookup before it applied the topic filter.
The lookup then interpreted the visible `Japan` topic as country JP.
The resulting topic link excluded the writing post. A writing-only view returned no results.

An exact topic now takes priority over geographic aliases.
Tests check retained topics that match country and region names.
A page regression checks the displayed results and the active topic link.

### P2: Geographic links changed meaning when post order changed

The original alias lookup returned its first country or region match.
With country Georgia before U.S. region Georgia, `tag=georgia` selected country GE.
With the posts reversed, the same URL selected region Georgia.
Trip facts also emitted that ambiguous URL for the U.S. region.

New fact links use explicit `country` and `region` parameters.
A U.S. Georgia link is `/posts?country=US&region=georgia`.
A country Georgia link is `/posts?country=GE`.
The shared URL helper normalizes and encodes these values.
Existing tag URLs use stable precedence: exact topic, country code, region name, then country name.
Tests check both post orders, country-name fallback, URL encoding, and identically named regions in different countries.

### P2: Valid region names overflowed phone layouts

The new filter pills combined `whitespace-nowrap` with `max-w-full`.
The width limit constrained each link's box. It did not constrain the text inside that box.
A valid Chilean region name increased the document width to 331 pixels in a 320-pixel viewport.

Visible labels now wrap. The hidden measurement row retains single-line labels for width calculations.
A browser regression checks long country and region names at 320 pixels.
It checks the link contents and the complete document width.

### P2: The responsive fixture caused repeated sizing changes

The fixture's main container omitted the application's `w-full` constraint.
Inside the flex root, it shrank to its visible links.
Hiding links reduced the container width, which caused another measurement and hid more links.
At 800 pixels, the measured row changed from 724 to 539 to 454 pixels.
The test captured seven links before the list settled at three. A later locator then timed out.

The fixture now has an explicit full width, as the application layout does.
The existing test retains its row-fill and resize assertions.

Standards result: four findings corrected. Incorrect topic selection had the greatest direct effect on normal navigation.

## Spec

The independent review found no additional confirmed mismatch in the trip header, photo viewer, animation, manifest, or map changes.

The authoring guide now states, “The manifest defines available animations. It does not insert them automatically.”
Removing automatic `introAnimation` placement follows that contract.
The local generated Kalaloch body contains the explicit animation component.
The source Google document was not changed or independently checked during this review.

The hero viewer contract states, “The hero viewer contains every manifest photo, with the hero first.”
The carousel retains that order. Both viewer buttons open the selected photo.
Browser tests check selected-slide expansion, focus return, image failure, reserved height, and reduced motion.

Spec result: no additional confirmed findings. There is no separate originating specification to establish broader intent.

## Build gates and test corrections

The main review also found a return-navigation defect in the manifest failure path.
The error page discarded the saved country, region, and post-type filters by linking to a fixed trip-list URL.
It now uses the same validated return URL and scroll-restoration state as the successful article.
A regression checks the return link after a rejected manifest load.

The new browser fixture failed `react-refresh/only-export-components` because its component had no export.
It now exports the fixture component, as the existing article fixture does.

The trip browser test still expected an active `ca` tag pill after the interface changed to country groups.
That assertion failed in desktop Chromium, phone Chromium, and iPhone WebKit.
It now checks the explicit country URL, the active Canada link, and the resulting post list.

New component tests cover selected-region visibility, expansion, collapse, resizing, observer cleanup, and missing measurement APIs.
They also cover unassigned regions and narrow rows that require the control to wrap.
The post list accepts mixed-case region names and lowercase country codes from shared URLs.
Generated links retain one normalized form.

## Documentation

The publication guide defines URL normalization and alias precedence.
The authoring guide now describes inline country groups and country-scoped region links.
The testing guide replaces obsolete country-tag requirements with current filter behavior.
It also explains the browser fixture's width constraint and the new regression cases.
The repository guide and documentation index link the current checks and this report.

Edited procedures use short sentences, active voice, and consistent terms.
Commands, identifiers, and product names retain their exact spelling.

## Validation

| Check | Result |
| --- | --- |
| Vitest with V8 coverage | 1,607 passed across 110 files; 17 unit cases added during this review |
| Python temperature pipeline | 17 passed |
| Browser smoke suite | 23 passed, including the new long-label case |
| Production trip browser suite | 115 passed; two desktop touch-only cases skipped |
| Production trip browsers | Desktop Chromium, phone Chromium, and iPhone WebKit |
| ESLint and TypeScript | Passed |
| Production `vite build` | Passed with the existing local content registry |
| Dependency audit | Zero advisories reported by `npm audit --audit-level=moderate` |
| Whitespace checks | Passed |

## Coverage comparison

Both measurements use the same final application source, compiler, and V8 provider.
The baseline excludes test names containing `filter review regressions`. It runs the original 1,590 cases.
The final measurement includes all 1,607 cases.

| Metric | Baseline | Final |
| --- | --- | --- |
| Statements | 80.09% (6,653/8,306) | 80.43% (6,681/8,306) |
| Branches | 74.37% (4,693/6,310) | 74.88% (4,725/6,310) |
| Functions | 78.19% (1,553/1,986) | 78.65% (1,562/1,986) |
| Lines | 82.33% (5,808/7,054) | 82.59% (5,826/7,054) |

`PostRegionFilters` line coverage increased from 65.38% to 96.15%.
Its branch coverage increased from 60.29% to 94.11%.
These reports measure loaded source files. They do not measure the complete repository.

Reproduce the comparison with:

```bash
npm run test:coverage -- --coverage.reporter=json-summary --coverage.reporter=text \
  --coverage.reportsDirectory=/tmp/rsmb-review-comparable-baseline -t '^(?!.*filter review regressions)'
npm run test:coverage -- --coverage.reporter=json-summary --coverage.reporter=text \
  --coverage.reportsDirectory=/tmp/rsmb-review-final-coverage
```

## Limits

The review used the existing local content registry for the production build.
It did not run a Google content import, upload assets, deploy infrastructure, or publish the site.
The dependency audit checks reported advisories. It does not prove that every dependency is free from defects.
Animation unit tests mock playback. They do not prove that a browser can decode the bundled Kalaloch MP4.

The host used Node.js 26.12.0 and npm 11.20.0.
Node.js is in the declared range. npm differs from the pinned npm 12.2.1.
No dependency installation or lockfile change was needed.
