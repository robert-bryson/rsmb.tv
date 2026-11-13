#!/usr/bin/env python3
"""Build global country and first-level region pins from pinned Natural Earth sources."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import tempfile
import urllib.request
from urllib.parse import urlparse
import zipfile

from shapely import make_valid
from shapely.geometry import MultiPolygon, Point, shape
from shapely.geometry.polygon import orient

import generate as geometry

ROOT = geometry.ROOT
SNAPSHOT = json.loads((ROOT / 'shared/geography/naturalEarthSnapshot.json').read_text(encoding='utf-8'))
CATALOG_PATH = ROOT / 'shared/geography/worldCatalog.json'
US_PUBLICATION = ROOT / 'public/data/pins-of-inaccessibility/pins.json'


def download(source, cache):
    expected = SNAPSHOT['sources'][source]
    target = cache / Path(urlparse(expected['url']).path).name
    if not target.exists():
        with urllib.request.urlopen(expected['url'], timeout=120) as response:
            content = response.read()
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=cache, suffix='.tmp', delete=False) as output:
                temporary = Path(output.name)
                output.write(content)
            if geometry.file_sha256(temporary) != expected['sha256']:
                raise ValueError(f'Unexpected Natural Earth source checksum: {source}')
            with zipfile.ZipFile(temporary) as archive:
                if archive.testzip() is not None:
                    raise ValueError(f'Invalid source archive: {source}')
            temporary.replace(target)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
    if geometry.file_sha256(target) != expected['sha256']:
        raise ValueError(f'Cached Natural Earth archive differs from the pinned source: {source}')
    return target


def country_records(archive):
    return [(record, shape_) for record, shape_ in geometry.read_shapes(archive)
            if record['ADM0_A3'] not in SNAPSHOT['excludedCountries']]


def align_region_to_country(region, country):
    """Use the parent country's coastline when the two source layers differ."""
    region = make_valid(region)
    if country.covers(region):
        return region, False
    parts = geometry.polygons(region.intersection(country))
    if not parts:
        raise ValueError('A source region has no area inside its parent country')
    return make_valid(MultiPolygon(parts)), True


def region_records(archive, countries=None):
    parents = {record['ADM0_A3']: make_valid(shape_) for record, shape_ in countries} if countries else None
    records = []
    for record, shape_ in geometry.read_shapes(archive):
        if record['adm0_a3'] in {*SNAPSHOT['excludedCountries'], 'USA'}:
            continue
        if parents is not None:
            shape_, adjusted = align_region_to_country(shape_, parents[record['adm0_a3']])
            record['countryBoundaryAdjusted'] = adjusted
        records.append((record, shape_))
    return records


def make_catalog(countries, regions, us_pins):
    by_country = {}
    for record, _ in regions:
        by_country.setdefault(record['adm0_a3'], []).append(f"region-{record['adm1_code']}")
    output = []
    for record, shape_ in countries:
        code = record['ADM0_A3']
        identifiers = sorted(by_country.get(code, []))
        identifier = f'country-{code}'
        bounds = geometry.wrapped_bounds(shape_)
        if code == 'USA':
            identifiers = sorted(pin['id'] for pin in us_pins if pin['level'] == 'state')
            identifier = 'country-US'
            bounds = next(pin['bounds'] for pin in us_pins if pin['level'] == 'country')
        output.append({'code': code, 'id': identifier, 'name': record['NAME_EN'] or record['ADMIN'],
                       'bounds': bounds, 'regionIds': identifiers})
        if code == 'USA':
            output[-1]['name'] = 'United States'
    codes = {country['code'] for country in output}
    if set(by_country) - codes:
        raise ValueError('A first-level region has no country')
    return {'version': SNAPSHOT['version'], 'countries': sorted(output, key=lambda country: country['code'])}


def mapped_area(geometry_):
    # Orient shells and holes consistently before summing ellipsoidal areas.
    return sum(abs(geometry.GEOD.geometry_area_perimeter(orient(part, sign=1))[0])
               for part in geometry.polygons(make_valid(geometry_))) / 1_000_000


