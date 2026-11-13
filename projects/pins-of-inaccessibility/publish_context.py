#!/usr/bin/env python3
"""Validate pin context and publish a release to the existing data CDN (opt-in)."""

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

from context_contract import validate_manifest, validate_record
from enrich import ROOT, CONTEXT_OUTPUT, digest, encoded, load_pins, scope_file

PREFIX = "maps/pins/context"


def verify(directory, pin_root):
    manifest = json.loads((directory / "manifest-v1.json").read_text())
    validate_manifest(manifest)
    release = manifest["release"]
    if digest(encoded({"files": manifest["files"], "sources": manifest["sources"]})) != release:
        raise ValueError("Release hash does not match the manifest")
    expected = {pin["id"]: pin for pin in load_pins(pin_root)}
    seen, elevation_count = set(), 0
    for name, info in manifest["files"].items():
        data = (directory / "releases" / release / name).read_bytes()
        if digest(data) != info["sha256"] or len(data) != info["bytes"]:
            raise ValueError(f"Context checksum mismatch: {name}")
        payload = json.loads(data)
        if (not isinstance(payload, dict) or type(payload.get("schemaVersion")) is not int
                or payload["schemaVersion"] != 1 or payload.get("scope") != name
                or not isinstance(payload.get("pins"), list) or len(payload["pins"]) != info["count"]):
            raise ValueError(f"Context scope/count mismatch: {name}")
        for details in payload["pins"]:
            if not isinstance(details, dict) or not isinstance(details.get("id"), str):
                raise ValueError(f"Invalid context pin identity: {name}")
            pin = expected.get(details["id"])
            if not pin or details["id"] in seen or scope_file(pin) != name:
                raise ValueError(f"Context pin identity/coordinate mismatch: {details['id']}")
            validate_record(details, pin)
            seen.add(details["id"])
            elevation_count += details["elevationMeters"] is not None
    if seen != set(expected) or manifest["coverage"] != {"pins": len(expected), "elevations": elevation_count, "places": len(expected)}:
        raise ValueError("Context does not cover every current pin exactly once")
    return manifest


def publish(args):
    manifest = verify(args.directory, args.pins)
    release = manifest["release"]
    total = sum(info["bytes"] for info in manifest["files"].values())
    destination = f"s3://{args.bucket}/{PREFIX}"
    print(f"Verified {manifest['coverage']['pins']} pins; {len(manifest['files'])} files, {total:,} bytes.")
    print(f"Release: {destination}/releases/{release}/")
    print(f"Publish manifest LAST: {destination}/manifest-v1.json")
    if not args.publish:
        print("Dry run. Pass --publish to upload; old releases are retained.")
        return
    aws = ["aws", *(["--profile", args.profile] if args.profile else [])]

    def run(arguments, capture=False):
        return subprocess.run([*aws, *arguments], check=True, text=True, capture_output=capture)

    # Upload one verified snapshot, including its manifest, even if a builder
    # finishes another release while the network operations are in progress.
    with tempfile.TemporaryDirectory(prefix="pins-context-upload-") as temporary:
        staging = Path(temporary)
        release_directory = staging / "releases" / release
        (staging / "manifest-v1.json").write_bytes(encoded(manifest))
        for name in manifest["files"]:
            target = release_directory / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(args.directory / "releases" / release / name, target)
        verify(staging, args.pins)
        run(["s3", "cp", str(release_directory), f"{destination}/releases/{release}/", "--recursive", "--only-show-errors", "--no-progress",
             "--content-type", "application/json", "--cache-control", "public,max-age=31536000,immutable", "--checksum-algorithm", "SHA256"])
        listing = json.loads(run(["s3api", "list-objects-v2", "--bucket", args.bucket, "--prefix", f"{PREFIX}/releases/{release}/", "--output", "json"], True).stdout)
        actual = {item["Key"].removeprefix(f"{PREFIX}/releases/{release}/"): item["Size"] for item in listing.get("Contents", [])}
        if actual != {name: info["bytes"] for name, info in manifest["files"].items()}:
            raise ValueError("Uploaded release inventory differs; current manifest was not changed")
        run(["s3", "cp", str(staging / "manifest-v1.json"), f"{destination}/manifest-v1.json", "--only-show-errors", "--no-progress",
             "--content-type", "application/json", "--cache-control", "public,max-age=300", "--checksum-algorithm", "SHA256"])
    print("Published. CDN: https://data.rsmb.tv/maps/pins/context/manifest-v1.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=CONTEXT_OUTPUT)
    parser.add_argument("--pins", type=Path, default=ROOT / "public/data/pins-of-inaccessibility")
    parser.add_argument("--bucket", default="rsmbtv-temperature-data")
    parser.add_argument("--profile", default=None)
    parser.add_argument("--publish", action="store_true")
    publish(parser.parse_args())
