# Dependency update and audit — November 13, 2026

## Changes

The repository uses current supported package releases and the November Node security patches.
The update covers the application, build tools, Python geometry pipeline, Terraform provider, and workflow actions.
No production infrastructure was changed.

| Dependency | Before | After |
| --- | --- | --- |
| AWS SDK clients and credential providers, six direct packages | 3.1164.0 | 3.1168.0 |
| MapLibre GL | 6.17.0 | 6.18.0 |
| Vite | 8.3.7 | 8.3.8 |
| jsdom | 31.0.0 | 31.0.1 |
| typescript-eslint | 8.72.1 | 8.72.2 |
| TypeScript used for lint and type checks | 6.0.2 | 6.0.3 |
| Scoped minimatch security overrides | 11.0.5 | 11.0.8 |
| three-render-objects, a transitive globe dependency | 1.43.1 | 1.44.1 |
| Default Node runtime | 24.22.2 | 24.22.3 |
| AWS Terraform provider | 6.72.0 | 6.73.0 |

Other compatible transitive dependencies were refreshed in the lockfile.
The configured npm version, 12.2.2, is current.
The five Python geometry requirements already match their latest stable PyPI releases.
Their existing exact pins remain in place.

## Security results

The final npm audit reports zero known advisories across production and development dependencies.
The Python audit reports zero known advisories across 30 resolved packages, including the audit tool.
No Python packages were skipped.
No advisory ignores were added.

An npm audit does not check the installed Node runtime.
The official releases for [Node 22.23.5](https://nodejs.org/en/blog/release/v22.23.5), [24.22.3](https://nodejs.org/en/blog/release/v24.22.3), and [26.13.1](https://nodejs.org/en/blog/release/v26.13.1) contain security fixes.
The engine ranges now require those patched minimums.
The default runtime pin is 24.22.3.
Validation uses that runtime and npm 12.2.2.

CI now installs the Python development requirements and runs `pip-audit --strict`.
That audit includes both the geometry packages and the audit tool's resolved dependencies.
It fails if a package cannot be audited.
Dependabot checks the Python requirements each day, alongside npm, GitHub Actions, and Terraform.

The six workflow actions already use their latest stable releases.
Each pinned commit was checked against its release tag.
Terraform installed AWS provider 6.73.0 with HashiCorp signature verification.
Infrastructure validation and all five tests pass with a mocked AWS provider.

## Compatibility fixes and retained constraints

The new globe renderer adds Arcball controls and custom controller classes.
It also changes its control import paths and removes a deprecated `tbControls` alias.
The application uses the retained `controls` interface.
The previous package archive was checked against its lockfile integrity value before comparing the source.
The reviewed build patch now handles the new selector and excludes the unused controllers.
Tests execute the generated setup code and confirm that orbit controls work while the unsupported controllers fail explicitly.
The source checksum guard remains active.

The TypeScript lint adapter requires a compiler below 6.1.
The project now declares TypeScript `~6.0.3` directly.
The older `@typescript/typescript6` alias remains at 6.0.2 and does not supply the new patch.
The type-check command invokes the intended compiler entry directly, so the separate TypeScript 7 package cannot take over the shared `tsc` command.
The existing compiler contract test checks the executed version against the lint compiler.

TypeScript 7 remains installed under its separate alias.
`npm outdated` can report TypeScript 7 as newer than the supported lint compiler.
That is an intentional compatibility limit.
React Router DOM also retains its declared router dependency; no different router major is forced into that package.

The scoped minimatch override remains necessary.
The upstream lint consumers still declare minimatch 10 ranges, which include the version affected by [CVE-2026-118764](https://github.com/advisories/GHSA-g3hv-75wg-m249).
The override uses current minimatch 11.0.8.
The compatibility suite checks file discovery, ignored paths, TypeScript project selection, and pattern-expansion limits through each consumer.

The transitive inventory includes older packages required by upstream consumers.
For example, Testing Library pins aria-query 5.3.0, and React Router DOM pins its router release.
Tailwind's optional WASM archive bundles its own runtime helpers and tslib.
Those bundled files cannot be refreshed independently without replacing the publisher's archive.
These entries remain subject to the advisory audit.

## Validation

All 3,098 JavaScript tests pass across 215 files.
The update adds controller coverage for Arcball and custom classes.
The measured modules have 87.88% line coverage and 82.09% branch coverage.
The changed globe adapter has 100% branch coverage.
All 25 Pins Python tests and 18 temperature Python tests pass.
Clean installation, lint, type checks, and the complete Vite bundle check pass.

The default Chromium browser run passes 132 tests.
It skips 52 checks that require separate production fixtures and one opt-in performance measurement.
The production trip-map, atlas, and route-choice run passes 106 tests in Chromium and mobile WebKit.
Six device-specific cases are skipped by their existing conditions.

The selected WebKit project run covers 55 globe, Pins, temperature, and tornado cases.
Its first run exposed a race in the tornado test's document replacement.
The map and its destination page share a heading, so that heading did not prove that React had unmounted the renderer.
The test now waits for the actual map container to disappear before replacing the document.
The page-error assertions remain unchanged.
The previously failing case passes three consecutive isolated runs after this fix.
All seven tornado cases are also checked in both browser engines after the fix.
The other 48 selected WebKit cases passed in the initial run.

The live preview uses patched Node 24.22.3.
A real-provider check renders Canada, selects Ontario, and shows its radius spokes without page errors.

The measurement record retains exact versions, advisory counts, package fingerprints, and test results.
See [dependency audit evidence](../performance/2026-11-13-dependency-audit.json).

Run the npm checks with the configured runtime and package manager:

```bash
nvm install
npm install --global npm@12.2.2
npm ci
npm run lint
npm run typecheck
npm run audit
npm outdated
npm run test:coverage
npm run test:temperature-records
```

Run the Python checks in a separate environment:

```bash
python3 -m venv .venv-pins
.venv-pins/bin/python -m pip install -r projects/pins-of-inaccessibility/requirements-dev.txt
.venv-pins/bin/python -m pip_audit -r projects/pins-of-inaccessibility/requirements-dev.txt --strict
.venv-pins/bin/python -m unittest discover -s projects/pins-of-inaccessibility/tests -v
```

The audits check published package advisories at the time of the run.
They do not certify that the code has no security defects.
Native libraries bundled inside wheels and operating-system packages are outside these package audits.
