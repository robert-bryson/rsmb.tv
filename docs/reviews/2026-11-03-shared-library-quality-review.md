# Shared module quality review

Date: 2026-11-03.
Baseline: `dd1ba96`, with the shared module extraction already present as uncommitted changes.

## Scope and result

The extraction preserves existing application behavior for valid input.
It also carries two airport input defects into a new shared helper.
Those defects are now fixed.
Additional tests cover contracts that the extraction previously left implicit.

The review covered all pending changes and their immediate consumers.
It checked request caching, state identities, airport generators, project pages, TypeScript configuration, and documentation.
Independent reviewers checked coding standards and the [consolidation specification](2026-11-03-shared-library-analysis.md).

This is a review of the pending extraction.
It does not establish that every feature, deployment, or external data source is correct.

## Standards

The extraction follows the documented module boundaries.
Feature hooks now import the shared request cache directly.
The geography registry has no runtime dependencies.
Airport processing remains within Flights.
Compatibility exports keep the previous cache import path working.
No additional standards violations or actionable duplication were found in the extraction.

### P2: Incomplete and non-finite airport elevations reached generated output

Location: [`airportData.js`](../../projects/flights/scripts/airportData.js).

The original generators used `parseFloat(value) || 0`.
The shared helper retained that expression.
`433feet` became `433`, which concealed an invalid input.
`Infinity` remained infinite until JSON serialization converted it to `null`.
Both outputs expose elevation as a number, so this conversion violated their data contract.

The helper now converts the complete value and checks that the result is finite.
Missing or invalid values use the existing zero default.
Valid negative and fractional elevations retain their values.
Meter values remain rounded to the nearest integer.

### P2: Airport name lookup accepted inherited object properties

Location: [`airportData.js`](../../projects/flights/scripts/airportData.js).

The original lookup used `mapping[code] || code`.
For an unmapped code such as `constructor`, this returned an inherited function.
JSON serialization then omitted the display-name property.
An unmapped code should remain visible.

The helper now accepts only nonempty string values from its own mapping entries.
Other values fall back to the original code.
Tests cover `constructor`, `toString`, `__proto__`, inherited mappings, and invalid mapping values.
This fixes data integrity. The review did not demonstrate code execution or prototype mutation.

## Spec

### P2: State contracts lacked direct assertions

The specification says: “Verify existing generator fixtures and jurisdiction subsets. Check leading zeros and name normalization.”

The registry was exercised through imports, but no direct test verified every state identity.
One flight fixture checked DC inclusion and Puerto Rico exclusion.
That fixture could not detect a wrong FIPS value elsewhere in the registry.

New tests independently assert all 50 state identities and their order.
They also assert the exact DC and Puerto Rico extensions.
Tornado CSV fixtures check full-name normalization for DC, Puerto Rico, and New York.

### P2: Presentation contracts lacked focused assertions

The specification says: “Verify project navigation, headings, screenshot dimensions, loading behavior, and external link attributes.”

Existing page tests mainly checked headings, URLs, and image presence.
They did not fully protect the three migrated galleries or shared header actions.

New tests check internal router navigation and external link isolation.
Gallery tests check dimensions, loading modes, decoding, alt descriptions, and separate captions.
Browser tests load the real screenshots at 320px and 1280px.
They compare declared dimensions with image dimensions and check page overflow.

Standards: two inherited data defects fixed; no additional extraction violations.
Spec: two acceptance-coverage gaps closed; no functional mismatch found.

## Validation

The final checks passed:

- ESLint and all TypeScript project checks.
- All 2,290 Vitest tests across 159 test files, including the production bundle regression checks.
- All 17 Python temperature pipeline tests.
- A Vite production build in `trip-test` mode.
- All 10 Chromium project browser checks against a local Vite server.
- `npm audit --audit-level=moderate`, with zero reported vulnerabilities.
- `git diff --check`.

The airport regression tests failed in eight cases before the fixes.
They pass with the corrected helper.
Generator tests also verify the corrected properties in both written airport outputs.

The HEAD flight generators were run in a temporary workspace against the same local inputs.
Their outputs matched the final generators: 334 flights, 114 visited airports, and 4,371 complete-airport records.
Only `metadata.generatedAt` was excluded from that comparison.
The input fixes therefore preserve the current valid dataset.

The standard browser runner could not download state boundaries inside the sandbox.
Browser checks instead used a local Vite server with `trip-test` content and the tracked public images.
The fixture production build omits those images, so it cannot validate these gallery checks by itself.
The complete map and trip browser suites were not rerun for this presentation and data extraction.

## Coverage

Both measurements used Node.js 26.12.0, Vitest 5.0.5, and the V8 provider.
The baseline used the initial pending changes and their 2,255 tests.
The final measurement used the corrected source and all 2,290 tests.
Dependencies and coverage configuration did not change.
The installed npm version was 11.20.0; this review did not install dependencies or change the lockfile.

| Measure | Baseline | Final |
| --- | --- | --- |
| Statements | 82.50% (10,274/12,452) | 82.56% (10,288/12,461) |
| Branches | 78.10% (7,439/9,524) | 78.21% (7,457/9,534) |
| Functions | 80.72% (2,383/2,952) | 80.84% (2,389/2,955) |
| Lines | 84.21% (8,792/10,440) | 84.26% (8,804/10,448) |

The unchanged cache implementation improved from 93.18% statement coverage to 100%.
Its branch and function coverage also reached 100%.
The airport helper now has 100% statement, branch, and function coverage through direct tests.
It was absent from the initial coverage report because its tests ran only through subprocesses.

Coverage includes loaded source files, rather than every repository file.
The aggregate denominator increased when direct tests loaded the airport helper.
The aggregate change therefore includes both added assertions and newly measured code.

## Documentation

The [shared module guide](../shared-modules.md) now states defaults, request detachment rules, input policies, and focused checks.
The root guide clarifies that cache clearing does not abort network requests.
The initial analysis now separates historical findings from its implementation record.
The documentation index links this review.
The edited guidance uses short sentences and consistent terms.
