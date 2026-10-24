# Critical review and regression fixes: 2026-10-24

## Scope and assessment

This review covers the complete uncommitted changes against `6e87d40`, including new files and generated preview assets.
The user's requests in this conversation supply the spec. `README.md` and `docs/README.md` supply the maintenance and documentation rules.
Two independent reviews checked standards and requested behavior. The implementation was then tested through failure cases.

The core application has useful safeguards: strict TypeScript, runtime temperature validation, route splitting, and substantial browser coverage.
The maintenance tools needed more scrutiny. Passing happy-path checks concealed file corruption, misleading performance reports, and an ineffective warning regression.

## Standards review

### P2: Preview publication could invalidate existing content

The generator removed old images before writing the replacement manifest. A failed manifest write left references to missing files.
Regenerating unchanged content had another failure path: writing an existing fingerprinted filename could truncate the published image.

Images and manifests now use the shared [atomic writer](../../scripts/atomic-write.js).
Each complete file replaces its target through a rename. Obsolete images are removed only after manifest publication succeeds.
Tests inject partial writes, disk errors, and failed renames. They verify that published references and image bytes remain valid.

### P2: Cleanup could remove an accepted source image

A source inside `public/images/previews/` could match the cleanup pattern. Generation succeeded and then deleted that source.
The next run failed. Detail pages also retained the missing original URL.

The generator now checks real source paths. It rejects files outside `public/images/` and files inside its output directory.
Tests cover direct paths, directory traversal, symlink targets, invalid slugs, and URL query fragments.
The failure is reproducible with a synthetic image. No private source data is needed.

### P2: Failed measurements could look successful

The original tool accepted HTTP errors and uncaught application exceptions. It could write an ordinary result row and exit successfully.
It also accepted incomplete metrics and could freeze LCP before a visible image finished loading.
The corrected behavior is detailed in the spec review below.

### P3: The CLI imported an undeclared transitive dependency

The performance CLI imported `playwright` directly. Only `@playwright/test` was declared.
It now imports the browser exports from the declared package. A typed module interface supports its browser-test caller.

### P3: Historical and current findings were mixed

The initial audit said both build warnings remained, beside a link to the follow-up that resolved them.
That paragraph now identifies the initial snapshot. Historical measurements retain their original results and link to this review.
Current procedures use shorter sentences and remain separate from dated test results.

## Spec review

### P2: Measurement failure handling did not meet the performance-analysis request

The request to analyze “performance” requires valid evidence. HTTP 503, application crashes, and missing paint metrics must not produce successful samples.
The CLI now validates its origin, routes, numeric settings, HTTP response, application errors, paint metrics, and byte counts.
It waits for visible images and fonts before the observation period starts.

Failed samples retain their status, metrics already collected, and error details. They increment `failedSamples` and produce a nonzero CLI status.
Browser cleanup errors also remain in the report. An already failed sample is not counted twice.
Report publication uses atomic replacement. A failed write cannot replace an existing report with a partial file.

Four real Chromium tests cover an HTTP error page, application crash, delayed image, and broken image.
Unit tests also cover invalid inputs, report persistence, browser ownership, cleanup errors, and interactions without an INP measurement.
The tool leaves unavailable INP as `null`.

### P2: Station history generated invalid leap-day ranges

The request said to find “issues, bugs, or improvements” and fix them.
On February 29, the two-year history request generated a nonexistent February 29 in the target year.
The default five-year request had the same defect.

The hook now clamps the starting day to the target month's last valid day.
Regression tests cover two-year, five-year, and leap-year-preserving ranges through the actual request body.

### P2: The source-map regression checked the wrong warning field

The request to “write tests for code changes” requires a test that can detect the original warning.
Vite can return `code: PLUGIN_WARNING` and `pluginCode: SOURCEMAP_BROKEN`, with a message that omits the diagnostic code.
The previous test saved only the message and searched for `SOURCEMAP_BROKEN`.

The guard now retains complete diagnostics and rejects unexpected warnings.
A virtual Vite build emits the actual warning shape and verifies rejection.
Only the host-load-dependent `PLUGIN_TIMINGS` hint is excluded. The correctness diagnostics remain active.
The JavaScript budget now counts UTF-8 bytes instead of string characters.

## Additional hardening

The globe adapter previously recognized source markers. Those markers could remain present after the surrounding algorithm changed.
It now checks complete hashes of both reviewed upstream modules before rewriting them.
Negative tests preserve the markers while changing source content. The adapter rejects those changes.
Tests also verify source-map content and normalized Windows paths.

This adapter remains a maintained dependency patch. Dependency upgrades require source review and production browser verification.
The build-size improvement does not justify an unchecked dependency rewrite.

## Verification and coverage

The baseline and final coverage runs use the same Node.js, compiler, Vitest, and V8 coverage versions.
Both runs include the full unit suite. The final run also loads the new maintenance modules and tests.

| Metric | Review baseline | After fixes |
| --- | --- | --- |
| Statements | 75.86% | 76.31% |
| Branches | 68.24% | 68.80% |
| Functions | 73.28% | 73.54% |
| Lines | 78.39% | 78.77% |
| Unit tests | 1,249 in 93 files | 1,314 in 96 files |

These percentages describe loaded source files. They do not measure every repository file.
The new tests cover publication and measurement failures. They do not only repeat the implementation's expected values.

Validation also includes 17 Python tests, 15 Chromium browser checks, 48 production trip checks, and three mocked Terraform tests.
All 26 preview files were checked against their recorded widths and content fingerprints.
Lint, TypeScript, the production build, dependency audit, and direct dependency freshness checks pass.
The audit reports zero vulnerabilities. No outdated direct dependencies were reported.

## Limits and deployment

The OIDC roles and workflows are prepared. AWS token exchange and production permissions still require the documented deployment checks.
The old measurement files remain historical laboratory evidence. They are not real-device results or current release gates.
Large map modules, Flights interaction latency, and publication reviews remain in [TODO.md](../../TODO.md).
No live infrastructure, repository variable, workflow secret, source document, or published asset was changed remotely.

Standards: five findings; highest severity P2, preview publication integrity.
Spec: three findings; highest severity P2, invalid measurement evidence and missing regression protection.
