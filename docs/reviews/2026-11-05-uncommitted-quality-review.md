# Review of the pending correctness and performance changes

Date: 2026-11-05. Baseline: `28abe7b8bd3846192c10e8eef5c09f422a53c63a`.
Scope: all tracked changes and new files pending on `main`.
Spec: the requested full-width project image, monthly temperature repair, page recovery, preview release gate, Flights startup work, and bounded data cache.

The original change set had release-blocking defects. A deployed preview could authorize production even after browser validation failed. The validator could also accept a broken Tornado map. The repair could stamp incomplete station data as current or overwrite its source files. Passing tests did not cover these failure paths.

The review used independent Standards and Spec passes. Findings remain separate below. Severity describes the reviewed implementation before the fixes.

## Standards

Four ranked findings: two P2 and two P3. The worst severity on this axis was P2.

| Severity | Finding and trigger | Correction and evidence |
| --- | --- | --- |
| P2 | `repair-temperature-archives.js` could overwrite input archives when source and output shared a path. CLI string comparisons did not protect direct API calls, symlink aliases, nested directories, or the adjacent station catalog. | Resolve real paths inside the exported operation. Require disjoint trees, protect the input catalog, reject symlink escapes, and preflight the full inventory before network calls or writes. Regression tests cover direct calls and filesystem aliases. |
| P2 | The release validator listened for responses but missed requests that failed before a response. It did not wait for the Tornado map. An aborted stylesheet or worker could pass. | Inspect required failed requests, external Tornado geometry, and MapLibre errors. Require page and map readiness. Committed Chromium integration fixtures exercise these failures. |
| P3 | Node release tooling imported a feature-owned temperature schema. This contradicted the dependency rules in [Shared modules](../shared-modules.md). | Move the wire contracts to `shared/temperatureSchemas.ts`; retain the feature re-export for current browser consumers. Put release flight contracts in `shared/flightSchemas.ts`. |
| P3 | The temperature guide promised a 60-second timeout for every request, although monthly history permits 120 seconds. The OIDC guide described two roles after a third role was added. | Correct the timeout scope, role count, proof permissions, and activation steps. Separate completed local checks from pending AWS rollout. |

Two additional maintainability observations were corrected. The migration no longer changes environment variables when imported. It inventories and validates the source once, sorts dates, and keeps paths and station IDs in memory instead of retaining the full archive set.

## Spec

Four material findings: two P1 and two P2. The worst severity on this axis was P1.

| Severity | Requirement and defect | Correction and evidence |
| --- | --- | --- |
| P1 | “Gate production releases on preview validation.” The production guard checked deployment identity only. A manual main build could proceed after the validator failed. | Publish a proof only after all preview checks pass. Bind it to the full revision, normalized preview job, origin, report digest, and a 24-hour age limit. Production checks the exact deployed preview and proof before and after compilation. Tests cover missing, stale, failed, and mismatched proofs; upload failures; and concurrent main changes. |
| P1 | “Check … data compatibility.” External yearly Tornado geometry was outside the response filter, and the Tornado route had no required ready state. Failed tracks or workers could produce an unusable release. | Check geometry responses and year/coordinate contracts. Add explicit loading/error/fallback/ready map state. Require a ready renderer in the release browser. Existing map tests cover both WebGL and static fallback, including retry. |
| P2 | “Fix monthly temperature classification … regenerate affected archives.” A nonempty ACIS response could omit an expected station. Repair then removed its thresholds and marked the archive version 2. | Require historical coverage when a daily predecessor proves history exists. Validate cached data in each context. For an omitted current-month station, use a bounded, UID-specific request with a complete dated series and explicit numeric or `M` values. Failure leaves the source archive unchanged. Apply the same checks to fresh generation. |
| P2 | “Test a preview with the actual hosting rules.” MIME checks did not check configured security or cache headers. | Read `customHttp.yml` as the expected policy. Check actual first-party document and asset headers, with semantic normalization for directive order. Integration tests reject missing or wrong CSP/cache policy. |

One lower-priority recovery defect was also corrected. A single stored URL allowed A → B → A reloads within a minute; query and fragment variants bypassed the same limit. Recovery now keeps a bounded history by pathname, prunes expired entries, and preserves the limit when storage writes fail. Tests cover route alternation, URL variants, blocked storage, expiry, and capacity.

