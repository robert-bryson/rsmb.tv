# Project analysis: November 5, 2026

Reviewed checkout `b031e4b`. This report records analysis; it does not implement fixes.

The [responsiveness implementation](2026-11-05-responsiveness-improvements.md) addresses the tornado data cost, flight rendering, and homepage loading.
The [pending-change review](2026-11-05-pending-changes-quality-review.md) adds validation, recovery, publication checks, and stronger tests.
The monthly-temperature and page-download findings remain open in `TODO.md`.

The first priorities are monthly temperature classification, page-download recovery, and filtered tornado Trends loading.
The first two are newly confirmed defects. The third is existing debt with new browser and public-data measurements.

## Scope

| Area | Review |
| --- | --- |
| Site and reading routes | Routing, lazy imports, error boundaries, scroll restoration, content registries, and generated HTML |
| Flights | Data-loading hooks, filters, aggregation, optional geography, renderer boundaries, generators, and existing regression coverage |
| Operational temperatures | ACIS requests, response validation, caches, archives, scope classification, and frontend filters |
| Historical temperatures | Python reconstruction, cohort selection, analysis windows, and output contracts |
| Tornado Tracks | Ingestion, filtered history requests, aggregation, retained data, renderer behavior, and browser fixtures |
| Trips and ADV Atlas | Manifests, route cache, map activation, galleries, asset preparation, and publication checks |
| Build and operations | CI workflows, bundle checks, dashboard polling, dependencies, and mocked infrastructure checks |

Through Routes, Anki Artisan, Aborg, Parc, Bookend, and Route2Gpx have source repositories outside this checkout.
Their presentation pages are within scope. Their separate applications and dependency trees were not audited.
Ride Ledger is a design document here; there is no application implementation to inspect.

Earlier reports were checked against current source. Resolved findings are not counted as open issues.
Existing content, historical-data publication, and deployment work remains tracked in [TODO.md](../../TODO.md).

## Recommended order

| Order | Item | Impact | Initial scope |
| --- | --- | --- | --- |
| 1 | Correct monthly temperature thresholds | Genuine monthly records can receive daily labels and disappear from the Monthly filter | Fix query semantics, version derived values, regenerate affected data, and cover calendar edge cases |
| 2 | Recover from failed page downloads | A transient download failure can leave the whole site behind an ineffective retry button | Preserve navigation, provide real recovery, and test a failed production chunk |
| 3 | Separate tornado chart aggregates from geometry | A state-filtered chart requests every available year, even with one display year selected | Publish filterable aggregates and limit geometry to displayed map years |

All three warrant focused changes. A broad framework migration is not required to address them.

## 1. Monthly temperature records use thresholds from other seasons

**Priority: P2. Confirmed correctness defect in the operational application.**

