# Intent prefetch quality review: November 9, 2026

The review covers all pending application changes and the version increase to `0.3.0`.
The design uses shared loaders and bounded preparation. That design is appropriate for this declarative router.
The implementation still had defects in data priority, validation, retry ownership, and configuration handling.
The earlier checks did not cover these specific failure sequences.

## Findings and fixes

### P2: demanded map data used speculative priority

Flights and Tornado startup called the same low-priority warmers used by hover preparation.
Temperature navigation also started low-priority requests.
Required data could compete poorly with other downloads after the user selected a map.

Feature warmers now accept a request priority.
New navigation requests use `auto`. New speculative requests use `low`.
An existing shared request retains its original priority.
Startup tests verify priority and confirm that pending data does not block renderer loading.

See [Flights startup](../../src/features/flights/loadFlightsMap.ts),
[Tornado startup](../../src/features/tornadoes/loadTornadoMap.ts), and [Temperature startup](../../src/pages/TemperatureRecords.tsx).

### P2: malformed optional metadata could crash Tornado Tracks

The warmer accepted arbitrary notable-event JSON and retained it for 30 minutes.
The consumer treated that JSON as a typed event array without runtime validation.
An object instead of an array caused `notableEvents.slice()` to throw.
Invalid fields could also break number formatting or event selection.

The [event schema](../../src/features/tornadoes/schemas.ts) now validates fields, coordinates, and numeric values.
The TypeScript event and track-property types come from that schema.
Both speculative and demanded reads validate the response.
Malformed optional events produce an empty list while required map data remains available.
The shared tornado cache lifetime has one feature-owned constant.

[Validated JSON reads](../../src/data/validatedJson.ts) remove only the rejected cached value.
This protects a newer response object from an older validation failure.
The helper also handles asynchronous validators. Every production warmer now requires a validator.
Tests cover malformed arrays, invalid coordinates, negative counts, corrected responses, and the map retry action.
Production browser tests confirm that bad speculative metadata cannot take down the demanded map.

### P2: the embedded map could reuse a rejected lazy component

The trip block reset its error boundary after Retry.
It reused the same `React.lazy` type, which retained the rejected import.
Resetting the application's module promise did not reset React's separate lazy state.

Each embedded map and explicit retry now gets a fresh lazy type and thenable.
The module loader still shares its underlying request.
Healthy maps retain their component when only a requested stop changes.
An earlier failure cannot poison a later block after the module recovers.
Unit tests simulate an import failure. Production Chromium and WebKit tests recover from an actual failed CSS request without reloading the story.

See [trip blocks](../../src/blog/TripMdxBlocks.tsx) and the [import-recovery regression](../../src/test/tripMapImportRecovery.test.tsx).

### P2: repeated CSS recovery could lose security attributes

The first retry copied the failed link's attributes and then removed the original link.
If the replacement also failed, a later attempt no longer had its nonce or integrity value.
The success cache also identified URLs rather than the specific links that loaded.
A different failed link could therefore inherit an earlier success result.

The [stylesheet helper](../../src/navigation/retryStylesheet.ts) keeps the original link until replacement succeeds.
It preserves nonce, integrity, cross-origin mode, and referrer policy across repeated failures.
A weak set records successful link elements.
Invalid protocols, external origins, credentials, and non-CSS paths are rejected before insertion.
Error, timeout, and insertion-failure tests verify cleanup and subsequent recovery.

### P2: temperature camera updates repeated data preparation

The startup effect depended on the complete query string.
Camera moves and filters therefore repeated cached JSON validation even when the selected data view did not change.
Large Recent snapshots could add unnecessary parsing work after map interaction.

[View classification](../../src/features/temperatures/temperatureDataView.ts) now has one implementation.
The resolver, warmer, and page use it.
Startup preparation depends on the normalized data view.
Tests verify that camera and state-filter changes do not repeat preparation.
County, State, and Freshness preparation still excludes Recent records and large archives.

### P2: an invalid rollout value enabled all preparation

The original parser treated every unknown value as `all`.
A mistyped disable setting could therefore enable map downloads.
Unset and empty values still select the documented default.
Unknown nonempty values now select `off`.
Queued work also checks the current rollout before it starts.
Tests cover valid settings, invalid settings, and queued heavy-work reduction.

### P2: late map updates could cancel navigation

The mobile WebKit control test failed twice when returning to the project overview.
An old camera callback restored the map URL while the lazy overview was loading.
The map remained mounted during that transition, so disposal cleanup had not run.

