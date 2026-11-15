# Post search and reading review — November 14, 2026

## Scope and result

This review starts at `e48e14c` with seven pending post-search files.
It covers search, filter URLs, history, article return links, contents observers, tests, and the affected documentation.
Four behavior defects required corrections. The review also found a weak request assertion and unclear URL construction.

The initial focused sample passed 87 tests.
New unit regressions then failed twice against the pending implementation.
New forced-color regressions failed at both tested widths.
These failures exposed conditions that the passing suite did not test.

## Low: search discarded navigation context

Each query edit replaced the complete navigation state with an ownership marker.
Unrelated object properties disappeared. Clearing all filters also discarded them.

The [search hook](../../src/hooks/usePostSearchQuery.ts) now copies navigation context before writing the new entry.
It removes the temporary scroll-return flag because editing starts a different list view.
Clearing all filters also removes the private query marker.
Neither action changes the source state object.

The input retains immediate local state while the router commits URL changes in a transition.
An earlier URL commit cannot replace newer typed text.
Back, Forward, and external navigation restore their selected query.
Article links use the current input value, including text that the router has not committed yet.

Tests cover context retention, clear actions, non-object history state, external replacement, and article return links.
Browser checks type multiple words with real key events in both engines.

## Medium: keyboard focus disappeared in forced colors

The input disabled its outline. Its surrounding field used a box shadow for focus.
Forced-color mode removed that shadow, leaving no visible indicator.
The failure occurred at 320px and 1280px.

The [search field](../../src/components/PostSearch.tsx) now uses an outline around the complete field.
The field keeps its visible label, hint, clear action, and 44px control height.
Each instance receives unique label and hint IDs.

Chromium checks the computed focus outline with forced colors active.
WebKit skips these two cases because its emulation does not support that mode.
Both engines run the other search accessibility checks.

## Medium: retired contents observers could replace the current heading

Disconnecting an observer did not prevent its callback from changing the active heading.
A queued callback from before a heading change could overwrite a newer observer's result.

The [contents component](../../src/blog/PostTableOfContents.tsx) now invalidates each callback during cleanup.
A regression changes a heading ID, activates the replacement observer, and delivers an older callback.
The current heading must remain unchanged.

The existing partial-visibility tests also assumed that the observer was ready when the navigation appeared.
They now wait for heading registration before delivering synthetic entries.
The tests retain their original assertions and timeout limits.

## Low: contents lookup could select a heading outside the article

The observer used `document.getElementById` to find each heading.
An unrelated page element with the same ID could receive the observation.
The supplied article reference did not restrict that lookup.

Lookup now uses headings within the article reference.
A regression places a conflicting ID before the article.
Only the article heading can receive the observation.

## Maintainability and test corrections

The URL builder had five positional arguments, including several empty strings.
Its callers did not show which values represented tags, countries, regions, or queries.
The [URL helpers](../../src/content/postFilters.ts) now accept named, typed options.
One query helper performs encoding, replacement, and removal without changing its source parameters.

Search matching, URL construction, input state, and field rendering have separate modules.
The route combines their results and sends the bounded filter event.
The [maintainer guide](../blog-publishing.md#maintain-search-behavior) identifies each module's responsibility.

The browser request test previously asserted only that its matching request list was empty.
An incorrect URL pattern could pass that assertion.
The test now requires a matching article module request after opening a result.

New event tests advance a controlled clock through repeated edits and unmount.
They verify the 300ms delay, cancellation, and exact event properties.
Search text and geographic selections cannot enter that payload.
URL tests also cover reserved characters, duplicate query values, and literal script-like text.

## Validation

Final checks used Node.js 24.22.3 and npm 12.2.2, as declared by the repository.
The [measurement record](../performance/2026-11-14-post-search-review.json) contains commands and coverage counts.

| Check | Result |
| --- | --- |
| Complete unit suite | 3,371 passed across 230 files |
| Focused search and contents suite | 106 passed across four files |
| Temperature pipeline tests | 18 passed |
| Production search and accessibility checks | 14 passed in Chromium and WebKit; two unsupported emulation cases skipped |
| Article and chapter browser fixtures | 52 passed in Chromium and WebKit |
| ESLint | Passed with zero warnings |
| Application TypeScript checks | Passed |
| Script TypeScript checks | Passed |
| Full-suite line coverage | 88.80% |
| Full-suite branch coverage | 83.24% |

The five search modules have 100% line and branch coverage.
The contents component has 100% line coverage and 85.48% branch coverage.
This review adds 19 unit cases and two forced-color browser cases.
It also strengthens existing browser request and observer assertions.

The initial focused coverage sample used Node.js 26.13.0.
Final coverage uses the supported runtime and the complete suite.
The measurement record keeps these samples separate.

Browser runs used fixed content and a temporary launcher for the installed WebKit engine's cached libraries.
The repository browser configuration retains its existing engine setup.

## Documentation and remaining checks

The publication guide now defines query matching, filter combinations, clear actions, history behavior, and code ownership.
The analytics guide defines event delay and cancellation.
The documentation index links both instructions and this review.
TODOs now separate local validation, engineering, infrastructure, content, and planning.
Revised prose uses short sentences, active voice, and consistent terms.

Physical keyboard and screen-reader checks remain in [TODO.md](../../TODO.md).
Hosted analytics delivery remains a release check.

The external dependency audit did not run.
Automatic approval review blocked `npm audit` because it exports dependency metadata to npm's registry.
The review does not reuse an older audit result as current evidence.
