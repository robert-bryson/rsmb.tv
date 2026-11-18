# Main branch review and flight separation

Review date: November 17, 2026.
Published baseline: `bf2ec56`.
Original local tip: `6c62ec3`.

## Branch boundaries

The original tip contains 13 unpublished commits.
`backup/main-before-flight-split-2026-11-17` retains those commits and their original identifiers.
`feature/flight-ui-and-maps` replays the flight work on the reviewed `main`.
The reviewed `main` retains the shared UI, search, and ADV Atlas changes.
The original home layout already matches the published baseline. Its stronger introduction test remains on `main`.

The split requires the Flights directories, application routes, map helpers, and dependency files on `main` to match the published baseline.
Flight-specific styles, tests, documentation, renderer changes, and dependencies belong to the feature branch.
The feature branch uses the reviewed `main` as its base, so its comparison shows the remaining flight work.
The remote update uses a normal fast-forward push.

| Original commits | Retained on main | Preserved flight work |
| --- | --- | --- |
| `14d5935` | Shared headings, map targets, Tornado layout, search previews, media-query subscription, and related tests | Flight panels, filters, sharing, overlay measurement, and their regressions |
| `4dbdbba` | Original-home assertion | Flight icon set and statistics changes |
| `42c2919` | Atlas table text alignment, card spacing, documentation, and browser regression | None |
| `6c62ec3` | Runtime version-check instructions | Spherical motion, stable filtered routes, stationary-clock behavior, and review evidence |
| `0b42343`, `883e9f0`, `c562348` | None | Statistics layout, visible actions, and duration presentation |
| `20ed4a5`, `e3470a6`, `fc54c0f` | None | Zoom research, adaptive globe detail, and the MapLibre prototype |
| `9a3eab0`, `0afc6fc`, `fe655d0` | None | Playback, lifecycle, camera history, and geographic speed corrections |

## Retained change review

Search extraction retains paragraph boundaries and decodes JSX entity text once.
The Markdown parser reads isolated entity tokens. It does not evaluate source expressions.
The browser selector requires eligible passages before ranking them.
Metadata matches use the description. Status messages remain outside project previews.
Tests cover split terms, fallback descriptions, ranking, long previews, and literal text.

Shared headings retain their semantic levels and focus behavior.
Map navigation buttons use 44-pixel targets within scoped map containers.
Tornado controls wrap on narrow screens and with enlarged text.
Temperature controls reuse the same target-size rule.

The shared media-query hook retains its browser query and removes listeners during cleanup.
Server rendering and missing browser APIs return a stable false snapshot.
The reduced-motion hook reuses this subscription.
The overlay-height hook remains with the flight work because its consumers are flight controls.

Atlas table titles align their first text line with neighboring cells.
Card containers own the location margin.
The regression checks wrapped titles, selection, missing metadata, and touch-target height.

Review found no confirmed defect that requires another application-code correction in the retained changes.
Branch separation also preserves their original source content.

## Dependency audit

The reviewed dependency and lock files match the published baseline.
The production audit reports no known vulnerabilities.
The full audit reports 16 high development alerts from the existing `picomatch` advisory.
The [advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) has no patched release at review time.
Keep the maintenance task open until a compatible patch is available.

## Validation

Checks use Node 24.22.3 and npm 12.2.2 with a fresh dependency install.
The review checkout uses the published lock file.
Build and browser checks use synthetic map credentials. Browser checks use fixed article and map content.
They do not establish physical-device performance or hosted analytics behavior.

| Check | Result |
| --- | --- |
| Fresh lock-file install | Passed |
| Complete Vitest suite | 246 files; 3,617 tests passed |
| Temperature pipeline | 18 Python tests passed |
| Search, navigation, and Tornado browsers | 42 passed; two expected WebKit forced-colors skips |
| Atlas text alignment | Four cases passed across desktop and phone Chromium and WebKit |
| TypeScript and ESLint | Passed; no lint warnings |
| Development build | Passed |
| Published flight boundaries | Flights source, routes, rendering helpers, and dependency files match the published baseline |
