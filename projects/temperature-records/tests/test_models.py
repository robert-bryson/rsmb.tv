import unittest
from datetime import date

from pipeline.models import Observation, Station, index_stations


class ModelValidationTests(unittest.TestCase):
    def test_rejects_non_finite_station_coordinates(self) -> None:
        for coordinate in (float("nan"), float("inf"), float("-inf")):
            with self.subTest(coordinate=coordinate):
                with self.assertRaisesRegex(ValueError, "invalid latitude"):
                    Station("A", "Alpha", coordinate, -100, "NE", "Plains", date(1950, 1, 1), None)

    def test_rejects_non_finite_temperatures(self) -> None:
        for temperature in (float("nan"), float("inf"), float("-inf")):
            with self.subTest(temperature=temperature):
                with self.assertRaisesRegex(ValueError, "implausible max_f"):
                    Observation("A", date(1950, 1, 1), temperature, 20)

    def test_rejects_empty_station_geography(self) -> None:
        with self.assertRaisesRegex(ValueError, "region must not be empty"):
            Station("A", "Alpha", 40, -100, "NE", " ", date(1950, 1, 1), None)

    def test_rejects_duplicate_station_ids(self) -> None:
        stations = [
            Station("A", "Alpha", 40, -100, "NE", "Plains", date(1950, 1, 1), None),
            Station("A", "Other Alpha", 41, -101, "SD", "Plains", date(1950, 1, 1), None),
        ]

        with self.assertRaisesRegex(ValueError, "duplicate station_id A"):
            index_stations(stations)


if __name__ == "__main__":
    unittest.main()