def build_pin(record, shape_, level, countries):
    country_code = record['ADM0_A3'] if level == 'country' else record['adm0_a3']
    code = country_code if level == 'country' else record['adm1_code']
    area = mapped_area(shape_)
    extent_meters = math.sqrt(area * 1_000_000)
    tolerance = min(25, max(0.01, extent_meters / 1000))
    simplification = min(20, max(0.001, extent_meters / 10000))
    lng, lat, radius, edge_lng, edge_lat = geometry.solve_geometry(shape_, tolerance, simplification)
    if not -85 <= lat <= 85:
        raise ValueError(f'Pin is outside the map projection: {code}')
    fallback = f'Unnamed region ({code})'
    name = (record['NAME_EN'] or record['ADMIN']) if level == 'country' else record['name_en'] or record['name'] or fallback
    short_code = country_code if level == 'country' else next(value for value in [record['iso_3166_2'], record['postal'], code] if value and value != '-99')
    identifier = f'country-{code}' if level == 'country' else f'region-{code}'
    pin = {'id': identifier, 'level': 'country' if level == 'country' else 'state',
           'kind': 'country / territory' if level == 'country' else record['type_en'] or 'region',
           'name': name, 'code': short_code, 'countryCode': country_code, 'countryName': countries[country_code]['name'],
           'lng': round(lng, 8), 'lat': round(lat, 8), 'radiusMeters': round(radius, 3),
           'nearestBoundary': [round(edge_lng, 8), round(edge_lat, 8)], 'bounds': geometry.wrapped_bounds(shape_),
           'areaKm2': round(area, 4), 'searchToleranceMeters': tolerance,
           'solveSimplificationMeters': simplification, 'unnamed': name == fallback,
           'countryBoundaryAdjusted': bool(record.get('countryBoundaryAdjusted', False))}
    pin['boundaryContacts'] = geometry.boundary_contacts(shape_, pin, coordinate_precision=8, distance_precision=3)
    error = geometry.verify_source_pin(pin, shape_, sample_margin=min(2, radius * 0.001))
    display = geometry.display_geometry(shape_, simplification_degrees=0.02 if level == 'country' else 0.0015)
    feature = {'type': 'Feature', 'id': identifier,
               'properties': {'id': identifier, 'name': name, 'countryCode': country_code, 'level': pin['level']},
               'geometry': display}
    return pin, feature, error


