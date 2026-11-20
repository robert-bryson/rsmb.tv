from contextlib import closing
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory
import unittest


script = Path(__file__).resolve().parents[1] / 'scripts' / 'build-resort-terrain.py'
spec = spec_from_file_location('build_resort_terrain', script)
terrain = module_from_spec(spec)
spec.loader.exec_module(terrain)


class TerrainSnapshotTest(unittest.TestCase):
    def setUp(self):
        directory = self.enterContext(TemporaryDirectory())
        self.path = Path(directory) / 'ski area #1.gpkg'
        stamp = '2026-11-16T01:00:00.000Z'
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute('CREATE TABLE gpkg_contents (table_name TEXT, last_change TEXT)')
            for layer in ('ski_areas_point', 'ski_areas_multipolygon', 'lifts_linestring', 'runs_linestring',
                          'runs_multipolygon', 'spots_point'):
                db.execute(f'CREATE TABLE {layer} (id INTEGER PRIMARY KEY)')
                db.execute(f'INSERT INTO {layer} DEFAULT VALUES')
                db.execute('INSERT INTO gpkg_contents VALUES (?, ?)', (layer, stamp))
        self.metadata = {
            'files': {'geoPackage': self.path.stat().st_size},
            'run': {'startedAt': '2026-11-15T23:00:00Z', 'finishedAt': '2026-11-16T02:00:00Z'},
            'counts': {'skiAreas': {'total': 1}, 'lifts': 1, 'runs': 2, 'spots': 1},
        }

    def test_accepts_matching_snapshot(self):
        terrain.validate_snapshot(self.path, self.metadata)

    def test_rejects_incomplete_download(self):
        self.metadata['files']['geoPackage'] += 1024
        with self.assertRaisesRegex(ValueError, 'GeoPackage size'):
            terrain.validate_snapshot(self.path, self.metadata)

    def test_rejects_same_size_snapshot_with_different_counts(self):
        self.metadata['counts']['runs'] = 3
        with self.assertRaisesRegex(ValueError, 'GeoPackage has 2 runs'):
            terrain.validate_snapshot(self.path, self.metadata)

    def test_rejects_metadata_from_another_build_with_equal_counts_and_size(self):
        self.metadata['run'] = {'startedAt': '2026-11-17T00:00:00Z', 'finishedAt': '2026-11-17T02:00:00Z'}
        with self.assertRaisesRegex(ValueError, 'outside the source build times'):
            terrain.validate_snapshot(self.path, self.metadata)

    def test_rejects_schema_that_lists_a_missing_layer(self):
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute('DROP TABLE ski_areas_multipolygon')
        self.metadata['files']['geoPackage'] = self.path.stat().st_size
        with self.assertRaisesRegex(ValueError, 'does not contain layer ski_areas_multipolygon'):
            terrain.validate_snapshot(self.path, self.metadata)

    def test_encodes_archive_attribution_as_html_text_and_attributes(self):
        credits = {'Peaks & Trails <data>': 'https://example.org/?label="winter"&copy=1'}
        self.assertEqual(
            terrain.format_attribution(credits),
            '<a href="https://example.org/?label=&quot;winter&quot;&amp;copy=1">Peaks &amp; Trails &lt;data&gt;</a>',
        )
