#!/usr/bin/env python3
"""Build approximate geodesic poles from the unabridged 2025 Census TIGER files."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import io
import json
import math
import os
from pathlib import Path
import platform
import re
import shutil
import tempfile
import urllib.request
import zipfile
from collections import Counter
from importlib.metadata import version

import numpy as np
from pyproj import CRS, Geod, Transformer
import shapefile
from shapely import geos_version_string, make_valid, maximum_inscribed_circle, segmentize, set_precision, transform as transform_coordinates
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, mapping, shape
from shapely.ops import nearest_points, split, unary_union


ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = json.loads((ROOT / "shared/geography/census2025.json").read_text(encoding="utf-8"))
SOURCES = SNAPSHOT["sourceUrls"]
VINTAGE = SNAPSHOT["vintage"]
COUNTY_COUNT = sum(SNAPSHOT["countyCounts"].values())
GEOD = Geod(ellps="WGS84")
SEARCH_TOLERANCE = 25.0
SOLVE_SIMPLIFICATION = 20.0
MAX_BOUNDARY_CONTACTS = 4


def transform(function, geometry):
    return transform_coordinates(geometry, function, interleaved=False)


def file_sha256(path):
    with Path(path).open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def generator_versions():
    return {"python": platform.python_version(), "geos": geos_version_string,
            **{name: version(name) for name in ["shapely", "pyproj", "pyshp", "numpy"]}}


def boundary_contacts(geometry, pin, coordinate_precision=6, distance_precision=1):
    """Find distinct, nearly tangent boundary contacts without resolving the pole."""
    component = None
    for polygon in polygons(make_valid(geometry)):
        unwrapped = unwrap_polygon(polygon)
        anchor = unwrapped.exterior.coords[0][0]
        longitude = anchor + (pin["lng"] - anchor + 180) % 360 - 180
        if unwrapped.covers(Point(longitude, pin["lat"])):
            component = unwrapped
            break
    if component is None:
        raise ValueError(f"No polygon contains {pin['id']}")
    forward, inverse = projection_at(pin["lng"], pin["lat"])
    projected = transform(forward.transform, segmentize(component, 0.02))
    tolerance = min(100.0, pin["radiusMeters"] * 0.01)
    candidates = []
    for ring in [projected.exterior, *projected.interiors]:
        coordinates = np.asarray(ring.coords)
        start, delta = coordinates[:-1], np.diff(coordinates, axis=0)
        squared_length = np.sum(delta * delta, axis=1)
        fraction = np.divide(-np.sum(start * delta, axis=1), squared_length,
                             out=np.zeros_like(squared_length), where=squared_length > 0)
        nearest = start + np.clip(fraction, 0, 1)[:, None] * delta
        distances = np.hypot(nearest[:, 0], nearest[:, 1])
        for index in np.flatnonzero(distances <= pin["radiusMeters"] + tolerance):
            x, y = nearest[index]
            lng, lat = inverse.transform(x, y)
            candidates.append((float(distances[index]), lng, lat))

    def contact(lng, lat):
        bearing, _, distance = GEOD.inv(pin["lng"], pin["lat"], lng, lat)
        return {"coordinates": [round(lng, coordinate_precision), round(lat, coordinate_precision)],
                "distanceMeters": round(distance, distance_precision), "bearingDegrees": round(bearing, 6)}

    contacts = [contact(*pin["nearestBoundary"])]
    for _, lng, lat in sorted(candidates):
        candidate = contact(lng, lat)
        if all(abs((candidate["bearingDegrees"] - previous["bearingDegrees"] + 180) % 360 - 180) >= 25 for previous in contacts):
            contacts.append(candidate)
        if len(contacts) == MAX_BOUNDARY_CONTACTS:
            break
    return contacts


def download(level, cache):
    target = cache / f"tl_{VINTAGE}_us_{level}.zip"
    if not target.exists():
        print(f"Downloading {SOURCES[level]}", flush=True)
        request = urllib.request.Request(SOURCES[level], headers={"User-Agent": "rsmb.tv pins-of-inaccessibility/1.0"})
        with urllib.request.urlopen(request, timeout=180) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != SNAPSHOT["sourceSha256"][level]:
            raise ValueError(f"Census {level} archive does not match the pinned SHA-256")
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if archive.testzip() is not None:
                raise ValueError(f"Corrupt Census archive: {level}")
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=cache, prefix=f".{target.name}.", suffix=".tmp", delete=False) as output:
                temporary = Path(output.name)
                output.write(data)
            os.replace(temporary, target)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
    if file_sha256(target) != SNAPSHOT["sourceSha256"][level]:
        raise ValueError(f"Cached Census {level} archive does not match the pinned SHA-256; remove {target} and retry")
    return target


def read_shapes(archive_path):
    with zipfile.ZipFile(archive_path) as archive:
        source_crs = CRS.from_wkt(archive.read(next(name for name in archive.namelist() if name.endswith('.prj'))).decode())
        to_wgs84 = Transformer.from_crs(source_crs, "EPSG:4326", always_xy=True)
        def member(extension):
            return io.BytesIO(archive.read(next(name for name in archive.namelist() if name.endswith(extension))))
        with shapefile.Reader(shp=member(".shp"), shx=member(".shx"), dbf=member(".dbf"), encoding="utf-8") as reader:
            for record in reader.iterShapeRecords():
                yield record.record.as_dict(), transform(to_wgs84.transform, shape(record.shape.__geo_interface__))


def polygons(geometry):
    if isinstance(geometry, Polygon):
        return [] if geometry.is_empty else [geometry]
    if hasattr(geometry, "geoms"):
        return [polygon for part in geometry.geoms for polygon in polygons(part) if not polygon.is_empty]
    return []


def unwrap_polygon(polygon):
    anchor = polygon.exterior.coords[0][0]
    return transform(lambda x, y: (anchor + (x - anchor + 180) % 360 - 180, y), polygon)


def projection_at(lng, lat):
    local = CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lng} +datum=WGS84 +units=m")
    return (Transformer.from_crs("EPSG:4326", local, always_xy=True),
            Transformer.from_crs(local, "EPSG:4326", always_xy=True))


def solve_polygon(polygon, search_tolerance=SEARCH_TOLERANCE, simplification=SOLVE_SIMPLIFICATION, initial_origin=None):
    """Recenter an ellipsoidal azimuthal equidistant projection at the solution."""
    polygon = unwrap_polygon(polygon)
    origin = polygon.representative_point()
    lng, lat = initial_origin if initial_origin is not None else (origin.x, origin.y)
    # Densification limits straight projected segments on long legal water borders.
    dense = segmentize(polygon, 0.02)
    for _ in range(6):
        forward, inverse = projection_at(lng, lat)
        projected = transform(forward.transform, dense)
        line = maximum_inscribed_circle(projected.simplify(simplification, preserve_topology=True), search_tolerance)
        center = Point(line.coords[0])
        next_lng, next_lat = inverse.transform(center.x, center.y)
        movement = GEOD.inv(lng, lat, next_lng, next_lat)[2]
        lng, lat = next_lng, next_lat
        if movement < search_tolerance:
            break
    # At this origin, radial projected distances are ellipsoidal geodesic distances.
    forward, inverse = projection_at(lng, lat)
    projected = transform(forward.transform, dense)
    center = Point(0, 0)
    if not projected.contains(center):
        raise ValueError("Calculated pole is outside its jurisdiction")
    nearest = nearest_points(center, projected.boundary)[1]
    radius = center.distance(nearest)
    edge_lng, edge_lat = inverse.transform(nearest.x, nearest.y)
    if not math.isfinite(radius) or radius <= 0:
        raise ValueError("Calculated radius must be positive")
    # Independently sample the geodesic circle against the original boundary.
    for bearing in range(0, 360, 5):
        x, y, _ = GEOD.fwd(lng, lat, bearing, max(0, radius - 2))
        px, py = forward.transform(x, y)
        if not projected.covers(Point(px, py)):
            raise ValueError("Calculated circle escapes its jurisdiction")
    return lng, lat, radius, edge_lng, edge_lat


def component_radius_bound(polygon):
    west, south, east, north = polygon.bounds
    # Equatorial components attain their largest longitude scale between the endpoints.
    cosine = 1 if south <= 0 <= north else max(math.cos(math.radians(south)), math.cos(math.radians(north)))
    width = (east - west) * 111_700 * cosine
    height = (north - south) * 111_700
    return min(width, height) / 2


def solve_geometry(geometry, search_tolerance=SEARCH_TOLERANCE, simplification=SOLVE_SIMPLIFICATION):
    parts = [unwrap_polygon(polygon) for polygon in polygons(make_valid(geometry))]
    parts.sort(key=component_radius_bound, reverse=True)
    best = None
    for polygon in parts:
        if best and component_radius_bound(polygon) < best[2] - search_tolerance:
            continue
        candidate = solve_polygon(polygon, search_tolerance, simplification)
        if best is None or candidate[2] > best[2]:
            best = candidate
    if best is None:
        raise ValueError("No polygonal jurisdiction geometry")
    return best


def display_geometry(geometry, simplification_degrees=0.0015, max_component_fraction=None):
    parts = []
    for polygon in polygons(make_valid(geometry)):
        unwrapped = unwrap_polygon(polygon)
        tolerance = simplification_degrees
        if max_component_fraction is not None:
            west, south, east, north = unwrapped.bounds
            tolerance = min(tolerance, min(east - west, north - south) * max_component_fraction)
        if tolerance:
            unwrapped = unwrapped.simplify(tolerance, preserve_topology=True)
        pieces = [unwrapped]
        for longitude in [-180, 180]:
            cutter = LineString([(longitude, -90), (longitude, 90)])
            pieces = [part for piece in pieces for part in split(piece, cutter).geoms]
        for piece in pieces:
            offset = -360 if piece.representative_point().x > 180 else 360 if piece.representative_point().x < -180 else 0
            parts.append(transform(lambda x, y: (x + offset, y), piece) if offset else piece)
    # Decimal rounding alone can turn narrow county enclaves into self-intersections.
    precise = set_precision(make_valid(MultiPolygon(parts)), 0.000001, mode="valid_output")
    rounded = transform(lambda x, y: (np.round(x, 6), np.round(y, 6)), MultiPolygon(polygons(precise)))
    if rounded.is_empty or not rounded.is_valid:
        raise ValueError("Display precision reduction produced an invalid polygon")
    return mapping(rounded)


def wrapped_bounds(geometry):
    lngs = [lng % 360 for polygon in polygons(geometry) for lng, _ in polygon.exterior.coords]
    lngs.sort()
    gaps = [(lngs[(index + 1) % len(lngs)] + (360 if index == len(lngs) - 1 else 0) - lng, index)
            for index, lng in enumerate(lngs)]
    _, index = max(gaps)
    west = lngs[(index + 1) % len(lngs)]
    east = lngs[index] + (360 if lngs[index] < west else 0)
    if west > 180:
        west, east = west - 360, east - 360
    return [round(west, 5), round(geometry.bounds[1], 5), round(east, 5), round(geometry.bounds[3], 5)]


def build_feature(record, geometry, level, states):
    fips = record["GEOID"]
    state = record if level == "state" else states[record["STATEFP"]]
    lng, lat, radius, edge_lng, edge_lat = solve_geometry(geometry)
    pin = {
        "id": f"{level}-{fips}", "fips": fips, "level": level,
        "kind": "county" if level == "county" else "district" if fips == "11" else "territory" if int(fips) > 56 else "state",
        "name": record["NAME"] if level == "state" else record["NAMELSAD"],
        "stateFips": state["STATEFP"], "stateAbbr": state["STUSPS"],
        "lng": round(lng, 6), "lat": round(lat, 6), "radiusMeters": round(radius, 1),
        "nearestBoundary": [round(edge_lng, 6), round(edge_lat, 6)],
        "landAreaKm2": round(int(record["ALAND"]) / 1_000_000, 2),
        "bounds": wrapped_bounds(geometry),
    }
    pin["boundaryContacts"] = boundary_contacts(geometry, pin)
    feature = {"type": "Feature", "id": pin["id"], "properties": {"id": pin["id"], "fips": fips, "name": pin["name"], "stateFips": pin["stateFips"]}, "geometry": display_geometry(geometry)}
    return pin, feature


def dissolve_jurisdictions(geometries):
    """Remove shared internal borders before solving the national extent."""
    return unary_union([make_valid(geometry) for geometry in geometries])


def build_national_pin(state_shapes):
    geometry = dissolve_jurisdictions([geometry for _, geometry in state_shapes])
    lng, lat, radius, edge_lng, edge_lat = solve_geometry(geometry)
    pin = {
        "id": "country-US", "fips": "US", "level": "country", "kind": "country",
        "name": "United States", "stateFips": "", "stateAbbr": "US",
        "lng": round(lng, 6), "lat": round(lat, 6), "radiusMeters": round(radius, 1),
        "nearestBoundary": [round(edge_lng, 6), round(edge_lat, 6)],
        "landAreaKm2": round(sum(int(record["ALAND"]) for record, _ in state_shapes) / 1_000_000, 2),
        "bounds": wrapped_bounds(geometry),
    }
    pin["boundaryContacts"] = boundary_contacts(geometry, pin)
    return pin


def update_boundary_contacts(published, state_shapes, county_shapes):
    pins = {pin["id"]: pin for pin in published["pins"]}
    updated = set()
    country = pins["country-US"]
    country["boundaryContacts"] = boundary_contacts(dissolve_jurisdictions([geometry for _, geometry in state_shapes]), country)
    updated.add(country["id"])
    for level, records in [("state", state_shapes), ("county", county_shapes)]:
        for index, (record, geometry) in enumerate(records):
            pin = pins[f"{level}-{record['GEOID']}"]
            pin["boundaryContacts"] = boundary_contacts(geometry, pin)
            updated.add(pin["id"])
            if index % 500 == 0:
                print(f"Boundary contacts: {level} {index + 1}", flush=True)
    if updated != set(pins):
        raise ValueError("Boundary contact coverage is incomplete")
    published["metadata"].update(generatedAt=datetime.now(timezone.utc).isoformat())


def write_json(path, payload, *, sort_keys=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent,
                                         prefix=f".{path.name}.", suffix=".tmp", delete=False) as output:
            temporary = Path(output.name)
            json.dump(payload, output, separators=(",", ":"), ensure_ascii=False, allow_nan=False, sort_keys=sort_keys)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def finite_number(value):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def validate_number(value, name, minimum=0, maximum=math.inf, positive=False):
    if (not finite_number(value) or value < minimum or value > maximum or (positive and value == 0)):
        raise ValueError(f'Invalid {name}')


def validate_name(value, name='geographic name', maximum=200):
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= maximum:
        raise ValueError(f'Invalid {name}')


def validate_timestamp(value):
    if not isinstance(value, str) or not re.fullmatch(
            r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})', value):
        raise ValueError('Invalid publication timestamp')
    try:
        datetime.fromisoformat(value)
    except ValueError as error:
        raise ValueError('Invalid publication timestamp') from error


def validate_position(point):
    if (not isinstance(point, (list, tuple)) or len(point) != 2
            or not all(finite_number(value) for value in point)
            or not -180 <= point[0] <= 180 or not -90 <= point[1] <= 90):
        raise ValueError('Invalid pin or boundary coordinates')


def validate_pin_geometry(pin, maximum_radius):
    """Apply the shared browser geometry contract before a publication can replace files."""
    validate_name(pin.get('id'), 'pin ID', maximum=100)
    validate_name(pin.get('name'))
    validate_number(pin.get('radiusMeters'), 'pin radius', maximum=maximum_radius, positive=True)
    contacts = pin.get('boundaryContacts')
    if (not isinstance(contacts, list) or not 1 <= len(contacts) <= MAX_BOUNDARY_CONTACTS
            or any(not isinstance(contact, dict) for contact in contacts)):
        raise ValueError('Invalid boundary contact count')
    positions = [[pin.get('lng'), pin.get('lat')], pin.get('nearestBoundary'),
                 *[contact.get('coordinates') for contact in contacts]]
    for point in positions:
        validate_position(point)
    if not -85 <= pin['lat'] <= 85:
        raise ValueError('Pin is outside the map projection')
    bounds = pin.get('bounds')
    if (not isinstance(bounds, (list, tuple)) or len(bounds) != 4
            or not all(finite_number(value) for value in bounds)
            or not -180 <= bounds[0] <= 180 or not -180 <= bounds[2] <= 540
            or not -90 <= bounds[1] < bounds[3] <= 90 or not 0 < bounds[2] - bounds[0] <= 360):
        raise ValueError('Invalid geographic bounds')
    west, south, east, north = bounds
    for lng, lat in positions:
        wrapped = lng + 360 * round(((west + east) / 2 - lng) / 360)
        if not west - 0.00002 <= wrapped <= east + 0.00002 or not south - 0.00002 <= lat <= north + 0.00002:
            raise ValueError('Pin or contact is outside its jurisdiction bounds')
    for index, contact in enumerate(contacts):
        validate_number(contact.get('bearingDegrees'), 'contact bearing', minimum=-180, maximum=180)
        validate_number(contact.get('distanceMeters'), 'contact distance', positive=True)
        if abs(contact['distanceMeters'] - pin['radiusMeters']) > min(100, pin['radiusMeters'] * 0.01) + 2:
            raise ValueError('Boundary contact is not near the radius')
        endpoint = GEOD.fwd(pin['lng'], pin['lat'], contact['bearingDegrees'], contact['distanceMeters'])
        if GEOD.inv(endpoint[0], endpoint[1], *contact['coordinates'])[2] > 1:
            raise ValueError('Inconsistent boundary contact geometry')
        if any(abs((previous['bearingDegrees'] - contact['bearingDegrees'] + 540) % 360 - 180) < 24.99999
               for previous in contacts[:index]):
            raise ValueError('Duplicate boundary contact direction')
    if (GEOD.inv(*contacts[0]['coordinates'], *pin['nearestBoundary'])[2] > 1
            or abs(contacts[0]['distanceMeters'] - pin['radiusMeters']) > 1):
        raise ValueError('Primary boundary contact disagrees with the radius')


def validate_display_geometry(geometry):
    """Reject raw GeoJSON that Shapely could silently close or coerce into another type."""
    if not isinstance(geometry, dict) or geometry.get('type') not in {'Polygon', 'MultiPolygon'}:
        raise ValueError('Display geometry must be a polygon or multipolygon')
    coordinates = geometry.get('coordinates')
    parts = [coordinates] if geometry['type'] == 'Polygon' else coordinates
    if not isinstance(parts, (list, tuple)) or not parts:
        raise ValueError('Empty display geometry')
    for polygon in parts:
        if not isinstance(polygon, (list, tuple)) or not polygon:
            raise ValueError('Empty display polygon')
        for ring in polygon:
            if not isinstance(ring, (list, tuple)) or len(ring) < 4:
                raise ValueError('Invalid display ring')
            for point in ring:
                validate_position(point)
            if ring[0] != ring[-1] or any(abs(point[0] - ring[index - 1][0]) > 180 for index, point in enumerate(ring) if index):
                raise ValueError('Unclosed display ring or unsplit date-line edge')
            x, y = ring[0]
            area = sum((ring[index][0] - x) * (point[1] - y) - (point[0] - x) * (ring[index][1] - y)
                       for index, point in enumerate(ring[1:]))
            if abs(area) <= 1e-14:
                raise ValueError('Display ring has no area')
    converted = shape(geometry)
    if converted.is_empty or not converted.is_valid:
        raise ValueError('Invalid display polygon topology')


def validate_artifact(name, payload):
    if name == "pins.json":
        metadata, pins = payload["metadata"], payload["pins"]
        expected = {"country": 1, "state": len(SNAPSHOT["countyCounts"]), "county": COUNTY_COUNT}
        if metadata["vintage"] != VINTAGE or metadata["sourceSha256"] != SNAPSHOT["sourceSha256"]:
            raise ValueError("Pin provenance differs from the pinned Census snapshot")
        validate_timestamp(metadata.get('generatedAt'))
        for field in ['source', 'method', 'coverage', 'water', 'nationalDefinition']:
            validate_name(metadata.get(field), field, maximum=2000)
        validate_number(metadata.get('searchToleranceMeters'), 'search tolerance', positive=True)
        validate_number(metadata.get('solveSimplificationMeters'), 'working simplification')
        if Counter(pin["level"] for pin in pins) != expected or len({pin["id"] for pin in pins}) != len(pins):
            raise ValueError("Incomplete or duplicate pin coverage")
        if any(isinstance(metadata.get(f'{key}Count'), bool) or metadata.get(f'{key}Count') != count
               for key, count in expected.items()):
            raise ValueError("Pin metadata totals do not match coverage")
        if Counter(pin["stateFips"] for pin in pins if pin["level"] == "county") != SNAPSHOT["countyCounts"]:
            raise ValueError("County coverage differs from the pinned Census snapshot")
        if {pin["fips"] for pin in pins if pin["level"] == "state"} != set(SNAPSHOT["countyCounts"]):
            raise ValueError("State coverage differs from the pinned Census snapshot")
        for pin in pins:
            if pin["id"] != f"{pin['level']}-{pin['fips']}":
                raise ValueError("Pin identity differs from its geographic code")
            if pin["level"] == "country":
                if ((pin["fips"], pin["stateFips"], pin["stateAbbr"], pin["kind"]) != ("US", "", "US", "country")
                        or pin.get('name') != 'United States'):
                    raise ValueError("Invalid national identity")
            elif (pin["stateFips"] not in SNAPSHOT["countyCounts"] or not pin["fips"].isdigit()
                  or len(pin["fips"]) != (2 if pin["level"] == "state" else 5)
                  or (pin["fips"] != pin["stateFips"] if pin["level"] == "state" else not pin["fips"].startswith(pin["stateFips"]))):
                raise ValueError("Invalid jurisdiction identity")
            validate_pin_geometry(pin, SNAPSHOT['maxRadiusMeters'])
            validate_number(pin.get('landAreaKm2'), 'land area')
        return
    if name not in {"states.geojson", "counties.geojson"} or payload.get("type") != "FeatureCollection":
        raise ValueError(f"Unsupported publication artifact: {name}")
    level = "state" if name == "states.geojson" else "county"
    features = payload["features"]
    expected_count = len(SNAPSHOT["countyCounts"]) if level == "state" else COUNTY_COUNT
    if len(features) != expected_count or len({feature["id"] for feature in features}) != expected_count:
        raise ValueError(f"Incomplete or duplicate {level} boundaries")
    for feature in features:
        properties = feature["properties"]
        if feature.get('type') != 'Feature' or feature["id"] != properties["id"] or feature["id"] != f"{level}-{properties['fips']}":
            raise ValueError("Boundary identity differs from its geographic code")
        validate_name(properties.get('name'))
        if (properties["stateFips"] not in SNAPSHOT["countyCounts"] or not properties["fips"].isdigit()
                or len(properties["fips"]) != (2 if level == "state" else 5)
                or (properties["fips"] != properties["stateFips"] if level == "state" else not properties["fips"].startswith(properties["stateFips"]))):
            raise ValueError("Boundary state identity is invalid")
        validate_display_geometry(feature['geometry'])
    if level == "county" and Counter(feature["properties"]["stateFips"] for feature in features) != SNAPSHOT["countyCounts"]:
        raise ValueError("Incomplete county boundary coverage")
    if level == "state" and {feature["properties"]["fips"] for feature in features} != set(SNAPSHOT["countyCounts"]):
        raise ValueError("Incomplete state boundary coverage")


def verify_source_pin(pin, geometry, sample_margin=2):
    """Compare a rounded published pin with its full source boundary."""
    component = None
    for polygon in polygons(make_valid(geometry)):
        unwrapped = unwrap_polygon(polygon)
        anchor = unwrapped.exterior.coords[0][0]
        longitude = anchor + (pin["lng"] - anchor + 180) % 360 - 180
        if unwrapped.covers(Point(longitude, pin["lat"])):
            component = unwrapped
            break
    if component is None:
        raise ValueError(f"Published pin is outside its source: {pin['id']}")
    forward, _ = projection_at(pin["lng"], pin["lat"])
    projected = transform(forward.transform, segmentize(component, 0.02))
    radius_error = abs(Point(0, 0).distance(projected.boundary) - pin["radiusMeters"])
    if radius_error >= 1:
        raise ValueError(f"Published radius differs from its source: {pin['id']}")
    contact_error = 0
    for contact in pin["boundaryContacts"]:
        point = Point(*forward.transform(*contact["coordinates"]))
        contact_error = max(contact_error, point.distance(projected.boundary))
    if contact_error >= 1:
        raise ValueError(f"Published contact is off its source boundary: {pin['id']}")
    for bearing in range(0, 360, 5):
        lng, lat, _ = GEOD.fwd(pin["lng"], pin["lat"], bearing, max(0, pin["radiusMeters"] - sample_margin))
        if not projected.covers(Point(*forward.transform(lng, lat))):
            raise ValueError(f"Published circle sample escapes its source: {pin['id']}")
    return radius_error, contact_error


def verify_publication(directory, state_shapes, county_shapes):
    artifacts = {name: json.loads((directory / name).read_text(encoding="utf-8"))
                 for name in ["pins.json", "states.geojson", "counties.geojson"]}
    for name, payload in artifacts.items():
        validate_artifact(name, payload)
    pins = {pin["id"]: pin for pin in artifacts["pins.json"]["pins"]}
    national = dissolve_jurisdictions([geometry for _, geometry in state_shapes])
    errors = [verify_source_pin(pins["country-US"], national)]
    checked = {"country-US"}
    for level, records in [("state", state_shapes), ("county", county_shapes)]:
        for record, geometry in records:
            identifier = f"{level}-{record['GEOID']}"
            errors.append(verify_source_pin(pins[identifier], geometry))
            checked.add(identifier)
    if checked != set(pins):
        raise ValueError("Source verification did not cover every published pin")
    return {"checked": len(checked), "circleSamples": len(checked) * 72,
            "maxRadiusErrorMeters": max(error[0] for error in errors),
            "maxContactBoundaryErrorMeters": max(error[1] for error in errors)}


def write_publication(directory, artifacts, validate=None):
    """Stage and validate outputs, reject concurrent writes, and roll back I/O failures."""
    directory = Path(directory)
    if any(Path(name).is_absolute() or '..' in Path(name).parts for name in artifacts):
        raise ValueError('Publication paths must stay inside the output directory')
    directory.parent.mkdir(parents=True, exist_ok=True)
    lock = directory.parent / f".{directory.name}.lock"
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as error:
        raise RuntimeError(f"A publication lock already exists: {lock}") from error
    try:
        with os.fdopen(descriptor, "w") as handle:
            handle.write(f"pid={os.getpid()}\n")
        with tempfile.TemporaryDirectory(prefix=".pins-publish-", dir=directory.parent) as temporary:
            staging = Path(temporary)
            directory.mkdir(parents=True, exist_ok=True)
            for name, payload in artifacts.items():
                (validate or validate_artifact)(name, payload)
                if name == "pins.json":
                    payload = {**payload, "metadata": {**payload["metadata"], "generatorVersions": generator_versions()}}
                write_json(staging / name, payload)
            backups, written = {}, []
            for name in artifacts:
                destination = directory / name
                if destination.exists():
                    backup = staging / f"{name}.previous"
                    shutil.copy2(destination, backup)
                    backups[name] = backup
            try:
                for name in artifacts:
                    (directory / name).parent.mkdir(parents=True, exist_ok=True)
                    written.append(name)
                    os.replace(staging / name, directory / name)
            except BaseException:
                for name in reversed(written):
                    if name in backups:
                        os.replace(backups[name], directory / name)
                    else:
                        (directory / name).unlink(missing_ok=True)
                raise
    finally:
        lock.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=ROOT / ".cache/pins-of-inaccessibility")
    parser.add_argument("--output", type=Path, default=ROOT / "public/data/pins-of-inaccessibility")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--download-only", action="store_true")
    mode.add_argument("--verify-only", action="store_true", help="Check the publication against full source boundaries without replacing files")
    mode.add_argument("--national-only", action="store_true", help="Update only the national pin in an existing compatible publication")
    mode.add_argument("--contacts-only", action="store_true", help="Add boundary contacts to existing pins without recalculating their positions")
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    levels = ["state"] if args.national_only else list(SOURCES)
    with ThreadPoolExecutor(max_workers=2) as executor:
        archives = dict(zip(levels, executor.map(lambda level: download(level, args.cache), levels)))
    if args.download_only:
        return
    state_shapes = list(read_shapes(archives["state"]))
    states = {record["STATEFP"]: record for record, _ in state_shapes}
    if len(states) != 56:
        raise ValueError(f"Expected 50 states, DC, and five territories; got {len(states)}")
    if args.verify_only:
        result = verify_publication(args.output, state_shapes, read_shapes(archives["county"]))
        print(json.dumps(result, indent=2), flush=True)
        return
    if args.contacts_only:
        published = json.loads((args.output / "pins.json").read_text(encoding="utf-8"))
        if published["metadata"]["vintage"] != VINTAGE or any(
                published["metadata"]["sourceSha256"][level] != file_sha256(archive)
                for level, archive in archives.items()):
            raise ValueError("Existing publication does not match the cached Census sources; run a full generation")
        update_boundary_contacts(published, state_shapes, read_shapes(archives["county"]))
        write_publication(args.output, {"pins.json": published})
        return
    national = build_national_pin(state_shapes)
    print(f"country: United States — {national['radiusMeters'] / 1000:.2f} km", flush=True)
    national_definition = "Union of 50 states, DC, and five inhabited territories; internal state borders dissolved; international borders and coastal jurisdiction limits count"
    if args.national_only:
        published = json.loads((args.output / "pins.json").read_text(encoding="utf-8"))
        state_hash = file_sha256(archives["state"])
        if published["metadata"]["vintage"] != VINTAGE or published["metadata"]["sourceSha256"]["state"] != state_hash:
            raise ValueError("Existing publication does not match the cached Census state source; run a full generation")
        published["pins"] = sorted([national] + [pin for pin in published["pins"] if pin["level"] != "country"], key=lambda pin: pin["id"])
        published["metadata"].update(countryCount=1, nationalDefinition=national_definition, generatedAt=datetime.now(timezone.utc).isoformat())
        write_publication(args.output, {"pins.json": published})
        return
    pins, state_features, county_features = [national], [], []
    for level, records in [("state", state_shapes), ("county", read_shapes(archives["county"]))]:
        for index, (record, geometry) in enumerate(records):
            pin, feature = build_feature(record, geometry, level, states)
            pins.append(pin)
            (state_features if level == "state" else county_features).append(feature)
            if level == "state" or index % 100 == 0:
                print(f"{level} {index + 1}: {pin['name']} — {pin['radiusMeters'] / 1000:.2f} km", flush=True)
    county_states = {pin["stateFips"] for pin in pins if pin["level"] == "county"}
    if county_states != set(states) or len(county_features) != COUNTY_COUNT:
        raise ValueError("Census county coverage is incomplete")
    pins.sort(key=lambda pin: pin["id"])
    metadata = {
        "vintage": VINTAGE, "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "U.S. Census Bureau, 2025 TIGER/Line", "sourceUrls": list(SOURCES.values()),
        "sourceSha256": {level: file_sha256(path) for level, path in archives.items()},
        "method": "Iteratively recentered WGS84 azimuthal equidistant maximum inscribed circle",
        "searchToleranceMeters": SEARCH_TOLERANCE, "solveSimplificationMeters": SOLVE_SIMPLIFICATION,
        "boundaryDensificationDegrees": 0.02,
        "water": "Administrative water included; jurisdictional enclaves remain boundary holes",
        "coverage": "50 states, DC, five inhabited territories, and all Census county equivalents; minor outlying islands are not in these files",
        "stateCount": len(state_features), "countyCount": len(county_features),
        "countryCount": 1, "nationalDefinition": national_definition,
    }
    # Compute and validate every record before replacing any published artifact.
    write_publication(args.output, {
        "states.geojson": {"type": "FeatureCollection", "features": state_features},
        "counties.geojson": {"type": "FeatureCollection", "features": county_features},
        "pins.json": {"metadata": metadata, "pins": pins},
    })
    print(f"Wrote {len(state_features)} jurisdictions and {len(county_features)} counties to {args.output}", flush=True)


if __name__ == "__main__":
    main()
