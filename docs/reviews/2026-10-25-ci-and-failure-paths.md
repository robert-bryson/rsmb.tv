# CI and failure-path review: 2026-10-25

## Scope

This review covers commit `e36debd` against `6e87d40`, plus the uncommitted CI repair.
The implementation commit changes 78 files, including generated assets and the dependency lockfile.
Two independent reviews checked standards and requested behavior.
`README.md`, the documentation rules, and the 2026-10-24 reports supplied the recorded requirements.

The previous test suite passed with defects in file cleanup, provider locking, data parsing, and measurement accounting.
The tests did not cover these failure conditions.
Eight distinct defects were corrected. The preview defect appears in both review axes.

## Standards

### P2: Preview cleanup could delete an original image

The generator resolved source paths but kept the output path unresolved.
A symbolic link at `public/images/previews/` could point to a directory that contained original images.
The source check then accepted an original with a generated-looking filename. Cleanup deleted that original after publication.

The generator now rejects an output directory that is a symbolic link.
Regression tests cover targets inside and outside `public/images/`.
They verify that rejected runs preserve source bytes, manifest bytes, and directory contents.
A separate test checks all three responsive widths and the default image selection.

See [the generator](../../scripts/generate-project-previews.js) and [publication tests](../../scripts/__tests__/projectPreviews.test.ts).

### P2: Performance reports excluded preloaded JavaScript

The tool counted only Resource Timing entries with `initiatorType` equal to `script`.
Chromium can assign another initiator type to a module preload.
A real browser test executed a compressed 101-byte module. The old counter reported zero bytes.

The tool now counts encoded JavaScript response bodies through Chrome DevTools Protocol events.
Each network request contributes its received body bytes before interaction.
The count includes module preloads and repeated transfers. It excludes response headers, stylesheets, images, and later interaction traffic.
Unit tests cover multiple data chunks, repeated URLs, response classification, and the snapshot boundary.
The browser test checks the compressed body size against an independently generated gzip fixture.

The older [mobile reports](2026-10-24-performance-follow-up.md) retain their original values.
Their script-byte counts are now marked incomplete.

### P2: Browser lifecycle failures escaped the report

Context creation occurred outside the sample error handler.
A creation failure stopped all remaining samples without a failed result row.
An owned-browser cleanup failure also escaped after the report had been written.

Context creation now occurs inside the sample handler. Failed samples are recorded, and later samples continue.
Browser cleanup failures are saved in the report's `errors` array.
The CLI returns a nonzero status for failed sample rows or run errors.
Tests verify both saved reports and continuation after a failed context.

See [the measurement tool](../../scripts/measure-performance.js) and [lifecycle tests](../../scripts/__tests__/measurePerformance.test.ts).

## Spec

### P2: The source-separation guarantee was incomplete

The previous review stated: "It rejects ... files inside its output directory."
The output symlink bypassed that guarantee. The standards finding above records the correction and regression tests.

### P2: Station history could crash its consumers

The recorded safeguards included "runtime temperature validation."
The station-history hook still trusted observation dates and metadata from JSON.
A numeric date reached a `.slice()` call in the station panel. An object-valued name could also fail React rendering.

The hook now parses unknown JSON through the existing Zod validation boundary.
The schema checks calendar dates, row structure, metadata types, and coordinate ranges.
Invalid payloads produce a request error before they reach the panel.
Missing metadata retains the existing defaults. Missing or nonnumeric observations remain `null`.

Tests cover malformed payloads, valid metadata, missing values, HTTP errors, API errors, JSON errors, and late response bodies.
See [the schema](../../src/features/temperatures/schemas.ts), [the hook](../../src/features/temperatures/hooks/useStationHistory.ts), and [hook tests](../../src/test/useStationHistory.test.ts).

### P3: Body cancellation hid the timeout reason

The request deadline must also cover response-body reads.
A stalled `Response.json()` can reject with a generic `AbortError` after the hook aborts its request.
The hook previously displayed that generic message instead of the explicit timeout reason.

The error handler now retains the abort controller's reason.
The regression test stalls the body after successful headers, then advances the request deadline.

## Additional checks

### P2: Type checking used the wrong compiler