[`fetchStateForDate`](../../scripts/sync-temperatures.js#L723) requests monthly values between matching months in 1950 and the prior year.
However, `interval: 'mly'` returns every intervening month. The summary then takes the maximum or minimum across that entire column.
Matching endpoint months does not select that calendar month in every year.
This follows the interval and summary definitions in the [official ACIS reference](https://docs.rcc-acis.org/acisws/).

A read-only ACIS comparison for Albany International Airport demonstrates the error:

| Threshold, 1950–2025 | Current November query | November values only |
| --- | ---: | ---: |
| Highest maximum | 100°F, September 1953 | 82°F, November 1950 |
| Lowest minimum | −28°F, January 1971 | 4°F, November 2018 |

The actual generator was also exercised with fixed responses and a hypothetical 83°F November observation.
Its calendar-date predecessor was 80°F. The generator classified it as `daily`, although it exceeded the verified 82°F November threshold.
This is a controlled example, not a claim about an actual November 2026 observation.

The frontend trusts this scope for labels, filtering, and counts in [`TemperatureMap`](../../src/features/temperatures/components/TemperatureMap.tsx#L356).
The wrong thresholds also persist as `mh` and `ml` in daily archives.
[`archiveRecordScope`](../../scripts/sync-temperatures.js#L865) reuses them, so correcting the request alone leaves affected archives and reused summaries unchanged.

Recommended implementation:

1. Define the comparison period explicitly and select only the intended calendar month.
2. Validate the policy for earlier observations in the current month and year.
3. Version or invalidate derived thresholds and regenerate affected archives and summaries.
4. Cover summer-versus-November extremes, low records, February, leap years, archive reconstruction, and frontend filter/count behavior.

The [pipeline report](2026-11-05-data-pipeline-analysis.md#1-p2--monthly-record-thresholds-include-other-calendar-months) contains exact API requests and reproduction details.
It also explains why existing scalar-response fixtures do not detect this semantic mistake.
The number of affected records currently published was not measured.

## 2. A failed lazy import cannot recover through “Try again”

**Priority: P2. Confirmed across the production routing mechanism.**

All route pages use module-level lazy components in [`App.tsx`](../../src/App.tsx#L9).
The root [`ErrorBoundary`](../../src/components/ErrorBoundary.tsx#L31) retries by clearing `hasError`.
React retains the rejected lazy promise, so rendering the same component throws the same error again.
The [React documentation](https://react.dev/reference/react/lazy#parameters) confirms that each lazy component caches its loader promise.

The boundary also wraps `Layout`, so the fallback removes the site navigation.
This turns a failed route download into a site-wide navigation failure for that document session.

A Chromium check used a production fixture build and blocked exactly the first `About` JavaScript request:

| Step | About chunk requests | Navigation elements | Result |
| --- | ---: | ---: | --- |
| Navigate from Home to About; abort the chunk | 1 | 0 | Error fallback |
| Allow subsequent downloads; click “Try again” | 1 | 0 | Same error fallback |
| Reload the document | 2 | 1 | About renders |

The failed request alone caused the issue. The network was available when the retry button was pressed.

Recommended implementation:

1. Keep the site shell outside route error boundaries where possible.
2. Make recovery start a fresh document or use a deliberately retryable loading strategy.
3. Handle stale deployment chunks with a bounded recovery policy that preserves the requested URL.
4. Prevent automatic reload loops during persistent outages.
5. Verify transient failures and missing old chunks in a production browser build.

Vite documents [`vite:preloadError`](https://vite.dev/guide/build.html#load-error-handling) for dynamic import failures and explains stale deployment chunks.
Do not suppress that event without providing a complete recovery path.
A new deployment was not required for this reproduction; deployment-related failures remain an additional plausible trigger.

The raw browser results are in [measurement evidence](../performance/2026-11-05-project-analysis-evidence.json).

## 3. Filtered tornado Trends downloads the full geometry archive

**Priority: P2 performance debt. Previously tracked; newly quantified.**

[`TornadoMap`](../../src/features/tornadoes/components/TornadoMap.tsx#L543) expands its data range to 1950 through the current year for filtered Trends.
Any selected state, region, or scale filter activates this path.
The chart rebuilds annual summaries from those track features, even when the displayed map range contains one year.

A production fixture browser check retained `start=2025&end=2025`:

| Selection | Yearly geometry requests |
| --- | ---: |
| National Trends | 1 |
| Missouri Trends | 77 |

Public CDN metadata currently lists 1950–2026 and 80,221 county-segment records.
Read-only `HEAD` requests measured **44,202,461 bytes** across those 77 geometry objects.
The 2025 object alone is **905,249 bytes**.
These are uncompressed object sizes, not measured compressed transfer sizes or JavaScript heap consumption.

The six-request concurrency limit in [`useTornadoData`](../../src/features/tornadoes/hooks/useTornadoData.ts#L87) prevents a request burst.
It does not reduce total downloads, JSON parsing, retained objects, or dependence on every historical year succeeding.

The shared [`fetchCache`](../../src/data/fetchCache.ts#L43) also has no size bound or automatic eviction.
Its TTL controls reuse; expired entries stay in memory until replaced or explicitly cleared.
Consequently, historical payloads can remain retained after leaving the tornado route.
That retention follows the source; actual browser heap size and real-phone responsiveness were not measured.

Recommended implementation:

1. Generate annual aggregates by state and scale in the existing tornado pipeline.
2. Derive region and national chart series from those aggregates without requesting historical geometry.
3. Keep map geometry requests tied to displayed years.
4. Preserve county-segment counting, unknown-scale handling, zero years, and exact width-median semantics.
5. Add a regression requiring filtered Trends to work while historical geometry requests fail.
6. Add a bounded cache policy after separating chart and geometry loading.

Avoid summing subgroup medians. Retain enough width-distribution information to reproduce the current combined median.
The [MapLibre large-data guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/) supports reducing unnecessary data and using appropriate delivery formats.
Aggregate chart data is the first step here; map tiling can remain a separate decision.

See the [existing tornado review](2026-10-29-tornado-tracks-quality-review.md) and [raw measurements](../performance/2026-11-05-project-analysis-evidence.json).

## Additional findings and maintenance opportunities

### Historical estimator output exceeds its declared end date

The Python CLI passes all cohort observations to reconstruction at [`cli.py:161`](../../projects/temperature-records/pipeline/cli.py#L161).
Its `events.csv` can therefore contain events after `--analysis-end`, while annual rates and the manifest use that end date.
A controlled 2000–2002 input with a 2001 analysis end reproduced the mismatch.
Bound the exported events and add a CLI contract test before publishing this pipeline.
See the [detailed reproduction](2026-11-05-data-pipeline-analysis.md#2-p2--the-offline-estimator-writes-events-after---analysis-end).
This has lower current impact because the estimator is separate from the operational map and remains unpublished.

### Extract boundaries that prevent repeated regressions

The temperature map contains 1,556 lines, the tornado map 1,115, and the blog importer 1,512.
Size alone is not a defect. Each currently combines several responsibilities that change for different reasons.

After the correctness changes, extract renderer startup/recovery, URL coordination, and pure chart/data operations in separate steps.
Keep each feature's camera, cancellation, and selection policies explicit.
The existing trip route cache already has bounded retention and reader cancellation; replacing it with the generic cache would lose those contracts.

For the blog importer, separate document normalization/conversion, shortcode expansion, asset validation, and import orchestration.
Retain the fixture compilation and publication checks around those interfaces.
Use the [shared-library analysis](2026-11-03-shared-library-analysis.md) for existing candidates rather than starting another utility catalog.

Dashboard polling and provider fetchers were inspected, but no new dashboard defect was independently reproduced in this pass.
Existing failure-path test work remains useful and is already tracked.
OIDC deployment and real-device performance measurements also remain open; repository preparation does not prove deployment state.

## Verification

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript project references | Passed |
| Full JavaScript/TypeScript suite | 2,507 tests passed in 166 files |
| Historical Python suite | 17 tests passed |
| Fixture production build | Passed |
| Installed dependency tree | No reported missing or invalid dependencies |
| npm advisory audit | Zero advisories |
| Terraform formatting and validation | Passed |
| Mocked Terraform tests | Four passed; no live AWS resources used |
| Production Chromium: failed route chunk | Reproduced ineffective retry and successful document reload |
| Production Chromium: tornado query changes | Reproduced 1 versus 77 geometry requests |
| Official ACIS requests | Confirmed the monthly query includes other months |
| Public tornado CDN headers | Measured 77 objects totaling 44,202,461 raw bytes |

Checks used the installed dependency tree with Node.js 26.12.0 and npm 11.20.0.
Node.js 26 is supported, but npm differs from the configured npm 12.2.1 toolchain.
A clean install with the pinned toolchain was not performed.

Browser reproductions used Chromium 156.0.8078.4, fixture content, and blocked external basemap services.
They establish failure recovery and request behavior, not real-world frame rates or Core Web Vitals.
The complete Playwright suites and WebKit were not rerun.
No live sync, content publication, deployment, or infrastructure change was performed.
Only review documents, measurement evidence, and backlog references were added or updated.
