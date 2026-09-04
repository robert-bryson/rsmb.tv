# Methodology 1.0.0

## Estimand

For year $y$, record kind $k$, and geography $g$, the estimated event rate is:

$$
R_{ykg}=\frac{E_{ykg}}{D_{ykg}}\times100{,}000
$$

$E$ is the number of station calendar-day record events. $D$ is the number of usable station-days for the same metric.

The pipeline counts maximum and minimum exposure separately. The result applies to the fixed observed station cohort.

The result is not area weighted. It does not estimate the fraction of United States land that experienced a record.

## Cohort

A candidate station must operate for the complete baseline and analysis window. Its maximum and minimum completeness must meet the configured threshold.

The pipeline calculates completeness against each expected calendar day. It uses only unflagged values with an accepted status.

Approve the station IDs after review. Then, freeze the IDs and supply them to subsequent runs.

Selection against the final analysis window causes survivorship bias. This bias is an explicit design choice.

Publish sensitivity runs for multiple completeness thresholds. Also publish an all-qualified-stations series. Keep the frozen cohort as the primary comparison.

## Record reconstruction

The baseline initializes one maximum and one minimum for each station and month-day pair. Baseline observations do not count as events.

The pipeline processes later observations in date order. A maximum event must be greater than the prior maximum. A minimum event must be less than the prior minimum.

After an event, the new value becomes the standing record. The pipeline keeps events that later values replace.

Ties do not count by default. The `--count-ties` option counts a tie but does not change the prior record date.

February 29 is a separate calendar day. If the baseline has no usable value, the first later value initializes the record. It does not create an event.

Measure the effect of delayed initialization for stations that have baseline gaps.

## Quality policy

The pipeline excludes missing values and values with a non-empty metric flag. It excludes preliminary observations by default.

The `--include-preliminary` option changes only the status rule. It does not change flag handling.

Input validation rejects these conditions:

- Duplicate station IDs.
- Duplicate station-date observations.
- Unknown station IDs.
- Observation dates outside the station operating period.
- Empty station names or geography values.
- Non-finite or out-of-range coordinates and temperatures.
- A minimum temperature that is greater than the maximum temperature.
- Invalid dates, statuses, or CSV schemas.
- Input paths that match generated output paths.

The extraction process must preserve ACIS values, flags, operating periods, and certification states. Methodology 1.0.0 does not define ACIS flag meanings.

## Confidence intervals

The 95 percent interval uses a nonparametric station-block bootstrap for each year and geography.

Each replicate samples contributing cohort stations with replacement. A contributing station has a usable observation for the applicable year and metric.

The replicate rate is the event total divided by valid station-days. The output gives the 2.5 and 97.5 percentiles.

Whole-station sampling keeps dependence between observations at one station. It does not model spatial correlation between nearby stations.

Intervals for a geography with few stations can be unstable.

## Validate before publication

- Check at least 20 events and their prior records against ACIS.
- Inspect completeness and operating-period distributions for each region.
- Compare cohort thresholds of 80, 90, and 95 percent.
- Compare strict events with tie-inclusive events.
- Compare certified-only results with preliminary-inclusive results.
- Confirm that no event date is in the baseline.
- Confirm that each denominator does not exceed expected cohort station-days.
- Compare broad high-to-low behavior with published NOAA analyses.

Do not expect identical counts from a study that uses a different cohort, baseline, or quality policy.