def validate_artifact(name, payload):
    catalog = json.loads(CATALOG_PATH.read_text(encoding='utf-8'))
    countries = {country['code']: country for country in catalog['countries']}
    foreign = {code: country for code, country in countries.items() if code != 'USA'}
    foreign_region_count = sum(len(country['regionIds']) for country in foreign.values())
    if name == 'pins.json' or (name.startswith('regions/') and name.endswith('.json') and name[8:-5] in foreign):
        pins, metadata = payload['pins'], payload['metadata']
        region_code = None if name == 'pins.json' else name[8:-5]
        expected_ids = {country['id'] for country in countries.values()} if not region_code else set(foreign[region_code]['regionIds'])
        if {pin['id'] for pin in pins} != expected_ids or len(pins) != len(expected_ids):
            raise ValueError('Incomplete or duplicate world pin publication')
        if metadata['version'] != SNAPSHOT['version'] or metadata['sourceSha256'] != {key: item['sha256'] for key, item in SNAPSHOT['sources'].items()}:
            raise ValueError('World pin provenance differs from the pinned source')
        if region_code and metadata['countryCode'] != region_code:
            raise ValueError('World region payload names the wrong country')
        if not region_code and (metadata['countryCount'] != len(countries) or metadata['regionCount'] != sum(len(country['regionIds']) for country in countries.values())):
            raise ValueError('World pin metadata counts differ from coverage')
        if not region_code:
            adjusted = metadata.get('adjustedRegionCount')
            if (metadata.get('regionalBoundaryAlignment') != SNAPSHOT['regionalBoundaryAlignment']
                    or not isinstance(adjusted, int) or isinstance(adjusted, bool) or not 0 <= adjusted <= foreign_region_count):
                raise ValueError('World regional alignment metadata differs from the publication policy')
            for field, expected in [('scale', SNAPSHOT['scale']), ('license', SNAPSHOT['license']),
                                    ('source', 'Natural Earth / U.S. Census')]:
                if metadata.get(field) != expected:
                    raise ValueError(f'World {field} differs from its source metadata')
            geometry.validate_name(metadata.get('definition'), 'world boundary definition', maximum=2000)
            geometry.validate_timestamp(metadata.get('generatedAt'))
            verification = metadata.get('verification')
            if (not isinstance(verification, dict) or verification.get('checked') != len(foreign) + foreign_region_count
                    or verification.get('circleSamples') != verification['checked'] * 72):
                raise ValueError('World source verification coverage is incomplete')
            for field in ['maxRadiusErrorMeters', 'maxContactBoundaryErrorMeters']:
                geometry.validate_number(verification.get(field), field)
                if verification[field] >= 1:
                    raise ValueError('World source verification exceeds the publication tolerance')
        for pin in pins:
            if pin.get('level') != ('state' if region_code else 'country'):
                raise ValueError('World pin has the wrong administrative level')
            if pin['id'] == 'country-US':
                expected = next(item for item in json.loads(US_PUBLICATION.read_text(encoding='utf-8'))['pins'] if item['id'] == 'country-US')
                if pin != expected:
                    raise ValueError('The world index must retain the published Census national pin')
                continue
            country = foreign.get(pin['countryCode'])
            if not country or pin['countryName'] != country['name']:
                raise ValueError('World pin country identity differs from the catalog')
            if pin['id'] not in ([country['id']] if pin['level'] == 'country' else country['regionIds']):
                raise ValueError('World pin identity differs from its country')
            geometry.validate_pin_geometry(pin, SNAPSHOT['maxRadiusMeters'])
            geometry.validate_number(pin.get('areaKm2'), 'mapped area')
            geometry.validate_number(pin.get('searchToleranceMeters'), 'search tolerance', maximum=25, positive=True)
            geometry.validate_number(pin.get('solveSimplificationMeters'), 'working simplification', maximum=20)
            geometry.validate_name(pin.get('kind'), 'jurisdiction kind')
            geometry.validate_name(pin.get('code'), 'jurisdiction code', maximum=60)
            if pin['level'] == 'country' and pin['name'] != country['name']:
                raise ValueError('Country name differs from the pinned catalog')
            if not isinstance(pin.get('unnamed'), bool) or not isinstance(pin.get('countryBoundaryAdjusted'), bool):
                raise ValueError('Missing regional alignment provenance')
        return
    if name == 'countries.geojson':
        owners = {country['id']: (country['code'], 'country') for country in countries.values()}
    elif name.startswith('regions/') and name.endswith('.geojson') and name[8:-8] in foreign:
        code = name[8:-8]
        owners = {identifier: (code, 'state') for identifier in foreign[code]['regionIds']}
    else:
        raise ValueError(f'Unsupported world artifact: {name}')
    expected_ids = set(owners)
    if payload.get('type') != 'FeatureCollection' or len(payload['features']) != len(expected_ids) or {feature['id'] for feature in payload['features']} != expected_ids:
        raise ValueError('Incomplete or duplicate world boundaries')
    for feature in payload['features']:
        properties = feature['properties']
        if (feature.get('type') != 'Feature' or feature['id'] != properties['id']
                or (properties.get('countryCode'), properties.get('level')) != owners[feature['id']]):
            raise ValueError('Invalid world boundary identity')
        geometry.validate_name(properties.get('name'))
        geometry.validate_display_geometry(feature['geometry'])


