# Flight duration and basemap quality review

Review date: November 2, 2026.
Baseline: `b2ae854` and its pending working-tree changes.

## Scope

The pending changes add flight durations, shared CARTO configuration, map controls, and data validation.
This review includes the new files and generated flight data.
It also checks the related build scripts, browser runners, and documentation.

Independent reviewers checked standards and documented behavior.
The behavior sources were the [duration proposal](2026-11-02-flight-duration-research.md), [flight guide](../../projects/flights/readme.md), and [basemap guide](../carto-basemaps.md).
No separate issue or acceptance document was available.

The initial suite passed 2,070 tests.
That result did not establish correct agreement between route counts, duration coverage, and open previews.
The main aggregation and selection hooks had no direct unit coverage.
The default coverage report omitted those unloaded files.

## Standards

### P2: The browser runner accepted another server as its own

The runner accepted any output that contained `ready in`.
The error `Port 4174 is already in use` contains that text inside `already in use`.
After its own server failed, the runner started tests against the existing server.
This occurred during the review. The resulting test run was invalid.

[The runner](../../scripts/run-playwright.js) now waits for Vite's listening URL on standard output.
It handles split output chunks and terminal color sequences.
Startup errors, early exit, and timeout reject startup and remove its listeners.
Regression tests cover each path.

### P2: Valid coordinates could corrupt every duration in a total

The Haversine calculation could exceed its mathematical range through floating-point rounding.
For opposite points at latitude `89.91999999999996`, its intermediate value becomes `1.0000000000000002`.
The square root then returns `NaN`.
The duration fallback accepted that result and added it to the total.

[The distance calculation](../../src/features/flights/utils/index.ts) now bounds the intermediate value between zero and one.
A regression checks the resulting estimated duration for those coordinates.
Ordinary routes and invalid-coordinate behavior retain their existing tests.

### P2: CSV serialization could split a quoted note into another record

The new parser accepts quoted multiline notes.
The writer quoted line feeds but omitted bare carriage returns.
A note containing `\r` could therefore leave synchronization as malformed CSV.

[The serializer](../../scripts/sync-flights.js) now quotes both line-break characters.
The regression checks carriage returns, line feeds, combined line breaks, commas, and embedded quotes.

### Maintainability findings

These findings are engineering judgments. They are not hard violations of a documented coding standard.

- Airport and state summaries scanned every matching leg for each geography. They now group matching legs before aggregation.
- The state hook duplicated its endpoint processing. One shared pass now retains both airports and counts each state leg once.
- The estimate source identifier appeared in several display components. The duration module now owns its identifier and display label.
- Hover rendering calculated the same duration summary twice. It now calculates one summary.
- Route list keys included the sorted position. Flight entries now use their existing record IDs.
- The basemap guide claimed missing-key verification without a direct configuration test. The new tests exercise the release guard and key selection.

The CARTO review found no confirmed injection defect or accidental exposure of a private environment value.
Provider requests use an encoded browser key.
Browser tests replace production configuration with a fixture key.

## Spec

### P2: Filtered durations disagreed with route counts

The proposal requires filtering to agree across surfaces.
Static routes retained an all-time count while their flight arrays used the selected year and airline.
For `year=2020&route=LAX-SEA`, details could show six flights beside coverage for two estimated flights.
The statistics panel showed two flights correctly.

[Static route aggregation](../../src/features/flights/hooks/useFlightData.ts) now counts the legs in each filtered route.
The same legs supply its tooltip, phone preview, and duration coverage.
The regression combines year, airline, and route filters.
Other cases check airport, country, region, domestic, international, intercontinental, and empty selections.
Same-date legs retain their separate direction, duration, and identity.

### P2: Open previews retained stale duration data

The proposal requires summaries to use the exact represented flights.
Phone and hover previews stored a route object from the original interaction.
Changing the year left that object and its new duration summary stale.

[FlightsMap](../../src/features/flights/components/FlightsMap.tsx) now stores each preview's route key.
It resolves that key against current route data.
A filter change updates its count and time immediately.
An excluded route has no preview.
Application tests use real filtering and navigation while replacing WebGL and asset loading.

