"""Observation quality policy shared by cohort, event, and exposure logic."""

from .models import Observation, RecordKind


def usable_value(
    observation: Observation,
    kind: RecordKind,
    *,
    include_preliminary: bool = False,
) -> float | None:
    value = observation.max_f if kind == "high" else observation.min_f
    flag = observation.max_flag if kind == "high" else observation.min_flag
    if value is None or flag or (observation.status == "preliminary" and not include_preliminary):
        return None
    return value