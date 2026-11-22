# Ski-status driving access review

November 22, 2026

The review covers the driving map, feed publication, and catalog updates on `feature/ski-status`. At batch 37, the app catalog has 417 approaches for 175 ski areas. It includes 14 mapped entrances and 41 named passes. The road research has 415 approaches before the app applies the reviewed corridor records. [Driving guide](../../projects/ski-status/readme.md#driving-data-and-coverage), [Catalog checkpoint](../../projects/ski-status/research/data-quality-log.md#batch-37--2026-11-22)

## Findings and fixes

| Impact | Finding | Fix |
| --- | --- | --- |
| High | A line report could span a reviewed road section with both of its points outside the section. The overlap check missed it. | Check the shared distance and alignment on the same road and direction. Reject a crossing or contact at the exit. Check that each reviewed route joins its entrance connector. [Matching rules](../../shared/skiDriving.ts), [Catalog validation](../../shared/skiDrivingCatalog.ts) |
| High | A malformed agency record could disappear from a current report. An advisory with a future date could appear as a scheduled closure. | Reject malformed report payloads. Keep recurring or ambiguous events as advisories. Treat a Caltrans closure as active when the agency confirms its start. [Agency parsers](../../projects/ski-status/scripts/driving-parsers.ts), [DriveBC fields](https://api.open511.gov.bc.ca/help), [Caltrans fields](https://cwwp2.dot.ca.gov/documentation/lcs/lcs-field-description.html) |
| High | The conditions sync role could write driving files. The two publishers share a bucket. | Scope each role to its own manifest and snapshot names. Expire driving report and camera files after 30 days. Keep the manifest available. [Role policies](../../infra/github-actions.tf), [Storage lifecycle](../../infra/temperature-data.tf) |
| Medium | A bad camera cache could block report publication. One failed write could remove the staging directory before the other writes ended. | Refresh an invalid camera cache. Wait for all writes before cleanup. Keep the previous manifest if an upload fails. Publish a failed feed state when an agency check fails. [Publication code](../../projects/ski-status/scripts/driving-publication.ts) |
| Medium | The browser could show a cached report as current while checking a new provider scope. An expired map report could remove keyboard focus. | Show **Checking** during a scope change. Verify the checksum, provider, and time before use. Return focus when the open marker leaves the map. [Feed loader](../../src/features/ski-status/driving-feed.ts), [Browser checks](../../tests/e2e/ski-status.spec.ts) |
| Medium | The standard browser runner contacted live agencies during fixture tests. A Stowe test used the prior report URL. | Disable local driving collection in the runner. Check that the marker opens the official URL from the catalog. [Runner](../../scripts/run-playwright.js), [Stowe snow report](https://www.stowe.com/the-mountain/mountain-conditions/snow-and-weather-report) |
| Low | A failed camera image could stay failed for the life of its URL. | Retry when the user reopens the image. Check the camera host, path, ID, and age before display. [Camera controls](../../src/features/ski-status/SkiDrivingContent.tsx), [UI tests](../../src/test/skiStatusDrivingDetails.test.tsx) |

UDOT supplies route geometry as an encoded polyline. The collector uses it when present. It also accepts milepost labels such as `MP 9.1`. The Washington public feed has pass observations and alert text. Use the WSDOT link to check current closures and restrictions. [UDOT events](https://www.udottraffic.utah.gov/help/endpoint/event), [WSDOT traveler information](https://www.wsdot.wa.gov/traffic/api/)

## Verification

| Check | Result |
| --- | --- |
| Repository tests | 4,054 Vitest cases and 37 Python cases passed. |
| Catalog update | The 121 catalog and feature tests passed after batch 37. The operator map confirms Blue Mountain's Village lot point. [Blue Mountain parking](https://www.bluemountain.ca/discover-blue/getting-here) |
| Ski-status browser | All 85 Chromium cases passed. They include route selection, stale reports, camera requests, and map focus. |
| WebKit | All five driving cases passed with a temporary launcher and cached WSL libraries. |
| Release validator | All 22 Chromium fixture cases passed. |
| Terraform | All six mocked cases passed. They include S3 object permissions and driving snapshot retention. |
| Production-mode build | Vite built the batch 37 bundle and verified 140 mounted runtime assets. The build omitted the public directory copy. |
| Live agency inputs | A local run published report and camera snapshots for WSDOT, DriveBC, and Caltrans. All six checksums matched. |
| Static checks | TypeScript, ESLint, Terraform formatting, and Git whitespace checks passed. npm found zero known vulnerabilities. |

Local checks used Node 26.13.0 and npm 11.20.0. The hosted workflow uses the versions in `.nvmrc` and `package.json`.

The V8 comparison uses the driving modules in the browser, shared code, and collector scripts. The browser cases check the map renderer separately.

| Measure | Before | After |
| --- | ---: | ---: |
| Focused tests | 20 | 41 |
| Statements | 54.97% | 74.18% |
| Branches | 48.26% | 68.71% |
| Functions | 40.85% | 71.58% |
| Lines | 58.80% | 78.12% |

The revised documentation uses short sentences, active voice, and one action per instruction. A Markdown screen found that more than 99% of measured sentences meet the length limits. Dictionary and grammar checks require a separate review. [Writing rules](../README.md#writing-rules), [ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf)

## Release work

The hosted release needs the runtime asset mirror, an Amplify preview of the candidate, and a run with the deployed OIDC roles. Utah needs a credentialed feed check. Oregon uses official road links until its feed has a verified sample. [Release tasks](../../projects/ski-status/TODO.md#release-checks), [Driving tasks](../../projects/ski-status/TODO.md#driving-map)
