"""Check global coverage, source geometry edge cases, and isolated publication paths."""

import json
from pathlib import Path
import sys
import tempfile
import unittest

from shapely.geometry import Polygon

PROJECT = Path(__file__).resolve().parents[1]
# The project is a standalone command directory, so load its sibling modules as the CLI does.
sys.path.insert(0, str(PROJECT))
import generate_world as world

PUBLIC = world.ROOT / 'public/data/pins-of-inaccessibility/world'


class WorldPublicationTests(unittest.TestCase):
    def test_regional_coastlines_are_aligned_to_the_country_before_calculation(self):
        country = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
        region = Polygon([(0.5, 0.25), (1.5, 0.25), (1.5, 0.75), (0.5, 0.75)])
        aligned, adjusted = world.align_region_to_country(region, country)
        self.assertTrue(adjusted)
        self.assertTrue(country.covers(aligned))
        self.assertAlmostEqual(aligned.area, 0.25)
        covered = Polygon([(0.1, 0.1), (0.2, 0.1), (0.2, 0.2), (0.1, 0.2)])
        self.assertFalse(world.align_region_to_country(covered, country)[1])
        with self.assertRaisesRegex(ValueError, 'no area'):
            world.align_region_to_country(region, Polygon([(5, 5), (6, 5), (6, 6), (5, 6)]))
        with self.assertRaisesRegex(ValueError, 'no area'):
            world.align_region_to_country(region, Polygon([(1.5, 0), (2, 0), (2, 1), (1.5, 1)]))

    def test_every_published_global_artifact_is_complete_and_valid(self):
        artifacts = list(PUBLIC.rglob('*.json')) + list(PUBLIC.rglob('*.geojson'))
        self.assertEqual(len(artifacts), 514)
        for path in artifacts:
            with self.subTest(artifact=path.name):
                world.validate_artifact(path.relative_to(PUBLIC).as_posix(), json.loads(path.read_text(encoding='utf-8')))

    def test_catalog_keeps_all_nonpolar_country_units_and_census_states(self):
        catalog = json.loads(world.CATALOG_PATH.read_text(encoding='utf-8'))['countries']
        self.assertEqual(len(catalog), 257)
        self.assertEqual(sum(len(country['regionIds']) for country in catalog), 4599)
        self.assertNotIn('ATA', {country['code'] for country in catalog})
        self.assertEqual(len(next(country for country in catalog if country['code'] == 'USA')['regionIds']), 56)
        self.assertEqual(len(next(country for country in catalog if country['code'] == 'CAN')['regionIds']), 13)

    def test_cached_world_archives_must_match_the_pinned_snapshot(self):
        with tempfile.TemporaryDirectory() as temporary:
            cache = Path(temporary)
            (cache / 'ne_10m_admin_0_countries.zip').write_bytes(b'wrong source')
            with self.assertRaisesRegex(ValueError, 'pinned source'):
                world.download('country', cache)

    def test_wrong_country_metadata_cannot_replace_a_region_file(self):
        publication = json.loads((PUBLIC / 'regions/CAN.json').read_text(encoding='utf-8'))
        publication['metadata']['countryCode'] = 'AUS'
        with self.assertRaisesRegex(ValueError, 'wrong country'):
            world.validate_artifact('regions/CAN.json', publication)

    def test_equatorial_component_bound_does_not_underestimate_the_longitude_scale(self):
        component = Polygon([(-1, -10), (1, -10), (1, 10), (-1, 10)])
        self.assertEqual(world.geometry.component_radius_bound(component), 111700)

    def test_adaptive_tolerance_resolves_a_tiny_jurisdiction(self):
        _, inverse = world.geometry.projection_at(12, 42)
        square = world.geometry.transform(inverse.transform, Polygon([(-20, -20), (20, -20), (20, 20), (-20, 20)]))
        result = world.geometry.solve_geometry(square, search_tolerance=0.01, simplification=0.001)
        self.assertAlmostEqual(result[2], 20, delta=0.02)
        self.assertAlmostEqual(world.mapped_area(square), 0.0016, delta=0.000001)

    def test_publication_writer_rejects_paths_outside_its_directory(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'world'
            with self.assertRaisesRegex(ValueError, 'inside the output'):
                world.geometry.write_publication(output, {'../escaped.json': {}}, validate=lambda *_: None)
            self.assertFalse((output.parent / 'escaped.json').exists())


if __name__ == '__main__':
    unittest.main()
