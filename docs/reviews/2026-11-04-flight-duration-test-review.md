# Flight duration test review

Review date: November 4, 2026.
Baseline: `b548d315ebab30e19a84704b3bd8bb4e06d8a118` and the pending duration test changes.

## Scope

The pending diff changed `tests/e2e/flight-duration.spec.ts`.
This review covers its fixtures, assertions, startup checks, and documentation.
The supplied CI log showed a missing `6h` value in the country summary after five seconds.
The previous investigation reproduced that failure with delayed visited-airport data.

Independent reviews checked repository standards and required behavior.
The [repository guide](../../README.md#testing-notes) supplies test conventions.
The [flight guide](../../projects/flights/readme.md#flight-duration) defines filtering and time presentation.
The [documentation index](../README.md#writing-rules) supplies writing rules.

## Standards

The independent review found no confirmed standard violation or security defect in the pending diff.
Fixed fixtures and an explicit startup condition were appropriate changes.
The duration assertions retained their five-second timeout.

The final fixture has one definition for each airport's geography and coordinates.
Flight legs and airport features use those definitions.
Shared assertions check time totals, averages, record labels, and the status bar.
Expected values remain explicit and independent of application calculations.

## Spec

### P2: Filter cases could pass with incorrect membership

The guide requires consistent filters across totals and selected details.
Every original 2024 fixture flight matched every tested selection and used airline `Test`.
A selected heading confirmed the view but did not establish which flights contributed to its totals.

The final fixture includes another year, another airline, a separate U.S. route, a Canadian domestic route, and an international route.
Each selection checks the exact flight count, airport count, total, decimal hours, and average.
Domestic flights within the selected country still contribute once per flight.

| Selection | Flights | Airports | Total minutes | Display | Hover hours | Average |
| --- | --- | --- | --- | --- | --- | --- |
| Route, LAX airport, or California | 2 | 2 | 345 | `6h` | `5.8 h` | `2h 53m` |
| United States | 3 | 3 | 513 | `9h` | `8.6 h` | `2h 51m` |
| Domestic | 4 | 5 | 687 | `11h` | `11.5 h` | `2h 52m` |
| Overall, with year and airline filters | 5 | 6 | 864 | `14h` | `14.4 h` | `2h 53m` |

A temporary test copy omitted only the airline query parameter.
The country case failed because it received four flights instead of three.
A diff confirmed the mutation before execution.
The temporary copy was removed.

### P3: The startup fix lacked a permanent regression

The pending fixture responses completed immediately.
Those cases did not preserve the slow-data condition that exposed the original failure.

Two permanent cases now delay either flights or visited airports for six seconds.
The shared startup check waits up to 15 seconds for the expected filtered counts.
Duration output retains its normal five-second assertion timeout.
Each delayed case verifies the completed country summary and confirms that its request was intercepted.
Cleanup clears the timer, releases blocked requests, and waits for route handlers after success or failure.

A temporary test copy removed only the startup assertion.
Both delayed cases then failed to find the expected `9h` value within five seconds.
A diff confirmed the mutation before execution.
The temporary copy was removed.

## Coverage

The browser suite grows from nine to eleven cases per engine.
The two new cases cover late flight data and late visited-airport data.
The six existing summary cases now require filter exclusions and different expected totals.
Estimated details, precise spoken time, keyboard controls, and phone layout checks remain covered.

Production code and Vitest test cases are unchanged.
The added browser cases do not contribute to V8 unit coverage percentages.
The coverage improvement is behavioral: incorrect membership and removal of the startup wait now cause failures.

## Documentation

The current guides describe fixture isolation, startup guarantees, timeout budgets, and failure cleanup.
The startup condition establishes summary data readiness.
Renderer readiness has separate checks in the [map guide](../../projects/flights/readme.md#map-code).

## Validation

| Check | Result |
| --- | --- |
| Full Vitest suite with V8 coverage | 166 files; 2,507 tests passed |
| Temperature pipeline | 17 tests passed |
| Duration suite in Chromium and WebKit | 22 tests passed |
| Complete Chromium suite, first run | 96 passed; two controls failures; one optional performance case skipped |
| Focused controls repetitions | Eight passed |
| Complete Chromium suite, final run | 98 passed; one optional performance case skipped |
| Mutation without startup readiness | Both delayed cases failed at the expected duration assertion |
| Mutation without the airline query | Country case failed with four flights instead of three |
| Full ESLint and TypeScript checks | Passed |
| Local documentation links | 145 checked; all targets exist |
| Review sentence lengths and diff whitespace | Passed |

The V8 report measures 84.56% statements, 79.7% branches, 82.35% functions, and 86.38% lines for the measured source files.
Browser regressions remain separate from these unit coverage measurements.

## Intermittent controls failures

The first complete Chromium run passed 96 cases, failed two cases, and skipped one optional performance case.
Both failures occurred in unchanged `flights-controls.spec.ts` cases.
The keyboard case expected no color parameter after key `1` but received `frequency`.
The texture-retry case expected wheel zoom to increase altitude above one, but altitude remained one.
Both assertions expired after five seconds.
Each case then passed four focused repetitions with two workers.
The second complete run passed 98 cases and skipped the optional performance case.

The duration patch uses routes scoped to each test page.
Its delayed cases clear timers and release blocked requests during cleanup.
Review found no shared mutation that connects these changes to the controls failures.
Their cause remains unconfirmed.
The [open-work list](../../TODO.md#browser-and-performance-checks) records the investigation.
Retain a failed run's trace before changing waits or application logic.
Closure requires a stable reproduction, a verified cause, and a regression that fails before the correction.

Standards: no confirmed violations.
Spec: two findings corrected; the highest severity is P2.
