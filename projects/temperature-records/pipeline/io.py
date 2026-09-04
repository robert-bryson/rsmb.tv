"""Strict CSV readers for normalized station and observation inputs."""

import csv
from datetime import date
from pathlib import Path
from typing import Iterable

from .models import Observation, Station, index_stations

STATION_FIELDS = {
    "station_id", "name", "latitude", "longitude", "state", "region",
    "operating_start", "operating_end",
}
OBSERVATION_FIELDS = {
    "station_id", "date", "max_f", "min_f", "max_flag", "min_flag", "status",
}


def _require_fields(actual: Iterable[str] | None, required: set[str], label: str) -> None:
    missing = required - set(actual or ())
    if missing:
        raise ValueError(f"{label} CSV missing columns: {', '.join(sorted(missing))}")


def _optional_float(value: str) -> float | None:
    stripped = value.strip()
    return None if stripped in ("", "M") else float(stripped)


def read_stations(path: Path) -> list[Station]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        _require_fields(reader.fieldnames, STATION_FIELDS, "station")
        stations = []
        for line_number, row in enumerate(reader, 2):
            try:
                stations.append(Station(
                    station_id=row["station_id"].strip(),
                    name=row["name"].strip(),
                    latitude=float(row["latitude"]),
                    longitude=float(row["longitude"]),
                    state=row["state"].strip(),
                    region=row["region"].strip(),
                    operating_start=date.fromisoformat(row["operating_start"]),
                    operating_end=date.fromisoformat(row["operating_end"]) if row["operating_end"].strip() else None,
                ))
            except (TypeError, ValueError) as error:
                raise ValueError(f"invalid station CSV row {line_number}: {error}") from error
    index_stations(stations)
    return stations


def read_observations(path: Path) -> list[Observation]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        _require_fields(reader.fieldnames, OBSERVATION_FIELDS, "observation")
        observations = []
        seen = set()
        for line_number, row in enumerate(reader, 2):
            try:
                key = (row["station_id"].strip(), date.fromisoformat(row["date"]))
                if key in seen:
                    raise ValueError(f"duplicate station-date {key[0]} {key[1]}")
                seen.add(key)
                observations.append(Observation(
                    station_id=key[0],
                    observed_on=key[1],
                    max_f=_optional_float(row["max_f"]),
                    min_f=_optional_float(row["min_f"]),
                    max_flag=row["max_flag"].strip(),
                    min_flag=row["min_flag"].strip(),
                    status=row["status"].strip().lower(),  # type: ignore[arg-type]
                ))
            except (TypeError, ValueError) as error:
                raise ValueError(f"invalid observation CSV row {line_number}: {error}") from error
    return observations