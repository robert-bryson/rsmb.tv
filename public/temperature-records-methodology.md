# Temperature record methodology

## Scope

The recent-record views show reporting stations in the contiguous United States. The recent-event request does not include Alaska or Hawaii.

The county and state record data are separate products. The stations do not form a uniform observing network.

## Sources and definitions

The data come from NOAA Regional Climate Center ACIS services.

A recent high occurs when a reported daily maximum is more than the previous station value for the same calendar date. A recent low occurs when a reported daily minimum is less than the previous station value for the same calendar date. These comparisons use observations from 1950 or later.

A monthly record also exceeds the previous station extreme for that calendar month. County and state products show the current standing all-time extremes.

The client can classify a recent event as a county or state all-time record. It compares the event with the applicable standing record. This classification does not change the source observation.

The standing-record history charts group current county records by the year of the record. The product does not contain superseded records. Thus, the charts describe record age. They do not estimate historical record-breaking rates. They do not show a controlled climate signal.

## Data quality and limitations

The pipeline excludes missing ACIS values. The current data do not include these items:

- Station operating periods.
- Observation completeness.
- ACIS quality flags.
- Preliminary or certified status.

The recent-event counts do not use a fixed station group. The counts are not normalized by active station-days. The counts do not include confidence intervals. Do not use these counts to infer trends.

The web client validates each generated JSON file before it shows the data. Download the source files from `https://data.rsmb.tv/`:

- `recentRecords.json`.
- `countyRecords.json`.
- `stateRecords.json`.
- `climateTrends.json`.
- `summary.json`.

## Requirements for trend analysis

A trend analysis must meet these requirements:

- Select the station group before the analysis starts.
- Record the operating interval for each station.
- Record the missing-observation rate for each station.
- Count each applicable event from 1950 or later.
- Normalize the counts by active station-days.
- Keep the ACIS flags and certification status.
- Give uncertainty intervals for regional and national estimates.