[URL updates](../../src/features/tornadoes/hooks/useTornadoFilters.ts) now belong to the browser pathname captured when the map mounts.
Writers stop when history advances to another path.
Repeated camera values also avoid rewriting history after coordinate rounding.
A native-history unit regression failed before the fix and passed afterward.
The existing browser navigation assertion remains unchanged.

## Maintainability and test isolation

Imports and JSX now use `IntentLink` explicitly.
They no longer hide preparation behavior behind the ordinary `Link` name.
Feature modules keep ownership of data URLs, validation, and cache lifetimes.
The generic cache still stores one response per URL.

Production browser fixtures explicitly select the `all` policy.
Local rollout settings cannot silently disable their expected preparation behavior.
The tests count actual worker construction, including workers created from blob URLs.
Checking request filenames alone would miss that work.
Shared tornado fixtures replace repeated response objects.

## Validation

| Check | Result |
| --- | --- |
| Complete JavaScript suite | 2,860 tests passed across 191 files |
| Python suite | 17 tests passed |
| Focused coverage run | 126 tests passed across 16 files |
| Production preparation, failure recovery, and layout | 36 checks passed across Chromium and WebKit |
| Valid tornado events, controls, and CSP | Six checks passed in Chromium and WebKit |
| Final reading budgets and embedded map behavior | 18 checks passed across desktop Chromium, mobile Chromium, and WebKit |
| Lint and type checking | Passed |
| npm dependency audit | No reported vulnerabilities |

No timeout or assertion was weakened.
The native-history navigation regression failed before its fix. All 65 URL-state tests pass after it.
The Tornado control suite uses Vite's development server for source-level disposal checks.
The preparation and recovery suite uses production bundles.

Coverage compares the same 13 production file paths before and after the review.
It includes loader registries even when their callbacks are exercised only by browser tests.
It does not represent repository-wide coverage.

| Metric | Before | After |
| --- | ---: | ---: |
| Statements | 69.35% | 90.82% |
| Branches | 72.10% | 94.24% |
| Lines | 75.53% | 92.44% |
| Functions | 52.59% | 71.55% |

The expanded scope also includes the new validator, view selector, and event schema.
Its statement coverage is 91.02%. Branch coverage is 94.35%.
The [coverage evidence](../performance/2026-11-09-intent-prefetch-review-coverage.json) records file counts, commands, and scope.

The final `test` build uses the same local content as the initial bundle comparison.
Vite's manifest identifies its complete static JavaScript dependency graph.
The app before prefetching used 100,369 gzip bytes in that graph.

| Final bundle check | Result | Limit |
| --- | ---: | ---: |
| Initial JavaScript, sum of gzip bodies | 103,595 bytes | Existing reading budgets |
| Initial JavaScript added against that baseline | 3,226 gzip bytes | 5,000 bytes |
| Flights renderer | 1,387,675 raw bytes | 1,400,000 bytes |
| Flights renderer | 386,616 gzip bytes | 400,000 bytes |

The reading suite keeps its existing limits: 125,000 bytes for Home and Posts, 185,000 for an article, and 190,000 for a trip.
All 122 Markdown files passed the relative-file link check.

## Documentation and remaining work

The [current guide](../intent-prefetch.md) owns configuration, limits, resources, and recovery instructions.
The [initial implementation report](2026-11-09-intent-prefetch-implementation.md) retains its earlier measurements.
Those timings are not a new benchmark of the reviewed code.
The [live release check](2026-11-09-live-release-verification.md) records the reviewed build on production.
It also corrects selector-polling and synthetic-input limits in the earlier benchmark helper.

The TODO list now separates unpublished content, published-source checks, operations, browser work, and maintenance.
Completed publication and release-configuration entries were removed.
Recurring publication procedures link to the authoring guide.
Real-device performance work appears once, with the prefetch comparison requirements.
Two stale local story links were replaced by the existing source-document references.

Updated instructions use short sentences, active verbs, and consistent technical names.
These choices follow the [official ASD-STE100 guidance](https://www.asd-ste100.org/faq.html).
The writing targets the requested STE style. It does not claim a formal dictionary-compliance percentage.
Dated evidence and source facts remain intact.

Physical-phone measurements remain open in [TODO.md](../../TODO.md#browser-and-performance-checks).
Headless browser fixtures cannot establish field INP, memory use, or cellular transfer costs.
This review does not deploy the application or modify publication data.
