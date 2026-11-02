# CI build quality review

Review date: November 2, 2026.

The review covers the pending CI registry fix against commit `256f1c5`.
Independent agents checked repository standards and the original build-failure requirements.
The review also examined adjacent CARTO key selection and publication tests.

## Standards

No documented-standard violations or actionable code smells were found in the initial patch.
The additional checks identified one configuration defect and one regression coverage gap.
Both are corrected.

### P2: Whitespace aliases masked valid browser keys

Vite previously selected the first truthy key candidate, then trimmed that value.
A whitespace-only `VITE_CARTO_API_KEY` therefore masked a valid `CARTO_API_KEY`.
Whitespace process values could also mask valid local values.
The release build then reported a missing key.

Three new tests reproduced these failures before the fix.
Vite now trims every candidate before selecting the first nonempty value.
Process variables retain priority over local files.
Within each source, `VITE_CARTO_API_KEY` retains priority over `CARTO_API_KEY`.
All-empty configurations still stop release builds.

The configuration suite increased from four cases to fourteen.
It covers fallback values, source priority, whitespace, and credential-free test modes.
The existing test still checks that unrelated environment values do not enter build definitions.
The tests use real temporary `.env.local` files and Vite's actual loader.
Vite process variables still override file values with the same name, including blank values.
The final review replaced a mocked scenario that incorrectly bypassed this merge behavior.

### P3: The CI regression checked too little of the workflow and output

The initial regression executed the build command and checked output filenames.
It ignored the selected step's condition and environment declarations.
It could therefore pass after restoring a push-only condition or a production-secret dependency.
It also omitted crawler directives and unpublished metadata in JavaScript.

The regression now checks push and pull-request triggers, unconditional build execution, and environment declarations without secret references.
It executes the actual workflow command in a temporary source copy.
That copy excludes generated blog content and local environment files.
The child process receives empty Google and CARTO settings.

Output checks cover article titles, the trip canonical URL, and the absence of `noindex` in generated HTML.
They require compiled published story text and reject unpublished metadata in JavaScript.
Both historic article collections must exclude the draft HTML page.
The temporary copy remains isolated and is removed after the test.

Standards result: no documented-standard breaches; one configuration defect and one coverage gap corrected.

## Spec

No concrete specification defect was found in the CI fix.
The original failure came from calling Vite before generating the Git-ignored post registry.
The corrected workflow uses the existing `trip-test` mode and tracked content fixtures.
It runs for pushes and pull requests to `main` without production credentials.

Fixture mode retains production publication rules.
Six additional content cases check article metadata and rejection of missing registries, published bodies, and published manifests.
Draft metadata, story bodies, manifests, and article pages remain excluded.

Amplify still runs `npm run build` for production.
That command imports published Google content before compiling the site.
Production builds still require a usable browser key and generated content.

Spec result: no concrete findings.

## Coverage

The controlled comparison measures only `scripts/trip-content-plugin.ts`.
Both runs use identical final source, Node.js, Vitest, and the V8 coverage provider.
The control runs the original 59 content cases.
The complete run adds six fixture-mode cases.

| Measure | Control | Complete |
| --- | ---: | ---: |
| Statements | 86.46% | 86.46% |
| Branches | 76.47% | 78.43% |
| Functions | 87.50% | 87.50% |
| Lines | 90.19% | 90.19% |

The new cases cover both fixture-directory branches in the plugin.
Configuration and subprocess assertions provide separate scenario coverage.
These figures do not measure the complete repository.

## Validation

Checks used Node.js `26.12.0` and the configured npm `12.2.1` from a temporary installation.

| Check | Result |
| --- | --- |
| Complete Vitest suite with V8 coverage | 2,219 passed in 155 files |
| Temperature pipeline | 17 Python tests passed |
| ESLint | Passed without warnings |
| TypeScript project checks | Passed |
| CI workflow command without generated content or credentials | Passed |
| Production WebGL budget and source-map checks | Passed |
| Local links in changed Markdown files | 102 checked |

The complete coverage run measured 82.43% statements, 77.93% branches, 80.75% functions, and 84.16% lines.
These percentages describe loaded files, not every repository file.

This review did not import Google content, validate deployed key authorization, or publish assets.
No dependency versions changed.
The [trip testing guide](../trips/TESTING.md) describes the CI command and its validation scope.
