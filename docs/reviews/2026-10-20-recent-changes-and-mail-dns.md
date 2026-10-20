# Recent changes and mail DNS review: 2026-10-20

## Scope

The user selected recent commits and uncommitted changes.
This review covers commits `88e109d`, `24a46bb`, and `1708c42`, plus the pending mail DNS configuration.
These commits changed dashboard sizing, dependencies, CI installation, browser bundle measurements, and trip map selection.
The pending files added mail records, documentation, and an AWS provider checksum.

This is a scoped engineering review, not a complete application security assessment.
The attached Obsidian research note is unrelated and remains unchanged.
No production infrastructure, DNS record, or Google Admin setting was changed.

## Findings and corrections

### P2: stop selection before map load hid the full-route action

[TripRouteMap](../../src/features/trips/components/TripRouteMap.tsx) enabled stop selection before its load event.
The action control initialized from the requested stop and track.
It did not observe camera movement until map load.
An overview had no requested stop. Selecting a stop therefore left its full-route action hidden.

The component now shows that action when a valid stop selection moves the camera.
The control retains its existing movement listeners and teardown behavior.
Replacement controls initialize from the current selection, not only the original request.

The same sequence exposed another ordering problem.
The delayed overview callback still reduced the zoom after a user reset.
It now distinguishes an untouched overview from an explicit reset.
Only an undefined selection receives the initial zoom adjustment.
The empty-string reset selection does not.

Regression tests select a stop, reset the camera, and then release the load callbacks.
They check control visibility, cleared selection, and the absence of later camera movement.
Both animated movement and reduced motion are covered.

### P2: errors from removed maps blocked healthy replacements

Map errors were associated only with the route URL.
Changing a track or stop list created another map without changing that URL.
The previous error still matched. Its overlay hid the replacement and made its controls inert.

Errors now match every map-construction input: route URL, route object, stop list, and track ID.
A replacement no longer inherits another configuration's error.
Its own errors still appear.
Regression tests cover track replacement and stop-list replacement.

Additional tests check map retry, old-instance removal, missing tracks, attribution initialization, download-control removal, and marker hover removal.

### P3: mail records had no automated policy or key checks

[mail.tf](../../infra/mail.tf) passed Terraform validation.
That check does not establish correct TXT chunking or a usable RSA public key.

[Terraform assertions](../../infra/tests/mail.tftest.hcl) now check the zone, record names, TXT types, TTLs, SPF, and monitoring-only DMARC.
They also check the DKIM text format and string-length limit.
[Node tests](../../scripts/__tests__/mailDns.test.ts) parse the actual public key.
They check its RSA type, 2048-bit modulus, and complete DER encoding.

The [CI workflow](../../.github/workflows/ci.yml) now has a separate offline Terraform job.
It uses the locked provider and a mocked AWS provider.
An isolated local run passed with AWS configuration and credentials files unavailable.
No overwrite option was added. The existing MX record remains outside Terraform.

### P3: mail instructions omitted the ownership check

Public DNS already contained the three mail authentication records.
Creating an existing record can fail if Terraform does not already manage it.
DNS output cannot establish state ownership.

The [email DNS guide](../email-dns.md) now requires a state check before deployment.
It includes conditional import commands and a plan review.
It also separates DNS publication, Gmail signing, delivery checks, and key rotation.
The repository guide now links to this procedure instead of repeating long instructions.

Remote state could not be inspected because the configured `rsmbtv-admin` profile was unavailable.
Record ownership remains an explicit operational check, not a claimed correction.

## Other reviewed behavior

No additional defect was verified in the response-body budget helper or the Ink sizing change.
The dependency tree satisfies the installed manifest contracts.
The dependency audit reports no known vulnerabilities.
That audit is not evidence that the application has no security defects.

The browser budgets remain 125,000, 185,000, and 190,000 gzip bytes for their documented route groups.
They passed in desktop Chromium, phone Chromium, and phone WebKit.
No limit was raised.

## Validation

| Check | Result |
| --- | --- |
| Initial focused unit baseline | 47 passed |
| New defect regressions before correction | 4 failed as expected |
| Final map unit tests | 28 passed |
| Complete Vitest suite | 1,200 passed in 87 files |
| Temperature pipeline | 17 passed |
| Trip browser suite | 48 passed across three browser projects |
| Site browser smoke tests | 9 passed |
| Synthetic production build | Passed |
| ESLint and TypeScript | Passed |
| Terraform formatting and validation | Passed |
| Mocked Terraform mail plan | 1 passed |
| Isolated credential-free Terraform setup | Passed |
| Dependency audit | Zero reported vulnerabilities |
| Whitespace check | Passed |

Playwright executables were initially absent.
Installing the required browser files resolved that setup failure.
WebKit then ran successfully. The obsolete setup blocker was removed from [TODO.md](../../TODO.md).

Local checks used Node.js 26.12.0, npm 11.20.0, and Terraform 1.16.6.
They used the existing installed Node dependencies.
This review did not repeat a clean dependency installation with the configured npm 12.2.0.
CI retains that installation contract.

## Coverage

The controlled map comparison used the same implementation, compiler, coverage provider, and include filter.
Only the tests changed.

| Map coverage | Earlier 21 tests | Final 28 tests |
| --- | --- | --- |
| Statements | 92.55% (199/215) | 97.20% (209/215) |
| Branches | 91.33% (116/127) | 92.91% (118/127) |
| Functions | 87.50% (49/56) | 94.64% (53/56) |
| Lines | 95.05% (173/182) | 99.45% (181/182) |

The four initial regressions did not increase these percentages by themselves.
They exposed incorrect event sequences through code that the old tests already executed.
Coverage percentages cannot establish correct asynchronous behavior.

The full suite measured 75.14% statements, 68.07% branches, 72.63% functions, and 77.68% lines.
Those values describe measured source files, not every repository file.
The full-suite result is not a controlled historical coverage comparison.

## Remaining limits

The build retains its existing large-visualization-chunk and Tailwind source-map warnings.
Related work remains in [TODO.md](../../TODO.md).
The review used synthetic production content. It did not synchronize live Google documents for a complete publication build.

The mail tests do not prove remote-state ownership, active Gmail signing, or external delivery.
Those checks require the configured AWS and Google Admin accounts.
DMARC remains in monitoring mode by design.

Current instructions use shorter sentences, active voice, and separate procedures.
They follow the repository's ASD-STE100 writing goals without claiming formal compliance.
Historical reports remain dated snapshots.
