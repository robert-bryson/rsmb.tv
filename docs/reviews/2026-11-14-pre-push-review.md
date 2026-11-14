# Pre-push review — November 14, 2026

## Scope

This review follows commit `6660fee`.
It checks the committed changes and their startup integration before a push.
The [earlier review](2026-11-14-project-quality-review.md) retains its original results.

## Medium: Ink replaced event-log capture

The watcher installed console capture, then called Ink without render options.
Ink enables its own console patch by default.
That patch replaced the event log's console functions.

A real-Ink probe reproduced two failures:

- `console.log` wrote outside the dashboard instead of entering the event log.
- `console.error` entered the log as a stderr warning and lost its error level.

The existing event tests mocked Ink.
The lifecycle tests also replaced the renderer.
These tests covered the local functions but missed their startup interaction.
The earlier 100% event-log coverage did not establish correct integration.

The [watcher](../../scripts/aws-watch.tsx) now passes `{ patchConsole: false }` to Ink.
The event log retains ownership of console capture.
Its existing cleanup still restores the original console functions and stderr writer.

The [integration regression](../../scripts/__tests__/awsWatchIntegration.test.tsx) uses real Ink and synthetic terminal streams.
Only the dashboard body and provider configuration are replaced.
It checks four messages, their levels and sources, output isolation, and restoration after exit.
The test and startup-option assertion both fail before the correction.

## Push and release state

The remote `main` and `release-preview` branches both named `620c25c` during this check.
The local review commit descends from that revision.
No branch divergence was found.
The remote revision's [CI run](https://github.com/robert-bryson/rsmb.tv/actions/runs/43563971219) completed successfully.

A push to `main` starts the configured CI and release workflow.
The new revision must pass CI and hosted preview validation before production.
These checks cannot be completed for an unpushed revision.
No push or deployment ran during this review.

## Validation

Results are recorded in the [measurement record](../performance/2026-11-14-pre-push-review.json).

| Check | Result |
| --- | --- |
| Complete unit suite | 3,283 passed across 228 files |
| Dashboard and watcher checks | 143 passed across 14 files |
| Lint | Passed |
| Application and dashboard TypeScript checks | Passed |
| Local documentation targets | 149 Markdown files checked; no missing targets |
| Line and branch coverage | 88.68% and 83.08%, unchanged from the earlier review |

The correction changes terminal startup only.
The earlier review retains the website browser, Python, build, and dependency-audit results.
