# Dashboard and dependency review: 2026-10-07

## Scope

The initial working tree contained one change: the dashboard terminal-size fix.
This review covers that change, dependency updates, install configuration, tests, and current maintenance instructions.
It does not certify every application feature, provider API, infrastructure resource, or authored trip fact.
No Google document, Sheet row, S3 object, or infrastructure setting was changed.

## Findings and corrections

### P1: terminal dimensions stopped TypeScript compilation

Ink types `useStdout().stdout` as a writable stream. That type does not declare `rows`.
Two direct property reads stopped the TypeScript check and production build.
The dashboard now uses Ink's typed `useWindowSize()` hook.
The hook also owns resize events and listener removal. The duplicate application listener was removed.

Ink uses stream dimensions first. It then detects the host terminal size.
If detection fails, it uses 80 columns and 24 rows.
This differs from the former unconditional 24-row fallback for streams without `rows`.
The tests verify the supported Ink behavior.
See the [dashboard](../../scripts/dashboard/App.tsx) and [regression tests](../../scripts/dashboard/__tests__/App.test.tsx).

### P2: the router override violated the package contract

`react-router-dom` 7.18.4 declares `react-router` 7.18.4.
The repository forced Router 8.3.0 through an override.
A passing typecheck did not prove compatibility between those major versions.
The override was removed. Both packages now use version 7.18.4.
Route-state tests and Chromium navigation tests pass. The corrected tree has no reported dependency advisories.
No production navigation failure was reproduced. This correction removes an unsupported dependency combination.

### P2: automated builds did not enforce the declared npm version

The manifest declared npm 11.17.0. CI and Amplify used the npm version supplied by Node.js.
The `packageManager` field alone did not select the executable.
The manifest now declares npm 12.2.0.
CI, the dependency-installing sync workflows, and Amplify select that version before `npm ci`.
The supported Node.js ranges now match npm 12 and Vitest 5 requirements.
They exclude the unsupported Node.js 23 and 25 lines.
Configuration tests verify install order, paired package versions, and the absence of the router override.
The tests now parse Amplify YAML with the existing YAML parser, not indentation rules.
See the [configuration tests](../../scripts/__tests__/amplifyConfig.test.ts).

### P2: the dashboard change had no application regression tests

TypeScript checks could not verify resize behavior, footer visibility, keyboard commands, or listener removal.
Ten tests now render the application through Ink with a synthetic output stream.
They check initial height, resize events, detected dimensions, scroll limits, mode changes, log commands, quit, and problem recovery.
They also check external-group callback identity and repeated reports.
Remote panels are replaced with fixed test components. These tests make no provider requests.

### P3: the control documentation described the wrong scroll behavior

The guide said that scrolling worked only in detail mode. The input handler also permits scrolling in compact mode.
The guide now describes the implemented behavior.
It also explains terminal-size fallback, dependency constraints, and coverage limits.

## Dependency updates

All direct package version ranges were refreshed to current compatible releases.
The lockfile was regenerated and tested with npm 12.2.0.
`terminal-size` is now a declared test dependency. The fallback test no longer relies on an undeclared transitive import.

| Package group | Installed version |
| --- | --- |
| React, React DOM, and their types | 19.3.0 |
| Ink | 8.0.0 |
| Vitest and V8 coverage | 5.0.3 |
| Vite | 8.3.3 |
| Playwright | 1.63.0 |
| MapLibre GL | 6.13.0 |
| AWS SDK clients and credential provider | 3.1147.0 |
| ESLint | 10.12.0 |
| TypeScript ESLint adapter | 8.71.1 |

The `typescript` alias remains on `@typescript/typescript6` 6.0.2.
The ESLint adapter requires TypeScript below 6.1. TypeScript 7 is not a supported replacement for that compiler.
The separate `@typescript/native` alias supplies version 7.0.2.
An empty `npm outdated` result does not imply that every transitive package uses its newest release.

## Validation

The local checks used Node.js 26.10.0 and npm 12.2.0.
The checked-in Node.js pin remains 24.16.0. This review did not run the suite on that runtime.

| Check | Result |
| --- | --- |
| Clean `npm ci` with npm 12.2.0 | Passed |
| Installed dependency tree | No invalid direct dependencies reported |
| ESLint | Passed |
| TypeScript | Passed |
| Dependency audit | Zero reported vulnerabilities |
| `npm outdated` | No outdated direct packages reported |
| Vitest | 1,179 tests passed in 85 files |
| Temperature pipeline | 17 tests passed |
| Chromium smoke tests | 9 tests passed |
| Production trip browser tests | 26 desktop and phone Chromium tests passed |
| Synthetic trip production build | Passed |
| Full production build | Passed; imported one published Google post |
| WebKit | Not run; required host libraries are absent |

The full suite measured 74.91% statements, 67.87% branches, 72.34% functions, and 77.47% lines.
These values describe loaded source files, not every repository file.

The focused comparison uses the same dashboard source, compiler, and coverage provider in both runs.
The first run includes only the three terminal-size tests. The second includes all ten dashboard tests.
This comparison measures added test coverage. It does not compare two source revisions.

| Dashboard metric | Three sizing tests | Ten regression tests |
| --- | --- | --- |
| Statements | 57.57% | 95.45% |
| Branches | 36.66% | 98.33% |
| Functions | 45.45% | 86.36% |
| Lines | 72.34% | 100.00% |

## Remaining risks

WebKit remains an unverified release gate on this host. CI installs the required system libraries.
The production build still reports a large Flights visualization chunk and a Tailwind source-map warning.
Build fetchers, cost-provider paths, and event log rendering still have limited unit coverage.
Passing dashboard tests do not verify AWS credentials, quotas, remote response formats, or production network behavior.
Passing builds do not verify unpublished trip dates, distances, captions, or public asset access.
The existing trip publication blockers remain open.
See [TODO.md](../../TODO.md) for incomplete work and acceptance conditions.

## Documentation

The repository guide now contains current install, dependency, and test procedures.
TODO tasks are grouped by publication blockers, browser checks, dashboard checks, maintenance, and content work.
Dated reports retain their historical findings and results.
The revised text follows the repository ASD-STE100 writing rules. No formal language certification was performed.
