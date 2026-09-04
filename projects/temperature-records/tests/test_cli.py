import argparse
import csv
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

from pipeline.cli import _read_cohort_ids, _validate_observation_periods, _validate_output_paths, run_analysis
from pipeline.models import Observation, Station


class CliIntegrationTests(unittest.TestCase):
    def test_writes_reproducible_analysis_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stations_path = root / "stations.csv"
            observations_path = root / "observations.csv"
            output = root / "output"
            with stations_path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle)
                writer.writerow(["station_id", "name", "latitude", "longitude", "state", "region", "operating_start", "operating_end"])
                writer.writerow(["A", "Alpha", 40, -100, "NE", "Plains", "2000-07-01", ""])
            with observations_path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle)
                writer.writerow(["station_id", "date", "max_f", "min_f", "max_flag", "min_flag", "status"])
                writer.writerow(["A", "2000-07-01", 90, 60, "", "", "certified"])
                writer.writerow(["A", "2001-07-01", 95, 55, "", "", "certified"])

            counts = run_analysis(argparse.Namespace(
                stations=stations_path,
                observations=observations_path,
                output=output,
                baseline_start=date(2000, 7, 1),
                baseline_end=date(2000, 7, 1),
                analysis_end=date(2001, 7, 1),
                minimum_completeness=0.005,
                cohort_file=None,
                bootstrap_iterations=20,
                random_seed=3,
                include_preliminary=False,
                count_ties=False,
            ))

            self.assertEqual(counts["stations"], 1)
            self.assertEqual(counts["events"], 2)
            self.assertEqual(
                {path.name for path in output.iterdir()},
                {"cohort.json", "events.csv", "annual-rates.json", "station-availability.json", "manifest.json"},
            )
            cohort = json.loads((output / "cohort.json").read_text(encoding="utf-8"))
            rates = json.loads((output / "annual-rates.json").read_text(encoding="utf-8"))
            manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(cohort["stationIds"], ["A"])
            self.assertEqual(rates["rateUnit"], "events per 100,000 valid station-days")
            self.assertEqual(len(manifest["inputs"]["stations"]["sha256"]), 64)
            self.assertEqual(len(manifest["outputs"]["events.csv"]["sha256"]), 64)

    def test_rejects_invalid_frozen_cohort_contracts(self) -> None:
        invalid_payloads = [
            {},
            {"stationIds": "A"},
            {"stationIds": [""]},
            {"stationIds": ["A", "A"]},
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cohort.json"
            for payload in invalid_payloads:
                with self.subTest(payload=payload):
                    path.write_text(json.dumps(payload), encoding="utf-8")
                    with self.assertRaises(ValueError):
                        _read_cohort_ids(path)

    def test_rejects_observations_outside_the_operating_period(self) -> None:
        station = Station("A", "Alpha", 40, -100, "NE", "Plains", date(2000, 1, 1), date(2000, 12, 31))
        observations = [Observation("A", date(2001, 1, 1), 50, 20)]

        with self.assertRaisesRegex(ValueError, "outside the station operating period"):
            _validate_observation_periods({"A": station}, observations)

    def test_rejects_input_paths_that_collide_with_outputs(self) -> None:
        root = Path("/tmp/temperature-records")

        with self.assertRaisesRegex(ValueError, "observations input path conflicts"):
            _validate_output_paths(root / "stations.csv", root / "events.csv", root)


if __name__ == "__main__":
    unittest.main()