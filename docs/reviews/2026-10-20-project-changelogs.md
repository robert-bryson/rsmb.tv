# Project changelog review: 2026-10-20

## Scope

The baseline is commit `d1e80dbd037d0645b6ca454d49a065d1c69db711`.
The review covers the six pending project changelog files and their date, page, metadata, and test dependencies.
The README changelog rules define the expected behavior.
Separate review passes checked repository standards and behavior.

The review did not find a critical or high-severity defect in this scope.
It found one content error, an existing date-formatting defect, and missing regression checks.

## Standards

### P3: duplicated date parsers silently changed calendar values

`formatProjectDate` used `parseInt` and a numeric `Date` constructor.
It accepted incomplete numbers, ignored invalid days, and normalized invalid months.
The changelog component had a separate numeric date parser with similar behavior.

Examples reproduced before correction:

| Input | Project card result | Changelog result |
| --- | --- | --- |
| `2026-13` | Jan 2027 | Jan 2027 |
| `2026-02-30` | Feb 2026 | Mar 2, 2026 |
| `2026-05junk` | May 2026 | Invalid Date |
| `0099-05-15` | May 1999 | May 15, 1999 |

All current project dates were valid. This defect was present before the pending changes.
Eleven new regression assertions failed against the previous implementation.

The project helpers now use the existing calendar validator in [formatDate.ts](../../src/utils/formatDate.ts).
The validator checks the complete input and the resulting calendar fields.
Month formatting uses day one for validation. UTC formatting prevents local timezone changes from shifting the displayed date.
Invalid text stays unchanged for correction. The content tests reject invalid dates before CI passes.

`formatDate` also accepts short month names for changelog dates.
Its existing callers retain long month names.
No additional parsing dependency or runtime content schema was added.

Duplicated date logic was a maintainability concern, not a documented standards violation.
The source now stores each changelog note on a separate line to simplify review and editing.

### P3: tests did not verify the new date and list behavior

The original page tests checked a heading and metadata. They did not check the new card dates or the launch-year fallback.
The changelog tests checked list contents and ordering separately. They did not check machine-readable dates or month-to-note associations.
A nonempty date assertion also accepted `Invalid Date`.

New tests cover exact `datetime` values, displayed months, launch-year fallback, and each month's associated notes.
Date tests cover invalid months, invalid days, leap years, incomplete numbers, extra suffixes, and years below 100.
Content tests check real calendar dates and valid `YYYY-MM` changelog months.

Browser tests check all project card links and exact update dates.
They check the Through Routes changelog at widths of 320 and 1280 pixels.
The checks include native bullets, mobile stacking, desktop columns, aligned wrapped text, and document width.

No documented coding-standard violation remains in the reviewed changes.

## Spec

### P3: taxonomy cards appeared in the wrong month

