# Trip content and atlas review

Review date: October 30, 2026.

The review found three atlas defects: stale camera snapshots, shared history keys, and incorrect fullscreen icons after recovery.
All three are corrected. A development dependency advisory remains open.

## Scope

The user selected the working tree and recent atlas and trip changes.
The committed comparison is `git diff da66ac5 0c4f080`.
It covers report buttons, development previews, the project rename, interaction recovery, publication artifacts, and saved views.
The working-tree review includes both recovered trip manifests, four outlines, the source inventory, and color assignments.

The standards and specification reviews ran independently through the code-review skill.
Standards came from [the repository guide](../../README.md), [the documentation rules](../README.md#writing-rules), and the trip guides.
The [atlas guide](../trips/ADV-ATLAS.md) and [authoring guide](../trips/TRIP-AUTHORING-README.md) supplied the behavior requirements.

## Standards

### P2: Navigation saved the camera too early

`AdvAtlas.tsx` persists its session during parent cleanup.
`TripAtlasMap.tsx` previously updated that session at `moveend` and during child cleanup.
React runs the parent's cleanup before the child's cleanup.
Opening a report during a fit animation or gesture could therefore persist the previous camera, or no camera.

This violated the atlas requirement: “Returning restores the camera, panel state, and card position within the same browser tab.”

The renderer now captures the camera on each `move` event.
It updates the in-memory session synchronously, before navigation or `pagehide` can persist it.
Overview comparison still runs at `moveend`.
The existing initialization and disposal guards remain active.

Tests check a parent snapshot during an unfinished gesture, a fit in progress, and callbacks from a removed renderer.

### P3: Renderer recovery reversed the fullscreen icon

The renderer reused MapLibre's fullscreen control to retain fullscreen through retries.
MapLibre retained the control's state but recreated its button with the enter-fullscreen icon.
After recovery, the button said **Exit fullscreen** while showing the enter icon.
Exiting then reversed the mismatch.

This was a usability defect. The coding standards did not specify an icon implementation.
`AtlasFullscreenControl` now records public fullscreen events and sets the rebuilt button's classes from that state.
The adapter uses MapLibre's public control methods and events.
It does not access private control fields.

The unit test uses the installed MapLibre control.
It checks reattachment, exit, labels, icons, and gesture restoration.
Browser tests also check the icon after a real WebGL failure and retry.

## Spec

### P2: A fresh direct visit could restore another visit's camera

The atlas read saved state using React Router's history key.
Direct document loads without a stored key received the shared value `default`.
Separate visits in one tab could therefore share a saved camera and panel state.
The restored camera also suppressed the requested trip's initial fit.

This violated the atlas requirement: “A fresh visit through a copied URL frames the selected trip.”

Application startup now assigns a unique key before the router mounts.
The key stays in the browser history entry, so reloads retain it.
Separate entries receive different keys, including separate visits to the same URL.
Existing router keys and user state remain intact.

Key generation uses `crypto.getRandomValues`.
It also works on HTTP development origins where `crypto.randomUUID` is unavailable.
Unit tests cover that case and uninitialized history state.
The browser regression leaves the atlas, revisits the same URL, and then opens a different trip.
It checks keys, panel state, selection, and painted route bounds.

## Content and documentation

The recovered manifests and outlines have consistent IDs, dates, counts, and track assignments.
The new tests compare every inventory entry with its tracked manifest.
They check Mississippi–Wisconsin responsive filenames, capture dates, gallery placements, and importer expansion.
They also check all 37 calendar days and recorded-track placements across the three 2026 outlines.

The 2026 manifest intentionally retains `hero: null`, no photos, and the `.json.draft` suffix.
It must fail the production schema until a real hero photo is selected.
The production and development publication tests continue to pass.

The source inventory now identifies itself as a dated snapshot.
The atlas and testing guides describe history keys, movement snapshots, fullscreen recovery, and the new regression commands.
Edited instructions use short sentences, active verbs, and consistent terms.
This is an approximate ASD-STE100 cleanup, without formal vocabulary certification.

The source inventory records prior Sheet and archive checks.
This review checks repository consistency. It does not independently verify those external sources or unpublished CDN assets.
Publication work remains in [TODO.md](../../TODO.md#content-publication).

## Dependency security

The full audit reports 12 moderate findings from one minimatch advisory in the ESLint dependency tree.
The installed minimatch version is `10.2.6`.
The [upstream advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) identifies `11.0.1` as patched.
It describes excessive resource use when attacker-controlled patterns use optimization level 2 or higher.

The latest inspected ESLint and TypeScript ESLint packages still require minimatch 10:

| Package | Inspected version | minimatch requirement |
| --- | --- | --- |
| `eslint` | `10.14.0` | `^10.2.6` |
| `@eslint/config-array` | `0.23.5` | `^10.2.4` |
| `@typescript-eslint/typescript-estree` | `8.72.1` | `^10.2.2` |

The repository guide prohibits forcing incompatible dependency majors.
The task is recorded in [TODO.md](../../TODO.md#build-and-maintenance) for a compatible upstream update.
No dependency version or lockfile was changed.
The production-only audit reports zero vulnerabilities.
That result does not clear the full development dependency audit.

## Validation

Verification uses Node.js `26.12.0` and the declared npm `12.2.1` from a temporary installation.
The host's global npm remains unchanged.

| Check | Result |
| --- | --- |
| Complete Vitest suite | 1,756 passed in 119 files |
| Python temperature tests | 17 passed |
| Atlas and article budget browsers | 72 passed; six expected phone skips |
| Final navigation, recovery, and budget checks | 24 passed across three browser projects |
| Shared startup smoke tests | 10 passed in Chromium and WebKit |
| TypeScript project checks | Passed |
| ESLint | Passed with no warnings |
| Full dependency audit | 12 moderate findings; see the dependency section |
| Production dependency audit | Zero reported vulnerabilities |
| Documentation file links | Passed in ten changed Markdown files |
| Patch whitespace | Passed |

The six browser skips exclude desktop hover and keyboard-panning cases on phone projects.
The final focused browser run uses the completed history-key implementation.
It covers reloads, fresh direct visits, report returns, fullscreen recovery, and article JavaScript budgets.
The smoke suite checks the shared startup change on the home, flights, and temperature pages.

The new behavior tests were also run with the fixes temporarily removed.
Twelve cases failed, including all three camera movement cases, the fullscreen case, and history-key cases.
The fixed sources were restored before final verification.

### Controlled coverage comparison

Both measurements use identical application source, the same compiler, and the same V8 coverage provider.
The control marks only the 19 new regression cases as skipped.
It runs 1,737 tests, including the new Mississippi–Wisconsin responsive-photo parameter.
The complete measurement runs all 1,756 tests.
Temporary test exclusions were removed after the control run.

| Measure | Control | Complete |
| --- | ---: | ---: |
| Statements | 80.84% | 80.99% |
| Branches | 75.24% | 75.37% |
| Functions | 78.95% | 79.14% |
| Lines | 83.02% | 83.15% |

Both runs measure the same 245 loaded source files and 7,606 executable lines.
Coverage measures loaded source. It does not measure every repository file.
The new history utility and fullscreen adapter reach complete statement coverage.
The atlas renderer still has 78.04% line coverage.
Browser checks exercise its real rendering and interaction paths separately.

Standards: two findings, worst P2 camera persistence. Spec: one finding, P2 fresh-visit restoration.
