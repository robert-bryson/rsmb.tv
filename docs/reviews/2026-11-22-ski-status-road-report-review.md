# Ski-status road report and catalog review

November 22, 2026

The review covered the ski-status changes on `feature/ski-status`. It checked agency input, publication, browser state, map selection, and the runtime asset build.

## Findings

| Impact | Defect | Change |
| --- | --- | --- |
| High | Reopening driving access could show the previous report as current while a new request was pending. | Reset the feed status to **Checking** when the feed opens or its provider scope changes. Keep the last verified snapshot. Drop results from an abandoned request. [Feed hook](../../src/features/ski-status/useSkiDriving.ts) |
| High | Caltrans work could lose its active status when the planned end passed. The agency can still report that the work is in progress. | Use the agency's start, end, and cancel flags. Show the planned time as **Planned end**. Apply the normal snapshot age limit. [Report parser](../../projects/ski-status/scripts/driving-parsers.ts), [Caltrans fields](https://cwwp2.dot.ca.gov/documentation/lcs/lcs-field-description.html) |
| High | A WSDOT report with a malformed placemark could appear as a successful check with missing reports. | Reject the report if a placemark has an invalid ID, name, or point. The publisher keeps the last verified file and reports the failure. [WSDOT feed documentation](https://wsdot.wa.gov/traffic/api/), [Publication code](../../projects/ski-status/scripts/driving-publication.ts) |
| Medium | A location filter could remove a resort from the URL and leave its selected approach. | Clear the resort, details, and approach together. [Page state](../../src/pages/SkiStatus.tsx) |
| Low | A test used Hunter Mountain as a resort without a verified entrance. The catalog now gives a verified point. | Use an explicit fallback fixture. Check that the catalog point produces a coordinate link. [Operator directions](https://www.huntermtn.com/explore-the-resort/about-the-resort/getting-here.aspx) |

The catalog includes batches 38 and 39. The road research has 459 approaches for 195 areas and 43 named passes. The runtime index includes 149 resort icons. [Data quality log](../../projects/ski-status/research/data-quality-log.md#batch-39--2026-11-22)

## Verification

| Check | Result |
| --- | --- |
| Repository tests | 4,060 Vitest cases and 37 Python cases passed. |
| Repository coverage | Line coverage rose from 88.82% to 88.90%. Branch coverage rose from 82.94% to 83.12%. |
| Driving feed hook | Line coverage rose from 75.00% to 97.77%. Branch coverage rose from 53.57% to 85.71%. |
| Browser checks | 86 Ski Status cases and 22 release-validation fixtures passed in Chromium. |
| Agency input | The parser accepted public samples from WSDOT, DriveBC, and Caltrans. |
| Runtime files | The production-mode build packaged 156 verified runtime files from the NAS. |
| Infrastructure | Four mocked Terraform tests passed. They cover role permissions, page rewrites, private origins, and retention. |
| Static and dependency checks | TypeScript and ESLint passed. npm reported zero known vulnerabilities. |
| Documentation | Local links in the edited files resolved. The sentence-length check found 99.6% within the ASD-STE100 limits. |

The catalog changed during the first Chromium run. Vite reloaded pages and four tests failed. The fixed checkout passed all browser checks.
The production-mode build used existing local posts and omitted the public directory copy. The hosted checks remain in the release list. [Release tasks](../../projects/ski-status/TODO.md#release-checks)

The documentation check measures sentence length. ASD-STE100 also specifies vocabulary and grammar rules. [ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf)