### P3: Individual durations lacked readable spoken units

The proposal requires wording such as "2 hours 45 minutes."
Individual entries and averages supplied only abbreviated text.
Only the aggregate total had an expanded accessible label.

The [duration formatter](../../src/features/flights/utils/flightDuration.ts) now supplies full unit names.
Entries, averages, and selected-route tooltip details use that wording for screen readers.
Visible values retain their compact form.
Tests also verify source escaping and separate presentation of unclassified reported time.

### P3: Missing duration totals used the ordinary time label

The proposal distinguishes missing data from measured zero.
Empty and wholly unavailable summaries retained the ordinary **Flight time** label.
The label now reads **Flight time unavailable**.
The interface omits an average when no duration is usable.
Its average denominator excludes unavailable flights.

The reviewed first delivery otherwise follows the documented duration contract.
Deferred timestamp conversion, historical matching, and directional averages remain outside this delivery.

## Documentation

The flight guide now describes missing values, averaging, spoken units, filtered counts, and current previews.
It includes focused test commands and the state generator's network requirement.
The basemap guide separates configuration checks from live account verification.
It no longer records an unsupported claim about configured deployment credentials.
The trip testing guide uses the current **Light** basemap name.
The repository guide explains server ownership and the default statistics panel.
The documentation index links the flight guide and this review.

The edits use short sentences, active voice, and one term for each concept.
Commands, identifiers, and product names retain their exact spelling.
This is a practical application of the repository's ASD-STE100 writing rules, without a formal compliance claim.

## Validation

Results use the final local source unless identified as an initial result.

| Check | Result |
| --- | --- |
| Initial Vitest run | 142 files; 2,070 tests passed |
| Final Vitest run | 147 files; 2,106 tests passed |
| Temperature pipeline | 17 Python tests passed |
| Trip browsers | 538 passed; 17 intentional skips |
| General browsers | 109 passed; 5 intentional skips |
| TypeScript and ESLint | Passed |
| Production Vite bundle | Passed with a fixture browser key and the existing content registry |
| Dependency audit | Zero reported vulnerabilities |
| Diff whitespace | Passed |

Trip checks ran desktop Chromium, phone Chromium, and phone WebKit.
General checks ran desktop Chromium and WebKit.
The initial concurrent browser runs had rendering and timing failures.
The affected 40 cases passed with two workers and without concurrent trip rendering.
The complete general suite then passed with two workers.
No timeout or retry setting changed.

### Comparable coverage

Both measurements use the same final source, compiler, V8 provider, and explicit file set.
The file set includes the flight feature, shared maps, synchronization script, and browser runner.
Vite configuration tests also run; default coverage exclusions omit configuration files from the totals.
The first measurement excludes only the five test files added during this review.
The second includes those files.
Both runs include the assertions added to existing test files.

| Metric | Existing test files | With five added test files |
| --- | ---: | ---: |
| Statements | 40.32% | 66.28% |
| Branches | 38.89% | 60.27% |
| Functions | 34.92% | 57.53% |
| Lines | 41.19% | 67.58% |

The line denominator remains 2,311 in both runs.
The main aggregation hook reaches 92.54% line coverage.
The selection hook reaches 97.01% line coverage.
These are scoped measurements, not whole-repository coverage percentages.
The main map component still has 28.80% unit line coverage.
Browser checks exercise its renderer separately and do not contribute to V8 unit coverage.

## Limits

This review did not import Google documents, publish data, or deploy the site.
It did not verify a live CARTO key or change deployment secrets.
CARTO recommends its hosted style URL with a key in the [official basemap guide](https://docs.carto.com/faqs/carto-basemaps).
Fixed browser responses verify application requests and visible attribution; they do not verify provider authorization.

The duration estimates remain estimates.
The committed source has no recorded durations to validate against personal flight records.
The largest map component still combines many responsibilities.
A later structural change needs its own behavior-preserving scope and renderer tests.

Standards: three correctness findings and six maintainability findings, fixed. Server ownership was the most consequential test-runner defect.
Spec: four findings, fixed. Stale previews and inconsistent route counts affected filtered data presentation.
