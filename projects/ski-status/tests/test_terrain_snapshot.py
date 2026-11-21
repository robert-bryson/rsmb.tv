from contextlib import closing
from importlib.util import module_from_spec, spec_from_file_location
import json
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch


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

    def test_rejects_attribution_without_a_valid_https_url(self):
        for url in ('http://example.org', '//example.org', 'https:///trails',
                    'https://user@example.org', 'https://example.org:wrong', 'https://exa\tmple.org'):
            with self.subTest(url=url), self.assertRaisesRegex(ValueError, 'HTTPS URL'):
                terrain.format_attribution({'Data source': url})

    def test_counts_unique_operating_trail_names_in_the_matching_area_and_snapshot(self):
        area_id, neighboring_id = '1' * 40, '2' * 40
        with closing(sqlite3.connect(self.path)) as db, db:
            for layer in terrain.FEATURE_LAYERS['runs']:
                db.execute(f'DROP TABLE "{layer}"')
                db.execute(f'CREATE TABLE "{layer}" (name TEXT, uses TEXT, ski_area_ids TEXT, status TEXT)')
            db.executemany('INSERT INTO runs_linestring VALUES (?, ?, ?, ?)', [
                ('East Run', 'downhill', area_id, 'operating'),
                ('East Run Extension', 'downhill', neighboring_id, 'operating'),
                ('  east   run  ', 'downhill', area_id, 'operating'),
                ('Forêt Loop', 'nordic', area_id, 'operating'),
                ('Old Run', 'downhill', area_id, 'abandoned'),
            ])
            db.executemany('INSERT INTO runs_multipolygon VALUES (?, ?, ?, ?)', [
                ('East Run', 'downhill', area_id, 'operating'),
                ('Fore\u0302t Loop', 'nordic', area_id, 'operating'),
            ])

        build_time = self.metadata['run']['finishedAt']
        mapped = {'source': f'https://openskimap.org/?obj={area_id}', 'downhillKm': 2, 'nordicKm': 3}
        locations = {'buildTime': build_time, 'locations': [{'mappedTerrain': mapped}]}

        self.assertFalse(terrain.add_mapped_trail_counts(self.path, locations, '2026-11-15T02:00:00Z'))
        self.assertNotIn('namedDownhillRuns', mapped)
        self.assertTrue(terrain.add_mapped_trail_counts(self.path, locations, build_time))
        self.assertEqual(mapped['namedDownhillRuns'], 1)
        self.assertEqual(mapped['namedNordicTrails'], 1)
        self.assertFalse(terrain.add_mapped_trail_counts(self.path, locations, build_time))


class TerrainPublicationTest(unittest.TestCase):
    def setUp(self):
        self.directory = Path(self.enterContext(TemporaryDirectory()))

    def test_publishes_immutable_archives_outside_the_checkout(self):
        work = self.directory / 'working.pmtiles'
        work.write_bytes(b'first archive')
        first_checksum = terrain.sha256(work)
        first = terrain.publish_terrain_archive(work, self.directory, first_checksum)
        self.assertEqual(first.relative_to(self.directory).as_posix(),
                         f'runtime/terrain/{first_checksum}/resort-terrain.pmtiles')
        self.assertEqual(terrain.publish_terrain_archive(work, self.directory, first_checksum), first)

        work.write_bytes(b'next archive')
        next_checksum = terrain.sha256(work)
        second = terrain.publish_terrain_archive(work, self.directory, next_checksum)
        self.assertEqual(first.read_bytes(), b'first archive')
        self.assertEqual(second.read_bytes(), b'next archive')

        first.write_bytes(b'corrupt archive')
        with self.assertRaisesRegex(OSError, 'Existing terrain archive does not match'):
            terrain.publish_terrain_archive(work, self.directory, first_checksum)
        self.assertEqual(first.read_bytes(), b'corrupt archive')

    def test_releases_the_lock_after_an_interrupted_build(self):
        with self.assertRaisesRegex(OSError, 'build failed'), terrain.lock_output(self.directory):
            with self.assertRaisesRegex(RuntimeError, 'already running'), terrain.lock_output(self.directory):
                self.fail('A second build acquired the output lock')
            raise OSError('build failed')

        with terrain.lock_output(self.directory):
            self.assertEqual(len(list(self.directory.iterdir())), 1)
        self.assertEqual(list(self.directory.iterdir()), [])

    def test_restores_previous_outputs_if_a_replacement_fails(self):
        staging = self.directory / 'staging'
        staging.mkdir()
        archive, locations, index = (staging / name for name in ('archive.pmtiles', 'locations.json', 'index.json'))
        outputs = (archive, locations, index)
        for output in outputs:
            output.write_text(f'New {output.name}', encoding='utf-8')
        for output in (archive, index):
            (self.directory / output.name).write_text(f'Old {output.name}', encoding='utf-8')

        replace = terrain.os.replace

        def fail_on_index(source, destination):
            if source == index:
                raise OSError('index replacement failed')
            replace(source, destination)

        with patch.object(terrain.os, 'replace', side_effect=fail_on_index):
            with self.assertRaisesRegex(OSError, 'index replacement failed'):
                terrain.publish_outputs(outputs, self.directory)

        self.assertEqual((self.directory / archive.name).read_text(encoding='utf-8'), f'Old {archive.name}')
        self.assertEqual((self.directory / index.name).read_text(encoding='utf-8'), f'Old {index.name}')
        self.assertFalse((self.directory / locations.name).exists())


