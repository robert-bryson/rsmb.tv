# Temperature map startup review

Review date: November 4, 2026.
Baseline: `974d62b6ee3b4e8d8bd2505c6a340863936b86cb` and the pending temperature startup changes.

## Scope

The original diff changed the browser readiness wait, added worker delays, and updated the temperature map guide.
This review covers those changes, the browser configuration, and the component's map error handling.
It does not assess unrelated project features.

Independent reviews checked standards and required behavior.
The [documentation rules](../README.md#writing-rules) and [temperature guide](../temperature-map.md) supply the repository requirements.
The session's CI output supplies the reported symptom: two WebKit readiness checks remained in `loading` after five seconds.

## Standards

### P2: Production-only interception broke the development suite

The delayed cases intercepted only `/assets/maplibre-gl-worker-*.js`.
The standard browser command also runs this spec, but its server uses Vite development serving.
Vite serves the worker through its original `.mjs` path with a `worker_file` query parameter.
The production-only route missed that request.
Both browsers rendered the map, then failed because `workerDelayed` was false.

A focused development run reproduced both failures before the correction.
The route now matches both actual worker URL formats.
It excludes Vite's module that exports the worker URL, so the delay reaches the worker request itself.

No documented coding-standard breach or security defect was found in the original diff.
The interception regression is a correctness defect in the test code.

### P3: Startup errors lost their diagnostic text

The readiness helper waited only for `ready`.
A map that reported `error` consumed the remaining test timeout and produced a generic locator failure.
The helper now waits for either state.
It rejects `error` immediately and includes available alert text.
An error without alert text receives a defined fallback message.

Two new cases failed before this correction because the helper timed out instead of reporting the map error.
Three final cases cover an existing error, a transition from loading to error, and missing alert text.

## Spec

### P3: The delay description exceeded the actual guarantee

The original release timer started after DOM content loaded, independently of worker interception.
The worker could therefore remain blocked for less than six seconds.
The test still exceeded the old readiness budget, but its documentation overstated the worker delay.

The timer now starts at the first intercepted worker request.
Both viewport widths retain normal startup and delayed startup cases.
The startup wait uses the remaining 30-second test budget.
Marker counts and period changes retain five-second assertion budgets.

The guide now separates unit checks, browser checks, and test limits.
It describes marker counts instead of claiming that pixels establish each station's identity.

## Coverage

Both measurements use unchanged production source, the same compiler, and the Vitest 5.0.5 V8 provider.
The measured file is `src/features/temperatures/components/TemperatureMap.tsx`.
The baseline runs the existing 20 component cases. The expanded run adds four map error cases.

| Metric | Before | After |
| --- | --- | --- |
| Statements | 72.97% (486/666) | 73.42% (489/666) |
| Branches | 60.43% (388/642) | 61.68% (396/642) |
| Functions | 61.90% (78/126) | 62.69% (79/126) |
| Lines | 76.90% (433/563) | 77.26% (435/563) |

The new component cases check worker failure, WebGL failure, context loss, and nonfatal resource errors.
They verify that later source loading cannot clear a fatal error.
They also cover error events without an error object.
Each case restores console spies through the test cleanup hook.

Browser cases do not contribute to these V8 measurements.
The browser suite now has 22 cases across Chromium and WebKit, including three diagnostic cases per browser.

## Validation

| Check | Result |
| --- | --- |
| Development interception before correction | Both browsers failed because no worker was intercepted |
| Diagnostic tests before correction | Both cases failed with a locator timeout |
| Development temperature suite | 22 passed across Chromium and WebKit |
| Production temperature suite | 22 passed across Chromium and WebKit |
| Focused component suite with V8 coverage | 24 passed |
| Full Vitest suite | 2,441 passed across 164 files |
| Historical temperature pipeline | 17 passed |
| Temporary five-second readiness mutation | Both delayed WebKit cases failed with `loading` after five seconds |
| ESLint, TypeScript, and diff whitespace | Passed |

The mutation changed one readiness wait. A diff confirmed that change before execution.
Cleanup restored the fixed helper after both expected failures.

## Limits

The controlled delay proves that the old five-second startup assertion rejects valid, slower startup.
It does not establish why the original Linux CI run was slow.
Local browser checks ran on macOS. They do not replace a Linux CI run.
Fixed data, tiles, and font responses do not verify provider authorization or live data quality.
Static diagnostic cases test the wait helper, while the marker cases use the real map renderer.

Standards: two findings corrected; highest severity P2.
Spec: one precision finding corrected; highest severity P3.
