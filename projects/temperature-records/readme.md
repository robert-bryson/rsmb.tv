# Historical temperature record signal

This package measures historical station record-event rates. It reconstructs calendar-day records, including records that later observations replaced.

The pipeline uses a fixed station cohort. It divides annual event counts by valid station-days. It uses station-block bootstrap samples for confidence intervals.

This package does not supply data to the operational temperature map. The map uses `scripts/sync-temperatures.js`.

## Requirements

Use Python 3.11 or a later compatible version. The pipeline uses only the Python standard library.

## Test the package

Run this command from the repository root:

```bash
npm run test:temperature-records
```

The root `npm test` command also runs these tests.

## Run the example

Run these commands from this directory:

```bash
python3 -m pipeline \
  --stations examples/stations.csv \
  --observations examples/observations.csv \
  --output /tmp/temperature-signal-example \
  --baseline-start 2000-07-01 \
  --baseline-end 2000-07-01 \
  --analysis-end 2001-07-01 \
  --minimum-completeness 0.005 \
  --bootstrap-iterations 100
```

The example has few rows. Therefore, it uses a low completeness threshold. Do not use this threshold for published results.

## Prepare production results

1. Export one station row for each ACIS station.
2. Export one observation row for each station and date.
3. Run the pipeline without `--cohort-file` for the complete analysis period.
4. Review station moves, completeness values, and exclusions in `cohort.json`.
5. Archive the approved `cohort.json` as a versioned input.
6. Run each published analysis with `--cohort-file` and the approved file.
7. Publish all five output files together.

The default baseline starts on 1950-01-01 and ends on 1959-12-31. Analysis starts on 1960-01-01.

The default minimum completeness is 90 percent for maximum and minimum observations. The pipeline excludes flagged and preliminary values by default.

The default bootstrap uses 1,000 replicates. The default random seed is `20260903`. The fixed seed makes the calculated intervals repeatable.

## Supply station data

The station file must contain this header:

```text
station_id,name,latitude,longitude,state,region,operating_start,operating_end
```

Supply one row for each station ID. Supply a finite latitude and longitude. Supply a non-empty name, state, and region.

Use ISO `YYYY-MM-DD` dates. Leave `operating_end` empty for an active station. The operating end cannot precede the operating start.

## Supply observation data

The observation file must contain this header:

```text
station_id,date,max_f,min_f,max_flag,min_flag,status
```

Supply no more than one row for each station and date. Each station ID must exist in the station file.

An observation date must be in the station operating period. A temperature must be finite and from -150 through 180 degrees Fahrenheit.

Use an empty field or `M` for a missing temperature. Use `certified` or `preliminary` for status.

Any non-empty quality flag excludes the applicable metric. The `--include-preliminary` option includes preliminary values but does not include flagged values.

## Reuse a cohort

A cohort file must contain a `stationIds` array. Each item must be a unique, non-empty station ID from the current station file.

The pipeline uses the supplied IDs without a new selection. It still reports current completeness values for review.

## Review the outputs

- `cohort.json` contains the cohort IDs, completeness values, and exclusion reasons.
- `events.csv` contains each post-baseline record event and its prior record.
- `annual-rates.json` contains national, regional, and state rates.
- `station-availability.json` contains annual station counts and metric exposure.
- `manifest.json` contains parameters, checksums, and the UTC generation time.

The pipeline rejects an input path that matches an output path. This check prevents the pipeline from overwriting an input file.

All calculated output is deterministic for the same inputs and parameters. The `generatedAt` value in `manifest.json` changes for each run.

See [methodology.md](methodology.md) for the estimand and limitations. See [annual-rates.schema.json](schemas/annual-rates.schema.json) for the rate output contract.

## Keep extraction separate

Do not add ACIS retrieval to this estimator. Build a resumable extraction command that writes the two normalized CSV files.

Keep raw responses and request manifests. Verify ACIS flags and certification fields against current RCC documentation. Check a sample of stations manually.
