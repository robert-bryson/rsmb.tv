# Trip registry and manifest review: 2026-10-01

## Scope

This review covers the pending trip loader, its tests, the Boise manifest changes, and the new Kalaloch manifest.
It also checks the local story references, prepared assets, and related publication instructions.
It does not certify unrelated application features or source facts.
No Google document, Sheet row, S3 object, or infrastructure setting was changed.

## Findings

### P1: production accepted a missing post registry

The loader used an empty array when the generated post registry was absent.
The article generation hook used the same fallback.
A production build could succeed without its articles after an omitted or failed import.

Both hooks now use one registry reader.
The reader permits an absent registry in development. It rejects an absent registry in production.
An existing empty registry remains valid. These checks do not certify the import source or article count.
Tests cover both virtual modules and article generation.
See the [loader](../../scripts/trip-content-plugin.ts) and [contract tests](../../scripts/__tests__/tripContent.test.ts).

### P2: development required a trip directory

The pending change avoided watching an absent post registry.
However, the trip loader still read the trip directory without an existence check.
Development could fail when that directory was absent.
The original test always created the directory, so it did not cover this case.

An absent trip directory now produces an empty registry.
Production still rejects a published trip whose manifest is absent.
Vite integration tests cover absent content and an existing trip without a post registry.
Other tests cover invalid development manifests, production rejection, excluded drafts, and removal of development metadata.

### P1: public trip assets remain unavailable

The Boise and Kalaloch public route and hero URLs returned HTTP 403 during this review.
Both trips remain unpublished in the local generated registry.
Do not publish either trip until every public asset URL passes the publication checks.
The HTTP result does not identify the cause. A missing object and an access restriction can require different corrections.

Both manifests pass the shared schema checks.
All 102 local photos match their declared dimensions.
Both local routes contain valid geometry and every declared track ID.
The imported stories have no unknown gallery references.
These local results do not prove public availability or correct authored facts.

The Boise manifest now contains 82 photos. The old TODO count was 81.
Kalaloch contains 20 photos and three tracks.
Some track filenames disagree with the stated trip dates. The review did not infer replacement dates from filenames.
Source dates, distances, riding days, and reconstructed tracks still require review.
See the [publication blockers](../../TODO.md#publication-blockers).

## Documentation

The current guides now distinguish empty development previews from failed production imports.
The TODO file contains separate Boise and Kalaloch publication blockers.
The documentation index links to this dated report.
The revised text uses short sentences, active voice, and consistent technical terms under the repository ASD-STE100 rules.
No automated language certification was performed.

## Validation

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript | Passed |
| Dependency audit | Zero reported vulnerabilities |
| Vitest | 1,166 tests passed in 84 files |
| Temperature tests | 17 passed |
| Chromium smoke tests | 9 passed |
| Production trip tests | 26 Chromium tests passed |
| WebKit trip tests | 13 launch failures; required host libraries are absent |
| Local image dimensions | 102 photos matched |
| Local routes and story galleries | No invalid geometry or unknown references |
| Fixture production build | Passed |
| Production build with existing local content | Passed |

The full suite covers 74.73% of statements, 67.52% of branches, 72.15% of functions, and 77.31% of lines.
These percentages measure loaded source files. They do not measure every repository file.

The focused comparison uses the same edited loader in both runs.
The first run excludes the nine added cases. The second run includes all 43 contract tests.
This comparison measures added test coverage. It does not compare two repository revisions.

| Loader metric | Existing 34 tests | Expanded 43 tests |
| --- | --- | --- |
| Statements | 66.66% | 82.53% |
| Branches | 56.98% | 75.26% |
| Functions | 75.00% | 82.14% |
| Lines | 70.52% | 87.36% |

The build still reports large visualization chunks and Tailwind source-map warnings.
Those existing maintenance tasks remain in the TODO file.
The production build used existing local content. It did not run a new Google import.
CI installs the WebKit libraries. Local Chromium results do not replace the WebKit gate.

## Remaining limits

Do not publish Boise or Kalaloch until their asset and source-review tasks are complete.
Passing schema and browser tests does not verify trip dates, distances, photo subjects, or captions.
The reviewed code changes address loader failures. They do not correct external asset delivery.
The current documentation was updated. Earlier reports retain their dated findings and results.
