# ski-status release identity and map recovery review

November 20, 2026

This review follows commit `d761b71`. It covers ski-status map recovery and the shared release validator.

## Findings

- A manual validation could start on Amplify job 42 and finish on job 43. The old code accepted both jobs when they used the same commit. The validator now pins the first job and records it in `previewJobId`. Proof creation requires the same job ID. [Validator](../../scripts/validate-release-preview.js), [Proof checks](../../scripts/release-proof.js)
- The preview validator followed redirects when it read the deployment record. A hosted route could return an identity from a different URL. The validator and production guard now request the records directly. The tests reject a redirected deployment record and a redirected proof. [Production guard](../../scripts/verify-preview-revision.js), [Release tests](../../tests/release/release-validation.spec.ts)
- A terrain relief warning stayed visible after the user turned the overlay off and on. The old handler waited for a source content event. A fresh raster source now clears the warning when it reports metadata. Later tile errors can display a new warning. [Map recovery](../../src/features/ski-status/SkiStatusMap.tsx)
- Keyboard activation of **Retry map** removed the focused button. Focus now moves to the map container during retry. The new canvas receives focus if the user remains on the container. [Map tests](../../tests/e2e/ski-status.spec.ts)

## Verification

The focused unit test run grew from 179 to 191 tests. It measures the ski-status feature, route, search hook, and release checks.
New archive tests cover range boundaries, invalid headers, and truncated bodies.

| Focused unit coverage | Before | After |
| --- | ---: | ---: |
| Lines | 50.36% | 51.64% |
| Branches | 55.83% | 57.38% |
| Functions | 56.61% | 57.02% |
| Terrain release check branches | 0% | 85.71% |

The browser regressions reproduced both identity errors, the stale terrain warning, and the lost keyboard focus.
The repository passed 3,755 Vitest tests and 28 Python tests. Chromium passed 31 ski-status tests and 20 release tests.
The hosted ski-status check still requires a preview build that contains the feature. Match the report's revision and job ID before closing the task. [Release tasks](../../TODO.md#ski-status)
