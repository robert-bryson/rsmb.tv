"""Chronologically reconstruct station calendar-day record events."""

from collections import defaultdict
from datetime import date
from typing import Iterable

from .models import Observation, RecordEvent, Station, index_stations
from .quality import usable_value


def reconstruct_record_events(
    stations: Iterable[Station],
    observations: Iterable[Observation],
    baseline_start: date,
    baseline_end: date,
    *,
    include_preliminary: bool = False,
    count_ties: bool = False,
) -> list[RecordEvent]:
    """Return every post-baseline event, retaining records later superseded."""
    if baseline_end < baseline_start:
        raise ValueError("baseline_end must not precede baseline_start")

    station_index = index_stations(stations)
    grouped: dict[str, list[Observation]] = defaultdict(list)
    seen_observations: set[tuple[str, date]] = set()
    for observation in observations:
        if observation.station_id not in station_index:
            raise ValueError(f"observation references unknown station {observation.station_id}")
        observation_key = (observation.station_id, observation.observed_on)
        if observation_key in seen_observations:
            raise ValueError(
                f"duplicate station-date {observation.station_id} {observation.observed_on}"
            )
        seen_observations.add(observation_key)
        grouped[observation.station_id].append(observation)

    events: list[RecordEvent] = []
    for station_id, rows in grouped.items():
        station = station_index[station_id]
        records: dict[tuple[int, int, str], tuple[float, date]] = {}
        for row in sorted(rows, key=lambda item: item.observed_on):
            if row.observed_on < baseline_start:
                continue
            day_key = (row.observed_on.month, row.observed_on.day)
            for kind in ("high", "low"):
                value = usable_value(row, kind, include_preliminary=include_preliminary)
                if value is None:
                    continue
                key = (*day_key, kind)
                prior = records.get(key)
                if row.observed_on <= baseline_end:
                    if prior is None or (kind == "high" and value > prior[0]) or (kind == "low" and value < prior[0]):
                        records[key] = (value, row.observed_on)
                    continue
                if prior is None:
                    records[key] = (value, row.observed_on)
                    continue

                breaks_record = value > prior[0] if kind == "high" else value < prior[0]
                is_tie = count_ties and value == prior[0]
                if breaks_record or is_tie:
                    margin = value - prior[0] if kind == "high" else prior[0] - value
                    events.append(RecordEvent(
                        station_id=station_id,
                        observed_on=row.observed_on,
                        kind=kind,
                        value_f=value,
                        prior_record_f=prior[0],
                        prior_record_date=prior[1],
                        margin_f=margin,
                        state=station.state,
                        region=station.region,
                    ))
                    if breaks_record:
                        records[key] = (value, row.observed_on)
    return sorted(events, key=lambda event: (event.observed_on, event.station_id, event.kind))