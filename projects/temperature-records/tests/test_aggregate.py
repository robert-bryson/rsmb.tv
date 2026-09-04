import unittest
from datetime import date

from pipeline.aggregate import aggregate_annual_rates
from pipeline.models import Observation, RecordEvent, Station


class AggregateTests(unittest.TestCase):
    def test_normalizes_by_valid_station_days_and_bootstraps_stations(self) -> None:
        stations = [
            Station("A", "Alpha", 40, -100, "NE", "Plains", date(1950, 1, 1), None),
            Station("B", "Beta", 35, -85, "TN", "Southeast", date(1950, 1, 1), None),
        ]
        observations = [
            Observation("A", date(1961, 7, 1), 95, 55),
            Observation("A", date(1961, 7, 2), 96, None),
            Observation("B", date(1961, 7, 1), 90, 60),
            Observation("B", date(1961, 7, 2), 91, 61),
        ]
        events = [
            RecordEvent("A", date(1961, 7, 1), "high", 95, 92, date(1955, 7, 1), 3, "NE", "Plains"),
            RecordEvent("A", date(1961, 7, 2), "high", 96, 93, date(1955, 7, 2), 3, "NE", "Plains"),
            RecordEvent("A", date(1961, 7, 1), "low", 55, 58, date(1955, 7, 1), 3, "NE", "Plains"),
        ]

        rates = aggregate_annual_rates(
            stations, observations, events, {"A", "B"}, date(1961, 1, 1), date(1961, 12, 31),
            bootstrap_iterations=500, random_seed=7,
        )
        high = next(row for row in rates if row.geography == "CONUS" and row.kind == "high")
        low = next(row for row in rates if row.geography == "CONUS" and row.kind == "low")

        self.assertEqual((high.events, high.station_days, high.station_count), (2, 4, 2))
        self.assertEqual(high.rate_per_100k_station_days, 50_000)
        self.assertEqual((high.ci95_low, high.ci95_high), (0, 100_000))
        self.assertEqual((low.events, low.station_days), (1, 3))

    def test_emits_zero_rates_when_observations_have_no_events(self) -> None:
        station = Station("A", "Alpha", 40, -100, "NE", "Plains", date(1950, 1, 1), None)
        observation = Observation("A", date(1961, 7, 1), 95, 55)

        rates = aggregate_annual_rates(
            [station], [observation], [], {"A"}, date(1961, 1, 1), date(1961, 12, 31),
            bootstrap_iterations=20,
        )

        self.assertTrue(rates)
        self.assertTrue(all(row.events == 0 for row in rates))
        self.assertTrue(all(row.rate_per_100k_station_days == 0 for row in rates))
        self.assertTrue(all((row.ci95_low, row.ci95_high) == (0, 0) for row in rates))


if __name__ == "__main__":
    unittest.main()