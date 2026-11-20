#!/usr/bin/env python3
"""Build catalog-scoped resort tiles from one OpenSkiData GeoPackage snapshot."""

import argparse
from collections import defaultdict
from contextlib import closing, contextmanager
from datetime import datetime
import hashlib
from html import escape
import json
from math import cos, hypot, inf, isfinite, radians
import os
from pathlib import Path
import re
from shutil import copy2
import sqlite3
import subprocess
from tempfile import TemporaryDirectory
from unicodedata import normalize
from urllib.parse import urlsplit

DATA = Path(__file__).resolve().parents[1] / 'data'
SOURCE = 'https://tiles.openskimap.org/openskidata.gpkg'
MIN_ZOOM, DETAIL_MIN_ZOOM, STATION_MIN_ZOOM, MAX_ZOOM = 9, 11, 13, 14
RUN_USES = ('downhill', 'nordic', 'skitour', 'snow_park', 'connection')
LIFT_FREE_USES = {'cross-country': 'nordic', 'ski-touring': 'skitour'}
AREA_POINTS = 'ski_areas_point'
AREA_FOOTPRINTS = 'ski_areas_multipolygon'
FEATURE_LAYERS = {
    'lifts': ('lifts_linestring',),
    'runs': ('runs_linestring', 'runs_multipolygon'),
    'stations': ('spots_point',),
}


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def validate_snapshot(path, metadata):
    if path.stat().st_size != metadata['files']['geoPackage']:
        raise ValueError('GeoPackage size does not match the source metadata.')
    start = datetime.fromisoformat(metadata['run']['startedAt'].replace('Z', '+00:00'))
    end = datetime.fromisoformat(metadata['run']['finishedAt'].replace('Z', '+00:00'))
    counts = metadata['counts']
    expected_counts = {
        'ski areas': ((AREA_POINTS,), counts['skiAreas']['total']),
        'lifts': (FEATURE_LAYERS['lifts'], counts['lifts']),
        'runs': (FEATURE_LAYERS['runs'], counts['runs']),
        'spots': (FEATURE_LAYERS['stations'], counts['spots']),
    }
    with closing(sqlite3.connect(f'{path.resolve().as_uri()}?mode=ro', uri=True)) as connection:
        changes = dict(connection.execute('''
            SELECT contents.table_name, contents.last_change FROM gpkg_contents AS contents
            JOIN sqlite_schema AS schema ON schema.name = contents.table_name AND schema.type = 'table'
        '''))
        for layer in (AREA_POINTS, AREA_FOOTPRINTS, *(name for names in FEATURE_LAYERS.values() for name in names)):
            if layer not in changes:
                raise ValueError(f'GeoPackage does not contain layer {layer}.')
            changed = datetime.fromisoformat(changes[layer].replace('Z', '+00:00'))
            if not start <= changed <= end:
                raise ValueError(f'GeoPackage layer {layer} is outside the source build times.')
        for label, (layers, expected) in expected_counts.items():
            actual = sum(connection.execute(f'SELECT COUNT(*) FROM "{layer}"').fetchone()[0] for layer in layers)
            if actual != expected:
                raise ValueError(f'GeoPackage has {actual} {label}. The source metadata lists {expected}.')


def format_attribution(credits):
    links = []
    for name, url in credits.items():
        error = f'Attribution for {name} requires an HTTPS URL without credentials.'
        if not isinstance(url, str) or re.search(r'[\s\x00-\x1f\x7f\\]', url):
            raise ValueError(error)
        try:
            parsed = urlsplit(url)
            valid_port = parsed.port != 0
        except ValueError as cause:
            raise ValueError(error) from cause
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username is not None or not valid_port:
            raise ValueError(error)
        links.append(f'<a href="{escape(url)}">{escape(name, quote=False)}</a>')
    return ' · '.join(links)


def values(field):
    return {value.strip() for value in (field or '').split(',') if value.strip()}


def source_key(url):
    parsed = urlsplit(url)
    if parsed.hostname in ('openstreetmap.org', 'www.openstreetmap.org'):
        path = parsed.path.strip('/')
        if re.fullmatch(r'(node|way|relation)/[0-9]+', path):
            return 'openstreetmap', path
    if parsed.hostname in ('skimap.org', 'www.skimap.org'):
        match = re.fullmatch(r'/SkiAreas/view/([0-9]+)/?', parsed.path)
        if match:
            return 'skimap.org', match[1]


