# Trip editorial cleanup and photo quality review: 2026-10-29

The pending changes removed duplicate content and corrected portrait sizing.
They passed unit checks but left a caption overflow defect in the affected photo component.
This review reproduced the defect in two browser engines and corrected the shared caption style.

## Scope and baseline

The fixed baseline is commit `956c183`.
The review covers the pending changes in three trip manifests, `TripPhoto`, its tests, and the editorial report.
It also checks the shared photo styles, gallery integration, viewer lifecycle, and asset update command.
It does not claim a complete audit of every project in this repository.

There is no originating issue or separate specification.
The behavior contract comes from the trip authoring guide, testing guide, editorial findings, and existing tests.
Two independent reviewers checked standards and documented behavior.
Both found no additional defect in the initial source diff.
The main review added browser cases, reproduced the caption defect, and applied the correction.

## Standards

### P2: Shared caption behavior was implemented only for galleries

The wrapping rule used `.trip-gallery-photo figcaption`.
Standalone `TripPhotoFigure` instances use the same caption markup but do not have that gallery class.
A long word or URL could therefore extend outside a portrait or panorama caption.
This affected pointer overlays and captions below photos on touch screens.

Before the correction, the new browser case failed in Chromium and WebKit.
WebKit measured 1,227 pixels of caption content inside a 272-pixel caption at a 320-pixel viewport.
The existing unit assertions checked class names and `sizes` text. They could not detect this layout failure.

The rule now targets `.image-caption-overlay`, which both layouts use.
The gallery-specific rule was removed. Each caption has one wrapping policy.
The browser cases check caption bounds and complete page width with pointer and touch input.

### P3: The editorial report presented an old snapshot as current

The report described 82 Boise photos, unused gallery definitions, and stale heading IDs.
The pending manifests already corrected those issues.
The report also said that it described the current working tree.
That combination made completed work appear incomplete.

The report now identifies its initial snapshot and lists completed local corrections first.
Historical counts and line references remain labeled as snapshot evidence.
The documentation index links both reports.
Unresolved source corrections are listed in `TODO.md`.

The independent standards review found no separate documented-standard violation or maintainability concern in the initial source diff.
No new abstraction was needed for the portrait sizing branch.
Its text-column dimensions match the existing gallery convention and application layout.

Standards result: two findings corrected. Caption overflow had the greatest effect on readers.

## Spec

The initial source changes satisfy the available local contract:

- Single portraits use the text column. Landscapes and square photos retain the wider media area.
- Explicit panorama placement takes priority over photo orientation.
- All three layouts retain image height after failure.
- Boise retains one copy of each selected photograph. Its manifest has 79 photos.
- Removed photo and gallery IDs have no remaining references in the current imported stories.
- The four corrected day heading IDs match the current generated headings.
- The asset update command maps the existing manifest photo list. Extra prepared photos cannot restore removed entries.

The independent spec review found no missing requirement or confirmed scope expansion.
The added browser checks measure standalone photo geometry instead of relying on CSS class assertions.
They also check responsive source selection on high-density displays.

Spec result: no additional confirmed findings. No separate originating specification was available.

## Tests and coverage

Two new unit cases check unknown photo errors and viewer cleanup.
The cleanup case changes the selected photo and disables its link before unmounting.
It verifies that old lightboxes are destroyed and that an unlinked photo creates no viewer.
The four pending orientation and layout cases remain in the suite.

Two new browser cases check standalone layouts and long captions.
The existing responsive source case now includes standalone portraits, landscapes, and explicit panoramas.
Width checks run at 320, 768, 1184, and 1440 pixels.
Caption checks also include 390- and 800-pixel widths, pointer input, and touch input.

Both V8 measurements use the same application TypeScript source, compiler, and provider.
The production correction after the first measurement changes CSS only.
The baseline includes all 1,623 unit cases present at review start.
The final measurement includes 1,625 cases.
These reports measure loaded source files. They do not measure the complete repository.
Browser layout checks do not contribute to V8 coverage.

| Metric | Before | After |
| --- | --- | --- |
| Statements | 80.71% (6,770 / 8,388) | 80.72% (6,771 / 8,388) |
| Branches | 75.03% (4,762 / 6,346) | 75.05% (4,763 / 6,346) |
| Functions | 79.14% (1,586 / 2,004) | 79.14% (1,586 / 2,004) |
| Lines | 82.80% (5,894 / 7,118) | 82.80% (5,894 / 7,118) |

`TripPhoto` statement coverage increased from 95.83% to 100%.
Its branch coverage increased from 97.95% to 100%.
The repository increase is small. The main new evidence is the browser regression that failed before the CSS correction.

## Validation

| Check | Result |
| --- | --- |
| Full Vitest suite with V8 coverage | 1,625 passed across 111 files |
| Python temperature pipeline | 17 passed |
| Gallery and article fixtures | 38 passed in desktop Chromium and WebKit |
| Production trip browser suite | 115 passed; two desktop touch-only cases skipped |
| Production browser projects | Desktop Chromium, phone Chromium, and iPhone WebKit |
| Production application build | Passed with the existing local content registry |
| ESLint and TypeScript | Passed |
| Trip content checks | Three manifests, 114 distinct photos, and 342 responsive sources passed |
| Documentation and whitespace | All 64 local links in six edited documents resolve; whitespace checks passed |
| Dependency advisory audit | Zero known vulnerabilities reported by `npm run audit` |

Content checks validate schemas, bundled animation fingerprints, current story references, and local image dimensions.
Decoded image hashes confirm that each manifest contains distinct primary photos.
All declared responsive candidates exist locally and have the expected widths.
The build command was `npx vite build`.
The production browser command also built the application with fixed content.
Neither build refreshed Google content or flight data.

The first browser attempt could not start browser processes inside the sandbox.
The completed browser checks ran with approved sandbox escalation.
The first advisory request could not resolve `registry.npmjs.org` inside the sandbox.
Automatic approval review rejected the escalated request because it would disclose dependency metadata to the public npm service.
After explicit user approval, the audit completed and reported zero known vulnerabilities.
This result checks reported dependency advisories. It does not prove that application code has no security defects.

The authoring and testing guides now state the standalone portrait rule, caption wrapping behavior, and regression checks.
Updated instructions use short sentences, active voice, and consistent terms.
This is a practical simplified-English edit. It is not a certified ASD-STE100 compliance review.

## Limits and remaining work

The source Google Docs and Sheet were not changed.
Generated MDX was checked locally. It was not edited because the next content import would replace those edits.
Copy corrections, ferry wording, Boise route provenance, the overnight boundary, and location confirmation remain source work.
See the [editorial report](2026-10-29-trip-editorial-review.md) and [open work](../../TODO.md#trip-story-sources).

Local media checks do not establish public CDN availability.
No assets were uploaded and no site or infrastructure was deployed.
The host used Node.js 26.12.0 and npm 11.20.0.
Node.js is in the declared range. The project pins npm 12.2.1.
Dependencies and the lockfile were not changed.
