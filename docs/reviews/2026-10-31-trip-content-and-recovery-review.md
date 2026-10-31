# Trip content and fullscreen recovery review

Review date: October 31, 2026.

The review found a fullscreen recovery defect and an incorrect source-document claim.
Both are corrected. Current testing instructions now match the promoted 2026 manifest.

## Scope

The user selected the latest three commits and the working changes.
The baseline is `f1f0d76`; the reviewed head is `2681a4b`.
The comparison is `git diff f1f0d76`, including the new 2026 manifest.

The review covers atlas restoration, renderer recovery, publication filtering, recovered trip content, and current trip documentation.
Independent agents checked repository standards and specification compliance through the code-review skill.
Standards came from [the repository guide](../../README.md), [writing rules](../README.md#writing-rules), and the trip guides.
The [atlas guide](../trips/ADV-ATLAS.md) and [authoring guide](../trips/TRIP-AUTHORING-README.md) supplied the behavior requirements.

This is a focused review. It does not certify every project in the repository.
Concurrent multipart-trip research remains outside this change.

## Standards

### P3: A detached fullscreen control retained the wrong action

The atlas guide requires renderer retries to retain the fullscreen button's action, label, and icon.
The renderer retained one MapLibre control through every retry.
MapLibre removes its document event listener when the control detaches.

This sequence left the control with stale state:

1. Enter native fullscreen.
2. Lose the WebGL context.
3. Retry while WebGL initialization still fails.
4. Exit native fullscreen while the control remains detached.
5. Retry after WebGL becomes available.

The rebuilt button still said **Exit fullscreen** and showed the shrink icon.
Its action called `exitFullscreen()` when the document was already outside fullscreen.

`restoreAtlasFullscreenControl` now checks the stable target's actual fullscreen state.
It retains an active control and creates a fresh control after fullscreen ends.
The check supports standard fullscreen, WebKit fullscreen, and MapLibre pseudo fullscreen.
It uses DOM state and public control construction. It does not modify MapLibre's internal fields.

Two tests reproduced the incorrect label before the fix, using the installed control with native fullscreen events.
A desktop Chromium regression also checks failed construction, native exit, successful retry, and fullscreen reentry.
Existing phone tests continue to check fullscreen recovery.

The original adapter already had 100% line coverage.
That percentage did not establish that its lifecycle transitions were correct.

Standards result: one confirmed finding, P3 fullscreen recovery. No additional concrete standards violations were confirmed.

## Spec

### P3: Source-document instructions contradicted the inventory

The source guide states that the machine inventory records report rows and remaining gaps.
The pending prose claimed that Mississippi–Wisconsin's source Google Doc was linked in Sheet row 7.
The machine record retained `googleDoc: null` and instructed the next author to create the document.

A read-only check of the configured public Sheet found empty `google_doc_id` and `description` fields in row 7.
The Sheet still marks the report unpublished.
The prose and TODO now require the missing source link.
The machine instruction requires a source Doc ID, without assuming that the document itself does not exist.
The check did not modify the Sheet or import story bodies.

Specification result: one confirmed finding, P3 source-document consistency.
No remaining runtime specification violation or scope expansion was confirmed in the selected changes.

## Content and documentation

The 2026 manifest has a valid July 17 hero, responsive filenames, and matching gallery and day assignments.
Its 35 tracks and 37 calendar days remain consistent with the source inventory.
The `.json` suffix enables previews; it does not publish the reports.

The testing guide still required a photo-free `.json.draft`.
That instruction now describes the selected hero and the Sheet publication boundary.
New tests expand all three outlines and verify that every selected photo appears once across the series.
They also reject unresolved trip shortcodes.

New renderer tests cover initialization failure, background tile errors, route-source errors, worker errors, and WebGL errors.
They check selected-trip retention, camera restoration, and callbacks from removed renderers.

Edited procedures use short sentences, active verbs, and consistent terms.
This is an approximate ASD-STE100 cleanup, without formal vocabulary certification.
Historical review results retain their original context.
Publication tasks remain in [TODO.md](../../TODO.md#publication-blockers).

## Dependency security

The full npm audit still reports 12 moderate findings from one minimatch advisory in the development toolchain.
The production-only audit reports zero findings.
The [upstream advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) identifies versions below `11.0.1` as affected.

Current registry checks found these requirements:

| Package | Latest checked version | minimatch requirement |
| --- | --- | --- |
| `eslint` | `10.14.0` | `^10.2.6` |
| `@eslint/config-array` | `0.23.5` | `^10.2.4` |
| `@typescript-eslint/typescript-estree` | `8.72.1` | `^10.2.2` |

These packages still require minimatch 10. The patched major is outside those declared ranges.
The repository prohibits forced incompatible major updates.
No dependency versions changed. The existing [dependency task](../../TODO.md#dependency-security) remains open.
The full audit therefore remains a failing CI check.

## Validation

Verification used Node.js `26.12.0` and the configured npm `12.2.1` from a temporary installation.

| Check | Result |
| --- | --- |
| Complete Vitest suite | 1,765 passed in 119 files |
| New unit cases | Eight passed |
| Temperature pipeline | 17 Python tests passed |
| Atlas and article-budget browsers | 73 passed; eight expected skips |
| Focused renderer recovery browsers | 13 passed; two expected skips |
| TypeScript project checks | Passed |
| ESLint | Passed with no warnings |
| Production and development Vite builds | Passed with existing local content |
| Full npm audit | 12 moderate development findings |
| Production npm audit | Zero findings |
| Documentation file links | Passed for changed Markdown files |
| Patch whitespace | Passed |

Browser checks used desktop Chromium, phone Chromium, and phone WebKit with fixed content and tiles.
Six skips exclude existing desktop hover or keyboard cases on phones.
Two skips exclude the new native-fullscreen sequence on phones, which have separate fullscreen recovery checks.
The JavaScript budgets remain unchanged.

The local builds did not sync Google documents or publish assets.
The production build emitted no 2026 manifest chunk.
The development build emitted that manifest and included `noindex, nofollow` metadata.
Real-device performance and Linux renderer checks remain outside this macOS run.

### Coverage comparison

Both controlled measurements use the final application source and the same V8 coverage provider.
The control skips only the eight new unit cases. The complete measurement runs all cases.

| Measure | Control | Complete |
| --- | ---: | ---: |
| Statements | 80.99% | 81.09% |
| Branches | 75.39% | 75.58% |
| Functions | 79.06% | 79.20% |
| Lines | 83.17% | 83.25% |

Both measurements cover 7,620 executable lines in the same loaded source files.
Renderer line coverage rises from 78.04% to 80.48%.
Renderer branch coverage rises from 63.54% to 69.45%.
Coverage measures loaded source; it does not measure every repository file or replace browser behavior checks.

Standards: one P3 fullscreen finding. Spec: one P3 source-document finding. Both are corrected.
