# Trip CI review: 2026-10-28

## Scope

The baseline is commit `199903b769b419804df9ac3282f33c52e0203573`.
The review started with five uncommitted files from the proposed CI fix.
The reported failures involved panorama width in Chromium and missing stop markers after a WebKit control toggle.

Independent standards and specification reviews examined the patch.
The review also checked the affected browser configuration, fixtures, and documentation.
Changes cover browser configuration, regression checks, and failure evidence.

## Standards

### P2: The scrollbar fixture discarded configured launch options

The fixture replaced `launchOptions` with a static object.
This removed the custom Firefox executable and any configured browser arguments.
It broke the testing guide's documented executable override.

A regression uses Playwright's actual fixture resolution without starting browsers.
The original fixture failed three project configurations: custom Chromium, custom Firefox, and ignored default arguments.

The fixture now receives the inherited options and applies a small scrollbar policy.
The policy changes only Chromium.
It preserves executable paths, arguments, existing exclusions, and boolean `ignoreDefaultArgs` values.
It does not mutate the caller's options or duplicate the scrollbar exclusion.
Six project configurations verify the fixture connection.
Seven unit cases check the policy directly.

### P3: Initial smoke failures had no trace or screenshot

The documentation promised failure evidence from both browser suites.
Smoke tests used `on-first-retry`, but no retry was configured.
Smoke tests also omitted screenshots.

Both suites now retain traces and screenshots from the initial failure.
The upload action retains available browser output for seven days.
The action uses a complete commit hash with its verified release comment.
Workflow permissions remain limited to reading repository content.

### P3: The new workflow guard accepted a missing browser step

The upload-order assertion used `findIndex` without checking its result.
A missing trip-browser step returned `-1` and still passed the ordering check.

The guard now requires that step to exist.
It checks output directories against the browser configurations.
It also checks effective job permissions, including a possible job-level override.

Standards result: three findings corrected.
The discarded executable configuration was the most serious finding.

## Specification

### P2: The proposed WebKit fix removed the failing input path

The reported failure followed clicks on `Stops` with normal motion.
The proposed fix changed both input and motion: keyboard activation replaced clicks, and reduced motion became mandatory.
Those passing results did not establish the cause of the reported failure.

The original click and normal-motion scenario is restored.
Separate cases add keyboard and touch input.
Each input runs with normal motion and reduced motion.
Desktop projects skip touch cases because their contexts do not support touch input.
All cases retain marker pixels, stop-list visibility, route colors, reset behavior, and camera bounds.

### P2: The executable override requirement was broken

The testing guide permits an alternative Firefox test executable.
The fixture replacement violated that requirement.
The launch-option correction above closes this gap.

### P3: A narrow phone body could pass the panorama check

The panorama must reach both page edges on phones and desktops.
The proposed assertion compared the image with `body.clientWidth`.
A narrow body could reduce both widths and still pass.

A phone regression applies a 320-pixel body constraint inside a 375-pixel page.
The original measurement reported 320 pixels and failed the new regression.
The corrected measurement uses the root element's layout box.
That boundary remains independent of body and article constraints.
It also excludes an empty reserved scrollbar gutter, which root `clientWidth` can include.

The complete panorama check runs with default and classic scrollbars.
The desktop Chromium classic case verifies a 15-pixel reserved width.
Responsive-source, image-ratio, overflow, viewer, and keyboard-focus assertions remain included.

Specification result: three findings corrected, including one overlap with the standards review.
Removing the original WebKit scenario was the most serious gap.

## Coverage

The focused comparison uses identical final source and the same V8 coverage provider.
The control includes only the default Chromium launch-option case.
The complete run adds option-preservation and browser-boundary cases.
Both measurements include only `scripts/trip-browser-options.ts`.

| Measure | Default case | Complete policy cases |
| --- | --- | --- |
| Statements | 75% | 100% |
| Branches | 66.66% | 100% |
| Functions | 100% | 100% |
| Lines | 100% | 100% |

The fixture-resolution integration test additionally checks six Playwright projects.
It can detect incorrect fixture wiring that policy unit tests alone would miss.
Failure-evidence tests cover both browser configurations and the upload contract.

The focused browser run passed 25 cases and skipped two desktop touch cases.
It covers both scrollbar modes, the narrowed-body measurement, and all supported input and motion combinations.
Browser results are scenario coverage. They are separate from V8 source percentages.

## Verification

The complete Vitest suite passed 1,511 cases across 105 files.
The Python temperature suite passed 17 cases.
The complete trip browser suite passed 106 cases across three browser projects.
It skipped two unsupported desktop touch cases.
The smoke browser suite passed 17 cases.
ESLint and TypeScript checks passed.
All 46 local links in the affected documentation resolved.
The full V8 report measured 78.88% statements, 73.18% branches, 77.37% functions, and 80.94% lines.
These percentages measure loaded files, rather than every repository file.

A prior full run exceeded the 180-second Chromium launch limit in two workers.
Those failures occurred before their test bodies ran. The other 104 cases passed.
The later complete run passed without those startup failures.

## Remaining limit

The original intermittent Linux WebKit marker failure did not reproduce locally.
The original scenario remains covered, and CI retains evidence if it fails again.
The investigation remains in [TODO.md](../../TODO.md#browser-checks).
This review does not claim a verified application-level cause or fix for that failure.

The [testing guide](../trips/TESTING.md) records current commands and failure-evidence procedures.
The documentation uses short sentences, active voice, and consistent terms.
It approximates ASD-STE100 style without claiming formal certification.
