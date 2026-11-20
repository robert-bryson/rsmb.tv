from collections import Counter, defaultdict
from datetime import date
import csv
import json
from pathlib import Path
import unittest


PROJECT = Path(__file__).resolve().parents[1]
REVIEW = PROJECT / 'research' / 'north-america-2026-11-16.csv'
SUMMARY = REVIEW.with_stem(f'{REVIEW.stem}-summary')
DECISIONS = ('already cataloged', 'eligible', 'duplicate', 'excluded', 'unresolved')


def read_rows(path):
    with path.open(encoding='utf-8', newline='') as stream:
        return list(csv.DictReader(stream))


class CandidateReviewTest(unittest.TestCase):
    def test_records_evidence_and_a_decision_for_each_candidate(self):
        rows = read_rows(REVIEW)
        self.assertEqual(len(rows), 848)
        self.assertEqual(len({row['upstream'] for row in rows}), len(rows))
        catalog = {area['id'] for area in json.loads((PROJECT / 'data' / 'areas.json').read_text(encoding='utf-8'))}
        for row in rows:
            with self.subTest(candidate=row['upstream']):
                self.assertIn(row['decision'], DECISIONS)
                self.assertTrue(row['evidence'] and row['reason'] and row['region'])
                self.assertEqual(date.fromisoformat(row['checkedOn']).isoformat(), row['checkedOn'])
                if row['decision'] == 'unresolved':
                    self.assertTrue(row['nextCheck'])
                if row['decision'] in ('already cataloged', 'eligible', 'duplicate'):
                    self.assertIn(row['areaId'], catalog)

    def test_reconciles_all_candidate_decisions_with_the_regional_counts(self):
        counts = defaultdict(Counter)
        for row in read_rows(REVIEW):
            counts[row['country'], row['region']][row['decision']] += 1
        summary = read_rows(SUMMARY)
        self.assertEqual(len(summary), len(counts))
        for row in summary:
            key = (row['country'], row['region'])
            with self.subTest(region=key):
                decisions = counts.pop(key)
                self.assertEqual(int(row['candidates']), decisions.total())
                for decision in DECISIONS:
                    self.assertEqual(int(row[decision]), decisions[decision], decision)
        self.assertFalse(counts)
