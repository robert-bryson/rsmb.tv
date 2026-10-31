# ADV Atlas merge fixes and dependency update

Date: October 31, 2026.

Follow-up: the [minimatch security fix](2026-10-31-minimatch-security-fix.md) resolves the audit failure described below.

Both interaction defects from the [pre-merge review](2026-10-31-adv-atlas-merge-research.md) are corrected.
Dependencies are updated to current compatible releases, and a clean installation passes.
The full dependency audit still fails on the existing minimatch advisory. Production dependencies have no reported vulnerabilities.

These changes apply to the working tree after `003ee94d943f50aed997cedf61ae17bed22810f1`.
The earlier review retains its original baseline and findings.

## Return to the originating atlas visit

Report links now carry the originating browser history key as `returnKey`.
Article headers, footers, previous/next links, and series links preserve it through navigation and reloads.
The atlas restores that visit's snapshot instead of the latest snapshot associated with its URL.

An atlas reload prefers its own saved view, including changes made after returning.
If an explicitly named source snapshot has expired, restoration does not substitute another visit at the same URL.
The page instead frames the selected trip normally.
Older report links without a key retain their existing URL fallback.

The implementation is in [AdvAtlas](../../src/pages/AdvAtlas.tsx), [BlogPost](../../src/pages/BlogPost.tsx), [PostNavigation](../../src/blog/PostNavigation.tsx), [TripStoryHeader](../../src/features/trips/components/TripStoryHeader.tsx), and [tripAtlasSession](../../src/features/trips/atlas/tripAtlasSession.ts).

Two production browser regressions cover the header return and a footer return after visiting another report.
Both create a second atlas visit at the same URL, change its view, and reload the original report.
They verify the original panel, camera, and card position on return.
Unit regressions cover series navigation, snapshot precedence, and an unavailable source snapshot.

## Escape dismissal

The [atlas renderer](../../src/features/trips/atlas/TripAtlasMap.tsx) now listens for Escape at document scope.
Its listener uses the current choice state and is removed when the component unmounts.
Escape closes shared-road choices after focus moves to the sibling trip panel, while retaining focus and trip selection.

The new browser case reproduces that exact sequence.
The existing chooser-button, hover, fullscreen, and renderer recovery cases continue to pass.

## Dependency updates

The update uses normal npm dependency and peer checks.
There are no forced major overrides, audit exclusions, or security-gate changes.

| Dependency | Previous | Updated |
| --- | --- | --- |
| Six declared AWS SDK packages | 3.1156.0 | 3.1161.0 |
| MapLibre GL | 6.15.0 | 6.16.0 |
| React Router DOM | 7.18.4 | 7.18.5 |
| ESLint | 10.13.0 | 10.14.0 |
| typescript-eslint | 8.72.0 | 8.72.1 |
| Rollup | 4.65.0 | 4.67.2 |
| magic-string | 1.4.3 | 1.4.5 |
| Node type definitions | 26.6.5 | 26.6.6 |

The lockfile also updates compatible transitive dependencies.
React and React DOM remain matched. Vitest and its coverage provider remain matched.
The TypeScript 6 lint/compiler alias remains in place because the adapter still requires TypeScript below 6.1.

MapLibre 6.16 includes a resize correction associated with WebGL context loss.
See the [official release notes](https://github.com/maplibre/maplibre-gl-js/releases/tag/v6.16.0).
The update retains the existing article JavaScript budgets and passes the browser recovery cases.

### Remaining audit failure

The full audit returns 12 moderate package findings from [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
They propagate from minimatch 10.2.6 through the development toolchain.
The patched version starts at 11.0.1.

Current upstream requirements still use minimatch 10:

| Upstream package | Checked version | Required minimatch |
| --- | --- | --- |
| [eslint](https://registry.npmjs.org/eslint/latest) | 10.14.0 | `^10.2.6` |
| [@eslint/config-array](https://registry.npmjs.org/@eslint%2fconfig-array/latest) | 0.23.5 | `^10.2.4` |
| [@typescript-eslint/typescript-estree](https://registry.npmjs.org/@typescript-eslint%2ftypescript-estree/latest) | 8.72.1 | `^10.2.2` |

No published minimatch 10 security backport was available during this check.
Forcing version 11 would exceed those contracts and the repository's dependency rules.
The full audit gate therefore remains visibly failing. Its production-only counterpart passes with zero findings.
This remains a merge blocker if the existing CI workflow must pass unchanged.

## Publication instructions

The Kalaloch TODO now reflects its current published state and the successful check of all 76 external asset URLs.
Its outstanding source, photo, date, and mileage verification tasks remain open.
PCH and Route 66ish instructions now refer to their already-linked source Google Docs.
Route 66ish still needs its final Sheet description.

The atlas and testing guides now describe explicit return identity and Escape dismissal outside the map.
No Sheet values, Google documents, or asset publication state were changed.
The recovered draft reports still require the publication work recorded in [TODO.md](../../TODO.md).

## Validation

Final installation and checks use the configured Node.js 24.22.1 and npm 12.2.1 from temporary installations.
Global toolchain installations are unchanged.

| Check | Result |
| --- | --- |
| Clean `npm ci` | Passed |
| ESLint | Passed, no warnings |
| TypeScript project checks | Passed |
| `npm outdated --json` | Empty object |
| Full Vitest coverage run | 1,768 passed in 119 files |
| Python temperature tests | 17 passed |
| Production trip browsers | 197 passed; 10 expected skips |
| Fixture and smoke browsers | 79 passed; five expected skips |
| Full `npm run build` | Passed with fresh published Google imports and public asset validation |
| Full `npm run build:dev` | Passed with fresh published and draft imports |
| Production dependency audit | Zero findings |
| Full dependency audit | Failed: 12 moderate development findings |

The three new browser cases first failed on the reviewed code, then passed across desktop Chromium, phone Chromium, and phone WebKit.
The final complete browser suites contain 276 passes and 15 expected browser/device exclusions.
No budgets or assertions were relaxed.

The coverage run measures loaded source: 81.13% statements, 75.71% branches, 79.32% functions, and 83.31% lines.
This is a current measurement, not a controlled coverage comparison with the earlier review.

Both full builds ran in a temporary snapshot of the changed source to preserve local generated previews.
Production imported three published stories and emitted no draft trip chunks.
Development imported 11 records and emitted draft previews with `noindex, nofollow`.
Its RSS feed retained only the three published stories.

The physical-phone cold-cache check and an actual Linux CI run remain release work.
The existing full audit failure still prevents a green unchanged CI workflow.

Local verification logs use `/private/tmp/rsmb-atlas-fixes-*` and `/private/tmp/rsmb-atlas-deps-*`.
Temporary build summaries remain alongside those logs; the temporary source snapshot was removed after inspection.
