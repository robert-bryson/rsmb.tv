# Flight duration research

Date: 2026-11-02.
Reviewed baseline: `b2ae854`.
Scope: existing data, duration sources, data model, application coverage, and an incremental implementation proposal.
This report contains research only. It changes no application code, flight records, Google Sheet, or generated data.
External product details were checked on this date. No paid API requests were made.

Implementation followed this research on the same date.
See the [flight guide](../../projects/flights/readme.md#flight-duration) for the implemented input contract and display behavior.
The analysis below retains the original reviewed baseline.

## Recommendation

Add optional duration data to individual flight records. Store whole minutes and display hours where useful.
Use gate-to-gate elapsed time as the main passenger travel metric. Identify actual, scheduled, and estimated values separately.
Keep the existing distance estimate as a fallback. Clearly label every total that includes estimates or schedules.
Use the same duration resolver and summary function throughout the application.

The application already displays estimated hours. Its data does not contain recorded duration.
The main work is adding trustworthy input and propagating it consistently.
A new API subscription is unnecessary for the first implementation.

Start with optional Google Sheet columns and manually supplied values.
Investigate BTS matching for older U.S. domestic flights after the feature works.
Consider paid international enrichment only when its remaining coverage justifies the cost.

## Existing data and calculations

### Source audit

The audit parsed the committed CSV with `csv-parse/sync`.
It checked calendar dates, airport references, duplicate date/route keys, and generated feature counts.
It used 2026-11-02 as the current date.
See [flights.csv](../../projects/flights/data/flights.csv), [airports.csv](../../projects/flights/data/airports.csv), and [flights.geojson](../../public/data/flights/flights.geojson).

| Check | Result | Implication |
| --- | --- | --- |
| Flight records | 332 | Small enough for a reviewed backfill |
| Date range | June 1, 2006–October 13, 2026 | Many flights need historical sources |
| CSV columns | `date,airline,flightNumber,origin,destination,notes` | No duration or departure/arrival timestamps |
| Recorded duration coverage | 0/332 | Existing displayed hours are entirely estimated |
| Missing airline | 4 | Some historical matches need manual research |
| Missing flight number | 49 | Date and route alone can match several departures |
| Nonempty notes | 10 | Notes must not be mistaken for structured duration data |
| Explicit uncertainty notes | 3 | The 2006 Ireland records say details are uncertain |
| Invalid calendar dates | 0 | No malformed committed dates found |
| Exact date/origin/destination duplicates | 0 | This does not establish a permanent unique identity |
| Unknown airport references | 0 | Every committed endpoint resolves |
| Future dates | 0 | Current records describe past travel |
| Generated flight features | 332 | All committed flights survive conversion |
| Flights before 2011 | 31 | Outside FlightAware's advertised historical period |
| Both endpoints in the United States | 231, or 69.6% | Upper bound for the main BTS enrichment population |
| U.S. domestic flights with numbers | 198 | Stronger BTS matching candidates, subject to carrier coverage |

The three uncertain 2006 records need caution before exact historical matching.
Do not manufacture exact departure times from their calendar dates.
The audit found no measured duration outliers because no measured duration values exist.

The shortest geographic route is SEA–BLI, approximately 150 km.
The longest is TPE–YVR, approximately 9,592 km.
These figures use the application's great-circle calculation. They do not establish actual paths or flight durations.
See [distance utility](../../src/features/flights/utils/index.ts), `calculateDistance`.

### The estimate already in the interface

The current formula is:

```text
estimated hours = great-circle kilometers / 800 + 1
```

`AVERAGE_FLIGHT_SPEED_KMH` is `800`.
`FLIGHT_OVERHEAD_HOURS` is `1`, with a takeoff/landing comment.
See [constants.ts](../../src/features/flights/constants.ts), lines 125–126.
See [useFlightData.ts](../../src/features/flights/hooks/useFlightData.ts), `estimateFlightTime` and `flightStats`.

The hook sums fractional hours, then rounds the final sum to whole hours.
The [statistics panel](../../src/features/flights/components/StatsPanel.tsx) labels this result **Est. Flight Time**.
The [type definition](../../src/features/flights/types/index.ts) describes `totalFlightTime` as estimated hours.

Recomputing this formula for the committed data gives approximately **1,167.4 hours**, displayed as **1,167h**.
The calculation uses approximately 668,326 great-circle kilometers and adds 332 overhead hours.
The same formula assigns roughly 1h 11m to SEA–BLI and 12h 59m to TPE–YVR.
These are examples of model output, not recovered historical flight times.

No checked evidence establishes this formula's accuracy for this history.
It ignores aircraft, direction, winds, taxi conditions, delays, and route changes.
Its identical treatment of opposite directions is especially relevant for route averages.
Retaining it preserves a useful approximate total while recorded coverage improves.

## Define what flight time means

Three concepts need different labels:

| Concept | Meaning | Appropriate label |
| --- | --- | --- |
| Actual block duration | Actual gate departure to actual gate arrival | Actual flight time; explain gate-to-gate |
| Scheduled block duration | Scheduled departure to scheduled arrival | Scheduled flight time |
| Airborne duration | Wheels-off to wheels-on | Airborne time |

BTS defines arrival and departure times at the gate.
It defines air time from leaving the ground until touching down.
See the [BTS glossary](https://transtats.bts.gov/glossary.asp).
Its flight data separately supplies `ActualElapsedTime`, `CRSElapsedTime`, and `AirTime`, in minutes.
See the [BTS reporting-carrier fields](https://www.transtats.bts.gov/Fields.asp?gnoyr_VQ=FGJ).

**Recommendation:** Use block duration for the primary total.
It represents passenger flight elapsed time and matches normal itinerary durations.
Call a separate airborne metric **Airborne time** if that data is later collected.
Do not substitute airborne time for missing block time without changing the label and aggregate basis.

An itinerary establishes scheduled time. It does not prove actual elapsed time.
An elapsed interval also excludes time spent before gate departure and after gate arrival.
Layovers belong in a separate journey model.

## Where duration can come from

### Personal records and an existing OpenFlights export

**Recommendation:** Prefer trustworthy records already owned by the user.
Examples include itinerary exports, original flight logs, and actual gate-time records.
Record the basis of each source before assigning a duration kind.

An OpenFlights personal CSV has a `Duration` field in `HH:MM` format.
OpenFlights estimates duration automatically when it is missing.
Its export therefore cannot establish which values were originally measured.
See the [OpenFlights personal CSV specification](https://openflights.org/help/csv.php).

For an export containing `02:45`, parse 165 minutes.
Do not interpret it as 2.45 decimal hours.
Preserve its original source and classify unverifiable values as `unclassified`.
Promote a value to an actual or scheduled block duration only when supporting evidence establishes that basis.

OpenFlights can calculate duration from entered local times.
Its documentation also warns that its time-zone and daylight-saving rules can be incorrect.
See [OpenFlights time handling](https://openflights.org/help/time.php).
Validate historical timestamp-derived values instead of treating every exported result as measured truth.

The public OpenFlights route dataset is a different product.
Its documented route fields contain endpoints, carrier, equipment, and stops, but no duration.
Its route updates stopped in June 2014.
It cannot recover each personal flight's historical elapsed time.
See [OpenFlights route data](https://openflights.org/data.php#route).

No personal OpenFlights export was present in the inspected flight data directory.
An optional importer would require an actual export supplied later.

### BTS: strongest public historical option for U.S. domestic legs

BTS provides reporting-carrier data from 1987 onward.
It covers reported nonstop domestic operations, rather than every global flight.
Carrier reporting requirements and voluntary submissions affect coverage.
See the [BTS dataset profile](https://www.transtats.bts.gov/TableInfo.asp?QO_fu146_anzr=b0-gvzr&gnoyr_VQ=FGJ)
and [BTS reporting explanation](https://www.bts.gov/explore-topics-and-geography/topics/airline-time-performance-and-causes-flight-delays).

The primary download listing currently reaches August 2026.
See [BTS monthly on-time files](https://www.bts.gov/browse-statistical-products-and-data/bts-publications/airline-service-quality-performance-234-time).
Three committed U.S. domestic legs are newer: September 24 and two flights on October 13, 2026.
Therefore 228 records fit both the current date window and U.S. endpoint criterion.
This is an eligibility ceiling, not a confirmed match count.

**Recommendation:** Build a separate, reviewable backfill tool if actual historical enrichment is desired.
Download only the months needed by the eligible records.
Use BTS `ActualElapsedTime` directly instead of subtracting its local `hhmm` fields.
Retain `CRSElapsedTime` separately when actual duration is unavailable.
Treat cancellations and diversions as explicit review cases.
BTS documents null `ActualElapsedTime` for diverted flights and a separate `DivActualElapsedTime` field.
See the [BTS field definitions](https://www.transtats.bts.gov/Fields.asp?gnoyr_VQ=FGJ).

Match date, direction, origin, destination, carrier identity, and flight number.
Account for marketing carriers, operating carriers, and historical airline identities.
BTS documents separate identifiers and warns that airline codes can be reused.
See [marketing-carrier fields](https://www.transtats.bts.gov/Fields.asp?gnoyr_VQ=FGK).
For example, the CSV labels a 2014 BLI–SEA flight `Alaska` but numbers it `QX 2491`.
Resolve that identity before searching a carrier-specific historical dataset.

Return one of three outcomes: unique candidate, ambiguous candidates, or no candidate.
An empty flight number must not trigger automatic acceptance of the first matching route.
Record candidate count and mismatch reasons in a review report.
Do not overwrite a manually verified duration with a weaker match.

### FlightAware AeroAPI: broader paid historical option

FlightAware advertises historical data from January 1, 2011.
History requires its Standard tier, currently subject to a $100 monthly minimum.
Personal includes no historical flight data.
The historical-flight endpoint lists $0.020 per result set, with 15 records per set.
Historical airport-to-airport lookup lists $0.120 per set.
See [AeroAPI plans and query fees](https://www.flightaware.com/commercial/aeroapi/).

The 31 pre-2011 records fall outside that advertised archive.
Of the remaining 301 records, 262 have flight numbers and 39 do not.
These counts indicate research candidates, not guaranteed vendor coverage.
For illustration, 262 one-page identifier queries would list at $5.24 before other queries and the monthly minimum.
That arithmetic does not make this a $5.24 backfill.

FlightAware distinguishes gate `actual_out`/`actual_in` from runway `actual_off`/`actual_on` timestamps.
See its [first-party field descriptions](https://www.flightaware.com/commercial/firehose/documentation/messages).
Its own support explanation says actual gate timestamps can be unavailable because coverage and data partnerships vary.
See [FlightAware's gate-time explanation](https://discussions.flightaware.com/t/scheduled-estimated-actual-out-off-on-in-explanation/94112).
The specific AeroAPI response contract must be verified during implementation.

**Recommendation:** Reserve this option for unresolved flights after personal records and BTS matching.
First verify storage and publication rights for derived durations.
The provider explicitly distinguishes tier permissions and storage restrictions on its [product page](https://www.flightaware.com/commercial/aeroapi/).
Use bounded pages, a fixed query budget, and a reviewed candidate report.
Keep credentials and lookup activity in a separate local tool or controlled workflow.
Do not add paid requests to normal builds or browser page loads.

### Aviationstack: recent-history option with limited backfill value

Aviationstack advertises historical flight data for a sliding three-month window.
Its Basic plan currently lists $49.99 monthly and includes historical access.
The Free plan lists real-time flights, without historical access.
See [Aviationstack pricing and history coverage](https://aviationstack.com/pricing).

**Recommendation:** It is a poor primary source for this 2006–2026 history.
Its advertised window could help recent records, but it cannot establish a complete historical backfill.
No API response completeness was tested during this research.

### Estimates remain useful

Keep estimation explicit and deterministic.
Do not present a contemporary route schedule as the actual duration of a historical flight.
Do not infer missing times from a route's opposite direction.
Do not replace uncertainty with artificial minute-level confidence.

Future calibration could compare this model against uniquely matched actual block durations.
Evaluate short and long routes separately.
Change model coefficients only after reporting the sample size and measured error.
Store a model version when publishing derived estimates.

## Proposed data contract

### Canonical values

**Recommendation:** Add these optional source columns:

```csv
date,airline,flightNumber,origin,destination,notes,durationMinutes,durationKind,durationSource,durationNote
```

| Field | Meaning | Validation |
| --- | --- | --- |
| `durationMinutes` | Whole elapsed minutes from the stated source | Blank or positive safe integer |
| `durationKind` | Evidence and timing basis | Enum below; required when minutes exist |
| `durationSource` | Origin of the value | Required with minutes; examples: `manual`, `itinerary`, `bts`, `openflights`, `flightaware` |
| `durationNote` | Optional reference or uncertainty | Keep private booking details out of public outputs |

Use this enum for the first version:

```ts
type FlightDurationKind =
  | 'actual-block'
  | 'scheduled-block'
  | 'estimated-block'
  | 'unclassified';

interface FlightDurationInput {
  durationMinutes: number | null;
  durationKind: FlightDurationKind | null;
  durationSource: string | null;
}
```

The combined enum makes the main basis explicit without adding two loosely related fields.
Reserve `unclassified` for supplied values whose timing basis remains unknown.
Show those values as **Reported duration** in details.
Exclude them from confirmed block totals until reviewed.
If airborne time is later required, add a separately named field or a richer duration object.

Keep blanks distinct from zero. A missing duration is not a zero-minute flight.
Do not populate the source CSV with formula estimates merely to fill blanks.
Keep authored data and the fallback calculation distinguishable.

The public `FlightProperties` contract should add the normalized fields above and `flightNumber`.
Current conversion drops `flightNumber` and `notes` despite their presence in the CSV.
See [convertFlights.js](../../projects/flights/scripts/convertFlights.js), the returned feature properties.
Keep sensitive provenance references out of generated public files.

For the first version, keep provenance in the Sheet and emitted duration fields in GeoJSON.
Avoid a second editable duration file with conflicting ownership.
If a later enrichment cache is introduced, assign each flight a stable authored `flightId` first.
The current generated `id: index + 1` changes when historical rows are inserted or reordered.
See [convertFlights.js](../../projects/flights/scripts/convertFlights.js), `id` generation.

### Input format and units

The canonical column should contain numeric minutes, such as `165`.
This avoids ambiguity between 2.45 decimal hours and 2h 45m.
It also avoids spreadsheet time-of-day values entering the data pipeline unnoticed.

An optional import adapter can accept `HH:MM` from OpenFlights and convert it once.
Validate minutes from `00` through `59`. Allow hours above 23 because this is an elapsed duration.
Reject clock syntax, suffixes, negatives, fractions, infinity, and ambiguous decimal forms in the canonical column.
Do not parse values with `parseFloat`, which can accept numeric prefixes from malformed input.

If decimal-hour authoring is required later, use an explicitly named `durationHours` input.
Convert it to minutes once and document rounding.
Do not allow two authoritative duration columns without checking their agreement.

### One shared resolver

Add a pure duration module, for example `src/features/flights/utils/flightDuration.ts`.
Give it three responsibilities: resolve one flight, summarize flights, and format a duration.
Share input validation between synchronization and conversion through a small dependency-free module.

Use this fallback policy:

1. Use a valid recorded actual block duration when present.
2. Otherwise use a recorded scheduled block duration.
3. Otherwise use a recorded block estimate.
4. Otherwise calculate the existing geographic estimate when coordinates are valid.
5. Otherwise report unavailable duration.

The flat source schema stores one selected authored value.
If enrichment retains several candidates, apply this precedence before emitting the selected value.
Preserve losing candidates in the review evidence, rather than silently overwriting them.
An `unclassified` value remains visible as reported data but does not replace the block fallback.

The resolved value should contain minutes, kind, and source.
The formula fallback should identify its model version, such as `distance-800-plus-60-v1`.
Compute fallback minutes from the unrounded geographic distance.
Choose one documented rounding boundary and apply it everywhere.
For an integer-minute domain, round the resolved fallback once per leg before summing.
This can differ slightly from the current sum-then-round-hours result.

Return a summary containing at least:

```ts
interface FlightDurationSummary {
  totalMinutes: number;
  actualMinutes: number;
  scheduledMinutes: number;
  estimatedMinutes: number;
  actualCount: number;
  scheduledCount: number;
  estimatedCount: number;
  unavailableCount: number;
  unclassifiedCount: number;
}
```

`unclassifiedCount` describes supplied input and can overlap a fallback estimate.
The other counts describe the selected block value and must sum to the flight count.
Compute average duration from the number of resolved values, not all flights when some are unavailable.
Compute actual-only average from `actualCount`.

### Display rules

Use `2h 45m` for an individual flight and `1,167.4 h` for a large total.
Hours do not change when users toggle metric and imperial distances.
Provide a readable accessible label such as “2 hours 45 minutes.”

| Composition | Main label | Supporting information |
| --- | --- | --- |
| All values actual block | Flight time | Gate-to-gate; all flights recorded |
| Any scheduled or estimated values | Est. flight time | Actual, scheduled, estimated, and missing counts |
| Actual-only view requested | Actual flight time | Coverage, such as 210 of 332 flights |
| No usable values | Flight time unavailable | No numeric zero standing in for missing data |

Keep coverage available in ordinary details on touch devices.
Do not rely on a hover-only explanation for whether a total is estimated.
Round only for presentation after aggregation of canonical minutes.
Avoid summing displayed decimal hours.

## Application coverage

Duration is a property of each flight leg.
Aggregate each leg once in an active result set.
The same leg can legitimately appear in two geography summaries, but those summaries are not additive partitions.

| Surface | Current owner | Proposed behavior |
| --- | --- | --- |
| Overall and year statistics | [useFlightData.ts](../../src/features/flights/hooks/useFlightData.ts), [StatsPanel.tsx](../../src/features/flights/components/StatsPanel.tsx) | Replace estimate-only total; add average and coverage |
| Bottom summary | [BottomStatsBar.tsx](../../src/features/flights/components/BottomStatsBar.tsx) | Add a compact hour total when space permits |
| Airport detail | `selectedAirportInfo` and `AirportStats` | Total and average duration for matching legs |
| Route detail | [useSelectionInfo.ts](../../src/features/flights/hooks/useSelectionInfo.ts), `RouteStatsView` | Total, average, coverage, and per-flight durations |
| Route flight list | `SelectedRouteInfo.dates` and `All Flights` list | Replace date-only entries with complete flight entries |
| Desktop route tooltip | [tooltipHtml.ts](../../src/features/flights/utils/tooltipHtml.ts) | Reuse summary and formatter; retain escaping |
| Secondary hover display | [HoverInfo.tsx](../../src/features/flights/components/HoverInfo.tsx) | Optional compact route time summary |
| Touch route details | [MobileInfoOverlay.tsx](../../src/features/flights/components/MobileInfoOverlay.tsx) | Show the same route summary and provenance meaning |
| Airline detail | Airline filtering and [AirlinesSection.tsx](../../src/features/flights/components/AirlinesSection.tsx) | Add time to the selected airline summary |
| Country and region details | `useSelectionInfo` and `StatsPanel` | Add time for distinct matching flight legs |
| Top routes | [RoutesSection.tsx](../../src/features/flights/components/RoutesSection.tsx) | Optional secondary total; retain count ranking initially |
| U.S. state detail | [useUSStates.ts](../../src/features/flights/hooks/useUSStates.ts), state tooltip | Optional incident-flight duration with explicit meaning |
| About page and project guide | [FlightsAbout.tsx](../../src/pages/FlightsAbout.tsx), [flight guide](../../projects/flights/readme.md) | Explain gate-to-gate basis, input units, and fallback |
| Loading and empty states | Loading placeholders and summary defaults | Preserve missing/empty distinctions |

The existing selected-route model retains dates rather than complete flight entries.
A date alone cannot reliably associate a duration, airline, number, and direction.
Add a sorted `flights` array containing those fields.
Use a stable identifier for rendering and later enrichment matching.
See [selection types](../../src/features/flights/types/index.ts) and the route list in [StatsPanel.tsx](../../src/features/flights/components/StatsPanel.tsx).

Route keys currently merge both directions through alphabetical sorting.
Keep that useful grouping, but retain original direction in each flight entry.
For route comparisons, offer directional averages when enough recorded data exists.
Do not multiply one representative duration by route frequency.

Current statistics and selection summaries use different filtered collections.
`useGlobeData` directly filters year, airport, and airline.
`useSelectionInfo` derives route, country, and region data from arc collections.
Any duration rollout must respect the final visible-flight filtering contract.
Compute summaries from the exact flights represented by each surface.
Avoid adding a parallel filtering implementation inside the duration module.

Airport, country, region, and state totals need explicit endpoint semantics.
For example, a same-state flight contributes its duration once to that state's matching-leg total.
The inspected state hook increments endpoint counts separately.
Do not copy that loop for duration and accidentally double the same leg's time.

Keep existing longest and shortest distance records labeled as distance records.
Add **Longest flight by time** only when the value and coverage have an explicit basis.
For actual records, rank actual block durations and exclude estimates from that ranking.
Do not silently change existing distance records into time records.

Duration color modes, duration filters, and proportional animation timing can wait.
They require extra URL state, legends, and comparison semantics.
Real flight hours must never become direct millisecond animation durations.

## Synchronization and build considerations

The actual pipeline is:

```text
Google Sheet
  -> scripts/sync-flights.js
  -> projects/flights/data/flights.csv
  -> projects/flights/scripts/convertFlights.js
  -> public/data/flights/flights.geojson
  -> useFlights / useGlobeData / selection summaries
  -> statistics, route details, and tooltips
```

`npm run sync-flights` updates the CSV only.
`npm run build-flights` performs conversion and builds the supporting geographic files.
The scheduled workflow runs both when synchronization changes the CSV.
See [package.json](../../package.json), [sync-flights.js](../../scripts/sync-flights.js), and [sync-flights.yml](../../.github/workflows/sync-flights.yml).
The project guide currently says the sync command regenerates GeoJSON, which overstates that command's behavior.
Correct this description when documenting the duration feature.

The sync script preserves additional named columns, including empty optional columns with headers.
However, it currently validates no duration fields.
The converter explicitly selects emitted properties, so adding a Sheet column alone changes no interface behavior.

**Recommendation:** Validate the same duration contract at both ingestion points.
The converter can run directly against committed CSV without the sync script.
Reject malformed supplied durations before either writer updates output.
Accept older CSV files that omit optional duration columns entirely.
Emit `null` consistently for absent values in the normalized contract.

The sync script has a custom line-based CSV parser.
It splits on newline before parsing quoted fields.
Use the installed `csv-parse` implementation when adding provenance notes that might contain embedded newlines.
Add explicit required-header and row-width checks alongside duration validation.
See [sync-flights.js](../../scripts/sync-flights.js), `parseCSV` and `runQAQC`.

Use structural validation errors for malformed values.
Use review warnings for plausible but unusual durations.
For example, warn about more than 24 hours or a large deviation from a rough route estimate.
These thresholds are proposed review policy, not aviation limits.
Never replace an unusual verified duration with a formula simply because it looks different.

## Dates, overnight flights, and time zones

Adding explicit elapsed minutes requires no departure/arrival clock calculation.
This is a useful first step because the current airport file has no time-zone identifier.
Its coordinates alone are insufficient to perform a correct historical clock conversion.

If timestamp ingestion is added later, use complete instants with UTC offsets or UTC values.
Compute block minutes as `(arrivalInstant - departureInstant) / 60000`.
Use actual gate timestamps together, or scheduled gate timestamps together.
Do not combine an actual departure with a scheduled arrival and call the result actual duration.

When only local clocks are available, require both calendar dates and IANA time-zone identifiers.
Use the historical rules for those dates.
IANA's database represents historical local times and changes to offsets and daylight-saving rules.
See [IANA time-zone database](https://www.iana.org/time-zones).

Handle these cases explicitly:

- An overnight flight can arrive on a later calendar date.
- A date-line crossing can arrive on an earlier local calendar date.
- Daylight-saving transitions can repeat or skip local clock times.
- Some locations use half-hour or quarter-hour offsets.
- A delayed departure can move to the next date without changing the source itinerary's scheduled departure date.

Adding 24 hours whenever arrival looks earlier cannot solve these cases reliably.
Prefer provider elapsed minutes when its documented basis matches the desired metric.
Preserve the meaning of the existing `date` as a departure calendar date.
Do not change yearly attribution to arrival year during duration work.

The committed dates are valid, but conversion is less strict than synchronization.
The converter currently extracts a year by splitting the date on `/`.
The browser utility also accepts ISO calendar dates.
An OpenFlights adapter must normalize date formats before conversion.
Do not pass through optional times or year-only dates without a deliberate date-precision policy.
See [conversion](../../projects/flights/scripts/convertFlights.js), [date utilities](../../src/features/flights/utils/index.ts), and [OpenFlights date formats](https://openflights.org/help/csv.php).

## Incremental implementation

### First delivery: optional duration support throughout existing details

1. Define and document block duration, minutes, provenance, and missing-value behavior.
2. Add shared parsing, resolution, summary, and formatting functions.
3. Extend sync validation, conversion, GeoJSON types, and fixtures.
4. Preserve `flightNumber` and complete per-flight entries in route selection data.
5. Apply summaries to overall, year, airline, airport, route, country, and region details.
6. Add matching duration information to desktop and touch route details.
7. Add the bottom total only after checking narrow layouts.
8. Document Sheet columns and correct the sync/build instructions.

Old data should continue to produce a clearly estimated total.
Entering one actual duration should replace only that flight's fallback.
It should immediately affect every summary containing that flight.
This delivery needs no paid service or historical backfill.

### Second delivery: improve recorded coverage

Review any available personal export or itinerary source.
Classify each value before import.
Then run a bounded BTS matching experiment against a representative sample.
Include a regional codeshare, an older major-carrier flight, a missing-number record, and a recent unavailable month.
Report match rate, ambiguity, missing elapsed time, and manual corrections.

Expand the BTS backfill only after that sample validates the matching rules.
Keep candidates and proposed updates reviewable.
Use FlightAware only for a deliberately selected unresolved subset.
Any later subscription or bulk lookup should have a concrete budget and publication terms checked first.

### Later enhancements

Consider directional route averages, actual-only records, and duration sorting after coverage improves.
Keep an optional actual-only view distinct from the default best-available estimate.
Add state duration details only with a documented unique-leg aggregation rule.
Calibration and richer timestamp capture can follow measured need.

## Validation and acceptance

The duration research used read-only audits. It did not introduce a duration implementation.
Implementation tests should verify behavior, data flow, and coverage labels.

| Area | Required examples |
| --- | --- |
| Parsing | Blank, `165`, whitespace, zero, negative, decimal, `Infinity`, suffix, invalid kind, missing source |
| Export adapter | `02:45` becomes 165; `02:60` fails; elapsed hours above 23 remain parseable |
| Resolution | Actual replaces fallback; scheduled stays labeled; unclassified stays separate; invalid coordinates yield unavailable |
| Aggregation | One leg once; mixed provenance counts; missing denominator; sum minutes before display rounding |
| Formatting | 45m, 1h, 1h 05m, large hour totals, accessible wording, unchanged metric/imperial behavior |
| Build pipeline | Optional columns survive sync; normalized fields reach GeoJSON; malformed input preserves prior output |
| Filtering | Year, airline, airport, route, country, region, and flight-type combinations agree across surfaces |
| Route details | Same-date legs retain their own direction, duration, number, and identity |
| Geography | Same-region legs count once; international legs appear once within each relevant selected geography |
| Evidence | Uncertain records are not auto-matched; ambiguous matches never silently win |
| Timestamp adapter | Overnight, date line, DST change, explicit offsets, and year-boundary cases |
| Browser | Desktop tooltip, touch detail, narrow summary, empty result, and reopened panel retain readable labels |

Extend existing [flight utility tests](../../src/test/flightUtils.test.ts), [build-script tests](../../scripts/__tests__/flightBuildScripts.test.ts),
[statistics tests](../../src/test/StatsPanel.test.tsx), [bottom summary tests](../../src/test/BottomStatsBar.test.tsx),
[tooltip tests](../../src/test/tooltipHtml.test.ts), and [flight browser tests](../../tests/e2e/flights-controls.spec.ts).
Add focused pure summary tests because aggregation carries the main correctness risk.
Run the relevant Vitest suites, `npm run typecheck`, and `npm run lint`.
Build flight artifacts in fixture directories or inspect expected generated changes carefully.

Acceptance requires a manually entered duration to survive Sheet synchronization, CSV conversion, loading, filtering, and every relevant detail surface.
All-estimated data must remain honest. Mixed data must expose coverage. Missing values must remain distinguishable from zero.

## Decisions before implementation

The recommended default is gate-to-gate time with estimated fallback and explicit provenance.
The remaining product choices are small:

- Whether source entry uses minutes alone or an additional `HH:MM` import helper.
- Whether the bottom summary has room for hours on phones.
- Whether actual-only totals deserve an optional view after coverage improves.
- Whether available personal records contain actual times, schedules, or undocumented estimates.

These choices do not prevent building optional duration support.
The repository already has the calculation and display foundation.
Trustworthy data semantics and one shared aggregation path are the substantial improvements.
