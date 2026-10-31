# ADV Atlas critical review

Date: October 31, 2026.

The existing test count concealed two untested state transitions.
Renderer recovery could discard a pending camera fit.
Keyboard route selection could remove the focused control without providing another focus target.
Both defects are corrected and have regression tests.
The existing dependency audit failure remains unresolved.

## Scope

The reviewed head was `003ee94d943f50aed997cedf61ae17bed22810f1`.
The feature baseline was `main`, at `f27cb017633c13aec8980ba07b3edc98831adc4f`.
The review also included the uncommitted navigation fixes, dependency updates, tests, and documentation present at the start.

Use `git diff main` to inspect feature integration.
Use the parent of this review's commit to inspect the final repair diff.
The review used independent standards and specification checks.
The [atlas guide](../trips/ADV-ATLAS.md) defines the current navigation and recovery contract.

## Standards

### P3: Repeated return state — corrected

Report navigation passed `returnTo`, `returnLabel`, and `returnKey` through several components.
Each component rebuilt the related router state.
Headers, footers, series links, and neighboring reports could therefore disagree about the source visit.

This was a Data Clumps and Duplicated Code heuristic, rather than a documented hard violation.
The repair introduces `PostReturnDestination` in [postReturnDestination.ts](../../src/blog/postReturnDestination.ts).
One resolver validates the source URL and builds the return and onward-navigation states.
The article, header, and footer components use that destination directly.

Tests cover filtered post lists, current and legacy atlas URLs, invalid sources, invalid keys, and neighboring reports.
External URLs and unrelated internal paths use the collection fallback.
Post-list destinations discard atlas history keys.

### P3: Documentation rules — corrected