## Additional hardening

- Flight validation now checks feature properties, geometry, coordinates, calendar dates, and elapsed-duration provenance. A nonempty array of empty objects no longer passes.
- Basic pages must expose their expected headings. An HTTP 200 with an empty application does not pass.
- The validator records the annual-summary response URL directly. It no longer depends on the browser's limited resource-timing buffer.
- Context cleanup runs after page creation, validation, and report-write failures. Failed validation reports remain available when the output path is writable.
- Release URL validation requires HTTPS, except HTTP loopback used by local tests. Credentials, query strings, and fragments are rejected.
- The preview hostname is included in the data bucket CORS configuration. The release role can write only its validation-proof prefix.
- MIME checks distinguish individual image and font formats. Image decoding still verifies the bytes independently.

The header matcher implements the patterns present in this repository. The [AWS header reference](https://docs.aws.amazon.com/amplify/latest/userguide/custom-header-YAML-format.html) does not define every glob edge case; new pattern forms require matching tests. Amplify permissions use the documented [job resource scope](https://docs.aws.amazon.com/service-authorization/latest/reference/list_amplify.html).

## Data audit and remaining limits

A fresh repair rebuilt all 226 archived dates from the immutable original snapshots. The [backfill audit](../performance/2026-11-05-temperature-full-backfill.json) records input/output hashes, unchanged coverage, all 492,101 raw observations, and all 34,214 reconstructed record identities. The new staging supersedes the earlier unchecked repair output.

The audit distinguishes 492 legitimate new-history observations from 48 observations that require four verified station-specific missing-value responses. It also records 12 unresolved numerical disagreements between legacy daily thresholds and monthly history. None affects the recent seven-day window. The cause needs source-level investigation; this review preserves raw values and does not claim complete historical source accuracy.

Corrected data remains local. AWS configuration, repository variables, hosted validation, and production publication still require rollout under the [release guide](../release-validation.md). The pipeline rebuilds the same Git revision for production; external content is not frozen into one promoted artifact. The cache has an entry limit, not a byte limit. Flights measurements use controlled browser emulation; real-phone startup and heap measurements remain open.

## Validation

All checks below passed on the final code. No live AWS changes were made.

| Check | Result |
| --- | --- |
| Complete Vitest suite | 2,760 tests in 175 files |
| Python temperature pipeline | 17 tests |
| Flights controls, basemaps, and Tornado maps | 24 Chromium cases |
| Navigation, projects, and flight durations | 29 Chromium cases |
| Production page recovery and image layout | 6 cases across Chromium and WebKit |
| Hosted-validator integration fixtures | 10 Chromium cases |
| Throttled mobile Flights budget | 1 case; 6,083 ms startup and 424 ms maximum toggle |
| Infrastructure | Terraform validation and 5 mocked tests |
| Static/build checks | ESLint, TypeScript, production fixture build, documentation links, and diff whitespace |
| Dependency audit | No reported vulnerabilities |

| V8 coverage | Review start | Final |
| --- | ---: | ---: |
| Statements | 84.04% | 84.44% |
| Branches | 79.62% | 80.15% |
| Functions | 82.41% | 82.65% |
| Lines | 86.03% | 86.35% |

The [coverage record](../performance/2026-11-05-correctness-review-coverage.json) retains totals and per-module results. Vitest does not collect the separate Playwright execution. The validator's healthy browser path and handled network failures therefore have integration coverage beyond its V8 unit figures. Release-proof lines have 100% unit coverage; shared-cache lines also have 100%.

The [review performance sample](../performance/2026-11-05-flight-review-budget.json) uses the final compressed production fixture, Pixel 7 emulation, 4× CPU slowdown, 150 ms latency, and a 1.6 Mbps download limit. It contains 334 flights and one 54,582-byte Night texture response. It passes the 8.5-second startup and 600-ms interaction budgets. The measurement does not replace real-phone validation.

Standards: four ranked findings, worst P2. Spec: four material findings, worst P1. All eight material findings have code or documentation fixes; the source-data and rollout limits above remain explicit.
