# Basemap startup review

Review date: November 4, 2026.
Baseline: `9d620e4ab5485593f7f7b6c32c9f395a7eddfa89` and the pending basemap startup changes.

## Scope

The original diff changed browser startup checks and the basemap guide.
This review covers those changes, their fixtures, shared basemap configuration, and related tests.
It does not establish the quality of unrelated project features.

Independent reviews checked repository standards and required behavior.
The [basemap guide](../carto-basemaps.md) supplies fixture and rendering requirements.
The [flight guide](../../projects/flights/readme.md#map-code) explains renderer readiness.
The [documentation index](../README.md#writing-rules) supplies writing rules.
The [failed CI run](https://github.com/robert-bryson/rsmb.tv/actions/runs/41858955508) establishes the original timeout failure.

## Standards

The review found no confirmed coding-standard breach or security defect in the original diff.
The waits retained the real renderer and existing output assertions.
No additional abstraction was needed for the small case matrix.

The readiness description needed greater precision.
This documentation finding also appears under Spec below. It is one finding, not two separate defects.
The final descriptions follow the repository's sentence limits and distinguish canvas discovery from tile rendering.

## Spec

### P2: The startup fix lacked a permanent regression

The original cases could pass locally after removal of the canvas wait.
Temporary CPU throttling reproduced the CI failure, but the committed suite did not preserve that condition.

Each transition now runs with normal startup and a delayed lazy module.
The delayed cases hold the actual `FlightsMap.tsx` response for six seconds after navigation.
This delay exceeds the unchanged color assertion timeout of five seconds.
Navigation waits for DOM content, so the blocked module cannot prevent the release timer from starting.
Each case verifies that the module request was intercepted.
Cleanup cancels the timer, releases blocked requests, and waits for route handlers, including after assertion failures.

Both delayed cases passed with the canvas wait.
A temporary copy removed only that wait. A diff confirmed the single-line mutation before execution.
Both cases then failed at the original pixel assertion with `Timeout 5000ms exceeded while waiting on the predicate`.
No mutation remains in the committed tests.

Initial color, selected color, old color removal, URL behavior, and both provider links remain checked.
The overall test timeout remains 30 seconds. Each color assertion retains its timeout of five seconds.

### P3: The guide overstated texture readiness

The initial guide claimed that the new waits established completed texture loading and excluded WebGL setup from the pixel budget.
Both starting CARTO styles have no image texture. Their texture hook immediately reports no loading.
The initial loading-message assertion therefore added no protection for those cases.
Canvas visibility also does not establish that CARTO tiles have rendered.

The redundant initial loading-message assertion is removed.
The guide now describes the actual guarantee: canvas discovery precedes color polling.
The color checks still establish rendered output.
The Night transition retains its loading-message check because it loads an image texture.

## Coverage

The comparison uses the same source, compiler, V8 provider, and explicit coverage file set.
That set contains `src/maps/cartoBasemaps.ts`, which has no production code changes.
The first run uses five existing unit cases. The second includes four configured-key cases.
The browser regressions do not contribute to these V8 percentages.

| Metric | Before | After |
| --- | --- | --- |
| Statements | 100% (10/10) | 100% (10/10) |
| Branches | 86.66% (13/15) | 100% (15/15) |
| Functions | 100% (3/3) | 100% (3/3) |
| Lines | 100% (9/9) | 100% (9/9) |

New cases import the module with missing, empty, whitespace-only, and valid configured keys.
They check default requests, trimming, encoded keys, neutral fallbacks, and unavailable attribution.
Each case restores environment values and resets the module cache.

## Validation

| Check | Result |
| --- | --- |
| Full Vitest suite with V8 coverage | 164 files; 2,437 tests passed |
| Temperature pipeline | 17 Python tests passed |
| Basemap cases in Chromium and WebKit | 14 passed |
| Complete Chromium suite with software WebGL | 86 passed; one optional performance check skipped |
| Mutation without the canvas wait | Both delayed cases failed at the expected pixel assertion |
| Full ESLint and TypeScript checks | Passed |
| Documentation links, sentence lengths, and diff whitespace | Passed |

Browser checks used a dedicated Vite server, existing generated geography, and the fixture browser key.
No production credentials were required.

## Limits

The delay intercepts Vite's development module URL. These regressions do not verify production chunk startup.
Fixed provider responses do not verify production CARTO authorization.
See the [basemap validation guide](../carto-basemaps.md#validation) for fixture limits and focused commands.

Standards: no hard violations; one precision finding corrected.
Spec: two findings corrected. The highest severity is P2.