The existing merge-fixes report contained a 28-word description.
The [writing rules](../README.md#writing-rules) permit at most 25 words in a description.
That sentence is now split.

PCH and Route 66ish publication procedures now use separate instructions for separate actions.
The guides identify the linked Google Doc as the story source.
Generated MDX remains importer output.
The current atlas and testing guides now describe pending fits and keyboard focus.

Standards findings: one documented violation and one maintenance heuristic.
The repeated navigation state was the greater maintenance concern.

## Spec

### P2: Renderer retry discarded pending fits — corrected

The original [design requirement](2026-10-30-adv-atlas-research.md#camera-and-scrolling) states:
“Fit the selected trip after an explicit selection.”

Reproduction:

1. Load trip A and save its camera.
2. Select trip B while its geometry is still loading.
3. Lose the WebGL context.
4. Select **Retry map** before trip B finishes loading.
5. Deliver trip B's geometry.

The replacement renderer previously marked the current fit request as handled whenever a saved camera existed.
It therefore retained trip A's camera and skipped trip B's fit.
The same defect affected pending collection-overview requests.

[TripAtlasMap.tsx](../../src/features/trips/atlas/TripAtlasMap.tsx) now retains the identity of the last handled request across renderer replacement.
A restored camera no longer completes an outstanding request.

Two regressions failed before the fix: delayed selection and delayed overview.
A separate regression checks cancellation by manual movement across recovery.
It also verifies that a later explicit request still fits the route.

A saved camera's initial request identity is also captured before the first constructor attempt.
Readers can change selection through the cards while that constructor has failed.
Three regressions cover unchanged selection, changed selection, and a new overview after constructor failure.
The latter two failed before correction.

### P2: Keyboard choice selection lost focus — corrected

The original [design requirement](2026-10-30-adv-atlas-research.md#accessible-browsing-and-failure-behavior) states:
“Keep keyboard focus on the initiating button after route selection.”
The shared-road chooser previously removed its focused button when it closed.
Focus then fell back to the document body.

Keyboard activation now requests focus on the selected card's **Show route** button.
[AdvAtlas.tsx](../../src/pages/AdvAtlas.tsx) opens the panel, reveals the card, and handles that focus request once.
Pointer activation reveals the card without moving keyboard focus.
Closing and reopening the panel does not repeat an earlier focus request.

The browser regression failed in desktop Chromium, phone Chromium, and phone WebKit before the fix.
It now checks selection, focus placement, subsequent link navigation, and panel reopening.
The WebKit case uses Option+Tab to include links in sequential navigation.
Page tests also distinguish pointer and keyboard activation.

Specification findings: two integration defects, both corrected.
The discarded camera request was the greater functional concern.

## Confirmed pending fixes

The changes present before this review addressed two additional defects:

- Report returns could restore a different visit at the same atlas URL.
- Escape could leave shared-road choices open after focus moved outside the map.

The final changes retain the source history key through report headers, footers, neighboring reports, and series links.
Reloads prefer the current atlas entry's snapshot.
An expired explicit source does not restore an unrelated URL snapshot.
The document-level Escape listener uses current choice state and is removed during cleanup.

Session, article-navigation, and browser regressions cover these behaviors.
See the earlier [merge-fixes report](2026-10-31-adv-atlas-merge-fixes.md) for the original reproductions and dependency update details.

## Dependency security

A fresh npm audit reports 12 moderate development-package findings from one minimatch advisory.
The production-only audit reports zero findings.
The [upstream advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) identifies versions below 11.0.1 as affected.
The installed ESLint toolchain requires minimatch 10.

The audit failure still blocks the unchanged CI workflow.
The repair preserves that security gate.
It does not force minimatch 11 outside the declared dependency contracts.
The unresolved task remains in [TODO.md](../../TODO.md#dependency-security).

## Validation

The initial working-tree suite passed 1,768 tests in 119 files.
The final suite passes 1,796 tests in 120 files.
The 28 added tests cover navigation boundaries, focus behavior, and request handling across renderer recovery.
All 17 Python temperature tests pass.

Coverage comparisons use identical final source, Node.js 26.12.0, compiler, coverage provider, and source denominators.
The control excludes the new resolver test file and the selected new regression cases.
The complete measurement includes every final unit test.
Coverage still measures loaded files, rather than the entire repository.

| Metric | Control | Complete suite |
| --- | --- | --- |
| Statements | 81.12% | 81.23% |
| Branches | 75.76% | 75.93% |
| Functions | 79.33% | 79.51% |
| Lines | 83.28% | 83.37% |
| `AdvAtlas.tsx` branches | 77.98% | 84.90% |
| `AdvAtlas.tsx` lines | 84.61% | 90.59% |
| `TripAtlasMap.tsx` branches | 69.75% | 70.24% |

The renderer's branch coverage remains modest despite the new behavior checks.
Executing a branch does not prove correct ordering across asynchronous events.
The failing regressions provide that additional evidence.

Clean installation and both full builds use the configured Node.js 24.22.1 and npm 12.2.1.
They run in an isolated source copy.
The production build imports three published stories and validates their public assets.
The development build imports 11 published and draft records.
Generated local previews in the working directory remain available.

| Check | Result |
| --- | --- |
| Clean `npm ci` in isolated source copy | Passed |
| ESLint | Passed with no warnings |
| TypeScript project checks | Passed |
| Full Vitest suite with V8 coverage | 1,796 passed in 120 files |
| Python temperature tests | 17 passed |
| Production trip browsers | 200 passed; 10 expected skips |
| Atlas browsers after the final constructor correction | 73 passed; eight expected skips |
| Fixture and smoke browsers | 79 passed; five expected skips |
| Full production build with fresh imports | Passed |
| Full development build with fresh imports | Passed |
| Development publication boundary | All eight draft pages use `noindex`; RSS and sitemap exclude every draft |
| Production dependency audit | Zero findings |
| Full dependency audit | Failed: 12 moderate development findings |
| Local links in changed Markdown files | All file targets exist |
| `git diff --check` | Passed |

The trip browsers include desktop Chromium, phone Chromium, and phone WebKit.
The fixture suite includes desktop Chromium and WebKit.
Skips exclude unsupported input or browser combinations.
The new keyboard test first exposed Safari's different Tab behavior.
Its corrected WebKit navigation sequence passes in the final complete browser run.

The temporary build copy is removed after inspection.
Verification logs and coverage summaries remain under `/private/tmp/rsmb-critical-review-*`.

## Limits

The full dependency audit remains a CI blocker.
Real-phone cold-cache measurements and an actual Linux CI run remain release work.
Draft publication still requires the source and media checks in `TODO.md`.

Local verification artifacts use `/private/tmp/rsmb-critical-review-*`.