def verify_publication(archives, output):
    catalog = json.loads(CATALOG_PATH.read_text(encoding='utf-8'))['countries']
    artifacts = ['pins.json', 'countries.geojson'] + [f'regions/{country["code"]}.{suffix}'
        for country in catalog if country['code'] != 'USA' for suffix in ['json', 'geojson']]
    pins = {}
    for name in artifacts:
        payload = json.loads((output / name).read_text(encoding='utf-8'))
        validate_artifact(name, payload)
        if name.endswith('.json'):
            pins.update({pin['id']: pin for pin in payload['pins']})
    errors = []
    countries = country_records(archives['country'])
    parents = {record['ADM0_A3']: make_valid(shape_) for record, shape_ in countries}
    national_pins = {pin['countryCode']: pin for pin in pins.values() if pin['level'] == 'country' and pin['id'] != 'country-US'}
    max_regional_radius_excess = 0
    for level, records in [('country', countries), ('region', region_records(archives['region'], countries))]:
        for record, shape_ in records:
            code = record['ADM0_A3'] if level == 'country' else record['adm1_code']
            if level == 'country' and code == 'USA':
                continue
            pin = pins[f'{level}-{code}']
            errors.append(geometry.verify_source_pin(pin, shape_, sample_margin=min(2, pin['radiusMeters'] * 0.001)))
            if level == 'region':
                if pin['countryBoundaryAdjusted'] != record['countryBoundaryAdjusted']:
                    raise ValueError('Regional alignment provenance differs from the source')
                if not parents[pin['countryCode']].covers(Point(pin['lng'], pin['lat'])):
                    raise ValueError('A regional pin is outside its parent country')
                max_regional_radius_excess = max(max_regional_radius_excess,
                    pin['radiusMeters'] - national_pins[pin['countryCode']]['radiusMeters'])
                if max_regional_radius_excess > 100:
                    raise ValueError('A regional radius exceeds its approximate country maximum')
    if len(errors) != len(pins) - 1:
        raise ValueError('Source verification missed a published world pin')
    adjusted_count = sum(pin.get('countryBoundaryAdjusted', False) for pin in pins.values())
    if adjusted_count != json.loads((output / 'pins.json').read_text(encoding='utf-8'))['metadata']['adjustedRegionCount']:
        raise ValueError('Regional alignment count differs from the publication metadata')
    return {'checked': len(errors), 'circleSamples': len(errors) * 72,
            'maxRadiusErrorMeters': max(error[0] for error in errors),
            'maxContactBoundaryErrorMeters': max(error[1] for error in errors),
            'regionsInsideParent': sum(pin['level'] == 'state' for pin in pins.values()),
            'adjustedRegionCount': adjusted_count,
            'maxRegionalRadiusExcessMeters': max_regional_radius_excess}


def benchmark(archives, output):
    """Measure sensitivity to four origins without changing any published point."""
    selected = {'CAN', 'RUS', 'AUS', 'BRA', 'CHN', 'FRA', 'GRL', 'IDN'}
    pins = {pin['id']: pin for pin in json.loads((output / 'pins.json').read_text(encoding='utf-8'))['pins']}
    results = []
    for record, shape_ in country_records(archives['country']):
        code = record['ADM0_A3']
        if code not in selected:
            continue
        pin = pins[f'country-{code}']
        component = None
        for part in geometry.polygons(make_valid(shape_)):
            candidate = geometry.unwrap_polygon(part)
            anchor = candidate.exterior.coords[0][0]
            longitude = anchor + (pin['lng'] - anchor + 180) % 360 - 180
            if candidate.covers(Point(longitude, pin['lat'])):
                component = candidate
                break
        if component is None:
            raise ValueError(f'No benchmark component contains {code}')
        seeds = [component.representative_point(), component.centroid,
                 component.exterior.interpolate(0.25, normalized=True), component.exterior.interpolate(0.75, normalized=True)]
        radii = [geometry.solve_polygon(component, initial_origin=(seed.x, seed.y))[2] for seed in seeds]
        results.append({'country': code, 'publishedRadiusMeters': pin['radiusMeters'], 'seedRadiiMeters': radii,
                        'spreadMeters': max(radii) - min(radii), 'bestGainMeters': max(radii) - pin['radiusMeters']})
    return {'method': 'Four AEQD origins in the component containing each published country pin. This measures solver sensitivity, not independent proof of a global geodesic optimum.',
            'results': results}


