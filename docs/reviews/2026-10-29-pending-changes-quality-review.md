# Pending-change quality review: 2026-10-29

The pending patch passed 1,541 unit tests but contained eight additional behavior defects and two lint errors.
All confirmed defects below are corrected. The final suite passes 1,576 unit tests.

## Scope

The baseline is `2a6b8171afc0950cc586f0691bcd2960a9afca64`.
The review covers tracked changes and new files present in the working tree.
These include Tornado Tracks, trip animations, Kalaloch content, hosting rules, tests, and documentation.

There was no originating issue or separate specification.
The behavior contract comes from the trip authoring guide, the Tornado Tracks guide, and the earlier implementation review.
Independent agents reviewed standards and specification compliance. The main review reproduced failures and applied fixes.

## Standards

The independent review confirmed one behavior finding. It found no separate documented-standard violation after excluding checks enforced by tooling.

**P2: Phone controls covered data errors and Retry.**
`TornadoSummaryPanel.tsx` used `z-40`; the error overlay in `TornadoMap.tsx` used `z-30`.
An open panel intercepted clicks on Retry after a historical request failed.
The browser regression reproduced that exact interception.
Errors now appear at `z-50`. The test recovers without closing the controls.

Standards result: one finding corrected. The hidden recovery action was the most severe finding on this axis.

## Spec

The independent review confirmed two partial requirements in `shared/tripManifestSchema.ts`.

1. **P2: Accepted media hosts conflicted with production policy.**
   The authoring guide permits “HTTPS URLs under the trip's existing `data.rsmb.tv` prefix.”
   The schema accepted any HTTPS origin. Such a manifest could pass validation and fail under production CSP.
   Remote media now requires the CDN origin and the correct trip directory.
   Tests cover another host, another trip, path traversal, credentials, and an unsupported port.
2. **P2: The video and poster accepted each other's file types.**
   The guide says, “Use an MP4 and a still WebP poster.”
   Both fields previously accepted `.mp4` and `.webp`.
   `src` now requires MP4. `poster` now requires WebP.
   Tests reject swapped bundled files and swapped remote formats.

Spec result: two findings corrected. Unsupported media origins caused the most severe contract failure on this axis.
The review found no additional specification mismatch in the documented tornado loading and filtering changes.

## Additional engineering findings

### P1: A failed write could destroy the previous tornado archive

`writeYearCollections` removed existing yearly files before replacement summaries were complete.
A disk error could leave missing geometry and mismatched summaries.
The first regression reproduced the loss by failing a write after the old directory was removed.

`writeTornadoOutputs` now creates the complete replacement in a sibling staging directory.
It then renames the previous directory to a backup and promotes the staged directory.
If promotion fails, it restores the backup.
If restoration fails, an `AggregateError` retains both causes and identifies the backup path.
The writer preserves unrelated files and removes obsolete generated years after successful replacement.

Tests cover write failure, promotion failure, failed restoration, obsolete files, unrelated files, and staging cleanup.
Directory promotion is not a crash-atomic operation across both renames.
A process interruption can leave a retained `.previous` directory that requires manual restoration.
The project guide now explains that recovery condition.

### P1: One invalid source year could publish an incomplete archive

The pending guard rejected an entirely empty archive. It still accepted a single empty year within a larger archive.
It also accepted tracks whose year did not match the downloaded filename.
That could replace a valid archive with incomplete or misdated data.

Each downloaded year must now contain valid tracks from that year.
Validation runs before output replacement.
Tests supply an empty 2023 CSV and a 2023 file containing 2024 tracks.
Both cases retain the previous summary and geometry.

### P2: Annual metadata was trusted before its shape was checked

`useTornadoData` treated a network response as `AnnualTornadoSummary[]` without runtime validation.
`null` and object responses crashed rendering. An empty response allowed guessed geometry URLs.
Duplicate years, incomplete rows, and unsorted years could also corrupt chart inputs.

The loader now requires nonempty metadata, unique supported years, and finite, nonnegative metrics.
It sorts valid rows before exposing them to charts.
Invalid metadata produces a recoverable error and stops geometry requests.
Tests cover malformed responses, duplicates, negative values, future years, sorting, and retry after repair.

### P2: Development rewrote CDN videos to nonexistent local assets

