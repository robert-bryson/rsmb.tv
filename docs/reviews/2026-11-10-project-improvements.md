# Project audit implementation

This change implements the six priorities from the [November 10 audit](2026-11-10-project-audit.md).
The dated audit and its original measurements remain the baseline.
Use the [quality review](2026-11-10-project-quality-review.md) for later fixes and current test results.

## Changes

| Priority | Result |
| --- | --- |
| Article image delivery | Article HTML preloads the initial trip hero. The loading view reserves its space. |
| Navigation and orientation | Projects has a disclosure button and a separate overview link. New route visits announce the title and focus the main landmark. |
| Temperature recovery | Background startup has a 15-second deadline. Retry preserves camera, selection, filters, and loaded data. |
| Accessibility | Flights has a visible shortcut setting. Map landmarks, headings, skip links, gallery names, contrast, and control names were corrected. |
| Measurement | Umami collects Web Vitals. Custom events report map startup. The lab helper measures map readiness and compressed application-script bodies. |
| Regression prevention | Production browser CI scans reading pages and four maps with axe. It checks phone and desktop widths, including open controls. |

The background recovery helper is shared between Temperature Records and Tornado Tracks.
Provider failures do not invalidate successful application data.
Flights texture requests have a 30-second deadline.
The shortcut setting persists across visits. Escape remains available.
New navigation tests preserve history restoration and fragment links.

## Measurement definition

`scriptBytes` measures completed same-origin JavaScript encoded bodies before interaction.
It includes modulepreloads and repeated requests.
It excludes HTTP headers and keeps server compression.
`conditions.scriptByteScope` declares the scope.
`externalScriptRequests` counts completed third-party scripts.
The browser can hide third-party body sizes. These responses do not become zero-byte application scripts.
Unavailable application counters fail the sample.

The implementation uses Resource Timing.
It uses compressed Content-Length when timing is unavailable.
Incremental CDP events can report zero for buffered bodies.
The completed-request size API can include protocol overhead.
A read-only check against the existing production deployment measured 101,622 application bytes, matching Resource Timing.
This check validated accounting; it is not a before/after performance benchmark.

The public hosted tracker supports the `performance` setting.
No account settings were changed.
Verify the Umami Performance view after deployment. Use its [documentation](https://docs.umami.is/docs/performance).

## Initial validation

Validation results and accounting evidence are recorded in [the implementation evidence](../performance/2026-11-10-project-improvements.json).

- ESLint and TypeScript checks passed.
- The complete unit suite passed: 3,000 tests in 204 files. All 18 historical Python tests passed.
- Production accessibility, navigation, preload, prefetch, and page-recovery checks: 96 passed across Chromium and WebKit.
- Temperature map checks: 20 passed in Chromium and 20 in WebKit.
- Flight controls, flight startup, tornado recovery, and measurement checks: 29 passed in Chromium. The final measurement helper also passed its eight dedicated browser checks, including opaque external scripts.
- Reading-route JavaScript budgets, trip opening layout, gallery focus, and return navigation: 14 passed across desktop and mobile Chromium.

WebKit used the installed browser with a local library wrapper required by this workstation.
The test behavior and assertions match the repository's browser projects.
Automated scans do not establish complete accessibility conformance. A real-device screen-reader pass remains useful follow-up work.

Changes are local. Production field metrics will become available after deployment and subsequent visitor traffic.
