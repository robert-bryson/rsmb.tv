# ski-status asset and visitor data review

November 21, 2026

The review covered changes after `134b683` on `feature/ski-status`. These changes moved runtime files to the NAS and added visitor records and map layers.

## Findings and fixes

| Impact | Finding | Fix |
| --- | --- | --- |
| High | Icons used stable filenames after the asset move. A browser could reuse an older icon after a release. | Icon and terrain URLs include their SHA-256 checksums. The build verifies all 23 runtime files from the NAS or HTTPS mirror. [Release assets](../../projects/ski-status/readme.md#release-assets) |
| High | The local server could open files that had no entry in the archive index. | The server accepts only indexed archive paths and versions on the local origin. It checks that the requested file still matches the recorded size. [Local assets](../../projects/ski-status/readme.md#local-assets) |
| High | The terrain tests skipped important map checks when the NAS was absent. | The tests use an 82 KiB fixture for byte ranges, rendering, filters, and retries. A separate local check uses the full archive. [Terrain fixture](../../projects/ski-status/readme.md#terrain-fixture) |
| Medium | An image failure lasted until the map reloaded. Some links lost their visible icon when the NAS was unavailable. | A background retry loads the images again. Pass controls show initials on failure. Resort links keep visible icons. |
| Medium | The browser bundle contained research metadata that the visitor panel did not use. The panel also called 14 lift bases visitor entrances. | Vite validates and selects the records before it builds the bundle. The panel labels these coordinates as resort map points. |

## Verification

The release validator checks the terrain path, full checksum, byte ranges, and two Heavenly tooltips.
The regression tests cover a missing file, corrupt bytes, and an incorrect checksum path.
The build test checks the browser bundle and source map for research-only fields.
Catalog tests compare each checked visitor map point with its catalog coordinates.
The catalog has 585 areas. The terrain index covers 552 areas. The visitor records cover 101 areas.
The road layer check used a public CARTO tile near Tahoe. It confirmed the road and shield fields. [CARTO Dark Matter style](https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json)

V8 used the same feature, shared module, and script paths for both measurements. Chromium checks map rendering and interaction. [Coverage command](../../projects/ski-status/readme.md#local-checks)

| Measure | Before | After |
| --- | ---: | ---: |
| Tests | 306 | 324 |
| Lines | 62.31% | 68.92% |
| Branches | 61.06% | 69.05% |
| Statements | 62.04% | 68.18% |
| Functions | 68.81% | 77.15% |

| Check | Result |
| --- | --- |
| Repository Vitest | 3,979 passed |
| Repository Python | 37 passed |
| Ski-status Chromium with the NAS | 72 passed |
| Focused Chromium checks with an empty asset folder | 13 passed. The full archive check requires the NAS. |
| Release validator in Chromium | 22 passed |
| Production Vite bundle | All 23 runtime files matched their checksums |
| ESLint, TypeScript, and npm audit | Passed. npm reported zero vulnerabilities. |

## Hosted release

The hosted build needs the versioned runtime files on the HTTPS mirror.
Set `SKI_ASSETS_BASE_URL` in Amplify. Then, validate the hosted preview for the candidate revision and job.
The local build verified all runtime files against the release indexes. [Release tasks](../../projects/ski-status/TODO.md#release-checks)
