# Trip state ownership and recovery review: 2026-10-28

## Scope and assessment

The baseline is commit `c2c64e1943df852b13b154e53eb03caf97b268a3`.
The review covers the four subsequent trip commits and the uncommitted changes present at review start.
The user confirmed this scope.

The reviewed areas include day maps, map recovery, panoramas, photo preparation, manifest validation, and Google Docs conversion.
The starting working tree passed 1,461 Vitest cases.
That result concealed several state transition defects.

The main problem was inconsistent ownership of transient state.
Day feedback belonged to a route. Stop feedback did not.
Map errors belonged to a configuration inside the renderer. The outer error boundary retained errors without that scope.
The preview retained a selected day after the block changed to a focused map.

Independent standards and specification reviews used the repository guide and trip authoring guide.
The findings below keep those two review axes separate.
The fixes also received regression tests.

## Standards

### P2: Stop feedback survived route replacement

`TripRouteMap` stored stop feedback in an unscoped `hoveredStopId` state value.
Replacing the route did not clear it.
A stop with the same ID on the replacement route received the old highlight.
A stale different ID could suppress the replacement route's selected stop highlight.

This violated the authoring guide's requirement to clear selection, hover, and focus feedback when another route loads.
Pointer and keyboard route-replacement regressions both failed before correction.

The shared `useTripMapHighlight` hook now owns route identity, pointer feedback, keyboard feedback, and dismissal.
Both day feedback and stop feedback use it.

### P2: Outer error boundaries had no configuration scope

`TripMapBlock` keyed its error boundary only by retry count.
A map construction or rendering error put that boundary into its failed state.
A healthy replacement configuration remained behind the fallback.

This violated the authoring guide's requirement to discard errors when the map configuration changes.
Five regressions reproduced this failure for route, track, day, stop-list, and day-list replacement.

The boundary now tracks a reset key.
Changing that key clears the failure without remounting healthy children.
Changing only the requested stop retains the healthy map instance.
Explicit retry remains available for the same configuration.

### Maintainability: One component owned too many concerns

`TripRouteMap` combined basemap definitions, control classes, map construction, selection, camera recovery, and rendering.
This was a maintainability judgment, rather than a separate behavior failure.

Basemap definitions and style creation now reside in `tripMapBasemaps.ts`.
Map control classes now reside in `tripMapControls.ts`.
The renderer retains map lifecycle and interaction behavior.
The existing control tests exercise the extracted classes through the renderer.

The remaining map decomposition task stays in `TODO.md`.

Standards result: two behavior findings and one maintainability finding.
Stale stop feedback was the clearest standards failure.

## Spec

### P2: A replacement map could not recover from an earlier boundary error

The guide states: "An error belongs to one map configuration."
The outer boundary did not follow that rule.
The reset-key correction described above closes this behavior gap.

### P2: Route replacement retained stop feedback

The guide requires another route to clear previous hover and focus feedback.
The day renderer implemented that rule, but stop feedback did not.
The shared highlight hook correction closes this gap.

Spec result: two behavior findings, both also identified by the standards review.
The persistent outer boundary error was the worst specification gap.
No clear unsupported scope expansion was found.

## Additional findings and corrections

### P2: Pointer exit removed active stop keyboard feedback

Focus a stop button, hover another stop, then move the pointer away.
The original implementation cleared all stop feedback, although the first button retained focus.
This repeated the input-ownership defect previously corrected for day buttons.

The shared hook gives pointer feedback priority while active.
Pointer exit restores feedback for the focused stop.
A mixed-input regression failed before correction.

### P2: Preview day selection overrode a new focused map

Select an overview day before activating the map, then change the block to a track or stop map.
The preview retained its selected day and passed it into the interactive renderer.
For a track map, this could display the previous day's extent and description instead of the requested track.

Preview selection now belongs to the route and requested focus.
Changing either clears the preview day.
Returning to the overview does not restore the old selection.
Track and stop transition regressions failed before correction.

### P2: A failed gallery blocked a replacement gallery

The gallery used the same boundary implementation without a reset key.
Changing the gallery ID after a rendering error retained the old fallback.
The boundary now clears that error when the gallery ID changes.
A regression reproduced the failure before correction.

### Incoming fixes retained and verified

The initial changes escaped shortcode-like prose before MDX compilation.
They restricted expansion to standalone paragraphs outside lists, blockquotes, tables, and code.
The compilation cases check that literal shortcode text renders without execution or component expansion.
Formatted standalone shortcodes still receive manifest-reference validation.

