"""Validate context with the same field limits used by shared/pinDetails.ts."""

import re

from generate import GEOD, validate_name, validate_number, validate_position, validate_timestamp

SCOPE_PATTERN = re.compile(r"(countries|regions/[A-Z]{3}|counties/\d{2})\.json", re.ASCII)
HASH_PATTERN = re.compile(r"[a-f0-9]{64}", re.ASCII)
ELEVATION_DATASETS = ("srtm30m", "aster30m")
MAX_PINS = 100_000
MAX_FILE_BYTES = 10_000_000


def validate_count(value, name, minimum=1, maximum=MAX_PINS):
    validate_number(value, name, minimum=minimum, maximum=maximum)
    if not isinstance(value, int):
        raise ValueError(f"Invalid {name}")


def validate_elevation(sample):
    if not isinstance(sample, dict) or not {"elevationMeters", "elevationDataset"} <= sample.keys():
        raise ValueError("Missing elevation fields")
    value, dataset = sample["elevationMeters"], sample["elevationDataset"]
    if value is None:
        if dataset is not None:
            raise ValueError("Missing elevation must not claim a dataset")
    else:
        validate_number(value, "terrain elevation", minimum=-500, maximum=9000)
        if dataset not in ELEVATION_DATASETS:
            raise ValueError("Invalid elevation dataset")


def validate_manifest(manifest):
    if not isinstance(manifest, dict) or type(manifest.get("schemaVersion")) is not int or manifest["schemaVersion"] != 1:
        raise ValueError("Invalid context manifest version")
    if not isinstance(manifest.get("release"), str) or not HASH_PATTERN.fullmatch(manifest["release"]):
        raise ValueError("Invalid context release")
    validate_timestamp(manifest.get("generatedAt"))
    if not isinstance(manifest.get("sources"), dict) or not isinstance(manifest.get("files"), dict):
        raise ValueError("Invalid context inventory or sources")
    for name, info in manifest["files"].items():
        if not SCOPE_PATTERN.fullmatch(name):
            raise ValueError("Unsafe context file path")
        if not isinstance(info, dict) or not isinstance(info.get("sha256"), str) or not HASH_PATTERN.fullmatch(info["sha256"]):
            raise ValueError("Invalid context file checksum")
        validate_count(info.get("bytes"), "context file size", maximum=MAX_FILE_BYTES)
        validate_count(info.get("count"), "context file count")
    coverage = manifest.get("coverage")
    if not isinstance(coverage, dict):
        raise ValueError("Missing context coverage")
    for field in ["pins", "places", "elevations"]:
        validate_count(coverage.get(field), f"{field} coverage", minimum=0 if field == "elevations" else 1)
    if (sum(info["count"] for info in manifest["files"].values()) != coverage["pins"]
            or coverage["places"] != coverage["pins"] or coverage["elevations"] > coverage["pins"]):
        raise ValueError("Incomplete context coverage")


def validate_record(details, pin):
    if not isinstance(details, dict):
        raise ValueError("Invalid context record")
    validate_position([details.get("lng"), details.get("lat")])
    if details.get("id") != pin["id"] or any(abs(pin[key] - details[key]) > 1e-7 for key in ["lat", "lng"]):
        raise ValueError(f"Context pin identity/coordinate mismatch: {details.get('id')}")
    validate_elevation(details)
    place = details.get("nearestPlace")
    if not isinstance(place, dict):
        raise ValueError("Missing nearby place")
    validate_count(place.get("geonameId"), "GeoNames ID", maximum=9_007_199_254_740_991)
    validate_name(place.get("name"), "place name")
    validate_name(place.get("countryName"), "place country name")
    if place.get("admin1Name") != "":
        validate_name(place.get("admin1Name"), "place region name")
    if not isinstance(place.get("countryCode"), str) or not re.fullmatch(r"[A-Z]{2}", place["countryCode"], re.ASCII):
        raise ValueError("Invalid place country code")
    validate_position([place.get("lng"), place.get("lat")])
    validate_number(place.get("distanceMeters"), "place distance", maximum=21_000_000)
    validate_number(place.get("bearingDegrees"), "place bearing", maximum=360)
    bearing, _, distance = GEOD.inv(place["lng"], place["lat"], pin["lng"], pin["lat"])
    if abs(distance - place["distanceMeters"]) > 0.11 or abs((bearing - place["bearingDegrees"] + 180) % 360 - 180) > 0.011:
        raise ValueError("Nearby-place distance/bearing mismatch")
