# Repository quality, performance, and security audit: 2026-10-24

## Assessment and scope

The repository has a sound baseline: strict TypeScript, lazy routes, shared request caching, runtime temperature schemas, and substantial automated coverage.
The audit found dependency advisories, request lifecycle defects, missing dependency checks, and avoidable aggregation work. The corrections below pass the available checks.

The starting checkout was clean at `6e87d40`. This audit covers the source in this repository and its local subprojects.

| Area | Review and verification |
| --- | --- |
| Site, portfolio pages, routing, and content metadata | Typecheck, unit tests, production build, and Chromium navigation checks |
| Flights | Data generators, input validation, shared fetch cache, map loading, and browser smoke checks |
| Operational temperatures | Request handling, runtime payload schemas, charts, and mobile map checks |
| Historical temperature pipeline | Python data contracts, estimation, deterministic outputs, tests, and a synthetic performance comparison |
| Tornado tracks | Data generator, independent layer requests, URL state, utilities, and lint coverage |
| Posts and trips | Import sanitization, request deadlines, manifest validation, responsive images, galleries, and three browser configurations |
| Operations dashboard | Dependency contracts, polling implementation, and existing fixed-provider unit tests |
| Infrastructure and delivery | Terraform schemas, mocked mail and storage tests, CDN redirect behavior, workflow pins, and dependency installation |
| Ride Ledger | Design and private-data boundaries; no implementation exists in this checkout |

Through Routes, Anki Artisan, Aborg, Parc, Bookend, and Route2Gpx link to separate source repositories.
Their portfolio pages are covered here. Their application source and dependency trees are outside this checkout and were not audited.

## Findings corrected

### P1: vulnerable dependency versions

The initial npm audit reported two high-severity affected packages: Zod and Undici.
Zod 4.6.5 was replaced with 4.6.7. Undici 7.29.0 was replaced with 7.30.1.
The final audit reports zero advisories at all severity levels.
See the [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) and [Undici advisory](https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c).

