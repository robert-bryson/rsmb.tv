import unittest
from datetime import date, timedelta

from pipeline.cohort import select_fixed_cohort, station_availability_by_year
from pipeline.models import Observation, Station


class CohortTests(unittest.TestCase):
    def test_requires_full_operating_period_and_metric_completeness(self) -> None:
        start = date(2000, 1, 1)
        end = date(2000, 1, 3)
        stations = [
            Station("A", "Alpha", 40, -100, "NE", "Plains", start, None),
            Station("B", "Beta", 41, -101, "SD", "Plains", start + timedelta(days=1), None),
        ]
        observations = [
            Observation("A", start, 50, 20),
            Observation("A", start + timedelta(days=1), 51, 21),
            Observation("A", end, 52, None),
            Observation("B", start + timedelta(days=1), 51, 21),
            Observation("B", end, 52, 22),
        ]

        report = select_fixed_cohort(stations, observations, start, end, minimum_completeness=0.8)

        self.assertFalse(report[0].included)
        self.assertEqual(report[0].exclusion_reason, "completeness below 80.0%")
        self.assertFalse(report[1].included)
        self.assertIn("operating period", report[1].exclusion_reason or "")

    def test_reports_separate_high_and_low_station_day_exposure(self) -> None:
        station = Station("A", "Alpha", 40, -100, "NE", "Plains", date(2000, 1, 1), None)
        observations = [
            Observation("A", date(2000, 1, 1), 50, 20),
            Observation("A", date(2000, 1, 2), 51, None),
        ]

        [row] = station_availability_by_year(
            [station], observations, {"A"}, date(2000, 1, 1), date(2000, 1, 2)
        )

        self.assertEqual(row["expectedStationDays"], 2)
        self.assertEqual(row["validHighStationDays"], 2)
        self.assertEqual(row["validLowStationDays"], 1)


if __name__ == "__main__":
    unittest.main()