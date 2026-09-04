import unittest
from datetime import date

from pipeline.events import reconstruct_record_events
from pipeline.models import Observation, Station


class EventReconstructionTests(unittest.TestCase):
    def test_reconstructs_superseded_events_after_baseline(self) -> None:
        station = Station("A", "Alpha", 40, -100, "NE", "Plains", date(1950, 1, 1), None)
        observations = [
            Observation("A", date(1950, 7, 1), 90, 60),
            Observation("A", date(1955, 7, 1), 92, 58),
            Observation("A", date(1960, 7, 1), 92, 58),
            Observation("A", date(1961, 7, 1), 95, 55),
            Observation("A", date(1962, 7, 1), 97, None),
            Observation("A", date(1963, 7, 1), 100, 50, max_flag="Q"),
        ]

        events = reconstruct_record_events(
            [station], observations, date(1950, 1, 1), date(1959, 12, 31)
        )

        self.assertEqual(
            [(event.observed_on.year, event.kind, event.value_f, event.prior_record_f) for event in events],
            [(1961, "high", 95, 92), (1961, "low", 55, 58), (1962, "high", 97, 95), (1963, "low", 50, 55)],
        )

    def test_initializes_a_missing_baseline_day_without_counting_it(self) -> None:
        station = Station("A", "Alpha", 40, -100, "NE", "Plains", date(1950, 1, 1), None)
        observations = [
            Observation("A", date(1960, 8, 1), 90, 60),
            Observation("A", date(1961, 8, 1), 91, 59),
        ]

        events = reconstruct_record_events(
            [station], observations, date(1950, 1, 1), date(1959, 12, 31)
        )

        self.assertEqual(
            [(event.observed_on.year, event.kind, event.prior_record_date.year) for event in events],
            [(1961, "high", 1960), (1961, "low", 1960)],
        )

    def test_counts_ties_without_advancing_the_prior_record(self) -> None:
        station = Station("A", "Alpha", 40, -100, "NE", "Plains", date(1950, 1, 1), None)
        observations = [
            Observation("A", date(1950, 7, 1), 90, 60),
            Observation("A", date(1960, 7, 1), 90, 60),
            Observation("A", date(1961, 7, 1), 91, 59),
        ]

        events = reconstruct_record_events(
            [station], observations, date(1950, 1, 1), date(1959, 12, 31), count_ties=True
        )

        self.assertEqual(
            [(event.observed_on.year, event.kind, event.prior_record_date.year) for event in events],
            [(1960, "high", 1950), (1960, "low", 1950), (1961, "high", 1950), (1961, "low", 1950)],
        )

    def test_includes_preliminary_values_only_when_requested(self) -> None:
        station = Station("A", "Alpha", 40, -100, "NE", "Plains", date(1950, 1, 1), None)
        observations = [
            Observation("A", date(1950, 7, 1), 90, 60),
            Observation("A", date(1960, 7, 1), 95, 55, status="preliminary"),
        ]

        excluded = reconstruct_record_events(
            [station], observations, date(1950, 1, 1), date(1959, 12, 31)
        )
        included = reconstruct_record_events(
            [station], observations, date(1950, 1, 1), date(1959, 12, 31), include_preliminary=True
        )

        self.assertEqual(excluded, [])
        self.assertEqual([(event.kind, event.value_f) for event in included], [("high", 95), ("low", 55)])

    def test_rejects_duplicate_station_dates_from_library_callers(self) -> None:
        station = Station("A", "Alpha", 40, -100, "NE", "Plains", date(1950, 1, 1), None)
        observations = [
            Observation("A", date(1950, 7, 1), 90, 60),
            Observation("A", date(1950, 7, 1), 95, 55),
        ]

        with self.assertRaisesRegex(ValueError, "duplicate station-date A 1950-07-01"):
            reconstruct_record_events(
                [station], observations, date(1950, 1, 1), date(1959, 12, 31)
            )


if __name__ == "__main__":
    unittest.main()