`parseTripManifest` rewrote animation URLs to `/data/trips/...` during development.
The still-photo processor does not create those video files.
The same accepted manifest therefore worked differently between development and production.

The animation rewrite was removed. CDN animation URLs now remain intact.
A regression checks the exact video and poster URLs after development parsing.

### P3: A missing selected year removed every histogram tab stop

`TornadoTimeline` used `tabIndex=0` only when a bar matched `startYear` exactly.
A valid range starting between published years made every bar unavailable through Tab.
The timeline now uses the first available year at or after the range start, with a fallback to the first bar.

Tests cover that gap, arrow navigation, year boundaries, constrained sliders, playback, wrapping, partial decades, and timer cleanup.

### Build gates

Initial ESLint checks failed in two places:

- The animation fallback called state setters synchronously inside an effect.
  Initial state now handles browsers without `IntersectionObserver`.
- A line break separated an `it.each` call from its test declaration.
  The test declaration now uses an unambiguous call expression.

The final lint and type checks pass.

## Documentation changes

The Tornado Tracks guide now uses recorded county segments consistently.
It no longer describes sync-generated summaries as build artifacts or start points as an additional density download.
The guide also documents validation, replacement recovery, and focused tests.

The authoring guide defines supported animation origins, directories, file types, and development behavior.
The test guide distinguishes mocked playback from browser decoding.
The documentation index includes both October 29 reviews.
`TODO.md` contains current follow-up work in one section.
Edited procedures use short sentences, active voice, and consistent terms.

## Validation

| Check | Result |
| --- | --- |
| Vitest with V8 coverage | 1,576 passed across 108 files; 35 tests added during this review |
| Python temperature pipeline | 17 passed |
| Browser smoke suite | 20 passed, including phone WebGL, desktop WebGL, and desktop SVG tornado cases |
| Production trip browser suite | 106 passed; two desktop touch-only cases skipped |
| Production trip browsers | Desktop Chromium, phone Chromium, and iPhone WebKit |
| ESLint and TypeScript | Passed |
| Production `vite build` | Passed with the existing local content registry |
| Terraform | Formatting and validation passed; three mock tests passed |
| Dependency audit | Zero advisories reported by `npm audit --audit-level=moderate` |
| Kalaloch local assets | Both bundled animation fingerprints validated; all 20 primary photo files exist locally |
| Whitespace checks | Passed |

The host used Node.js 26.12.0 and npm 11.20.0.
Node.js is within the declared supported range; npm differs from the pinned npm 12.2.1.
No dependency installation or lockfile change was required.
Terraform used a temporary data directory and mocked AWS responses. The production backend was not accessed.

## Coverage comparison

Both measurements use the same final application source, compiler, and V8 provider.
The baseline excludes tests whose names contain `review regressions`.
It executes the original 1,541 cases. The final measurement includes all 1,576 cases.

| Metric | Baseline | Final |
| --- | --- | --- |
| Statements | 79.10% (6,409/8,102) | 80.02% (6,484/8,102) |
| Branches | 73.07% (4,476/6,125) | 74.17% (4,543/6,125) |
| Functions | 77.19% (1,493/1,934) | 78.33% (1,515/1,934) |
| Lines | 81.25% (5,606/6,899) | 82.22% (5,673/6,899) |

The same commands produce the comparison:

```bash
npm run test:coverage -- --coverage.reporter=json-summary --coverage.reporter=text \
  --coverage.reportsDirectory=/tmp/rsmb-review-baseline-report -t '^(?!.*review regressions)'
npm run test:coverage -- --coverage.reporter=json-summary --coverage.reporter=text
```

These reports measure loaded source files. They do not measure the complete repository.
Timeline line coverage increased from 0% to 85.07% in this comparison.

## Limits and remaining work

Filtered historical comparisons still load geometry. Basemap network failures still need a dedicated recovery path.
See [current tornado tasks](../../TODO.md#tornado-tracks) for the remaining engineering work.

Kalaloch source dates, captions, route assignments, and CDN publication still require the existing publication checks.
Local asset presence does not establish factual accuracy or public availability.
This review preserves the pending content edits without marking the trip ready for publication.

The full Google content sync, production tornado sync, uploads, and deployment were not run.
Playback unit tests mock media APIs; this review did not validate the bundled MP4 with a browser decoder.
