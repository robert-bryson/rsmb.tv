"""Check the solver against shapes with independently known inscribed radii."""

import importlib.util
import math
from pathlib import Path
import unittest

from shapely.geometry import MultiPolygon, Polygon
from shapely import transform

SPEC = importlib.util.spec_from_file_location("pins_generator", Path(__file__).resolve().parents[1] / "generate.py")
generator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(generator)


def geographic(polygon, lng=-100, lat=35):
    _, inverse = generator.projection_at(lng, lat)
    return transform(polygon, inverse.transform, interleaved=False)


class GeometryTests(unittest.TestCase):
    def test_source_verification_rejects_shifted_pins_radii_and_contacts(self):
        geometry = geographic(Polygon([(-5000, -5000), (5000, -5000), (5000, 5000), (-5000, 5000)]))
        lng, lat, radius, edge_lng, edge_lat = generator.solve_geometry(geometry)
        pin = {"id": "square", "lng": lng, "lat": lat, "radiusMeters": radius, "nearestBoundary": [edge_lng, edge_lat]}
        pin["boundaryContacts"] = generator.boundary_contacts(geometry, pin)
        self.assertLess(max(generator.verify_source_pin(pin, geometry)), 1)
        for changed in [{"lng": 0}, {"radiusMeters": radius + 100}, {"boundaryContacts": [{"coordinates": [0, 0]}]}]:
            with self.subTest(changed=changed):
                with self.assertRaises(ValueError):
                    generator.verify_source_pin({**pin, **changed}, geometry)

    def test_square_has_four_distinct_boundary_contacts(self):
        geometry = geographic(Polygon([(-5000, -5000), (5000, -5000), (5000, 5000), (-5000, 5000)]))
        lng, lat, radius, edge_lng, edge_lat = generator.solve_geometry(geometry)
        pin = {"id": "square", "lng": lng, "lat": lat, "radiusMeters": radius, "nearestBoundary": [edge_lng, edge_lat]}
        contacts = generator.boundary_contacts(geometry, pin)
        self.assertEqual(len(contacts), 4)
        self.assertEqual(len({round(contact["bearingDegrees"] / 90) % 4 for contact in contacts}), 4)
        for contact in contacts:
            self.assertAlmostEqual(contact["distanceMeters"], 5000, delta=2)

    def test_rectangle_contacts_exclude_distant_sides(self):
        geometry = geographic(Polygon([(-15000, -5000), (15000, -5000), (15000, 5000), (-15000, 5000)]))
        _, inverse = generator.projection_at(-100, 35)
        pin = {"id": "rectangle", "lng": -100, "lat": 35, "radiusMeters": 5000, "nearestBoundary": list(inverse.transform(0, 5000))}
        contacts = generator.boundary_contacts(geometry, pin)
        self.assertEqual(len(contacts), 2)
        self.assertTrue(all(abs(contact["bearingDegrees"]) < 1 or abs(contact["bearingDegrees"]) > 179 for contact in contacts))

    def test_national_union_removes_shared_state_borders(self):
        left = geographic(Polygon([(-10000, -10000), (0, -10000), (0, 10000), (-10000, 10000)]))
        right = geographic(Polygon([(0, -10000), (10000, -10000), (10000, 10000), (0, 10000)]))
        national = generator.dissolve_jurisdictions([left, right])
        lng, lat, radius, _, _ = generator.solve_geometry(national)
        self.assertAlmostEqual(radius, 10000, delta=40)
        self.assertLess(generator.GEOD.inv(-100, 35, lng, lat)[2], 60)
        self.assertAlmostEqual(generator.solve_geometry(left)[2], 5000, delta=40)

    def test_square_radius_is_half_its_side(self):
        geometry = geographic(Polygon([(-5000, -5000), (5000, -5000), (5000, 5000), (-5000, 5000)]))
        lng, lat, radius, edge_lng, edge_lat = generator.solve_geometry(geometry)
        self.assertAlmostEqual(radius, 5000, delta=30)
        self.assertLess(generator.GEOD.inv(-100, 35, lng, lat)[2], 40)
        self.assertAlmostEqual(generator.GEOD.inv(lng, lat, edge_lng, edge_lat)[2], radius, delta=0.01)

    def test_an_administrative_enclave_counts_as_a_boundary(self):
        outer = [(-10000, -10000), (10000, -10000), (10000, 10000), (-10000, 10000)]
        hole = [(-1000, -1000), (-1000, 1000), (1000, 1000), (1000, -1000)]
        result = generator.solve_geometry(geographic(Polygon(outer, [hole])))
        expected = 9000 * math.sqrt(2) / (1 + math.sqrt(2))
        self.assertAlmostEqual(result[2], expected, delta=50)

    def test_disconnected_parts_choose_the_largest_circle(self):
        small = geographic(Polygon([(-1000, -1000), (1000, -1000), (1000, 1000), (-1000, 1000)]), -103)
        large = geographic(Polygon([(-6000, -6000), (6000, -6000), (6000, 6000), (-6000, 6000)]), -100)
        lng, _, radius, _, _ = generator.solve_geometry(MultiPolygon([small, large]))
        self.assertAlmostEqual(lng, -100, delta=0.001)
        self.assertAlmostEqual(radius, 6000, delta=40)

    def test_date_line_does_not_turn_an_island_into_a_world_spanning_shape(self):
        geometry = geographic(Polygon([(-8000, -8000), (8000, -8000), (8000, 8000), (-8000, 8000)]), 179.99, 52)
        lng, lat, radius, _, _ = generator.solve_geometry(geometry)
        self.assertLess(generator.GEOD.inv(179.99, 52, lng, lat)[2], 60)
        self.assertAlmostEqual(radius, 8000, delta=40)
        west, _, east, _ = generator.wrapped_bounds(geometry)
        self.assertLess(east - west, 1)
        display = generator.display_geometry(geometry)
        for polygon in display["coordinates"]:
            for ring in polygon:
                self.assertTrue(all(abs(ring[index][0] - ring[index - 1][0]) < 180 for index in range(1, len(ring))))

    def test_display_geometry_keeps_enclaves(self):
        geometry = geographic(Polygon([(-10000, -10000), (10000, -10000), (10000, 10000), (-10000, 10000)],
                                     [[(-1000, -1000), (-1000, 1000), (1000, 1000), (1000, -1000)]]))
        display = generator.display_geometry(geometry)
        self.assertEqual(len(display["coordinates"][0]), 2)


if __name__ == "__main__":
    unittest.main()
