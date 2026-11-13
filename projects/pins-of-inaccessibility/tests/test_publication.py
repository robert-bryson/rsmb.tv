"""Check publication integrity, precision reduction, and interrupted writes."""

import importlib.util
from copy import deepcopy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from shapely.geometry import shape

SPEC = importlib.util.spec_from_file_location("pins_publication", Path(__file__).resolve().parents[1] / "generate.py")
generator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(generator)
PUBLIC = generator.ROOT / "public/data/pins-of-inaccessibility"


class PublishedArtifactsTests(unittest.TestCase):
    def test_invalid_pin_coordinates_and_jurisdiction_codes_are_rejected(self):
        published = json.loads((PUBLIC / "pins.json").read_text(encoding="utf-8"))
        national = next(index for index, pin in enumerate(published["pins"]) if pin["level"] == "country")
        state = next(index for index, pin in enumerate(published["pins"]) if pin["level"] == "state")
        for index, changed in [
            (national, {"lng": float("nan")}),
            (national, {"nearestBoundary": [0, 95]}),
            (national, {"boundaryContacts": [{"coordinates": [float("nan"), 0], "bearingDegrees": 0, "distanceMeters": 1}]}),
            (state, {"fips": "010", "id": "state-010"}),
        ]:
            with self.subTest(changed=changed):
                publication = deepcopy(published)
                publication["pins"][index].update(changed)
                with self.assertRaises(ValueError):
                    generator.validate_artifact("pins.json", publication)

    def test_every_published_artifact_has_complete_coverage_and_valid_geometry(self):
        for name in ["pins.json", "states.geojson", "counties.geojson"]:
            with self.subTest(artifact=name):
                generator.validate_artifact(name, json.loads((PUBLIC / name).read_text(encoding="utf-8")))

    def test_narrow_enclave_survives_display_precision_reduction(self):
        # This small fixture reproduces the precision failure found in Weld County.
        geometry = shape({"type": "Polygon", "coordinates": [
            [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
            [[0.0000001, 0.4], [0.0000001, 0.6], [0.2, 0.6], [0.2, 0.4], [0.0000001, 0.4]],
        ]})
        displayed = shape(generator.display_geometry(geometry))
        self.assertTrue(displayed.is_valid)
        self.assertFalse(displayed.is_empty)

    def test_cached_archives_must_match_the_pinned_source(self):
        with tempfile.TemporaryDirectory() as temporary:
            cache = Path(temporary)
            (cache / "tl_2025_us_state.zip").write_bytes(b"wrong source")
            with self.assertRaisesRegex(ValueError, "pinned SHA-256"):
                generator.download("state", cache)


class PublicationWriteTests(unittest.TestCase):
    def test_nonfinite_values_cannot_replace_a_json_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / "pins.json"
            destination.write_text("previous", encoding="utf-8")
            with self.assertRaises(ValueError):
                generator.write_json(destination, {"radius": float("nan")})
            self.assertEqual(destination.read_text(), "previous")
            self.assertEqual(list(destination.parent.glob("*.tmp")), [])

    def test_validation_failure_does_not_replace_any_published_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "publication"
            output.mkdir()
            destination = output / "pins.json"
            destination.write_text("previous", encoding="utf-8")
            with self.assertRaises((KeyError, ValueError)):
                generator.write_publication(output, {"pins.json": {"metadata": {}, "pins": []}})
            self.assertEqual(destination.read_text(), "previous")
            self.assertFalse(output.parent.joinpath(".publication.lock").exists())

    def test_an_existing_lock_is_not_removed_by_another_writer(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "publication"
            lock = output.parent / ".publication.lock"
            lock.write_text("another process", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "publication lock"):
                generator.write_publication(output, {})
            self.assertEqual(lock.read_text(), "another process")

    def test_failure_on_second_replacement_restores_both_originals(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "publication"
            output.mkdir()
            artifacts = {"states.geojson": {"value": "new states"}, "counties.geojson": {"value": "new counties"}}
            for name in artifacts:
                (output / name).write_text(f"old {name}", encoding="utf-8")
            real_replace = generator.os.replace
            failed = False

            def replace(source, destination):
                nonlocal failed
                if Path(destination) == output / "counties.geojson" and not failed:
                    failed = True
                    raise OSError("simulated interrupted publication")
                return real_replace(source, destination)

            with patch.object(generator, "validate_artifact"), patch.object(generator.os, "replace", side_effect=replace):
                with self.assertRaisesRegex(OSError, "interrupted publication"):
                    generator.write_publication(output, artifacts)
            for name in artifacts:
                self.assertEqual((output / name).read_text(), f"old {name}")
            self.assertFalse((output.parent / ".publication.lock").exists())
            self.assertEqual(list(output.parent.glob(".pins-publish-*")), [])


if __name__ == "__main__":
    unittest.main()
