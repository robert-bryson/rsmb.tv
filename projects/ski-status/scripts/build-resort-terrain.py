#!/usr/bin/env python3
"""Build catalog-scoped resort tiles from one OpenSkiData GeoPackage snapshot."""

import argparse
from collections import defaultdict
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from tempfile import TemporaryDirectory
from urllib.parse import urlsplit

from osgeo import ogr


DATA = Path(__file__).resolve().parents[1] / 'data'
SOURCE = 'https://tiles.openskimap.org/openskidata.gpkg'
MIN_ZOOM, MAX_ZOOM = 11, 14
RUN_USES = ('downhill', 'nordic', 'skitour', 'snow_park', 'connection')
LIFT_FREE_TYPES = {'cross-country', 'ski-touring'}
FEATURE_LAYERS = {
    'lifts': ('lifts_linestring',),
    'runs': ('runs_linestring', 'runs_multipolygon'),
    'stations': ('spots_point',),
}


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


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
    by_id = {}
    by_source = defaultdict(set)
    for feature in db.GetLayerByName('ski_areas_point'):
        if feature['status'] != 'operating':
            continue
        identifier = feature['feature_id']
        geometry = feature.GetGeometryRef()
        by_id[identifier] = (geometry.GetX(), geometry.GetY(), values(feature['country_codes']), values(feature['activities']))
        for source in json.loads(feature['sources']):
            by_source[source['type'], str(source['id'])].add(identifier)

    footprints = db.GetLayerByName('ski_areas_multipolygon')
    matched = defaultdict(set)
    for record in locations:
        area = areas[record['id']]
        kind = area.get('skiing', 'downhill')
        if kind in ('heli-skiing', 'cat-skiing'):
            continue
        activity = {'cross-country': 'nordic', 'ski-touring': 'skitour'}.get(kind, 'downhill')
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


def write_tiles(db, matched, areas, work, attribution):
    groups = {}
    counts = {}
    inputs = []
    for layer, source_names in {'footprints': ('ski_areas_multipolygon',), **FEATURE_LAYERS}.items():
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
                    if layer == 'runs':
                        uses = values(feature['uses'])
                        use = next((option for option in RUN_USES if option in uses), None)
                        if not use:
                            continue
                        owners = {owner for owner in owners if areas[owner].get('skiing') != 'cross-country' or 'nordic' in uses}
                        props.update(use=use, difficulty=feature['difficulty'], convention=feature['difficulty_convention'],
                                     ref=feature['ref'])
                    elif layer in ('lifts', 'stations'):
                        owners = {owner for owner in owners if areas[owner].get('skiing') not in LIFT_FREE_TYPES}
                        if layer == 'lifts':
                            props.update(liftType=feature['lift_type'])
                    if not owners:
                        continue

                    geometry = feature.GetGeometryRef()
                    if geometry is None or geometry.IsEmpty():
                        continue
                    geometry.FlattenTo2D()
                    props['group'] = groups.setdefault(tuple(sorted(owners)), len(groups) + 1)
                    stream.write(json.dumps({'type': 'Feature', 'properties': {k: v for k, v in props.items() if v},
                                             'geometry': json.loads(geometry.ExportToJson(['COORDINATE_PRECISION=6']))},
                                            ensure_ascii=False, separators=(',', ':')) + '\n')
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('geopackage', type=Path)
    parser.add_argument('metadata', type=Path)
    args = parser.parse_args()
    metadata = read_json(args.metadata)
    if args.geopackage.stat().st_size != metadata['files']['geoPackage']:
        raise SystemExit('GeoPackage size does not match the source metadata.')
    db = ogr.Open(str(args.geopackage))
    if db is None:
        raise SystemExit('Cannot read the OpenSkiData GeoPackage.')
    locations = read_json(DATA / 'locations.json')
    areas = {area['id']: area for area in read_json(DATA / 'areas.json')}
    matched = find_areas(db, areas, locations['locations'])
    if not matched:
        raise SystemExit('No OpenSkiData areas match the catalog.')
    credits = {**locations['attribution'], 'ODbL': locations['license']}
    attribution = ' · '.join(f'<a href="{url}">{name}</a>' for name, url in credits.items())

    with TemporaryDirectory(prefix='resort-terrain-', dir=DATA) as temporary:
        work = Path(temporary)
        archive, by_area, counts = write_tiles(db, matched, areas, work, attribution)
        manifest = {
            'source': SOURCE, 'buildTime': metadata['run']['finishedAt'], 'sourceSha256': sha256(args.geopackage),
            'archiveSha256': sha256(archive), 'license': locations['license'], 'minZoom': MIN_ZOOM, 'maxZoom': MAX_ZOOM,
            'counts': counts, 'groupsByArea': by_area,
        }
        index = work / 'resort-terrain.json'
        index.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        os.replace(archive, DATA / archive.name)
        os.replace(index, DATA / index.name)
    print(f'{len(by_area)} catalog areas, {counts}')


if __name__ == '__main__':
    main()
