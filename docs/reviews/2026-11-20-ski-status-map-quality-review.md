# ski-status map quality review

November 20, 2026

The review covers the ski-status redesign and its shared URL, conditions, and release code. The baseline is the working tree before this review.

## Findings and fixes

| Priority | Finding | Fix |
| --- | --- | --- |
| High | The map expired reports at local midnight. The conditions panel and publisher could still show the same data as current. | Use the resort's local ski day for filters, counts, hours, named terrain, and publication coverage. Reject reports collected in the future from current status. |
| High | A report could contain a date and timestamp for different ski days. The Open Data Hub adapter took the date from the timestamp text. | Check the date in the resort time zone. Convert offset timestamps to local dates before publication. |
| High | The SkiBig3 parser accepted the first value from duplicate fields. It also accepted ambiguous local times during an offset change. | Require one plain value for each required field. Require one valid timestamp. Cancel the response stream on an HTTP error. |
| Medium | Tapping an active marker could prevent a later result selection from centering the resort. A map retry could repeat a terrain shortcut. | Consume marker input when the selection changes. Apply each terrain request once. Restore the saved position after a renderer retry. |
| Medium | The share button changed its visible name after a copy. Each app also handled browser share errors on its own. | Keep the **Share** label. Announce copy success in a status message. Reuse the share helper in ski-status and ADV Atlas. |

The data tests cover the local midnight boundary, conflicting report dates, future retrievals, and ambiguous XML fields.
Browser tests reproduce the two camera failures before the fixes.
The share tests check native cancellation, clipboard access, and focus in the copy dialog.

## Verification

The focused Vitest run measures the feature, route, collector, and shared search code. The browser checks exercise the map renderer separately.

| Coverage | Before | After |
| --- | ---: | ---: |
| Lines | 68.17% | 70.48% |
| Branches | 64.85% | 68.41% |
| Functions | 70.21% | 73.39% |
| Statements | 67.15% | 69.39% |

The repository passed 3,848 Vitest tests and 32 Python tests. Chromium passed 45 ski-status tests and 20 release-validator tests on local fixtures.
TypeScript, ESLint, and the Vite production build passed. WebKit could not start because the test host lacks its system libraries.
The revised documentation uses the repository's ASD-STE100 writing rules. The sentence length check passed. [Writing rules](../README.md#writing-rules)

## Open work

Verify the archive ranges and Heavenly tooltips on the hosted preview for the candidate revision.
Confirm the reuse terms for the new Rockies feeds. Resolve the failed Norquay XML request. Complete the seven-day comparison with the operators. [Release tasks](../../TODO.md#ski-status)