class ResortBaseTest(unittest.TestCase):
    def test_counts_only_lower_lift_terminals_when_the_elevations_differ(self):
        base = (-120.005, 39, 1800)
        transfer = (-120.001, 39, 2100)
        summit = (-120.001, 39.005, 2400)
        stations = [
            (transfer[:2], 'Transfer', 'https://example.test/transfer'),
            (base[:2], 'Lodge', 'https://example.test/base'),
        ]
        lifts = [terrain.lift_entry_points(transfer, base), terrain.lift_entry_points(transfer, summit),
                 terrain.lift_entry_points(base, summit)]
        self.assertEqual(terrain.select_lift_base((-120, 39), stations, lifts)['name'], 'Lodge')
        self.assertEqual(terrain.lift_entry_points(base, transfer), (base[:2],))
        self.assertEqual(terrain.lift_entry_points(base, (*transfer[:2], base[2] + 1)), (base[:2], transfer[:2]))

    def test_drops_verified_entrances_for_deleted_catalog_areas(self):
        directory = Path(self.enterContext(TemporaryDirectory()))
        staging = directory / 'staging'
        staging.mkdir()
        entrance = {'kind': 'entrance', 'coordinates': [4, 6], 'source': 'https://example.test/base', 'name': 'Lodge'}
        original = directory / 'resort-bases.json'
        original.write_text(json.dumps({'bases': {'kept': entrance, 'removed': entrance}}), encoding='utf-8')
        locations = {'license': 'https://example.test/license', 'locations': [{'id': 'kept', 'coordinates': [4, 5]}]}
        db = type('EmptyDatabase', (), {'GetLayerByName': lambda self, _name: []})()
        with patch.object(terrain, 'DATA', directory):
            output = terrain.write_resort_bases(db, {}, {'kept': {}}, locations, '2026-11-20T12:00:00Z', staging)
        self.assertEqual(terrain.read_json(output)['bases'], {'kept': entrance})

    def test_chooses_a_lift_cluster_and_ignores_a_distant_station(self):
        closer, lodge, distant = (-120.001, 39), (-120.005, 39), (-120.04, 39)
        stations = [
            (closer, 'Upper chair', 'https://example.test/upper'),
            (lodge, 'Main lift', 'https://example.test/base'),
            (distant, 'Other area', 'https://example.test/distant'),
        ]
        lifts = [
            (closer, (-120.001, 39.005)),
            (lodge, (-120.005, 39.005)),
            ((-120.006, 39), (-120.006, 39.005)),
            (distant, (-120.04, 39.005)),
            (distant, (-120.04, 39.006)),
            (distant, (-120.04, 39.007)),
        ]
        self.assertEqual(terrain.select_lift_base((-120, 39), stations, lifts), {
            'coordinates': lodge, 'name': 'Main lift', 'kind': 'lift-base', 'source': 'https://example.test/base',
        })

    def test_requires_a_station_next_to_an_operating_lift(self):
        station = ((-120, 39), None, 'https://example.test/station')
        lift = ((-120.001, 39), (-120.001, 39.005))
        self.assertIsNone(terrain.select_lift_base((-120, 39), [station], [lift]))


class TerrainRunOwnershipTest(unittest.TestCase):
    areas = {'alpine': {}, 'nordic': {'skiing': 'cross-country'}, 'touring': {'skiing': 'ski-touring'}}

    def test_draws_shared_geometry_for_each_supported_activity(self):
        self.assertEqual(
            terrain.run_owners(self.areas, self.areas, {'downhill', 'nordic', 'skitour'}),
            {'downhill': {'alpine'}, 'nordic': {'nordic'}, 'skitour': {'touring'}},
        )

    def test_excludes_unsupported_activities_from_lift_free_areas(self):
        self.assertEqual(terrain.run_owners(self.areas, self.areas, {'downhill'}), {'downhill': {'alpine'}})
        self.assertEqual(terrain.run_owners(self.areas, self.areas, {'sled'}), {})