def generate(archives, output, write_catalog=False):
    countries = country_records(archives['country'])
    regions = region_records(archives['region'], countries)
    parent_shapes = {record['ADM0_A3']: make_valid(shape_) for record, shape_ in countries}
    if len(countries) + len(SNAPSHOT['excludedCountries']) != SNAPSHOT['sources']['country']['count']:
        raise ValueError('Unexpected source country coverage')
    us = json.loads(US_PUBLICATION.read_text(encoding='utf-8'))
    geometry.validate_artifact('pins.json', us)
    catalog = make_catalog(countries, regions, us['pins'])
    if write_catalog:
        geometry.write_json(CATALOG_PATH, catalog)
        return
    if json.loads(CATALOG_PATH.read_text(encoding='utf-8')) != catalog:
        raise ValueError('Source coverage differs from worldCatalog.json; inspect and update the catalog first')
    lookup = {country['code']: country for country in catalog['countries']}
    pins, country_features, region_features, errors = [], [], {}, []
    national_pins = {}
    for level, records in [('country', countries), ('region', regions)]:
        for index, (record, shape_) in enumerate(records):
            if level == 'country' and record['ADM0_A3'] == 'USA':
                country_features.append({'type': 'Feature', 'id': 'country-US',
                    'properties': {'id': 'country-US', 'name': 'United States', 'countryCode': 'USA', 'level': 'country'},
                    'geometry': geometry.display_geometry(shape_, simplification_degrees=0.02)})
                continue
            pin, feature, error = build_pin(record, shape_, level, lookup)
            if level == 'region':
                if not parent_shapes[pin['countryCode']].covers(Point(pin['lng'], pin['lat'])):
                    raise ValueError(f"Regional pin is outside its parent country: {pin['id']}")
                national = national_pins[pin['countryCode']]
                if pin['radiusMeters'] > national['radiusMeters'] + 100:
                    raise ValueError(f"Regional radius exceeds the approximate country maximum: {pin['id']}")
            else:
                national_pins[pin['countryCode']] = pin
            pins.append(pin)
            errors.append(error)
            if level == 'country':
                country_features.append(feature)
            else:
                region_features.setdefault(pin['countryCode'], []).append(feature)
            if level == 'country' or index % 100 == 0:
                print(f"{level} {index + 1}/{len(records)}: {pin['name']} ({pin['countryCode']})", flush=True)
    metadata = {'version': SNAPSHOT['version'], 'scale': SNAPSHOT['scale'], 'license': SNAPSHOT['license'],
                'generatedAt': datetime.now(timezone.utc).isoformat(), 'source': 'Natural Earth / U.S. Census',
                'sourceSha256': {key: value['sha256'] for key, value in SNAPSHOT['sources'].items()},
                'countryCount': len(lookup),
                'regionCount': sum(len(country['regionIds']) for country in lookup.values()),
                'definition': 'Administrative borders and coastline; large inland lakes retained; source enclaves count.',
                'regionalBoundaryAlignment': SNAPSHOT['regionalBoundaryAlignment'],
                'adjustedRegionCount': sum(pin['countryBoundaryAdjusted'] for pin in pins if pin['level'] == 'state'),
                'verification': {'checked': len(errors), 'circleSamples': len(errors) * 72,
                    'maxRadiusErrorMeters': max(error[0] for error in errors),
                    'maxContactBoundaryErrorMeters': max(error[1] for error in errors)}}
    national = next(pin for pin in us['pins'] if pin['id'] == 'country-US')
    artifacts = {'pins.json': {'metadata': metadata, 'pins': sorted([national] + [pin for pin in pins if pin['level'] == 'country'], key=lambda pin: pin['id'])},
                 'countries.geojson': {'type': 'FeatureCollection', 'features': country_features}}
    for code, country in lookup.items():
        if code != 'USA':
            artifacts[f'regions/{code}.geojson'] = {'type': 'FeatureCollection', 'features': region_features.get(code, [])}
            artifacts[f'regions/{code}.json'] = {'metadata': {'version': SNAPSHOT['version'], 'countryCode': code, 'sourceSha256': metadata['sourceSha256']},
                                                'pins': [pin for pin in pins if pin['level'] == 'state' and pin['countryCode'] == code]}
    geometry.write_publication(output, artifacts, validate=validate_artifact)
    print(json.dumps(metadata, indent=2), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=ROOT / '.cache/pins-of-inaccessibility/world')
    parser.add_argument('--output', type=Path, default=ROOT / 'public/data/pins-of-inaccessibility/world')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--write-catalog', action='store_true', help='Write the source identity catalog without calculating pins')
    mode.add_argument('--verify-only', action='store_true', help='Check every world artifact and pin against its full source')
    mode.add_argument('--benchmark', action='store_true', help='Measure country solver sensitivity to four different origins')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=2) as executor:
        archives = dict(zip(SNAPSHOT['sources'], executor.map(lambda key: download(key, args.cache), SNAPSHOT['sources'])))
    if args.verify_only or args.benchmark:
        result = verify_publication(archives, args.output) if args.verify_only else benchmark(archives, args.output)
        print(json.dumps(result, indent=2), flush=True)
    else:
        generate(archives, args.output, args.write_catalog)


if __name__ == '__main__':
    main()
