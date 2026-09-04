"""Validated data contracts for historical climate-signal analysis."""

from dataclasses import dataclass
from datetime import date
from math import isfinite
from typing import Iterable, Literal

RecordKind = Literal["high", "low"]
ObservationStatus = Literal["certified", "preliminary"]


@dataclass(frozen=True, slots=True)
class Station:
    station_id: str
    name: str
    latitude: float
    longitude: float
    state: str
    region: str
    operating_start: date
    operating_end: date | None

    def __post_init__(self) -> None:
        if not self.station_id.strip():
            raise ValueError("station_id must not be empty")
        for label, value in (("name", self.name), ("state", self.state), ("region", self.region)):
            if not value.strip():
                raise ValueError(f"{label} must not be empty for {self.station_id}")
        if not isfinite(self.latitude) or not -90 <= self.latitude <= 90:
            raise ValueError(f"invalid latitude for {self.station_id}")
        if not isfinite(self.longitude) or not -180 <= self.longitude <= 180:
            raise ValueError(f"invalid longitude for {self.station_id}")
        if self.operating_end is not None and self.operating_end < self.operating_start:
            raise ValueError(f"operating_end precedes operating_start for {self.station_id}")


@dataclass(frozen=True, slots=True)
class Observation:
    station_id: str
    observed_on: date
    max_f: float | None
    min_f: float | None
    max_flag: str = ""
    min_flag: str = ""
    status: ObservationStatus = "certified"

    def __post_init__(self) -> None:
        if not self.station_id.strip():
            raise ValueError("station_id must not be empty")
        if self.status not in ("certified", "preliminary"):
            raise ValueError(f"invalid observation status: {self.status}")
        for label, value in (("max_f", self.max_f), ("min_f", self.min_f)):
            if value is not None and (not isfinite(value) or not -150 <= value <= 180):
                raise ValueError(f"implausible {label} for {self.station_id} on {self.observed_on}")
        if self.max_f is not None and self.min_f is not None and self.min_f > self.max_f:
            raise ValueError(f"minimum exceeds maximum for {self.station_id} on {self.observed_on}")


@dataclass(frozen=True, slots=True)
class RecordEvent:
    station_id: str
    observed_on: date
    kind: RecordKind
    value_f: float
    prior_record_f: float
    prior_record_date: date
    margin_f: float
    state: str
    region: str


def index_stations(stations: Iterable[Station]) -> dict[str, Station]:
    station_index: dict[str, Station] = {}
    for station in stations:
        if station.station_id in station_index:
            raise ValueError(f"duplicate station_id {station.station_id}")
        station_index[station.station_id] = station
    return station_index