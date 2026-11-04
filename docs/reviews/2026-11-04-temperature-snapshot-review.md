# Temperature snapshot fixture review

Review date: November 4, 2026.
Baseline: `84be95345fd6d8206f5c056576f36146956d1704` and the pending temperature snapshot changes.

## Scope

The pending change preserved WebGL drawing buffers and checked the return to **Yesterday**.
This review covers the browser fixture, its tests, and the temperature map guide.
Independent reviews checked repository standards and required behavior.

The [documentation rules](../README.md#writing-rules) supply the writing requirements.
The [temperature guide](../temperature-map.md#validation) supplies the browser requirements.
The [failed CI run](https://github.com/robert-bryson/rsmb.tv/actions/runs/41890952602) supplies the original symptom.

All 2,441 unit tests passed in that run.
Four WebKit marker assertions failed. The fifth error reported the failed process exit.
The two notices summarized the browser results.
Linux screenshots contained cleared frames or markers from the previous period.
Preserving the drawing buffer corrected these screenshot failures.

## Standards

### P3: The fixture changed unrelated WebGL canvases

The original hook changed every WebGL context on each temperature test page.
An unrelated canvas received `preserveDrawingBuffer: true`, even when its caller requested `false`.
Real-context tests reproduced this behavior in Chromium and WebKit, with both WebGL context types.

The extracted `preserveMapDrawingBuffer` helper now checks the `maplibregl-canvas` class.
Only application cases that inspect pixels install the helper.
Data fixtures no longer change rendering configuration.
Frozen caller options verify that the helper preserves requested alpha and antialias settings without changing the input object.

### P3: Context matching changed native option access

The original `/webgl/` pattern also matched `unsupported-webgl`.
Spreading its options evaluated an `alpha` getter before the native call returned `null`.
WebKit's native call does not evaluate that getter.
Chromium evaluates it natively, so the test compares each browser with its own unmodified behavior.

The helper now matches only `webgl` and `webgl2`.
Other context requests receive their original options.
A separate case verifies that 2D drawing still produces the expected pixels.

These are fixture isolation defects. They do not affect the deployed application.
No documented coding-standard breach or credential exposure was found in the original diff.
The small helper has multiple test callers. No additional abstraction was needed.

## Spec

No confirmed requirement violation was found.
The final cases retain the real renderer, fixed data, neutral tiles, and error collection.
The marker matrix checks `5/4 → 2/2 → 5/4` high/low counts at both viewport widths.
Normal startup and the six-second worker delay remain covered.
Readiness retains the test budget. Marker assertions retain five-second timeouts.
Cleanup still releases intercepted worker requests after failures.

The original hook also changed startup, controls, and independent-feed cases that did not need pixel capture.
Those cases now use the default drawing buffer.
A new case checks real-map startup, source readiness, and `preserveDrawingBuffer: false` together.

## Coverage

The temperature browser suite increased from 22 to 32 cases across Chromium and WebKit.
Five added cases per browser check both WebGL types, unsupported names, 2D drawing, and default-buffer startup.
Existing marker cases also check the return to **Yesterday**.

The new scope tests failed against the original hook before the correction.
The final suite checks real browser contexts rather than mocked context factories.
These browser cases do not contribute to Vitest V8 coverage.
No application source changed, so this review does not claim increased application V8 percentages.

## Validation

| Check | Result |
| --- | --- |
| Production temperature suite on macOS | 32 passed across Chromium and WebKit |
| Production temperature suite on Linux | 32 passed across Chromium and WebKit |
| Development temperature suite on macOS | 32 passed across Chromium and WebKit |
| Complete Vitest suite | 2,441 passed across 164 files |
| Historical temperature pipeline | 17 passed |
| ESLint and project TypeScript checks | Passed |
| Direct TypeScript check of the modified browser spec | Passed |
| Diff whitespace | Passed |

## Limits

Pixel cases use preserved drawing buffers. They do not measure performance with the default buffer.
Default-buffer startup verifies source readiness, not marker pixels in screenshots.
Fixed responses do not verify production data, provider authorization, or font appearance.
Linux validation used the official Playwright 1.64.1 Ubuntu 24.04 ARM64 container.
It does not replace the GitHub Actions run on Ubuntu 26.04.

Standards: two P3 fixture defects corrected; no remaining findings.
Spec: no confirmed violations; default-buffer coverage expanded.
