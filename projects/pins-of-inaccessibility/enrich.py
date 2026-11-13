#!/usr/bin/env python3
"""Build small, independently published pin context files, without changing poles."""

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

import certifi
import numpy as np
from context_contract import ELEVATION_DATASETS, GEOD, validate_elevation, validate_manifest, validate_record
from generate import validate_artifact as validate_us_artifact, validate_position, write_json
from generate_world import CATALOG_PATH, validate_artifact as validate_world_artifact

ROOT = Path(__file__).resolve().parents[2]
CONTEXT_OUTPUT = ROOT / ".cache/pins-of-inaccessibility/context/publication"
GEONAMES = "https://download.geonames.org/export/dump/"
ELEVATION_API = f"https://api.opentopodata.org/v1/{','.join(ELEVATION_DATASETS)}"
# The minimum radius of curvature of WGS84 bounds geodesic distance below.
MIN_EARTH_RADIUS = 6335439.0


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def save(path, value):
    write_json(path, value, sort_keys=True)


def now():
    return datetime.now(timezone.utc).isoformat()


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "rsmb.tv pin-context/1.0"})
    with urllib.request.urlopen(request, timeout=180, context=ssl.create_default_context(cafile=certifi.where())) as response:
        return response.read()


def load_places(cache, refresh=False):
    provenance = {}
    for filename in ["cities500.zip", "admin1CodesASCII.txt", "countryInfo.txt"]:
        path = cache / filename
        if refresh or not path.exists():
            print(f"Downloading GeoNames {filename}", flush=True)
            data = fetch(GEONAMES + filename)
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(path.suffix + ".tmp")
            temporary.write_bytes(data)
            temporary.replace(path)
        provenance[filename] = {"url": GEONAMES + filename, "sha256": digest(path.read_bytes())}
    admins = {row[0]: row[1] for row in (line.split("\t") for line in (cache / "admin1CodesASCII.txt").read_text().splitlines()) if len(row) >= 2}
    countries = {row[0]: row[4] for row in (line.split("\t") for line in (cache / "countryInfo.txt").read_text().splitlines() if not line.startswith("#")) if len(row) >= 5}
    places = []
    with zipfile.ZipFile(cache / "cities500.zip") as archive:
        for line in archive.read("cities500.txt").decode("utf-8").splitlines():
            row = line.split("\t")
            if len(row) != 19 or row[6] != "P":
                raise ValueError("Unexpected GeoNames cities500 record")
            places.append({"geonameId": int(row[0]), "name": row[1], "lat": float(row[4]), "lng": float(row[5]),
                           "admin1Name": admins.get(f"{row[8]}.{row[10]}", ""), "countryCode": row[8],
                           "countryName": countries.get(row[8], row[8])})
    if len(places) < 100_000:
        raise ValueError("GeoNames place catalog is unexpectedly small")
    return places, provenance


def unit_vectors(points):
    lat = np.radians([point["lat"] for point in points])
    lng = np.radians([point["lng"] for point in points])
    return np.column_stack((np.cos(lat) * np.cos(lng), np.cos(lat) * np.sin(lng), np.sin(lat)))


def nearest_places(pins, places):
    """Find the nearest catalog place by exact WGS84 distance, including borders."""
    vectors = unit_vectors(places)
    place_lng = np.array([place["lng"] for place in places])
    place_lat = np.array([place["lat"] for place in places])
    nearest = {}
    for offset in range(0, len(pins), 64):
        batch = pins[offset:offset + 64]
        scores = unit_vectors(batch) @ vectors.T
        for pin, score in zip(batch, scores):
            initial = int(np.argmax(score))
            _, _, upper_bound = GEOD.inv(pin["lng"], pin["lat"], place_lng[initial], place_lat[initial])
            # Include every place capable of improving the initial geodesic distance.
            candidates = np.flatnonzero(score >= math.cos(min(math.pi, upper_bound / MIN_EARTH_RADIUS)) - 1e-12)
            bearings, _, distances = GEOD.inv(place_lng[candidates], place_lat[candidates],
                                              np.full(len(candidates), pin["lng"]), np.full(len(candidates), pin["lat"]))
            best = int(np.argmin(distances))
            nearest[pin["id"]] = {**places[int(candidates[best])], "distanceMeters": round(float(distances[best]), 1),
                                   "bearingDegrees": round(float(bearings[best]) % 360, 2)}
        if offset % 512 == 0:
            print(f"Nearest places: {min(offset + 64, len(pins))}/{len(pins)}", flush=True)
    return nearest


def coordinate_key(pin):
    return f"{pin['lat']:.8f},{pin['lng']:.8f}"


def validate_elevations(payload, batch):
    if (not isinstance(payload, dict) or payload.get("status") != "OK"
            or not isinstance(payload.get("results"), list) or len(payload["results"]) != len(batch)):
        raise ValueError("Invalid elevation response status or result count")
    output = {}
    for pin, result in zip(batch, payload["results"]):
        if not isinstance(result, dict) or not isinstance(result.get("location"), dict):
            raise ValueError("Missing elevation response coordinates")
        location, value = result.get("location", {}), result.get("elevation")
        validate_position([location.get("lng"), location.get("lat")])
        if abs(location.get("lat", 999) - pin["lat"]) > 1e-7 or abs(location.get("lng", 999) - pin["lng"]) > 1e-7:
            raise ValueError("Elevation response coordinates do not match the requested pin")
        dataset = result.get("dataset")
        if dataset not in ELEVATION_DATASETS or "elevation" not in result:
            raise ValueError("Unexpected elevation dataset")
        sample = {"elevationMeters": value, "elevationDataset": dataset if value is not None else None}
        validate_elevation(sample)
        output[coordinate_key(pin)] = sample
    return output