def find_areas(db, areas, locations):
    from osgeo import ogr

    by_id = {}
    by_source = defaultdict(set)
    for feature in db.GetLayerByName(AREA_POINTS):
        if feature['status'] != 'operating':
            continue
        identifier = feature['feature_id']
        geometry = feature.GetGeometryRef()
        by_id[identifier] = (geometry.GetX(), geometry.GetY(), values(feature['country_codes']), values(feature['activities']))
        for source in json.loads(feature['sources']):
            by_source[source['type'], str(source['id'])].add(identifier)

    footprints = db.GetLayerByName(AREA_FOOTPRINTS)
    matched = defaultdict(set)
    for record in locations:
        area = areas[record['id']]
        kind = area.get('skiing', 'downhill')
        if kind in ('heli-skiing', 'cat-skiing'):
            continue
        activity = LIFT_FREE_USES.get(kind, 'downhill')
        countries = {area['country'], *area.get('otherCountries', ())}
        longitude, latitude = record['coordinates']

        def matches_scope(identifier):
            _, _, source_countries, activities = by_id[identifier]
            return bool(countries & source_countries) and activity in activities

        candidates = {identifier for url in record['upstream'] for identifier in by_source.get(source_key(url), ())
                      if matches_scope(identifier)}
        if len(candidates) > 1:
            exact = {identifier for identifier in candidates
                     if abs(by_id[identifier][0] - longitude) < 1e-5 and abs(by_id[identifier][1] - latitude) < 1e-5}
            if exact:
                candidates = exact
        if len(candidates) != 1:
            point = ogr.Geometry(ogr.wkbPoint)
            point.AddPoint_2D(longitude, latitude)
            footprints.SetSpatialFilter(point)
            candidates = {f['feature_id'] for f in footprints if f['feature_id'] in by_id
                          and (not candidates or f['feature_id'] in candidates) and matches_scope(f['feature_id'])
                          and f.GetGeometryRef().Intersects(point)}
            footprints.SetSpatialFilter(None)
        if len(candidates) == 1:
            matched[next(iter(candidates))].add(area['id'])
    return matched


def distance_metres(first, second):
    longitude = (first[0] - second[0] + 180) % 360 - 180
    latitude = first[1] - second[1]
    return 111_195 * hypot(longitude * cos(radians((first[1] + second[1]) / 2)), latitude)


def lift_entry_points(first, last):
    if all(isfinite(point[2]) for point in (first, last)) and abs(first[2] - last[2]) >= 5:
        bottom = first if first[2] < last[2] else last
        return (bottom[:2],)
    return first[:2], last[:2]


def select_lift_base(origin, stations, lifts):
    candidates = []
    for coordinates, name, source in stations:
        offset = distance_metres(origin, coordinates)
        if offset > 1800:
            continue
        distances = [min(distance_metres(coordinates, end) for end in lift) for lift in lifts]
        serving_lifts = sum(distance <= 225 for distance in distances)
        at_operating_lift = min(distances, default=inf) <= 55
        if at_operating_lift and (serving_lifts >= 2 or len(lifts) == 1):
            candidates.append((-serving_lifts, offset, coordinates, name or 'Mapped lift base', source))
    if candidates:
        _, _, coordinates, name, source = min(candidates)
        return {'coordinates': coordinates, 'name': name, 'kind': 'lift-base', 'source': source}


