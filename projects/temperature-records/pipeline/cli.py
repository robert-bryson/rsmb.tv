"""Command-line orchestration for reproducible historical signal analysis."""

import argparse
import csv
import hashlib
import json
from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from .aggregate import aggregate_annual_rates
from .cohort import select_fixed_cohort, station_availability_by_year
from .events import reconstruct_record_events
from .io import read_observations, read_stations
from .models import Observation, RecordEvent, Station, index_stations

METHODOLOGY_VERSION = "1.0.0"
OUTPUT_NAMES = (
    "cohort.json",
    "events.csv",
    "annual-rates.json",
    "station-availability.json",
    "manifest.json",
)


def _date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("dates must use YYYY-MM-DD") from error


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _write_events(path: Path, events: list[RecordEvent]) -> None:
    fieldnames = [
        "station_id", "observed_on", "kind", "value_f", "prior_record_f",
        "prior_record_date", "margin_f", "state", "region",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for event in events:
            row = asdict(event)
            row["observed_on"] = row["observed_on"].isoformat()
            row["prior_record_date"] = row["prior_record_date"].isoformat()
            writer.writerow(row)


def _read_cohort_ids(path: Path) -> set[str]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(f"invalid cohort JSON in {path}: {error.msg}") from error
    if not isinstance(payload, dict) or "stationIds" not in payload:
        raise ValueError(f"cohort JSON in {path} must contain stationIds")
    station_ids = payload["stationIds"]
    if not isinstance(station_ids, list) or any(
        not isinstance(station_id, str) or not station_id.strip() for station_id in station_ids
    ):
        raise ValueError(f"stationIds in {path} must be an array of non-empty strings")
    if len(station_ids) != len(set(station_ids)):
        raise ValueError(f"stationIds in {path} must not contain duplicates")
    return set(station_ids)


def _validate_observation_periods(
    station_index: dict[str, Station],
    observations: list[Observation],
) -> None:
    for observation in observations:
        station = station_index.get(observation.station_id)
        if station is None:
            continue
        if observation.observed_on < station.operating_start or (
            station.operating_end is not None and observation.observed_on > station.operating_end
        ):
            raise ValueError(
                f"observation for {observation.station_id} on {observation.observed_on} "
                "is outside the station operating period"
            )


def _validate_output_paths(stations: Path, observations: Path, output: Path) -> None:
    output_paths = {(output / name).resolve() for name in OUTPUT_NAMES}
    for label, input_path in (("stations", stations), ("observations", observations)):
        if input_path.resolve() in output_paths:
            raise ValueError(f"{label} input path conflicts with a generated output path")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Estimate historical station record-event rates")
    parser.add_argument("--stations", type=Path, required=True, help="normalized station CSV")
    parser.add_argument("--observations", type=Path, required=True, help="normalized daily observation CSV")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--baseline-start", type=_date, default=date(1950, 1, 1))
    parser.add_argument("--baseline-end", type=_date, default=date(1959, 12, 31))
    parser.add_argument("--analysis-end", type=_date, default=date.today())
    parser.add_argument("--minimum-completeness", type=float, default=0.9)
    parser.add_argument("--cohort-file", type=Path, help="reuse station IDs from an existing cohort JSON")
    parser.add_argument("--bootstrap-iterations", type=int, default=1_000)
    parser.add_argument("--random-seed", type=int, default=20260903)
    parser.add_argument("--include-preliminary", action="store_true")
    parser.add_argument("--count-ties", action="store_true")
    return parser


def run_analysis(args: argparse.Namespace) -> dict[str, int]:
    analysis_start = args.baseline_end + timedelta(days=1)
    if args.baseline_start > args.baseline_end or args.baseline_end >= args.analysis_end:
        raise ValueError("baseline must precede a non-empty analysis period")
    if args.bootstrap_iterations < 1:
        raise ValueError("bootstrap_iterations must be positive")
    _validate_output_paths(args.stations, args.observations, args.output)

    stations = read_stations(args.stations)
    observations = read_observations(args.observations)
    input_hashes = {
        "stations": _sha256(args.stations),
        "observations": _sha256(args.observations),
    }
    station_index = index_stations(stations)
    station_ids = set(station_index)
    unknown_ids = sorted({row.station_id for row in observations} - station_ids)
    if unknown_ids:
        raise ValueError(f"observations reference unknown stations: {', '.join(unknown_ids[:10])}")
    _validate_observation_periods(station_index, observations)

    cohort_report = select_fixed_cohort(
        stations,
        observations,
        args.baseline_start,
        args.analysis_end,
        minimum_completeness=args.minimum_completeness,
        include_preliminary=args.include_preliminary,
    )
    if args.cohort_file:
        cohort_ids = _read_cohort_ids(args.cohort_file)
        missing_ids = cohort_ids - station_ids
        if missing_ids:
            raise ValueError(f"frozen cohort contains unknown stations: {', '.join(sorted(missing_ids))}")
        cohort_source = str(args.cohort_file)
    else:
        cohort_ids = {row.station_id for row in cohort_report if row.included}
        cohort_source = "selected from current inputs"
    if not cohort_ids:
        raise ValueError("fixed cohort is empty; inspect completeness thresholds and operating periods")

    cohort_stations = [station for station in stations if station.station_id in cohort_ids]
    cohort_observations = [row for row in observations if row.station_id in cohort_ids]
    events = reconstruct_record_events(
        cohort_stations,
        cohort_observations,
        args.baseline_start,
        args.baseline_end,
        include_preliminary=args.include_preliminary,
        count_ties=args.count_ties,
    )
    rates = aggregate_annual_rates(
        cohort_stations,
        cohort_observations,
        events,
        cohort_ids,
        analysis_start,
        args.analysis_end,
        include_preliminary=args.include_preliminary,
        bootstrap_iterations=args.bootstrap_iterations,
        random_seed=args.random_seed,
    )
    availability = station_availability_by_year(
        stations,
        observations,
        cohort_ids,
        args.baseline_start,
        args.analysis_end,
        include_preliminary=args.include_preliminary,
    )

    args.output.mkdir(parents=True, exist_ok=True)
    cohort_payload = {
        "methodologyVersion": METHODOLOGY_VERSION,
        "source": cohort_source,
        "window": [args.baseline_start.isoformat(), args.analysis_end.isoformat()],
        "minimumCompleteness": args.minimum_completeness,
        "stationIds": sorted(cohort_ids),
        "stations": [row.to_dict() for row in cohort_report],
    }
    _write_json(args.output / "cohort.json", cohort_payload)
    _write_events(args.output / "events.csv", events)
    _write_json(args.output / "annual-rates.json", {
        "methodologyVersion": METHODOLOGY_VERSION,
        "rateUnit": "events per 100,000 valid station-days",
        "confidenceInterval": f"station-block bootstrap, {args.bootstrap_iterations} replicates",
        "rows": [rate.to_dict() for rate in rates],
    })
    _write_json(args.output / "station-availability.json", availability)
    _write_json(args.output / "manifest.json", {
        "methodologyVersion": METHODOLOGY_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "inputs": {
            "stations": {"path": str(args.stations), "sha256": input_hashes["stations"]},
            "observations": {"path": str(args.observations), "sha256": input_hashes["observations"]},
        },
        "outputs": {
            name: {"sha256": _sha256(args.output / name)} for name in OUTPUT_NAMES if name != "manifest.json"
        },
        "parameters": {
            "baselineStart": args.baseline_start.isoformat(),
            "baselineEnd": args.baseline_end.isoformat(),
            "analysisEnd": args.analysis_end.isoformat(),
            "minimumCompleteness": args.minimum_completeness,
            "includePreliminary": args.include_preliminary,
            "countTies": args.count_ties,
            "bootstrapIterations": args.bootstrap_iterations,
            "randomSeed": args.random_seed,
        },
        "qualityPolicy": "missing, flagged, and (by default) preliminary values are excluded",
    })
    return {"stations": len(cohort_ids), "events": len(events), "rates": len(rates)}


def main() -> None:
    args = build_parser().parse_args()
    counts = run_analysis(args)
    print(f"Analyzed {counts['stations']} stations; wrote {counts['events']} events and {counts['rates']} rate rows")