def elevations(pins, cache, retry_missing=False):
    path = cache / "elevations-v1.json"
    stored = json.loads(path.read_text()) if path.exists() else {"api": ELEVATION_API, "samples": {}}
    if stored["api"] != ELEVATION_API:
        raise ValueError("Elevation cache uses another dataset; use a new cache directory")
    for pin in pins:
        if coordinate_key(pin) in stored["samples"]:
            validate_elevation(stored["samples"][coordinate_key(pin)])
    pending = list({coordinate_key(pin): pin for pin in pins if coordinate_key(pin) not in stored["samples"]
                    or retry_missing and stored["samples"][coordinate_key(pin)]["elevationMeters"] is None}.values())
    last_request = 0
    for offset in range(0, len(pending), 100):
        batch = pending[offset:offset + 100]
        url = ELEVATION_API + "?" + urllib.parse.urlencode({"locations": "|".join(map(coordinate_key, batch)), "interpolation": "bilinear"})
        for attempt in range(4):
            time.sleep(max(0, 1.1 - (time.monotonic() - last_request)))
            last_request = time.monotonic()
            try:
                response = json.loads(fetch(url))
                values = validate_elevations(response, batch)
                break
            except urllib.error.HTTPError as error:
                if error.code == 429 or error.code < 500 or attempt == 3:
                    raise
                time.sleep(2 ** (attempt + 1))
            except (urllib.error.URLError, TimeoutError):
                if attempt == 3:
                    raise
                time.sleep(2 ** (attempt + 1))
        stored["samples"].update(values)
        stored["updatedAt"] = now()
        save(path, stored)
        print(f"Elevation: {min(offset + 100, len(pending))}/{len(pending)} uncached coordinates", flush=True)
    return stored["samples"]


def load_pins(root):
    pins = {}
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    # Enumerate required files from the pinned catalog. A glob silently accepts
    # an incomplete checkout and would then publish incomplete context coverage.
    paths = [root / "pins.json", root / "world/pins.json", *[
        root / "world/regions" / f"{country['code']}.json"
        for country in catalog["countries"] if country["code"] != "USA"]]
    for path in paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if path == root / "pins.json":
            validate_us_artifact("pins.json", payload)
        else:
            validate_world_artifact(path.relative_to(root / "world").as_posix(), payload, us_publication=root / "pins.json")
        for pin in payload["pins"]:
            previous = pins.get(pin["id"])
            if previous and previous != pin:
                raise ValueError(f"Conflicting source records for {pin['id']}")
            pins[pin["id"]] = pin
    return sorted(pins.values(), key=lambda pin: pin["id"])


def scope_file(pin):
    if pin["level"] == "country":
        return "countries.json"
    if pin["level"] == "county":
        return f"counties/{pin['stateFips']}.json"
    return f"regions/{pin.get('countryCode', 'USA')}.json"


def build(args):
    pins = load_pins(args.pins)
    places, place_sources = load_places(args.cache, args.refresh_sources)
    # Checkpoint the slower external sampling first; interrupted runs can resume.
    samples = elevations(pins, args.cache, args.retry_missing)
    nearest = nearest_places(pins, places)
    groups = defaultdict(list)
    for pin in pins:
        details = {"id": pin["id"], "lat": pin["lat"], "lng": pin["lng"],
                   **samples[coordinate_key(pin)], "nearestPlace": nearest[pin["id"]]}
        validate_record(details, pin)
        groups[scope_file(pin)].append(details)
    files = {name: encoded({"schemaVersion": 1, "scope": name, "pins": records}) for name, records in sorted(groups.items())}
    inventory = {name: {"sha256": digest(data), "bytes": len(data), "count": len(groups[name])} for name, data in files.items()}
    sources = {"places": {"name": "GeoNames cities500", "license": "CC BY 4.0", "catalogCount": len(places), "files": place_sources},
               "elevation": {"name": "NASA/USGS SRTM 30 m; NASA/METI ASTER GDEM v3 fallback", "api": ELEVATION_API,
                             "interpolation": "bilinear", "units": "meters above sea level"}}
    release = digest(encoded({"files": inventory, "sources": sources}))
    count = sum(samples[coordinate_key(pin)]["elevationMeters"] is not None for pin in pins)
    manifest = {"schemaVersion": 1, "release": release, "generatedAt": now(), "files": inventory, "sources": sources,
                "coverage": {"pins": len(pins), "elevations": count, "places": len(nearest)}}
    validate_manifest(manifest)
    for name, data in files.items():
        path = args.output / "releases" / release / name
        path.parent.mkdir(parents=True, exist_ok=True)
        save(path, json.loads(data))
    save(args.output / "releases" / release / "manifest-v1.json", manifest)
    save(args.output / "manifest-v1.json", manifest)
    print(f"Release {release}: {len(pins)} pins, {count} elevations, {len(nearest)} nearest places; {sum(map(len, files.values())):,} bytes in {len(files)} files", flush=True)
    print(f"Missing elevation: {', '.join(pin['id'] for pin in pins if samples[coordinate_key(pin)]['elevationMeters'] is None) or 'none'}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pins", type=Path, default=ROOT / "public/data/pins-of-inaccessibility")
    parser.add_argument("--cache", type=Path, default=ROOT / ".cache/pins-of-inaccessibility/context")
    parser.add_argument("--output", type=Path, default=CONTEXT_OUTPUT)
    parser.add_argument("--refresh-sources", action="store_true")
    parser.add_argument("--retry-missing", action="store_true")
    build(parser.parse_args())