The repository requires TypeScript 6 for the lint adapter and documents the same compiler for type checking.
The `typescript` alias installs version 6.0.2 and exposes `tsc6`.
Its compiler reports version 6.0.3.
The separate `@typescript/native` alias exposes `tsc`, which reports version 7.0.2.
The old npm script invoked `tsc`. It therefore used TypeScript 7 despite the documented contract.

The script now invokes `tsc6`.
A regression test runs `npm run typecheck -- --help` and checks the actual compiler version.
It failed with version 7.0.2 before the correction.
See [the script](../../package.json) and [installation contract tests](../../scripts/__tests__/amplifyConfig.test.ts).

### P3: One observation produced an invalid chart coordinate

The station chart divided by `observation count - 1` when it placed month labels.
One observation therefore produced `x="NaN"`.
The chart now uses a minimum denominator of one.

Panel tests verify the single-observation chart, missing observations, request retry, and Celsius output.
See [the panel](../../src/features/temperatures/components/StationDetailPanel.tsx) and [panel tests](../../src/test/StationDetailPanel.test.tsx).

### P2: The provider lockfile omitted the Linux package hash

The failed CI run installed the signed AWS provider archive successfully.
Validation then rejected its unpacked cache because the lockfile contained only the macOS `h1` hash.

Terraform's provider lock command verified both platform packages against the publisher's signed checksums.
It added one Linux `h1` hash. Every existing checksum and the provider version remain unchanged.
CI retains `-lockfile=readonly`.
Both CI jobs now specify Ubuntu 26.04, which the reviewed run already used.
The [mail guide](../email-dns.md#refresh-provider-checksums) describes the platform refresh command.

## Verification

Local checks used Node.js 26.12.0, npm 11.20.0, and Python 3.15.0.
Node.js 26 is within the declared supported range. No dependency installation was required.
CI retains its configured Node.js and npm versions.

| Check | Result |
| --- | --- |
| Full Vitest suite | 1,348 passed in 97 files |
| Added unit cases | 34, with failure regressions verified before their fixes |
| Historical temperature tests | 17 passed |
| Chromium smoke suite | 16 passed, including five measurement fixtures |
| Production trip suite | 48 passed across desktop Chromium, mobile Chromium, and iPhone WebKit |
| Production fixture build and JavaScript budgets | Passed |
| ESLint and TypeScript 6 checks | Passed |
| Terraform 1.17 initialization, formatting, validation, and mocked tests | Passed; three mocked tests |
| npm advisory query | Zero vulnerabilities |
| Changed documentation links and diff whitespace | Passed |

The coverage comparison uses the same corrected production source, test adapters, Node.js, Vitest 5.0.5, and V8 provider.
The baseline runs the 1,314 existing cases. It excludes the 34 new cases by name.
The final run includes all cases.

| Metric | Existing cases on corrected source | All cases on corrected source |
| --- | --- | --- |
| Statements | 75.66% | 76.57% |
| Branches | 68.11% | 69.12% |
| Functions | 72.71% | 73.86% |
| Lines | 78.16% | 79.00% |

The new cases cover 66 additional statements, 54 branches, 20 functions, and 52 lines on identical production source.
The original checkout measured 76.31% statements, 68.80% branches, 73.54% functions, and 78.77% lines.
All four final percentages also exceed that earlier snapshot.
Coverage describes loaded source files. It does not establish complete repository coverage.

## Limits

The dependency advisory query reported zero vulnerabilities.
That result does not establish that application code has no security defects.
No additional confirmed defect was found in the changed OIDC policies, authentication selection, aggregation grouping, or guarded WebGL adapter.

Local Terraform validation used macOS. The Linux package checksum was verified against the signed provider release.
The amended GitHub workflow still requires a run after the commit is pushed.
Live OIDC exchange, infrastructure deployment, and mail delivery remain separate checks in [TODO.md](../../TODO.md).
The publication blockers also remain unchanged.

Standards: three findings; highest severity P2, source deletion and incomplete measurement evidence.
Spec: three findings; highest severity P2, source separation and unsafe station payloads.
Additional checks: three findings, including the existing CI failure; highest severity P2, compiler selection and provider checksums.
