# Project quality review

This review covers the pending November 10 app changes and their tests.
It includes the earlier audit, implementation, and evidence files.
The review found five defects. All five were reproduced and fixed.

The earlier passing suite missed input and lifecycle boundaries.
Test count alone did not show that the new behavior was correct.

## Findings and fixes

### 1. Hover menus could not be dismissed from outside focus

**Severity: medium.** `ProjectsNavigation` handled Escape only on its own list item.
Mouse hover could open the list while focus remained on Posts or the page body.
Escape then failed to close the list. The list could cover page content.

The open disclosure now listens for Escape at document level.
It restores toggle focus only when focus was inside the disclosure.
It keeps outside focus in place and respects an event already handled by another control.
The effect removes both document listeners when the disclosure closes or unmounts.

A regression test reproduces outside focus.
The production browser test uses real hover and keyboard input.
The behavior follows the [WAI disclosure navigation guidance](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation-hybrid/).

### 2. Help allowed map changes behind the modal dialog

**Severity: medium.** The global Flights shortcut handler remained active while help was open.
Letters, numbers, and Shift shortcuts could change panels, camera, colors, or layers behind the dialog.
The help footer also instructed readers to use H after character shortcuts had been disabled.

The shortcut handler now isolates help input.
H can close help when character shortcuts are enabled.
Escape closes help without clearing the map selection.
The footer names Escape, which remains available when character shortcuts are disabled.

Hook tests cover each map action while help is open.
Component tests cover event propagation, focus return, persistent settings, and reopening help through its visible control.

### 3. Navigation announced ancestor links as the current page

**Severity: medium.** Projects and its child links used `aria-current="page"` for descendant routes.
Posts did the same for article routes.
The target of each link was not the page being displayed.

Exact destinations now use `page`.
Ancestor locations use `location` and retain their active visual style.
Tests check both navigation levels.
See the [WAI current-page example](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/).

### 4. Atlas reported readiness before routes were usable

**Severity: medium.** Atlas used the existence of a style-initialized map as its ready signal.
Route requests and worker processing could still be pending.
This produced premature startup measurements.

Atlas now waits for an available route and a rendered frame with a loaded route source.
Readiness belongs to one renderer, data snapshot, and retry attempt.
A retry invalidates the previous readiness result.
Late events from a removed renderer cannot restore it.
An empty filtered result can be ready. Failed route downloads report an error.

The render listener updates React state only when source readiness changes.
It does not schedule a state update on every frame.
Tests cover pending downloads, worker processing, empty results, route failures, and renderer retry.
A native browser test holds route responses until the background has rendered.

### 5. The performance helper rejected recovered maps

**Severity: medium.** The helper treated every MapLibre error log as a failed sample.
A provider HTTP 503 could recover to a neutral background with usable records.
The helper still rejected that sample after the map reported `degraded`.

Recoverable provider logs no longer fail the sample.
Terminal map states, application exceptions, failed worker requests, and fatal renderer logs still fail it.
Unit and native browser tests cover a provider failure followed by a usable degraded map.

## Code quality and security

The review retained the shared background recovery helper and validated data cache.
It simplified the map telemetry event conditions and removed a non-null assertion.
Renderer readiness uses explicit identities to prevent stale results after retry.
Effect cleanup removes added listeners.

The review found no exploitable security defect in this diff.
New image attributes use HTML escaping.
Temperature payloads pass schema validation before use.
Custom analytics events contain bounded feature fields and pathnames.
They exclude query values and respect Do Not Track.
The locked dependency audit reported zero vulnerabilities.
These checks do not establish that the whole application has no security defects.

## Tests and coverage

Six assertions failed against the earlier implementation across four test files.
The fixes made those assertions pass.
Further tests cover lifecycle cleanup, error pages, user focus, and client navigation timing.

Coverage compares the same ten modules before and after this review.
The set includes navigation, focus, telemetry, recovery, shortcuts, help, data loading, textures, and measurement.
These figures are not whole-repository coverage.

| Metric | Before | After |
| --- | ---: | ---: |
| Lines | 95.07% | 97.03% |
| Statements | 91.25% | 94.60% |
| Functions | 86.66% | 93.33% |
| Branches | 83.79% | 88.62% |

The [review evidence](../performance/2026-11-10-project-quality-review.json) records exact counts and validation results.
The initial implementation evidence remains in its [dated report](2026-11-10-project-improvements.md).

| Check | Result |
| --- | --- |
| ESLint and TypeScript | Passed |
| Unit tests | 3,012 passed in 205 files |
| Historical Python tests | 18 passed |
| Production Chromium and WebKit checks | 96 passed |
| Flight and measurement browser checks | 24 passed |
| Trip readiness, recovery, reading budgets, and return navigation | 18 passed |
| Locked dependency audit | Zero vulnerabilities |
| Changed-document file links and diff whitespace | Passed |

The first full unit run overlapped browser jobs.
Two build checks reached their existing 30-second limits.
The isolated final run passed. Test limits were not increased.
WebKit used the installed browser with this workstation's local library wrapper.

## Documentation and open work

Current guides use shorter sentences, active voice, and consistent terms.
The language pass follows [ASD-STE100 writing guidance](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf).
Code identifiers and technical terms remain unchanged.
Dated measurements retain their original scope and results.

The documentation index now states the writing rules.
The TODO list separates next-release checks from content, data, device, infrastructure, and refactor work.
No completed implementation task remains on that list.

The following work remains open:

- Verify field metrics after deployment and visitor traffic.
- Test reading and map controls with a physical phone and a screen reader.
- Test scroll restoration when content arrives after the existing three-second observation window.
- Split the remaining large map components and document importer through separate changes with behavior tests.

The review does not change production infrastructure or publish a release.

## Release follow-up

The first pushed revision, `f3edac4`, reached the final CI suite.
The suite passed 620 trip checks and failed two WebKit checks.
The release gate blocked deployment.
See the [failed run](https://github.com/robert-bryson/rsmb.tv/actions/runs/42863656528).

The hero check matched the title in the loading placeholder.
It then measured a hero that was being replaced.
The check now waits for the real `Trip photos` region and its subtitle.

The return-link trace showed layout changes during footer activation.
The footer appeared before the lazy story body had loaded.
Scroll restoration also remained active after pointer input.
The footer now shares the story body's Suspense boundary.
The hero and header return link remain available while the body loads.
Pointer input now cancels restoration, including queued resize callbacks.
The footer-return test targets the named Post navigation region.

A new held-module browser check verifies the loading boundary.
Five unit cases verify restoration and input ownership.
The pointer case failed before the fix.
Repeated WebKit checks verify both failed flows and delayed body loading.
The final stress run passed all 30 WebKit checks.
Desktop and phone Chromium passed 14 related checks, including reading budgets.
The complete suite passed 3,017 unit tests in 206 files and all 18 Python tests.
Lint and TypeScript checks passed.

Trip CI now emits GitHub failure annotations and stops at its first failure.
Passing releases still run the full suite.
