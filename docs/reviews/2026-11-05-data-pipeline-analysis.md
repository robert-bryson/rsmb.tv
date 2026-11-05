# Data pipeline analysis — November 5, 2026

Inspected checkout `b031e4b`. This is research, with no application or pipeline fixes.
The main recommendation is to correct the operational temperature map's monthly record calculation and regenerate affected derived data.

## Scope and prior work

Reviewed `scripts/sync-temperatures.js`, its archive/cache/publication tests, the historical Python estimator, the tornado generator, and the temperature frontend's use of generated scopes.
Read the November 3–4 temperature reviews, the October 29 tornado review, the current project guides, and `TODO.md` before selecting findings.
The recently fixed retry, response-validation, state-coverage, archive-merge, and tornado publication safeguards are present; they are not repeated as open findings here.
The historical estimator remains explicitly separate from the operational map and is not ready for publication according to `TODO.md`.

## 1. P2 — Monthly record thresholds include other calendar months

**Confirmed in source, a live first-party API comparison, and a deterministic call to the real generator.**

The request at [`scripts/sync-temperatures.js:723`](../../scripts/sync-temperatures.js#L723) starts at `1950-MM-01`, ends at the last day of that month in the prior year, and uses `interval: 'mly'` with `duration: 'mly'`.
That interval produces every intervening month. The final `smry: { reduce: 'max' }` or `min` summarizes that whole column.
Matching the start and end month does not filter out intervening months.
The [ACIS service reference](https://docs.rcc-acis.org/acisws/) defines the interval as the output time step and the summary as a column reduction; its GridData example 4.1 illustrates a summary over multiple monthly extremes.

The generator then calls these values `monthlyHigh` and `monthlyLow`, compares against them at [line 798](../../scripts/sync-temperatures.js#L798) and [line 821](../../scripts/sync-temperatures.js#L821), and archives them as `mh`/`ml` at [line 785](../../scripts/sync-temperatures.js#L785).
This usually tests a station's multi-season extreme instead of its extreme for the requested calendar month. Genuine monthly records can remain classified as daily records.

### Live ACIS evidence

Read-only requests to the official [MultiStnData](https://data.rcc-acis.org/MultiStnData) and [StnData](https://data.rcc-acis.org/StnData) endpoints were made on November 5, 2026. They were limited to Albany International Airport, `KALB`, ACIS UID `18747`.
No credentials were used.

The exact generator element definitions, restricted to this one station, were:

```json
{
  "sids": ["KALB"],
  "sdate": "1950-11-01",
  "edate": "2025-11-30",
  "meta": ["uid"],
  "elems": [
    {"name":"maxt","interval":"mly","duration":"mly","reduce":"max","smry":{"reduce":"max"},"smry_only":1},
    {"name":"mint","interval":"mly","duration":"mly","reduce":"min","smry":{"reduce":"min"},"smry_only":1}
  ]
}
```

The official API returned:

```json
{"data":[{"meta":{"uid":18747},"smry":["100","-28"]}]}
```

Removing `smry_only` and requesting dated summaries through StnData returned 901 monthly rows. Only 76 were November rows.
Filtering those rows to November produced the following comparison:

| Statistic, 1950–2025 | Existing query | November rows only |
| --- | ---: | ---: |
| Highest maximum | 100°F, September 3, 1953 | 82°F, November 2, 1950 |
| Lowest minimum | −28°F, January 19, 1971 | 4°F, November 23, 2018 |

A separate first-party query with annual sampling (`interval: [1,0,0]`), `duration: 'mtd'`, and both endpoints on November 30 returned the correct 82°F and 4°F values.
That validates a possible November query shape; February, leap years, and earlier observations in the current month still need explicit acceptance cases before choosing a production implementation.

### Deterministic generator reproduction

Called the real exported `fetchStateForDate('NY', '2026-11-05', '11-05', 2026)` with `globalThis.fetch` replaced by three fixed responses and `TEMP_DATA_DIR` pointing to a temporary directory.
The daily observation was a **hypothetical** 83°F maximum; its calendar-date prior record was 80°F.
The monthly response used the real upstream values above, 100°F and −28°F.
The hypothetical observation is not a claim that Albany actually observed 83°F that day.

The unchanged generator returned:

```json
{
  "tempF": 83,
  "prevRecordF": 80,
  "recordScope": "daily"
}
```

It archived `mh: 100`. Passing that observation and the returned station index to the real `buildBrokenRecordsFromDailyArchive` also returned `recordScope: 'daily'`.
An 83°F November observation exceeds the verified 82°F November record, so both generated and reconstructed classifications are wrong in this controlled case.

### User impact and persistence

The frontend trusts the backend scope. [`TemperatureMap.tsx:99`](../../src/features/temperatures/components/TemperatureMap.tsx#L99) chooses the daily/monthly popup title from it; [line 356](../../src/features/temperatures/components/TemperatureMap.tsx#L356) filters by it; [line 378](../../src/features/temperatures/components/TemperatureMap.tsx#L378) counts it.
Consequently, affected records disappear under the Monthly filter and lose their monthly label and count.
Daily record detection and the total number of daily record-breaking observations are not changed by this particular defect.

The wrong threshold persists in archived `mh`/`ml` fields.
[`archiveRecordScope` at line 865](../../scripts/sync-temperatures.js#L865) reuses those fields.
[`fetchRecentRecords` at line 1006](../../scripts/sync-temperatures.js#L1006) can reuse an existing summary or reconstruct from an archive without requesting fresh thresholds.
Changing the request alone therefore does not correct already archived/reused dates.

### Recommended work and acceptance conditions

1. Select only the requested calendar month and compare against observations preceding the observation date, including earlier days of the same month in the current year.
2. Version or explicitly invalidate the derived monthly thresholds and regenerate affected archive fields and recent summaries. A routine cached sync must not silently retain old classifications.
3. Add a semantic fixture containing a November maximum and a hotter summer maximum; require the November threshold. Include the corresponding low-temperature case.
4. Cover February in both leap and non-leap years, a later day below a new record set earlier that same month, fresh generation, archive reconstruction, and the frontend Monthly filter/count.
5. Review prior-record text when showing a monthly record: the current `prevRecordF`/`prevRecordDate` fields describe the calendar-date record, which can differ from the monthly predecessor.

Existing tests validate request end dates, response shapes, retries, and scalar scope comparisons. They stub the monthly summary rather than demonstrate which months the upstream request includes; see [`syncTemperatures.test.ts:128`](../../scripts/__tests__/syncTemperatures.test.ts#L128).
All focused tests can therefore pass while the production query has the wrong meaning.

## 2. P2 — The offline estimator writes events after `--analysis-end`

**Confirmed with an isolated CLI-library run. Lower priority because this pipeline is not the published map's data source.**

[`pipeline/cli.py:161`](../../projects/temperature-records/pipeline/cli.py#L161) restricts observations by station ID, then sends all their dates to record reconstruction.
[`events.py:43`](../../projects/temperature-records/pipeline/events.py#L43) skips dates before the baseline but has no analysis-end bound.
The CLI writes that complete event list to `events.csv` at [line 200](../../projects/temperature-records/pipeline/cli.py#L200).
Annual rates and station availability do receive the analysis bound, so the generated files disagree about the analysis window.

A temporary single-station input used maximum temperatures 80°F on July 1, 2000; 90°F on July 1, 2001; and 95°F on July 1, 2002.
The run used baseline start/end `2000-07-01`, `--analysis-end 2001-07-01`, completeness `0.005`, and 10 bootstrap iterations.
It succeeded with two events. `events.csv` contained **both July 1, 2001 and July 1, 2002**, while all annual-rate rows were for 2001 and the manifest declared the 2001 end date.

Recommended correction: bound the event input/output to the configured analysis window and add a CLI regression using an input CSV that extends beyond the requested end.
This is relevant to sensitivity runs and historical cutoffs, but it does not outrank the operational monthly classification defect.

## Tornado and other pipeline observations

The earlier tornado review identified the filtered-Trends data cost and missing source-coverage metadata.
The [responsiveness implementation](2026-11-05-responsiveness-improvements.md) addresses the data cost.
Source-coverage metadata remains open in `TODO.md`.
The generator currently checks missing/empty source years, stages directory replacement, restores the prior directory after promotion failures, and expires the IEM text caches.
Its WFO/time and watch-bounding-box report matching remains an approximation, as the app and generator metadata say.
The [IEM archive documentation](https://mesonet.agron.iastate.edu/request/gis/watchwarn.phtml) states that its default export contains issuance polygons; a suspected duplicate-update warning-count defect was therefore not substantiated.

Temperature archives also have no automatic correction policy for observations revised after the first successful fetch.
The source confirms immutable reuse, but this review did not compare successive production observations or quantify missed late reports. This is a follow-up data-quality risk, not a third confirmed high-priority finding.

## Validation and limits

| Check | Result |
| --- | --- |
| Temperature sync, archive, and publication suites | 65 tests passed in three files |
| Tornado generator suite | 49 tests passed |
| Historical estimator suite | 17 tests passed |
| Real generator with fixed responses and temporary cache | Reproduced wrong monthly scope and archive persistence |
| Real historical CLI library with temporary CSVs | Reproduced events outside the declared analysis window |
| Official ACIS API, single station | Confirmed all-month summary and November-only comparison |

The full live sync, S3 writes, CloudFront invalidations, and deployment were not run.
No application/source/test files were modified.
The live API comparison establishes the request's semantics, not the number of affected records currently published on the CDN.
The deterministic 83°F observation is intentionally synthetic. A production backfill must independently validate actual record dates and values.
