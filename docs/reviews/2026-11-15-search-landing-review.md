# Search landing review

Date: November 15, 2026.
Starting revision: `9f89723`.
Scope: the latest search-to-passage change, its shared navigation behavior, tests, and instructions.
The working tree was clean at the start.

The starting change passed 3,528 unit tests.
Its focused coverage also exceeded 98% of lines across the two original landing modules.
Those results missed real visibility, keyboard, and history defects.
The new browser fixture initially failed all five scenarios in both engines.
The short-screen case was also reproduced with the production trip heading measurement hook.

## Findings and fixes

### Medium: matching a summary removed its native Tab stop

The landing component gave every target without an explicit `tabindex` the value `-1`.
That included a native `summary`, which already belongs in the keyboard order.
The initial focus succeeded, but Tab and Shift+Tab could not return to the disclosure control.

The component now adds `tabindex` only when the target lacks native keyboard focus.
Existing attributes remain intact.
Unit and browser regressions failed before the fix.
The browser check now moves away from the summary and returns with Shift+Tab in both engines.

### Medium: transparent text could win over a visible passage

The matcher checked an element's boxes and `visibility` property.
An opacity-zero ancestor still supplied those boxes, so invisible text could receive the match and focus.
The same passage later on the page remained unselected.

The text walk now excludes transparent and hidden subtrees.
It caches computed styles and ancestor checks for each walk.
Text visibility comes from rendered text ranges, rather than the wrapper's layout box.
This also supports visible text inside a `display: contents` wrapper.
Hidden content remains excluded from landing targets; these checks are not a publication security boundary.

### Medium: scrolling the page did not reveal matches inside scroll areas

The original implementation moved only the document.
It left matching code beyond a horizontal scrollbar and paragraphs below a nested scroll area's visible bounds.
Both engines reproduced both failures.
The repository uses horizontal code blocks on several project and article pages.

The new [`scrollToSiteSearchMatch`](../../src/navigation/scrollToSiteSearchMatch.ts) helper first reveals the matched line within its scrollable ancestors.
It accounts for borders and handles both axes.
Oversized matches reveal their beginning.
The document jump then uses the updated text position.

WebKit exposed a second defect after the first fix.
It truncated fractional scroll deltas, leaving about 0.72 pixels horizontally and 0.80 pixels vertically outside the clip area.
The helper now rounds each delta toward the obscured edge.
The browser assertions still require full containment.

### Medium: large text could land below a short viewport

The original clearance always included a chapter heading, even after the trip layout made that heading static.
It also reserved the full navigation height without checking the available screen height.
At 320 by 240 pixels with enlarged text, the matched line could remain below the screen.

Clearance now includes only an actual sticky chapter heading.
Placement uses the visual viewport and leaves room for the start of the match.
Short screens reduce excess reserved space.
The helper ignores empty inline boundary rectangles that can belong to the preceding line.
Visual viewport resize and scroll events update placement until correction stops.
Tests cover offsets, large text, oversized lines, cleanup, and the production heading hook.

### Medium: history depended on delivery of the final scroll event

The broader WebKit run restored pixel 2,067 instead of the reader's saved pixel 700.
The position map still held the earlier search landing because navigation preceded the latest scroll event.
A new unit regression reproduced the missing departure snapshot without relying on browser timing.

[`ScrollToTop`](../../src/components/ScrollToTop.tsx) now saves the current position when leaving the route.
It still records normal scroll events.
The departure snapshot closes the gap before the next route resets the document position.
Search visits continue to yield layout correction to the passage locator.
Back and Forward continue to use ordinary restoration.

### Low: visible line breaks were removed from phrase matching

The matcher joined text node contents without representing rendered breaks.
`Quiet<br>harbor` became `Quietharbor` during passage selection.
A query for the full phrase then highlighted only one word.
Displayed block spans had the same problem.

Passages now include separator offsets for explicit breaks and block boundaries.
Each authored text segment retains its own source offsets.
The final range still points to the original React text nodes.
Inline markup and Unicode normalization retain their existing behavior.
The change does not wrap or replace article text.

## Maintainability and security

[`SearchMatch`](../../src/components/SearchMatch.tsx) owns readiness, focus, highlighting, observers, and cancellation.
The geometry helper owns scroll areas, viewport limits, and page clearance.
The matcher owns rendered passage selection and source ranges.
Horizontal and vertical positioning share one delta calculation and rounding rule.
Correction stops if the live range collapses after text replacement.

The query remains in browser navigation state.
URLs and analytics behavior remain unchanged.
The review found no new injection path: the query selects text ranges and does not become HTML or executable code.
No dependency was added.
This review covers the latest change set, not every infrastructure or application security path.

The [search guide](../site-search.md) states these ownership and behavior contracts.
The shared-module guide links to the geometry helper.
Existing phone and screen-reader tasks in [TODO.md](../../TODO.md) now include scroll areas, short screens, and native summary controls.
Fixed defects remain in this report rather than open TODO entries.

## Validation and coverage

The [evidence file](../performance/2026-11-15-search-landing-review.json) records commands, counts, source hashes, and coverage.
The final unit suite passes 3,549 tests across 244 files.
The review adds 21 unit cases.
The focused suite passes 138 tests.
The temperature analysis suite passes all 18 Python tests.
The landing fixture passes ten browser cases across Chromium and WebKit.
The production search, navigation, filter, and accessibility checks pass 58 cases.
Two WebKit forced-color cases skip unsupported emulation.
Lint and application, build configuration, and script type checks pass.
The npm audit reports zero known vulnerabilities.

The current-content PCH check also passes at 390 by 900 pixels.
It finds the original **Avenue of the Giants** range, focuses the passage, and keeps its first matched line visible.
No page error occurred.
One warmed local text walk took 5.3 milliseconds.
That single sample does not establish a performance budget or a before-and-after comparison.

The coverage comparison uses identical final source in both runs.
The smaller run omits the new review groups.
The complete run includes them.
The evidence records line, statement, branch, and function measures for the four reviewed modules.
Line coverage rises from 95.55% to 98.66%.
Branch coverage rises from 79.51% to 88.29%.
These figures do not describe the complete application.

Documentation checks validate local file links and sentence length.
Prose uses short sentences, active voice, and consistent terms.
The sentence check does not certify ASD-STE100 vocabulary compliance.
Older dated reports retain their original evidence.

## Remaining checks

Physical phone keyboards, browser chrome changes, and assistive technology still need the existing tasks in [TODO.md](../../TODO.md).
The local Node and npm versions differ from the declared runtime.
The evidence records both; these results do not verify installation under the declared versions.
Copied result URLs and new tabs still open at the normal page position, as documented.