Undici enters through development tooling. An npm advisory does not establish exploitation of the deployed static site.
The Node pin also moves to the [24.22.1 security release](https://nodejs.org/en/blog/release/v24.22.1).
This matters because Node's built-in fetch implementation is separate from the installed Undici package.

### P2: peer dependency validation was disabled

The repository used `legacy-peer-deps=true`. The dependency tree lacked the Rollup peer required by `@mdx-js/rollup`.
Rollup is now declared. The legacy setting is removed.
A clean installation with normal peer checks passes. `npm ls --all` reports no missing required or invalid dependencies.

### P2: station history requests survived cancellation

Clearing or replacing a station suppressed state updates but left its network request running. Clearing could also retain the loading state.
The hook now aborts replaced, cleared, and unmounted requests. It resets loading on clear and enforces a 30-second deadline.
Invalid observations now become `null`, rather than partial numbers, infinity, or `NaN`.
Five tests cover invalid observations, cancellation, replacement, timeout, and late responses.

### P2: independent tornado requests erased each other's failures

Tracks and density points shared one error state. A successful request could hide a failed active layer.
Errors could also remain visible after changing the selected year range.
Each layer now owns its error and range. Disabled density errors are excluded. Failed layers discard their previous data.
Four tests cover both completion orders, disabled density, and changed ranges.

### P2: data imports had no explicit request deadlines

Google Sheet and document imports now have 30-second deadlines. Each temperature GET or POST attempt has a 60-second deadline.
The signal remains active while the response body is read. Temperature retries receive independent deadlines.
Four tests use stalled response bodies to verify cancellation and retry behavior.

### P2: temperature aggregation repeatedly scanned all station contributions

The estimator scanned every contribution again for each year, geography, and record kind.
It now groups contributions once. Sorted output and station insertion order remain consistent with the original implementation.
The performance comparison and output checks are described below.

### P2: storage protection and delivery needed stronger checks

The data bucket permitted public policies through two disabled public-access blocks.
Its existing CloudFront policy was already restricted to the distribution. This finding does not establish public bucket exposure.
All four public-access blocks are now enabled. AWS documents fixed service principals and source ARNs as non-public policy constraints.
See [S3 public-access policy evaluation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html).

A mocked Terraform test checks both buckets and origin request signing. CI now checks formatting, validates configuration, and runs all infrastructure tests.
The apex redirect also preserves repeated query parameters. Its regression test executes the function embedded in Terraform.
The function uses CloudFront's documented [query parameter structure](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html).

### P3: JavaScript lint coverage omitted the tornado pipeline

ESLint now covers all repository JavaScript files. This includes the tornado generator and root JavaScript configuration.
The new coverage exposed one unused destructured value. It is now explicitly ignored.
The lint command rejects warnings.

## Dependency maintenance

All 19 outdated direct packages were refreshed. Compatible transitive releases were updated through npm.
`npm outdated` returns an empty object. This result does not imply that every transitive dependency uses its newest major release.

| Package or tool | Verified version |
| --- | --- |
| Pinned Node.js / npm | 24.22.1 / 12.2.1 |
| React / React DOM | 19.3.1 |
| MapLibre GL | 6.15.0 |
| Vite | 8.3.5 |
| Vitest / V8 coverage | 5.0.5 |
| Playwright | 1.64.1 |
| AWS SDK clients and credential providers | 3.1156.0 |
| ESLint / TypeScript ESLint | 10.13.0 / 8.72.0 |
| Rollup | 4.65.0 |
| Terraform / AWS provider | 1.17.0 / 6.70.0 |
| Checkout / Setup Node / Cache actions | 7.0.1 / 7.1.0 / 6.1.0 |
| Setup Terraform action | 4.0.1 |

All workflow actions now use complete commit hashes with release comments.
The lint compiler remains on TypeScript 6.0.2 because the current adapter requires TypeScript below 6.1.
The separately declared TypeScript 7 alias remains at 7.0.2. The router packages retain their supported dependency contract.
The Python pipeline uses only the standard library.

## Verification

JavaScript checks used the exact pinned Node.js 24.22.1 and npm 12.2.1 versions. Python tests used Python 3.15.0.
Infrastructure checks used Terraform 1.17.0 and AWS provider 6.70.0 in an isolated local data directory.

| Check | Result |
| --- | --- |
| Clean `npm ci` with normal peer resolution | Passed |
| Installed dependency tree | No missing required or invalid dependencies |
| ESLint / TypeScript | Passed |
| Dependency audit / outdated direct packages | Zero / zero |
| Vitest with V8 coverage | 1,246 passed in 92 files |
| Python estimator tests | 17 passed |
| Chromium browser smoke suite | 11 passed |
| Production trip browser suite | 48 passed across desktop Chromium, mobile Chromium, and iPhone WebKit |
| Full production build with configured Google import | Passed; one published post imported |
| Terraform formatting / validation | Passed |
| Mocked Terraform tests | Two passed |
| Tracked-text credential signature scan | No credentials found; one example token was confirmed as a placeholder |

The credential scan covered common private-key, AWS, GitHub, and Google token signatures. It did not inspect Git history.
Coverage measured 75.85% statements, 68.23% branches, 73.27% functions, and 78.38% lines.
These values describe loaded source files. Browser checks supplement them but do not establish complete application coverage.

## Performance evidence

All twelve route-budget checks passed across the three trip browser configurations.
Home and posts remain below 125,000 gzip bytes. The fixed blog and trip routes remain below 185,000 and 190,000 bytes.
These checks count unique script bodies compressed separately. They do not measure connection speed or Core Web Vitals.

The production entry chunk is 91.09 kB gzip. The lazy Flights chunk is 579.29 kB gzip.
The shared MapLibre chunk is 288.75 kB gzip. Its worker is a separate 518.42 kB uncompressed asset.
The visualization dependencies remain outside initial reading-route requests.

The Python comparison used 120 synthetic stations, 20 years, 30 states, four regions, and 1,400 output groups.
Median aggregation time across three runs fell from 967.956 ms to 7.374 ms: approximately 131 times faster.
Timed runs disabled bootstrap sampling to isolate aggregation work. This is not a full production-pipeline speed estimate.
A separate comparison with 25 bootstrap replicates produced identical serialized output hashes before and after the change.
All 17 estimator tests also passed after the change.

## Remaining work and limits

The [performance follow-up](2026-10-24-performance-follow-up.md) addresses the Flights bundle, source-map warning, and responsive previews. It also prepares the OIDC migration.
Use that report for the later measurements and remaining deployment steps.

The initial audit build reported a large Flights chunk and a Tailwind source-map warning. The follow-up resolved both warnings.
Real-device LCP, CLS, and INP measurements remain separate from the passing byte budgets.
Large map components remain maintenance hotspots. Data sync workflows still use long-lived AWS credentials.
The related work is recorded in [TODO.md](../../TODO.md#build-and-maintenance) and [trip release tasks](../../TODO.md#trip-release-tasks).

Existing trip publication, historical data, and mail deployment checks remain in [TODO.md](../../TODO.md#publication-blockers).
The historical estimator's tests do not certify the ACIS source data or its publication readiness.

Infrastructure changes were validated locally with mocked AWS responses. No infrastructure, workflow secret, Google source document, or published asset was changed remotely.
The Terraform changes still require deployment through the existing infrastructure procedure.
