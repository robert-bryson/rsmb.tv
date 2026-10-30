# Trip media and map recovery review

Review date: 2026-10-29.
Baseline: `bfb8fdf4ccac6aff63bf4509bbdab58dcea91e1b`.

This review covers the pending changes and their surrounding map, media, content, and browser-test code.
The comparison is `git diff bfb8fdf4ccac6aff63bf4509bbdab58dcea91e1b --`.
It also includes the new video, browser tests, fixtures, and PCH draft.

The main weakness was incomplete failure validation.
The existing unit suite passed while a map recovery path remained broken.
Mocked media playback did not establish that the application controls worked with a browser decoder and application styles.

## Standards

The independent Standards review found no actionable violation in the initial pending diff.
The implementation review and full browser run identified two additional maintenance issues.

### P2: WebKit ran Chromium-only performance tests

`tests/e2e/performance-measurement.spec.ts` supplied the selected browser to `measurePerformance`.
The measurement code requires Chromium's DevTools Protocol for network accounting, cache control, and CPU emulation.
Enabling the WebKit project therefore caused four measurement tests to fail before their intended checks.

The suite now explicitly skips these five performance cases outside Chromium.
All five cases still execute in Chromium. Application behavior checks still execute in both engines.

The first skip implementation exposed another fixture defect.
Playwright can run `afterAll` when a project skip bypasses `beforeAll`.
The cleanup hook assumed that the HTTP server existed and called `closeAllConnections` on `undefined`.
Cleanup now checks resource availability. A `finally` block removes the temporary directory even if server cleanup fails.
The focused run passes all five Chromium cases and cleanly skips all five WebKit cases.

### P3: The renamed video duplicated a bundled file

The pending MP4 had the same SHA-256 as the existing file:

```text
ab1ba266c9719256b36a2f4eea84237e3cd359a7387fb15a01a8552b7b83b599
```

Keeping both copies added 856,852 unused bytes to each copied public directory.
The old copy was removed after byte comparison and a manifest-reference check.
Git records a rename. The replacement keeps the correct 12-character fingerprint.

The filename change avoids an old cached response at the previous URL.
It does not apply Amplify rewrite rules or verify production delivery.

## Spec

The trip authoring and testing guides supply the behavior requirements.
The user confirmed that the new blog content references both new June 22 gallery IDs.

### P2: Replacing day definitions retained a stale renderer failure

`TripRouteMap` recreates its renderer when `manifest.days` changes.
Its renderer-error state tracked the route URL, route geometry, stops, track, and requested day.
It omitted the day definitions.

After a map error, replacing day definitions left the previous error active.
That error kept `enabled` false, so the replacement renderer could not start.
The updated day labels appeared in the preview, but the interactive map remained unavailable.

The testing guide requires: “Ignore callbacks from replaced maps. Retain usable previews and downloads.”
The authoring guide also defines configuration recovery and selection preservation.

The error state now includes the day definitions that created the renderer.
A replacement clears the stale failure without another route request.
The selected day remains active when its ID still exists.
A normal day selection still retains the error until Retry.

Two new regression cases failed before the fix and passed after it.
They cover both `error` and `webglcontextlost`, replacement day labels, selection retention, request reuse, and late callbacks.

### Accepted content changes

The June 22 gallery split is preserved.
The local generated MDX predates the new source content and cannot establish whether those gallery IDs are unused.
The authoring guide now requires a current import before that check.
Gallery splits and their source shortcodes must be published together.

The PCH draft remains a draft.
Its incomplete hero and photo entries do not make it a publication-ready manifest.
The review did not invent missing content or publish the trip.

### Browser coverage added

The retained WebGL change sends context loss through the existing preview and retry path.
Its browser test loses a real graphics context and checks painted route pixels after Retry.
It passes in desktop Chromium, phone Chromium, and iPhone WebKit.

The asset test checks MP4 response headers and file bytes, WebP delivery, and actual browser decoding.
It can run against local or deployed assets.

New player fixtures mount the real React component with the application stylesheet and bundled video.
They check deferred requests, pointer pause, keyboard playback, reduced motion, touch controls, and HTML-response fallback.
Desktop tests reveal controls through hover or focus. Phone tests use touch input.
The fixtures do not require Google access or public trip photographs.

Six additional unit cases check optional captions and attribution, source replacement, initial tab visibility, pause persistence, and unknown animation IDs.

## Validation

| Check | Result |
| --- | --- |
| Vitest with V8 coverage | 1,634 passed across 111 files; eight unit cases added |
| Python temperature pipeline | 17 passed |
| Chromium and WebKit fixture suite | 79 passed; five Chromium-only performance cases skipped in WebKit |
| Production trip browser suite | 118 passed; two desktop touch-only cases skipped |
| Production trip browsers | Desktop Chromium, phone Chromium, and iPhone WebKit |
| ESLint and TypeScript | Passed |
| Production `vite build` | Passed with the existing local content registry |
| Dependency audit | Zero vulnerabilities reported |
| Bundled media | Both referenced fingerprints validated |
| Whitespace checks | Passed |

One article-hover check failed during the first parallel WebKit run.
It passed three isolated repetitions and the next full run.
This review does not claim that the intermittent failure has a proven cause.

The host used Node.js 26.12.0 and npm 11.20.0.
Node.js meets the declared range. npm differs from the pinned npm 12.2.1.
No dependency installation or lockfile change was required.

The standard smoke wrapper attempted a flight-boundary download that the sandbox could not resolve.
Browser checks instead used a separately started Vite server and existing generated flight data.
The application-player fixtures used only local assets.

## Coverage comparison

Both measurements use the same final source, compiler, and V8 provider.
The baseline excludes the eight new unit cases whose names contain `review:`.
The baseline executes 1,626 cases. The final measurement executes 1,634.

| Metric | Baseline | Final |
| --- | --- | --- |
| Statements | 80.70% (6,772/8,391) | 80.71% (6,773/8,391) |
| Branches | 75.05% (4,764/6,347) | 75.07% (4,765/6,347) |
| Functions | 79.04% (1,584/2,004) | 79.04% (1,584/2,004) |
| Lines | 82.79% (5,897/7,122) | 82.79% (5,897/7,122) |

Animation statement coverage increased from 95.58% to 97.05%.
Animation branch coverage increased from 87.23% to 89.36%.
Map line coverage remains 100%. The new cases detect incorrect behavior on already executed lines.
These reports measure loaded source files, not every repository file.

Reproduce the comparison with:

```bash
npm run test:coverage -- --coverage.reportsDirectory=/tmp/rsmb-review-baseline \
  -t '^(?!.*review:)' --coverage.reporter=json-summary --coverage.reporter=text
npm run test:coverage -- --coverage.reporter=json-summary --coverage.reporter=text
```

## Limits and remaining work

`TripRouteMap` still combines renderer setup, camera state, controls, highlighting, and recovery in one 479-line component.
Its error scope repeats some lifecycle dependencies. Future changes must keep both lists aligned.
The existing [module extraction task](../../TODO.md#build-and-maintenance) remains appropriate.
Preserve the current selection, camera, and browser tests during that work.

The new clip name still requires correct deployed hosting rules.
The asset smoke test can verify delivery after deployment.
The current procedures distinguish local component checks from deployed file checks.

Google content imports, Terraform changes, uploads, and deployment were not performed.
The new source gallery references were confirmed by the user, not by an external content fetch.
Existing [publication tasks](../../TODO.md#publication-blockers) remain open.

Standards: two additional maintenance findings, both corrected; the browser matrix issue was the higher priority.
Spec: one confirmed recovery defect, corrected; the gallery split remains valid under the updated source context.