def write_resort_bases(db, matched, areas, locations, build_time, work):
    existing = DATA / 'resort-bases.json'
    origins = {location['id']: location['coordinates'] for location in locations['locations']}
    previous = read_json(existing)['bases'] if existing.exists() else {}
    bases = {area_id: base for area_id, base in previous.items()
             if area_id in areas and area_id in origins and base['kind'] == 'entrance'}
    eligible = origins.keys() - bases.keys()
    access_areas = {}
    for feature, owners in matched.items():
        if len(owners) != 1:
            continue
        owner, = owners
        if owner in eligible and areas[owner].get('skiing', 'downhill') in ('downhill', 'both'):
            access_areas[feature] = owner
    lifts = defaultdict(list)
    stations = defaultdict(list)
    for feature in db.GetLayerByName(FEATURE_LAYERS['lifts'][0]):
        if feature['status'] != 'operating' or feature['access'] in ('private', 'no') or feature['lift_type'] == 'zip_line':
            continue
        geometry = feature.GetGeometryRef()
        if not geometry or geometry.GetPointCount() < 2:
            continue
        entries = lift_entry_points(geometry.GetPoint(0), geometry.GetPoint(geometry.GetPointCount() - 1))
        for feature_id in values(feature['ski_area_ids']) & access_areas.keys():
            lifts[feature_id].append(entries)
    for feature in db.GetLayerByName(FEATURE_LAYERS['stations'][0]):
        if feature['spot_type'] != 'lift_station' or feature['position'] != 'bottom':
            continue
        geometry = feature.GetGeometryRef()
        if not geometry or geometry.IsEmpty():
            continue
        coordinates = (round(geometry.GetX(), 6), round(geometry.GetY(), 6))
        for feature_id in values(feature['ski_area_ids']) & access_areas.keys():
            stations[feature_id].append((coordinates, feature['name'], f'https://openskimap.org/?obj={feature_id}'))
    for feature_id, area in access_areas.items():
        result = select_lift_base(origins[area], stations[feature_id], lifts[feature_id])
        if result:
            bases[area] = result
    output = work / 'resort-bases.json'
    output.write_text(json.dumps({'buildTime': build_time, 'license': locations['license'], 'bases': dict(sorted(bases.items()))},
                                 ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return output


def add_mapped_trail_counts(path, locations, build_time):
    if locations['buildTime'] != build_time:
        return False

    destinations = defaultdict(list)
    for record in locations['locations']:
        mapped = record.get('mappedTerrain')
        if mapped:
            source = re.fullmatch(r'https://openskimap\.org/\?obj=([a-f0-9]{40})', mapped['source'])
            if source:
                destinations[source[1]].append(mapped)

    names = defaultdict(set)
    with closing(sqlite3.connect(f'{path.resolve().as_uri()}?mode=ro', uri=True)) as connection:
        for table in FEATURE_LAYERS['runs']:
            rows = connection.execute(f'''
                SELECT name, uses, ski_area_ids FROM "{table}"
                WHERE status = 'operating' AND name IS NOT NULL AND ski_area_ids IS NOT NULL
            ''')
            for name, uses, area_ids in rows:
                name = normalize('NFC', ' '.join(name.split()).casefold())
                if not name:
                    continue
                activities = values(uses) & {'downhill', 'nordic'}
                for area_id in values(area_ids) & destinations.keys():
                    for activity in activities:
                        names[area_id, activity].add(name)

    changed = False
    for area_id, records in destinations.items():
        for mapped in records:
            for activity, field in [('downhill', 'namedDownhillRuns'), ('nordic', 'namedNordicTrails')]:
                count = len(names[area_id, activity]) if mapped.get(f'{activity}Km') else 0
                if mapped.get(field, 0) != count:
                    changed = True
                    if count:
                        mapped[field] = count
                    else:
                        mapped.pop(field, None)
    return changed


def run_owners(owners, areas, uses):
    primary = next((use for use in RUN_USES if use in uses), None)
    by_use = defaultdict(set)
    for owner in sorted(owners):
        use = LIFT_FREE_USES.get(areas[owner].get('skiing'), primary)
        if use in uses:
            by_use[use].add(owner)
    return by_use


def write_tiles(db, matched, areas, work, attribution):
    groups = {}
    counts = {}
    inputs = []
    layer_zooms = {'footprints': MIN_ZOOM, 'runs': DETAIL_MIN_ZOOM, 'lifts': DETAIL_MIN_ZOOM, 'stations': STATION_MIN_ZOOM}
    for layer, source_names in {'footprints': (AREA_FOOTPRINTS,), **FEATURE_LAYERS}.items():
        path = work / f'{layer}.geojsonl'
        counts[layer] = 0
        with path.open('w', encoding='utf-8') as stream:
            for source_name in source_names:
                for feature in db.GetLayerByName(source_name):
                    if layer == 'stations':
                        if feature['spot_type'] != 'lift_station':
                            continue
                    elif feature['status'] != 'operating':
                        continue

                    upstream = {feature['feature_id']} if layer == 'footprints' else values(feature['ski_area_ids'])
                    owners = {name for identifier in upstream for name in matched.get(identifier, ())}
                    if not owners:
                        continue

                    props = {'name': feature['name']} if feature['name'] else {}
                    owners_by_use = {None: owners}
                    if layer == 'runs':
                        owners_by_use = run_owners(owners, areas, values(feature['uses']))
                        props.update(difficulty=feature['difficulty'], convention=feature['difficulty_convention'],
                                     ref=feature['ref'])
                    elif layer in ('lifts', 'stations'):
                        owners_by_use = {None: {owner for owner in owners if areas[owner].get('skiing') not in LIFT_FREE_USES}}
                        if layer == 'lifts':
                            props.update(liftType=feature['lift_type'])
                    if not any(owners_by_use.values()):
                        continue

                    geometry = feature.GetGeometryRef()
                    if geometry is None or geometry.IsEmpty():
                        continue
                    geometry.FlattenTo2D()
                    geometry_json = json.loads(geometry.ExportToJson(['COORDINATE_PRECISION=6']))
                    for use, use_owners in owners_by_use.items():
                        if use:
                            props['use'] = use
                        props['group'] = groups.setdefault(tuple(sorted(use_owners)), len(groups) + 1)
                        stream.write(json.dumps({'type': 'Feature', 'tippecanoe': {'minzoom': layer_zooms[layer]},
                                                 'properties': {k: v for k, v in props.items() if v},
                                                 'geometry': geometry_json}, ensure_ascii=False, separators=(',', ':')) + '\n')
                        counts[layer] += 1
        if counts[layer]:
            inputs.append(f'--named-layer={layer}:{path.name}')

    archive = work / 'resort-terrain.pmtiles'
    subprocess.run(['tippecanoe', f'--output={archive.name}', f'--minimum-zoom={MIN_ZOOM}', f'--maximum-zoom={MAX_ZOOM}',
                    '--drop-rate=1', '--no-feature-limit', '--no-tile-size-limit', '--no-tiny-polygon-reduction',
                    '--name=Ski-status resort terrain', f'--attribution={attribution}', *inputs], cwd=work, check=True)
    by_area = defaultdict(list)
    for owners, group in groups.items():
        for owner in owners:
            by_area[owner].append(group)
    return archive, dict(sorted(by_area.items())), counts


def sha256(path):
    checksum = hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b''):
            checksum.update(data)
    return checksum.hexdigest()


@contextmanager
def lock_output(directory):
    lock = directory / 'resort-terrain.pid.lock'
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as error:
        raise RuntimeError(f'A resort terrain build is already running: {lock}') from error
    try:
        with os.fdopen(descriptor, 'w', encoding='ascii') as stream:
            stream.write(f'{os.getpid()}\n')
        yield
    finally:
        lock.unlink()


def publish_outputs(outputs, directory):
    """Replace staged files and restore the previous outputs if a replacement fails."""
    replacements = [(output, directory / output.name, output.with_suffix(output.suffix + '.previous')) for output in outputs]
    for _, target, backup in replacements:
        if target.exists():
            copy2(target, backup)
    try:
        for output, target, _ in replacements:
            os.replace(output, target)
    except (OSError, KeyboardInterrupt):
        for output, target, backup in reversed(replacements):
            # A successful rename consumes the staged file.
            if output.exists():
                continue
            if backup.exists():
                os.replace(backup, target)
            else:
                target.unlink(missing_ok=True)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('geopackage', type=Path)
    parser.add_argument('metadata', type=Path)
    args = parser.parse_args()
    try:
        metadata = read_json(args.metadata)
        validate_snapshot(args.geopackage, metadata)
    except (OSError, ValueError, KeyError, TypeError, AttributeError, sqlite3.DatabaseError) as error:
        parser.error(f'Invalid OpenSkiData snapshot. {error}')

    with lock_output(DATA), TemporaryDirectory(prefix='resort-terrain-', dir=DATA) as temporary:
        locations = read_json(DATA / 'locations.json')
        areas = {area['id']: area for area in read_json(DATA / 'areas.json')}
        try:
            attribution = format_attribution({**locations['attribution'], 'ODbL': locations['license']})
        except (KeyError, TypeError, ValueError) as error:
            parser.error(f'Invalid terrain attribution. {error}')

        from osgeo import ogr

        db = ogr.Open(str(args.geopackage))
        if db is None:
            raise SystemExit('Cannot read the OpenSkiData GeoPackage.')
        matched = find_areas(db, areas, locations['locations'])
        if not matched:
            raise SystemExit('No OpenSkiData areas match the catalog.')

        work = Path(temporary)
        archive, by_area, counts = write_tiles(db, matched, areas, work, attribution)
        manifest = {
            'source': SOURCE, 'buildTime': metadata['run']['finishedAt'], 'sourceSha256': sha256(args.geopackage),
            'archiveSha256': sha256(archive), 'license': locations['license'], 'minZoom': MIN_ZOOM,
            'detailMinZoom': DETAIL_MIN_ZOOM, 'stationMinZoom': STATION_MIN_ZOOM, 'maxZoom': MAX_ZOOM,
            'counts': counts, 'groupsByArea': by_area,
        }
        index = work / 'resort-terrain.json'
        index.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        outputs = [archive, write_resort_bases(db, matched, areas, locations, manifest['buildTime'], work)]
        if add_mapped_trail_counts(args.geopackage, locations, manifest['buildTime']):
            location_index = work / 'locations.json'
            location_index.write_text(json.dumps(locations, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            outputs.append(location_index)
        publish_outputs([*outputs, index], DATA)
    print(f'{len(by_area)} catalog areas, {counts}')


if __name__ == '__main__':
    main()