The photo schema now trims alt descriptions and rejects empty or whitespace-only descriptions.
The accessible-name cases verify the parsed description on the viewer link and image.
The Boise gallery split and existing route-selection regressions remain included.

### P2: Preview replacement lost keyboard focus before Escape

The first complete browser run passed 74 cases and failed one phone Chromium Escape case.
Ten isolated repetitions of that original case then passed.
The failure trace showed a preview replacement between button focus and the keypress.

New browser cases delay the interactive map module until after a preview day receives focus.
They send Escape before or after releasing the module.
They use `page.keyboard.press`, because `locator.press` can refocus the replacement button and conceal the defect.
The initial after-handoff case failed three times before correction.
Two diagnostic runs confirmed that focus had moved to `BODY`.

Replacing the controls removed the focused DOM node.
The dismissal hook correctly treated the subsequent body keypress as outside the map.
The existing composed-path unit regression covered replacement during key dispatch, but missed replacement before dispatch.

Day controls now transfer focus within the stable map viewport during replacement.
The transfer matches both route identity and day ID. It also retains the Escape dismissal state.
It runs before paint and uses `preventScroll`.
It preserves focus on outside controls and discards unused transfers in a microtask.

Intermediate browser runs exposed a second failure after focus restoration.
Restored focus and pointer-entry events could reopen feedback after Escape had dismissed it.
WebKit diagnostics recorded `mouseenter` on the replacement button while the pointer remained stationary.
This re-emphasized the day and caused the original Escape color checks to fail.

Escape now suppresses restored focus feedback and stationary pointer-entry feedback.
A real pointer move or exit allows hover feedback again.
Suppression lasts until the focus event arrives, including deferred delivery.
The implementation records dismissal explicitly instead of inferring it from the currently highlighted day.
This preserves keyboard feedback when another day previously had pointer priority.

The original case and both deterministic timings passed two repetitions in all three browser projects.
The new cases retain selection, focus, popup, and route-color assertions.
The original case retains its selection and route-color assertions.
Temporary diagnostic logs were removed.

## Tests and coverage

Twenty added unit cases cover boundary recovery, retry, healthy-map reuse, focus changes, stop input transitions, and keyboard focus transfer.
Fourteen failed before their corrections.
The other six protect retry, reuse, focus boundaries, and input precedence.
Two added browser cases check the real asynchronous module handoff.

The controlled coverage comparison uses the same final source, compiler, and V8 provider.
The control excludes those twenty cases by test name.
Both runs include the ten map modules and the six test files in the repository guide's focused command.

| Measure | Control: 92 cases | With additions: 112 cases |
| --- | --- | --- |
| Statements | 94.96% | 97.76% |
| Branches | 92.64% | 94.67% |
| Functions | 94.62% | 98.92% |
| Lines | 97.26% | 99.65% |

Full-suite coverage is 78.73% statements, 72.97% branches, 77.18% functions, and 80.83% lines.
This measures loaded files, rather than every repository file.

## Verification

| Check | Result |
| --- | --- |
| Complete Vitest suite with V8 coverage | 1,481 passed across 103 files |
| Focused map suite | 112 passed |
| Python temperature pipeline | 17 passed |
| ESLint | Passed with zero warnings |
| TypeScript project checks | Passed |
| Dependency audit | Zero known vulnerabilities |
| Production build with fresh content and asset checks | Passed |
| Repeated Escape browser cases across three projects | 18 passed |
| Complete production trip browser suite | 81 passed |
| Browser smoke suite | 16 passed |
| All three checked-in trip manifests | Passed schema validation |
| Local documentation links in affected guides | 42 valid |

The complete trip run includes desktop Chromium, phone Chromium, and phone WebKit.
It passed after the focus and pointer-entry corrections.

## Documentation and limits

The current guides now define literal shortcode contexts and nonempty photo descriptions.
They also define gallery error reset, focused-map selection reset, and stop keyboard feedback.
The story template uses short instructions and separates alt descriptions from captions.
The review index links to this report.
Historical reports retain their original results.

These edits use short sentences, active voice, and consistent terms.
They approximate ASD-STE100 style without claiming formal certification.

No direct security defect was established in the reviewed changes.
Shortcode attributes remain constrained to validated IDs.
Popup and caption text retains escaping.
The dependency audit reported zero known vulnerabilities.

Browser checks use synthetic articles, routes, images, and tiles.
They do not verify live tile services, private source records, or deployment.
