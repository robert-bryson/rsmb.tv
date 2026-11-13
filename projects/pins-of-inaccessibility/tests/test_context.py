"""Verify exact nearest-place searches and coordinate-safe terrain enrichment."""

from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
from threading import Barrier
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import enrich
import publish_context


class ContextTests(unittest.TestCase):
    def test_concurrent_json_checkpoints_remain_complete_and_use_distinct_temporary_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "checkpoint.json"
            payloads = [{"writer": index, "name": "Montréal", "samples": [index] * 500} for index in range(2)]
            ready = Barrier(2)
            replace = os.replace

            def synchronized_replace(source, destination):
                ready.wait(timeout=5)
                return replace(source, destination)

            with patch("generate.os.replace", side_effect=synchronized_replace), ThreadPoolExecutor(max_workers=2) as executor:
                futures = [executor.submit(enrich.save, target, payload) for payload in payloads]
                for future in futures:
                    future.result(timeout=10)
            result = json.loads(target.read_text())
            self.assertIn(result, payloads)
            self.assertEqual(target.read_bytes(), enrich.encoded(result))
            self.assertEqual(list(target.parent.glob("*.tmp")), [])

    def test_nearest_places_match_exhaustive_geodesic_search_including_poles_and_dateline(self):
        rng = np.random.default_rng(821)
        places = [{"geonameId": index + 1, "lat": float(lat), "lng": float(lng)}
                  for index, (lat, lng) in enumerate(zip(rng.uniform(-89, 89, 900), rng.uniform(-180, 180, 900)))]
        places.extend([{"geonameId": 901, "lat": 10, "lng": -179.99}, {"geonameId": 902, "lat": 89, "lng": 90}])
        pins = [{"id": str(index), "lat": float(lat), "lng": float(lng)}
                for index, (lat, lng) in enumerate(zip(rng.uniform(-89, 89, 130), rng.uniform(-180, 180, 130)))]
        pins.extend([{"id": "dateline", "lat": 10, "lng": 179.99}, {"id": "polar", "lat": 89.1, "lng": 90}])
        results = enrich.nearest_places(pins, places)
        for pin in pins:
            expected = min(places, key=lambda place: enrich.GEOD.inv(pin["lng"], pin["lat"], place["lng"], place["lat"])[2])
            self.assertEqual(results[pin["id"]]["geonameId"], expected["geonameId"])
        self.assertEqual(results["dateline"]["geonameId"], 901)

    def test_elevation_requires_matching_coordinates_and_retains_zero_and_missing_samples(self):
        pins = [{"lat": 0, "lng": 179.9}, {"lat": 83.5, "lng": -20}]
        response = {"status": "OK", "results": [
            {"location": {"lat": 0, "lng": 179.9}, "elevation": 0, "dataset": "srtm30m"},
            {"location": {"lat": 83.5, "lng": -20}, "elevation": None, "dataset": "aster30m"},
        ]}
        samples = enrich.validate_elevations(response, pins)
        self.assertEqual(samples[enrich.coordinate_key(pins[0])]["elevationMeters"], 0)
        self.assertIsNone(samples[enrich.coordinate_key(pins[1])]["elevationMeters"])
        self.assertIsNone(samples[enrich.coordinate_key(pins[1])]["elevationDataset"])
        for field, value in [("location", {"lat": 1, "lng": 179.9}),
                             ("location", {"lat": float("nan"), "lng": 179.9}),
                             ("location", {"lat": False, "lng": 179.9}),
                             ("elevation", float("nan")), ("elevation", True), ("dataset", "mapzen")]:
            invalid = deepcopy(response)
            invalid["results"][0][field] = value
            with self.subTest(field=field, value=value):
                with self.assertRaises(ValueError):
                    enrich.validate_elevations(invalid, pins)
        invalid = deepcopy(response)
        del invalid["results"][0]["elevation"]
        with self.assertRaises(ValueError):
            enrich.validate_elevations(invalid, pins)
        with self.assertRaises(ValueError):
            enrich.validate_elevations({"status": "SERVER_ERROR"}, pins)

    def test_place_bearing_describes_pin_direction_from_place(self):
        pin = {"id": "pin", "lat": 0, "lng": -179.99}
        place = {"geonameId": 1, "lat": 0, "lng": 179.99}
        result = enrich.nearest_places([pin], [place])["pin"]
        self.assertEqual(result["bearingDegrees"], 90)
        self.assertAlmostEqual(result["distanceMeters"], 2226.4, delta=0.1)

    def test_terrain_checkpoints_resume_and_missing_samples_are_only_retried_on_request(self):
        pin = {"lat": 0, "lng": 0}
        with tempfile.TemporaryDirectory() as temporary:
            cache = Path(temporary)
            payload = {"status": "OK", "results": [{"location": pin, "elevation": None, "dataset": "aster30m"}]}
            with patch("enrich.fetch", return_value=enrich.encoded(payload)) as fetch, patch("enrich.time.sleep"):
                samples = enrich.elevations([pin, pin], cache)
                self.assertIsNone(samples[enrich.coordinate_key(pin)]["elevationMeters"])
                self.assertEqual(fetch.call_count, 1)
                enrich.elevations([pin], cache)
                self.assertEqual(fetch.call_count, 1)
                payload["results"][0].update(elevation=0, dataset="srtm30m")
                fetch.return_value = enrich.encoded(payload)
                samples = enrich.elevations([pin], cache, retry_missing=True)
                self.assertEqual(samples[enrich.coordinate_key(pin)]["elevationMeters"], 0)
                self.assertEqual(fetch.call_count, 2)
            stored = json.loads((cache / "elevations-v1.json").read_text())
            self.assertEqual(stored["samples"], samples)

    def test_invalid_cached_terrain_is_rejected_before_network_access(self):
        pin = {"lat": 0, "lng": 0}
        with tempfile.TemporaryDirectory() as temporary:
            cache = Path(temporary)
            enrich.save(cache / "elevations-v1.json", {"api": enrich.ELEVATION_API, "samples": {
                enrich.coordinate_key(pin): {"elevationMeters": True, "elevationDataset": "srtm30m"}}})
            with patch("enrich.fetch") as fetch:
                with self.assertRaisesRegex(ValueError, "terrain elevation"):
                    enrich.elevations([pin], cache)
                fetch.assert_not_called()

class ContextPublicationTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.pin_root, self.output = self.root / "pins", self.root / "output"
        self.pin = {"id": "country-US", "level": "country", "lat": 0, "lng": 0}
        loader = patch("publish_context.load_pins", return_value=[self.pin])
        loader.start()
        self.addCleanup(loader.stop)
        self.details = {"id": self.pin["id"], "lat": 0, "lng": 0, "elevationMeters": 0, "elevationDataset": "srtm30m",
                        "nearestPlace": {"geonameId": 1, "name": "Test place", "admin1Name": "", "countryCode": "US",
                                         "countryName": "United States", "lat": 0, "lng": 0, "distanceMeters": 0, "bearingDegrees": 180}}
        self.args = SimpleNamespace(directory=self.output, pins=self.pin_root, bucket="fixture-bucket", profile=None, publish=True)

    def write_context(self, details=None, info_changes=None, manifest_changes=None):
        payload = {"schemaVersion": 1, "scope": "countries.json", "pins": [self.details if details is None else details]}
        # Retain invalid JSON constants here so the verifier must reject them.
        data = json.dumps(payload).encode("utf-8")
        inventory = {"countries.json": {"sha256": enrich.digest(data), "bytes": len(data), "count": 1, **(info_changes or {})}}
        manifest = {"schemaVersion": 1, "generatedAt": "2026-11-13T12:00:00Z", "files": inventory, "sources": {},
                    "coverage": {"pins": 1, "elevations": 1, "places": 1}, **(manifest_changes or {})}
        manifest["release"] = enrich.digest(enrich.encoded({"files": inventory, "sources": manifest["sources"]}))
        path = self.output / "releases" / manifest["release"] / "countries.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        enrich.save(self.output / "manifest-v1.json", manifest)
        return manifest, path

    def test_publisher_rejects_tampering_or_stale_context_before_any_upload(self):
        _, path = self.write_context()
        self.assertEqual(publish_context.verify(self.output, self.pin_root)["coverage"]["elevations"], 1)
        path.write_bytes(path.read_bytes() + b" ")
        with patch("publish_context.subprocess.run") as aws:
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                publish_context.publish(self.args)
            self.write_context({**self.details, "lat": 1})
            with self.assertRaisesRegex(ValueError, "coordinate mismatch"):
                publish_context.publish(self.args)
            self.write_context({**self.details, "nearestPlace": {**self.details["nearestPlace"], "distanceMeters": 500}})
            with self.assertRaisesRegex(ValueError, "distance/bearing mismatch"):
                publish_context.publish(self.args)
            aws.assert_not_called()

    def test_publication_requires_the_complete_browser_record_contract(self):
        mutations = [
            {"lat": float("nan")}, {"lng": True}, {"elevationMeters": True},
            {"nearestPlace": {key: value for key, value in self.details["nearestPlace"].items() if key != "geonameId"}},
            *[{"nearestPlace": {**self.details["nearestPlace"], field: value}} for field, value in [
                ("geonameId", True), ("geonameId", 0), ("geonameId", 1.5),
                ("name", " "), ("name", "x" * 201), ("admin1Name", None), ("countryName", ""),
                ("countryCode", "USA"), ("countryCode", "us"), ("lat", 360),
                ("distanceMeters", True), ("bearingDegrees", -180), ("bearingDegrees", 540),
            ]],
        ]
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                self.write_context({**self.details, **mutation})
                with patch("publish_context.subprocess.run") as aws:
                    with self.assertRaises(ValueError):
                        publish_context.publish(self.args)
                    aws.assert_not_called()

    def test_publication_requires_the_complete_browser_manifest_contract(self):
        for mutation in [{"schemaVersion": True}, {"generatedAt": None}, {"generatedAt": "yesterday"},
                         {"coverage": {"pins": True, "elevations": True, "places": True}}]:
            with self.subTest(mutation=mutation):
                self.write_context(manifest_changes=mutation)
                with self.assertRaises(ValueError):
                    publish_context.verify(self.output, self.pin_root)
        for field, value in [("count", True), ("bytes", True), ("bytes", 10_000_001)]:
            with self.subTest(field=field, value=value):
                self.write_context(info_changes={field: value})
                with self.assertRaises(ValueError):
                    publish_context.verify(self.output, self.pin_root)

    def test_dry_run_does_not_upload(self):
        self.write_context()
        self.args.publish = False
        with patch("publish_context.subprocess.run") as aws:
            publish_context.publish(self.args)
            aws.assert_not_called()

    def test_uploaded_manifest_comes_from_the_verified_snapshot(self):
        manifest, _ = self.write_context()
        uploaded = []

        def run(command, **_):
            if "list-objects-v2" in command:
                return SimpleNamespace(stdout=json.dumps({"Contents": [
                    {"Key": f"{publish_context.PREFIX}/releases/{manifest['release']}/{name}", "Size": info["bytes"]}
                    for name, info in manifest["files"].items()]}))
            if "--recursive" in command:
                # A concurrent builder finishes while the release upload is in progress.
                enrich.save(self.output / "manifest-v1.json", {**manifest, "release": "f" * 64})
            else:
                uploaded.append(json.loads(Path(command[3]).read_text(encoding="utf-8")))
            return SimpleNamespace(stdout="")

        with patch("publish_context.subprocess.run", side_effect=run):
            publish_context.publish(self.args)
        self.assertEqual(uploaded, [manifest])

    def test_changed_release_cannot_be_uploaded_after_verification(self):
        _, path = self.write_context()
        copyfile = publish_context.shutil.copyfile

        def copy_changed(source, destination):
            if Path(source) == path:
                path.write_bytes(b"{}")
            return copyfile(source, destination)

        with patch("publish_context.shutil.copyfile", side_effect=copy_changed), patch("publish_context.subprocess.run") as aws:
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                publish_context.publish(self.args)
            aws.assert_not_called()

    def test_remote_inventory_failure_does_not_advance_the_manifest(self):
        self.write_context()
        with patch("publish_context.subprocess.run", return_value=SimpleNamespace(stdout='{"Contents":[]}')) as aws:
            with self.assertRaisesRegex(ValueError, "inventory differs"):
                publish_context.publish(self.args)
            self.assertEqual(aws.call_count, 2)
            self.assertIn("--recursive", aws.call_args_list[0].args[0])

    def test_build_checks_records_before_replacing_the_current_manifest(self):
        previous, _ = self.write_context()
        args = SimpleNamespace(pins=self.pin_root, cache=self.root / "cache", output=self.output,
                               refresh_sources=False, retry_missing=False)
        with patch("enrich.load_pins", return_value=[self.pin]), \
                patch("enrich.load_places", return_value=([self.details["nearestPlace"]], {})), \
                patch("enrich.elevations", return_value={enrich.coordinate_key(self.pin): {
                    "elevationMeters": 0, "elevationDataset": "srtm30m"}}), \
                patch("enrich.nearest_places", return_value={self.pin["id"]: {**self.details["nearestPlace"], "name": ""}}) as nearest:
            with self.assertRaisesRegex(ValueError, "place name"):
                enrich.build(args)
            self.assertEqual(json.loads((self.output / "manifest-v1.json").read_text()), previous)
            nearest.return_value = {self.pin["id"]: self.details["nearestPlace"]}
            enrich.build(args)
        manifest = publish_context.verify(self.output, self.pin_root)
        self.assertEqual(manifest["coverage"], previous["coverage"])
        self.assertEqual(json.loads((self.output / "releases" / manifest["release"] / "manifest-v1.json").read_text()), manifest)


class PinInventoryTests(unittest.TestCase):
    def test_inventory_has_every_current_pin_and_rejects_a_missing_region_file(self):
        source = enrich.ROOT / "public/data/pins-of-inaccessibility"
        self.assertEqual(len(enrich.load_pins(source)), 8091)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "world/regions").mkdir(parents=True)
            shutil.copyfile(source / "pins.json", root / "pins.json")
            shutil.copyfile(source / "world/pins.json", root / "world/pins.json")
            with self.assertRaises(FileNotFoundError):
                enrich.load_pins(root)


if __name__ == "__main__":
    unittest.main()
