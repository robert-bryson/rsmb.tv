"""Fixed station-cohort selection and availability accounting."""

from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import date
from typing import Iterable

from .models import Observation, Station, index_stations
from .quality import usable_value


@dataclass(frozen=True, slots=True)
class CohortStation:
    station_id: str
    expected_days: int
    valid_high_days: int
    valid_low_days: int
    high_completeness: float
    low_completeness: float
    included: bool
    exclusion_reason: str | None

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def _inclusive_days(start: date, end: date) -> int:
    return (end - start).days + 1


def select_fixed_cohort(
    stations: Iterable[Station],
    observations: Iterable[Observation],
    window_start: date,
    window_end: date,
    *,
    minimum_completeness: float = 0.9,
    include_preliminary: bool = False,
) -> list[CohortStation]:
    if window_end < window_start:
        raise ValueError("window_end must not precede window_start")
    if not 0 <= minimum_completeness <= 1:
        raise ValueError("minimum_completeness must be between 0 and 1")

    station_list = list(stations)
    index_stations(station_list)
    rows_by_station: dict[str, list[Observation]] = defaultdict(list)
    for observation in observations:
        if window_start <= observation.observed_on <= window_end:
            rows_by_station[observation.station_id].append(observation)

    expected_days = _inclusive_days(window_start, window_end)
    results = []
    for station in sorted(station_list, key=lambda item: item.station_id):
        covers_window = station.operating_start <= window_start and (
            station.operating_end is None or station.operating_end >= window_end
        )
        rows = rows_by_station[station.station_id]
        valid_high_days = sum(usable_value(row, "high", include_preliminary=include_preliminary) is not None for row in rows)
        valid_low_days = sum(usable_value(row, "low", include_preliminary=include_preliminary) is not None for row in rows)
        high_completeness = valid_high_days / expected_days
        low_completeness = valid_low_days / expected_days
        if not covers_window:
            exclusion_reason = "operating period does not cover analysis window"
        elif min(high_completeness, low_completeness) < minimum_completeness:
            exclusion_reason = f"completeness below {minimum_completeness:.1%}"
        else:
            exclusion_reason = None
        results.append(CohortStation(
            station_id=station.station_id,
            expected_days=expected_days,
            valid_high_days=valid_high_days,
            valid_low_days=valid_low_days,
            high_completeness=round(high_completeness, 6),
            low_completeness=round(low_completeness, 6),
            included=exclusion_reason is None,
            exclusion_reason=exclusion_reason,
        ))
    return results


def station_availability_by_year(
    stations: Iterable[Station],
    observations: Iterable[Observation],
    cohort_ids: set[str],
    start: date,
    end: date,
    *,
    include_preliminary: bool = False,
) -> list[dict[str, int | float]]:
    station_list = list(stations)
    index_stations(station_list)
    observations_by_year: dict[int, list[Observation]] = defaultdict(list)
    for observation in observations:
        if start <= observation.observed_on <= end:
            observations_by_year[observation.observed_on.year].append(observation)

    output = []
    for year in range(start.year, end.year + 1):
        year_start = max(start, date(year, 1, 1))
        year_end = min(end, date(year, 12, 31))
        expected_per_station = _inclusive_days(year_start, year_end)
        reporting_ids = {row.station_id for row in observations_by_year[year]}
        fixed_ids = cohort_ids & reporting_ids
        valid_high_days = sum(
            usable_value(row, "high", include_preliminary=include_preliminary) is not None
            for row in observations_by_year[year] if row.station_id in cohort_ids
        )
        valid_low_days = sum(
            usable_value(row, "low", include_preliminary=include_preliminary) is not None
            for row in observations_by_year[year] if row.station_id in cohort_ids
        )
        expected_days = expected_per_station * len(cohort_ids)
        output.append({
            "year": year,
            "operatingStations": sum(
                station.operating_start <= year_end and (station.operating_end is None or station.operating_end >= year_start)
                for station in station_list
            ),
            "reportingStations": len(reporting_ids),
            "fixedCohortStations": len(fixed_ids),
            "expectedStationDays": expected_days,
            "validHighStationDays": valid_high_days,
            "validLowStationDays": valid_low_days,
            "highCompleteness": round(valid_high_days / expected_days, 6) if expected_days else 0,
            "lowCompleteness": round(valid_low_days / expected_days, 6) if expected_days else 0,
        })
    return output