The README requires features to use the month of their source commit.
Anki Artisan listed taxonomy hierarchy cards under April 2026.
Default-branch commit [`94f29ad396`](https://github.com/robert-bryson/anki-artisan/commit/94f29ad3968a82f74ad1863f420c28d06a543cbf) introduced those cards on March 18.
The April change moved an existing model into a module.

The note now appears under March. The April 30 update date remains correct for other represented features.
The README now requires a commit-diff check before assigning a release month.

### Source checks

All six external project repositories use `main` as their default branch.
Read-only GitHub queries verified their newest represented feature dates.
Local default-branch history verified the four projects maintained in this repository.

| Project | Latest represented feature date | Source commit |
| --- | --- | --- |
| Through Routes | 2026-10-02 | [`c8382a6ae7`](https://github.com/robert-bryson/through-routes/commit/c8382a6ae7f3bc691241a1bb8aefe4674c972860) |
| Flights | 2026-08-20 | [`f33f401`](https://github.com/robert-bryson/rsmb.tv/commit/f33f4013156d2231791c81265a16451e1aa49dd0) |
| Anki Artisan | 2026-04-30 | [`b7a78434db`](https://github.com/robert-bryson/anki-artisan/commit/b7a78434db5fdec3b00cd81d0956d6f6d834e405) |
| aborg | 2026-04-16 | [`5fa284e58c`](https://github.com/robert-bryson/aborg/commit/5fa284e58ca0b3ee43a448f0b8a9a42eb1a53573) |
| parc | 2026-09-29 | [`a38a137af4`](https://github.com/robert-bryson/parc/commit/a38a137af40051191f6722a4416b511b377552fd) |
| Bookend | 2026-05-08 | [`f2b0f98ea9`](https://github.com/robert-bryson/bookend/commit/f2b0f98ea98678e8ffebac9f6d4041b78f031b36) |
| U.S. Temperature Records | 2026-09-08 | [`37a324a`](https://github.com/robert-bryson/rsmb.tv/commit/37a324aafa0ea13304ef56d247d394952db16f9f) |
| Tornado Tracks | 2026-04-29 | [`febaffd`](https://github.com/robert-bryson/rsmb.tv/commit/febaffdb4defcb3f2301a05324549fe2ffd0b74a) |
| Status Dashboard | 2026-04-21 | [`17e361b`](https://github.com/robert-bryson/rsmb.tv/commit/17e361b79c777f1f3f5693abe5317ae79a8f402c) |
| route2gpx | 2026-04-07 | [`0e6f592553`](https://github.com/robert-bryson/route2gpx/commit/0e6f59255340d37a1786102c51dbf6802ee5836c) |

The temperature analysis command came from merged commit `3fef451` on September 4.
The September 8 commit added standing-record summaries. Its merged title still contains `[WIP]`; the title does not establish branch status.
The historical temperature publication checks remain open in [TODO.md](../../TODO.md#temperature-record-data).

The source review also checked the external projects' feature groups around their latest update dates.
It did not find another incorrect month or maintenance-only note.
This is a curated feature history. It does not claim to include every feature commit.

## Validation

| Check | Result |
| --- | --- |
| Initial focused baseline | 48 tests passed |
| Calendar regressions before correction | 11 assertions failed as expected |
| Final focused date and project suite | 91 tests passed |
| Complete Vitest suite | 1,231 tests passed in 88 files |
| Temperature pipeline | 17 tests passed |
| Site browser suite | 11 tests passed |
| Production trip browser suite | 48 tests passed in desktop Chromium, phone Chromium, and phone WebKit |
| Synthetic production build | Passed; existing JavaScript budgets passed |
| ESLint and TypeScript | Passed |
| Dependency audit | Zero reported vulnerabilities |
| Whitespace check | Passed |

The first site browser run overlapped HTML coverage generation.
Vite reloaded pages as the reports were written. Two assertions timed out during those reloads.
All 11 tests passed after report generation finished. No timeout or retry limit was increased.

Checks used Node.js 26.12.0 and npm 11.20.0 with the installed dependencies.
The configured installation uses npm 12.2.0. This review did not repeat a clean installation with that version.

## Coverage

The Projects page executed the same rendering branches in both measurements.
The compiler, V8 provider, and source filter were unchanged.
The initial measurement used four project test files. The final measurement added date utility and card fallback tests.

| Projects page measure | Before | After |
| --- | --- | --- |
| Branches | 87.5% (7/8) | 100% (8/8) |
| Statements | 100% (8/8) | 100% (8/8) |
| Functions | 100% (5/5) | 100% (5/5) |

The final focused run covered all statements, branches, functions, and lines in four modules.
Those modules are project content, changelog rendering, the Projects page, and the shared date utilities.
Other modules changed during extraction, so their percentages are not a controlled before-and-after comparison.

Full-suite coverage is 75.13% statements, 68.09% branches, 72.63% functions, and 77.67% lines.
These values cover measured files, not every repository file.
The application still has substantial test gaps outside this review, especially in provider fetchers, event logs, and temperature synchronization.
Existing follow-up work remains in [TODO.md](../../TODO.md).

## Limits

The source check verifies feature history. It does not establish that every feature is available on each live deployment.
The dependency audit checks known package vulnerabilities. It does not establish complete application security.
The production browser checks use synthetic content. They do not synchronize live Google documents.

Current instructions use short sentences, active voice, consistent terms, and separate procedures.
They follow the repository's ASD-STE100 writing goals without claiming formal compliance.

Review totals: two standards-axis findings, worst P3 date normalization; one spec-axis finding, P3 incorrect feature month.
