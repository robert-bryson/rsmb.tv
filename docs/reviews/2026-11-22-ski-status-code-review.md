# Ski-status code, data, and release review

November 22, 2026

The review compared `feature/ski-status` with `main` at `0ec3dfd`. It included the pending About panel, map controls, snow chart, and catalog batches.

## Findings and fixes

| Impact | Finding | Fix and regression check |
| --- | --- | --- |
| High | The clean build test expected visitor data in one named chunk. About moved that data to a shared chunk. The privacy assertions still targeted the old chunk. | Check the public visitor record across the bundle. Check all emitted JavaScript and source maps for excluded research fields. [Clean build test](../../scripts/__tests__/ciBuild.test.ts) |
| Medium | The local runtime asset server could return changed terrain or icon bytes under an existing checksum URL. | Use the same SHA-256 check for runtime and research files. Reject changed bytes before sending an HTTP range. Reuse the check while the file metadata matches. [Asset server](../../scripts/ski-assets-plugin.ts), [Byte range tests](../../scripts/__tests__/skiAssets.test.ts) |
| Medium | The browser returned the cached feed as a success after it rejected an older or conflicting manifest. About showed the feed as reachable. | Report the failure and keep the last verified snapshot. Test recovery with the original manifest and a later rollback. [Feed loader](../../src/features/ski-status/conditions-feed.ts), [Feed tests](../../scripts/__tests__/syncSkiStatus.test.ts) |
| Medium | A report-only run skipped forecast requests for all resorts while any forecast remained current. Missing rows could wait until the next six-hour refresh. | Retry the missing or expired forecast for each area. Keep the other forecast rows. [Collector](../../projects/ski-status/scripts/conditions-publication.ts), [Publication tests](../../scripts/__tests__/syncSkiStatus.test.ts) |
| Medium | The Aspen Snowmass reservation change covered only part of the group. | Apply the operator's 2026/27 reservation terms. Test the seven shared Ikon days, Snowmass-only Base access, and Base blackouts. [Operator terms](https://www.aspensnowmass.com/partner-passes/ikon-pass/ikon-pass-holders-guide-to-aspen-snowmass), [Pass tests](../../src/test/skiStatusRelease.test.ts) |
| Low | The rsmb.tv links led to the preview's homepage when viewed on a preview. | Use the canonical rsmb.tv address from both the header and About. [About](../../src/features/ski-status/SkiProjectInfo.tsx), [Browser tests](../../tests/e2e/ski-status.spec.ts) |
| Low | The chart test expected an older Aspen Highlands source. The NAS terrain check exceeded the standard five-second deadline on the first run. | Compare the chart link with the current catalog citation. Give the NAS check its own test deadline. [Browser tests](../../tests/e2e/ski-status.spec.ts), [Archive test](../../scripts/__tests__/skiResortTerrain.test.ts) |

The dashboard tests cover feed and snapshot labels, local ski days, and empty records. The map control tests cover keyboard focus after clearing an area. They also cover preview and applied states and an empty visible area. [Dashboard tests](../../src/test/skiStatusDataStatus.test.tsx), [Component tests](../../src/test/skiStatusComponents.test.tsx)

## Coverage

The V8 runs use the same test filters and source paths. These cover the ski-status page, feature modules, collector scripts, and shared ski modules. Chromium tests cover the WebGL renderer separately.

| Measure | Before | After |
| --- | ---: | ---: |
| Focused tests | 365 | 371 |
| Statements | 69.93% | 72.30% |
| Branches | 69.67% | 71.76% |
| Functions | 74.38% | 78.16% |
| Lines | 71.24% | 73.66% |

## Verification

| Check | Result |
| --- | --- |
| Repository | 4,013 Vitest tests and 37 Python tests passed. |
| Ski-status browser | All 80 Chromium cases passed. They cover the About panel, snow chart, map scope, and terrain. |
| Release validator | All 22 Chromium fixture cases passed. |
| Runtime assets | The production-mode Vite build verified 80 ski-status assets. They total 13,264,361 bytes. |
| Infrastructure | Three Terraform cases passed for rewrites, the release gate, and sync permissions. |
| Static checks | TypeScript, ESLint, and the whitespace check passed. npm reported zero known vulnerabilities. |

The runtime asset check used a temporary copy of the NAS inputs. The build used the production bundle settings with the public directory copy disabled. The verification scanned 210 emitted JavaScript files and maps for research-only fields.

## Documentation

The project guide describes the About panel, combined snow chart, map area control, and forecast retry. The task list puts the release steps first. It links to the evidence for completed checks. [Project guide](../../projects/ski-status/readme.md), [Project tasks](../../projects/ski-status/TODO.md)

The revised prose follows the repository's ASD-STE100 guidance for short sentences, active voice, and consistent terms.
All measured sentences in the project guide, task list, and two new reviews met the 20-word check. [Writing rules](../README.md#writing-rules), [ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf)

## Hosted release

On November 22, production and the hosted preview reported revision `0ec3dfd`. The public conditions manifest returned HTTP 403. [Production revision](https://www.rsmb.tv/deployment.json), [Preview revision](https://release-preview.d38ki8k4lanh8s.amplifyapp.com/deployment.json), [Conditions manifest](https://data.rsmb.tv/ski-status/manifest.json)

The first hosted release needs the runtime asset mirror, the Amplify rewrite, and a preview check on the candidate revision. The public live feed needs the scoped sync role and a successful publication. [Release tasks](../../projects/ski-status/TODO.md#release-checks)
