"""Exposure-normalized climate estimates with station-block uncertainty."""

from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import date
from random import Random
from typing import Iterable

from .models import Observation, RecordEvent, RecordKind, Station, index_stations
from .quality import usable_value

RATE_SCALE = 100_000


@dataclass(frozen=True, slots=True)
class AnnualRate:
    year: int
    geography_type: str
    geography: str
    kind: RecordKind
    events: int
    station_days: int
    station_count: int
    rate_per_100k_station_days: float | None
    ci95_low: float | None
    ci95_high: float | None

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def _percentile(values: list[float], probability: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * probability
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return ordered[lower] * (1 - fraction) + ordered[upper] * fraction


def _bootstrap_interval(
    contributions: list[tuple[int, int]],
    iterations: int,
    random: Random,
) -> tuple[float | None, float | None]:
    if not contributions or iterations <= 0:
        return None, None
    rates = []
    for _ in range(iterations):
        sampled = [random.choice(contributions) for _ in contributions]
        events = sum(item[0] for item in sampled)
        station_days = sum(item[1] for item in sampled)
        if station_days:
            rates.append(events / station_days * RATE_SCALE)
    if not rates:
        return None, None
    return _percentile(rates, 0.025), _percentile(rates, 0.975)


def aggregate_annual_rates(
    stations: Iterable[Station],
    observations: Iterable[Observation],
    events: Iterable[RecordEvent],
    cohort_ids: set[str],
    analysis_start: date,
    analysis_end: date,
    *,
    include_preliminary: bool = False,
    bootstrap_iterations: int = 1_000,
    random_seed: int = 20260903,
) -> list[AnnualRate]:
    all_stations = index_stations(stations)
    station_index = {
        station_id: station for station_id, station in all_stations.items()
        if station_id in cohort_ids
    }
    contributions: dict[tuple[int, str, str, RecordKind, str], list[int]] = defaultdict(lambda: [0, 0])

    for observation in observations:
        station = station_index.get(observation.station_id)
        if station is None or not analysis_start <= observation.observed_on <= analysis_end:
            continue
        for geography_type, geography in (("national", "CONUS"), ("region", station.region), ("state", station.state)):
            for kind in ("high", "low"):
                if usable_value(observation, kind, include_preliminary=include_preliminary) is not None:
                    contributions[(observation.observed_on.year, geography_type, geography, kind, station.station_id)][1] += 1

    for event in events:
        if event.station_id not in station_index or not analysis_start <= event.observed_on <= analysis_end:
            continue
        for geography_type, geography in (("national", "CONUS"), ("region", event.region), ("state", event.state)):
            contributions[(event.observed_on.year, geography_type, geography, event.kind, event.station_id)][0] += 1

    strata = sorted({key[:4] for key in contributions})
    random = Random(random_seed)
    output = []
    for year, geography_type, geography, kind in strata:
        station_contributions = [
            (values[0], values[1]) for (row_year, row_type, row_geography, row_kind, _), values in contributions.items()
            if (row_year, row_type, row_geography, row_kind) == (year, geography_type, geography, kind)
        ]
        event_count = sum(item[0] for item in station_contributions)
        station_days = sum(item[1] for item in station_contributions)
        rate = event_count / station_days * RATE_SCALE if station_days else None
        ci_low, ci_high = _bootstrap_interval(station_contributions, bootstrap_iterations, random)
        output.append(AnnualRate(
            year=year,
            geography_type=geography_type,
            geography=geography,
            kind=kind,
            events=event_count,
            station_days=station_days,
            station_count=len(station_contributions),
            rate_per_100k_station_days=round(rate, 6) if rate is not None else None,
            ci95_low=round(ci_low, 6) if ci_low is not None else None,
            ci95_high=round(ci_high, 6) if ci_high is not None else None,
        ))
    return output