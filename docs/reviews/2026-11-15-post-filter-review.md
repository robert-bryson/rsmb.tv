# Post filter review

Date: November 15, 2026.
Starting revision: `dc2c334`.
Scope: pending Posts control placement, tag and region dropdown, tests, and related instructions.

The requested layout moves All, Writing, and Trips beside the Posts heading.
The Filters button sits below those controls and opens the complete tag and location lists.
The initial implementation passed 50 focused unit tests.
Those tests did not prove that users could reach every option or operate the native scrollbar.
Both behaviors failed in a real browser.

## Findings and fixes

### Medium: the dropdown extended below short screens

The panel always opened below its button with a maximum height of 65% of the viewport.
That limit ignored the button position and the site header.
At 320 by 480 pixels, the real-content panel ended at pixel 682.
Its last link ended at pixel 661.
Scroll containment kept the page at its starting position while the pointer remained inside the panel.
Users could not reach those options through that scroll area.
Other failures occurred at 390 by 600 pixels and with enlarged text.

The new [`usePostFilterPosition`](../../src/hooks/usePostFilterPosition.ts) hook measures the available space around the button.
It opens above when that space is larger and the list cannot fit below.
The panel height accounts for the visual viewport, page gutters, and the current and target header bounds.
Padding can shrink on very short screens.
The horizontal limit also accounts for a classic page scrollbar.

The hook updates after viewport changes, header transitions, element resizing, and list changes.
A content observer handles a growing list whose constrained outer box does not change size.
Animation frames combine repeated notifications into one layout pass.
Closing or unmounting the panel removes listeners, disconnects observers, and cancels pending work.
Scrolling the button out of view dismisses the panel without moving the reader back.

A browser regression failed before the placement fix.
New unit cases cover both placement directions, visual viewport offsets, header changes, content growth, fallback events, and cleanup.
Browser checks cover 240-pixel height, enlarged text, rotation-sized viewport changes, and the final focused option.

### Medium: using the scrollbar closed the panel

The outside-focus handler assumed that every click inside the panel retained focus inside it.
The scroll container could not receive focus.
After a link received focus, a native scrollbar click moved focus to the page main element.
The blur handler then closed the panel before the scrollbar could be used.

The scroll container now has `tabIndex={-1}`.
Mouse clicks can focus it, and normal Tab navigation still moves between the button and links.
Escape returns focus to the button.
A unit regression failed before this fix.
Chromium checks the native scrollbar gutter and focus behavior.
WebKit uses overlay scrollbars in this environment and checks scroll-area focus and keyboard navigation.

### Low: unused region-preview code remained in the production component

All production callers requested the complete region list.
The component still retained a second path with hidden measurement links, per-country state, observers, and See all controls.
The browser fixture tested that obsolete path instead of the dropdown used by readers.

[`PostRegionFilters`](../../src/components/PostRegionFilters.tsx) now renders the complete list directly.
The preview prop, measurement copies, expansion state, and related observers are removed.
The fixture now uses the application layout and the real dropdown.
Its checks cover country selection, complete lists, long labels, responsive sizing, and shared region URLs.

### Low: filter presentation and maintenance instructions had diverged

Tags, countries, and regions repeated the same pill styling and selected-state handling.
[`PostFilterLink`](../../src/components/PostFilterLink.tsx) now owns both.
The page retains one URL builder and the existing query, type, tag, and location contracts.
The active count represents the tag and location groups inside the dropdown.
Changing the post type resets the dropdown; combining tag and location selections keeps it open.

The [blog guide](../blog-publishing.md#maintain-post-filters) now states component ownership, placement rules, and focus behavior.
The trip test guide describes the complete dropdown instead of row previews.
The shared-module guide links to those instructions.
Existing screen-reader and phone tasks in [TODO.md](../../TODO.md) now include the new controls.
Completed defects remain in this report rather than becoming open TODOs.

## Security and maintainability

Filter values continue through `URLSearchParams` in `createPostsUrl`.
Labels remain React text, and the changes add no HTML injection path or dependency.
Filter selection preserves the existing analytics contract, which excludes query text.
The review found no new security defect in this change set.
This statement applies to the reviewed changes, not every application or infrastructure path.

Disclosure behavior belongs in `PostFilters`; body-page geometry belongs in `usePostFilterPosition`.
The hook is specific to this panel because it reserves site header space.
It should not become a generic header dropdown utility without a different layout contract.

## Validation and coverage

The [evidence file](../performance/2026-11-15-post-filter-review.json) records commands, source hashes, failures, and final results.
The full unit suite passes 3,485 tests across 241 files.
This adds 24 tests to the starting revision, including the requested feature tests.
The focused unit suite passes 68 tests.
The production filter and reading checks pass 16 browser cases across Chromium and WebKit.
The region fixture passes another 16 cases across both engines.
No cases in these browser runs are skipped.
The Python suite passes all 18 tests.
Lint and application, build configuration, and script type checks pass.
The npm audit reports zero known vulnerabilities.

A local production build with current imported content also passes a Chromium smoke check.
It checks heading alignment, combined filters, Escape, clear-filter focus, short-screen bounds, and page errors.
The browser runners use fixed content to keep their result counts stable.

The coverage comparison uses the same final source in both runs.
The smaller run omits the 15 new review regression cases.
The complete run includes them.
Branch coverage rises from 92.16% to 98.79% across the five reviewed modules.
Statement coverage rises from 96.55% to 100%.
Line and function coverage remain at 100%.
These percentages do not describe the complete application.

The local Node and npm versions differ from the declared versions.
The evidence records both; this review does not verify installation under the declared runtime.
Documentation checks cover local link targets and sentence length.
The prose uses short sentences, active voice, and consistent terms.
Sentence length does not certify ASD-STE100 vocabulary compliance.
Dated reports retain their original evidence.

## Remaining checks

Real phone keyboards, device rotation, and screen-reader announcements still need the existing tasks in [TODO.md](../../TODO.md).
The browser checks exercise layout, focus, and accessibility rules but do not replace those device checks.
