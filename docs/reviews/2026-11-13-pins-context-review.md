# Pins context and pending changes review — November 13, 2026

## Scope and result

This review covers the uncommitted globe, outline, location context, development, and documentation changes after `4def384`.
It preserves the existing work and corrects the defects below.
The existing context release passes the new checks for all 8,091 pins.
This review does not upload data or deploy the site.

The main defects were at the publication boundary.
The browser contract was stricter than the publisher contract.
The publisher also read mutable files after validation.
Both defects could make a published release unusable.
The existing success tests did not exercise these cases.

## Findings and fixes

### P1 — A local build could change the manifest during upload

The publisher validated one manifest and uploaded its release files.
It then uploaded the manifest from the original working directory.
A build that completed during upload could replace that manifest with a different release.
The active manifest could then point to files that the publisher had never uploaded.

The publisher now copies listed files and the manifest into a private temporary directory.
It validates that copy before the first AWS command.
It uploads the copied release, checks the remote inventory, and uploads the copied manifest last.
Changes to the working files cannot change this publication snapshot.

Regression tests replace the source manifest during a simulated upload.
They also corrupt a release file during the copy step.
The first case retains the validated manifest. The second case stops before any AWS command.
An incomplete remote inventory also stops publication before the manifest update.

### P2 — Context validation accepted records that the browser rejects

The publisher omitted required place names, GeoNames IDs, country fields, timestamps, and numeric type limits.
Python also treats booleans as integers.
A comparison with a nonfinite coordinate could return false without rejecting the coordinate.
These conditions let invalid records pass the old checks.

The new [Python context contract](../../projects/pins-of-inaccessibility/context_contract.py) checks the browser's field limits.
Generation and publication use the same checks.
Terrain responses and cached terrain samples also reject invalid coordinates, booleans, missing fields, and invalid datasets.
Valid zero, negative, and missing terrain samples retain their meanings.
The publisher still checks nearby-place distance and bearing against WGS84 calculations.

The regressions cover invalid manifests and records, including missing place IDs and nonfinite coordinates.
They verify that rejected data cannot start an upload or replace the current generated manifest.

### P2 — Missing source files silently reduced context coverage

The source reader found province files with a directory glob.
A missing file therefore reduced the expected inventory instead of causing an error.
Publication could claim complete coverage of that incomplete input.

The reader now enumerates required files from the pinned country catalog.
It validates the U.S. and global payloads with the existing publication validators.
The global validator accepts the selected U.S. publication path when checking the retained national pole.
Missing files, incomplete identities, changed provenance, and inconsistent duplicate records stop the operation.
Unlisted working files cannot add records.

The inventory test checks all 8,091 current pins.
It also rejects a directory with valid national files and missing province files.

### P2 — A changed validation function could reuse previously accepted data

The shared pin hook bound stored data only to its URL.
It skipped validation after a caller changed its validation function at the same URL.
The hook now binds data to both values.
A changed function checks cached raw JSON again before exposing data.
A rejected value leaves the cache, and a later valid reader can recover.

The [resource regression](../../scripts/__tests__/pinsResources.test.tsx) reproduces the old behavior and verifies recovery without duplicate valid requests.

### P2 — Component exports failed the release lint check

The new details component also exported three utility functions.
That arrangement produced three React Fast Refresh lint errors and blocked CI.
The utilities now live in [locationDetails.ts](../../src/features/pins/locationDetails.ts).
The component exports its React component only.
Existing formatting and coordinate-link tests exercise the extracted functions.

### P3 — JSON writers shared temporary filenames

Context checkpoints and JSON output used a fixed temporary filename.
Concurrent writers could replace or remove that file during another write.
The context writer now reuses the existing atomic JSON writer.
It creates unique temporary files, flushes file contents, and replaces the destination atomically.
Canonical key order remains stable for release checksums.
A regression holds two checkpoint writers at replacement and verifies that both complete without partial or missing output.

## Validation

| Check | Result |
| --- | --- |
| JavaScript suite | 3,120 tests pass in 216 files |
| Temperature Python suite | 18 tests pass |
| Pins Python suite | 48 tests pass |
| Focused Pins suite | 82 tests pass |
| Chromium and WebKit Pins suites | 20 scenarios pass in each browser |
| Existing context dry run | 8,091 pins, 307 files, 2,586,600 bytes pass |
| Global source comparison | 4,799 pins and 345,528 circle samples pass |
| Matched regional source coverage | 236 country groups pass |
| Lint, TypeScript, and Vite fixture build | Pass |
| npm advisory scan | No known vulnerabilities |
| Python advisory scan | 30 packages checked, no known vulnerabilities |

The browser results and coverage totals are retained in the [measurement record](../performance/2026-11-13-pins-context-review.json).
The browser checks retain the real renderer and geographic files.
Fixed responses replace external map and context services.
They include context failure and retry, globe framing, shared selections, mobile layout, and accessible controls.

The focused coverage scope includes `src/features/pins/**`, the pin contracts, common pin geometry, and the WGS84 destination helper.
The same test selection and V8 coverage provider apply before and after the changes.
The baseline has 77 focused tests. The final selection has 82.

| Coverage | Before | After |
| --- | ---: | ---: |
| Lines | 99.31% | 99.31% |
| Branches | 93.41% | 93.89% |
| Statements | 97.01% | 97.00% |
| Functions | 97.93% | 97.93% |

The removed coordinate declarations reduce statement and line totals by two.
Branch coverage improves without adding duplicate source checks.
Browser checks used one worker and a separate Vite server after unit and build checks finished.
WebKit used the existing local compatibility launcher.

The host uses Node.js 26.13.0 and npm 11.20.0.
These versions differ from the declared supported runtime and package manager.
CI retains the versions pinned in `.nvmrc` and `package.json`.
The fixture build checks code and bundle contracts without production credentials.
It does not verify hosted content imports or physical-device performance.

## Documentation and remaining work

The documentation index now has one set of writing rules.
Current instructions use short sentences, active voice, and consistent technical names.
The rules follow [ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf).

The link scan found 41 stale heading links across current guides and dated reports.
The corrected links point to current sections. Historical findings and measurements retain their stated dates.
The Pins guide now states the source inventory checks and exact publication order.
The repository guide includes a direct local startup command for work with existing generated assets.

Open source comparisons, hosted checks, phone measurements, boundary delivery work, and source refresh policy remain in [TODO.md](../../TODO.md#pins-of-inaccessibility).
The source checks establish consistency with the pinned boundaries.
They do not establish current legal boundaries or an independent global geodesic optimum.
