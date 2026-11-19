import { describe, expect, it } from 'vitest';
import { filterSkiAreas, formatArea, formatSkiLocation, formatSkiStat, passFilterFamily, readPassFilter, readSkiResultsView, readSkiSort, skiAreaIdsInViewport, skiRegionOptions, sortSkiAreas } from '../features/ski-status/browse';
import { readSkiCatalog, skiAreas } from '../features/ski-status/catalog';
import { markerAppearance, markerLegend, readMarkerMode } from '../features/ski-status/mapAppearance';

const area = {
    id: 'test-mountain', name: 'Test Mountain', country: 'US', region: 'WA', locality: 'Test Town', acres: 100,
    website: 'https://example.org/', statsUrl: 'https://example.org/stats', reportUrl: 'https://example.org/conditions',
};
const point = { id: area.id, coordinates: [-121, 47], upstream: ['https://example.org/open-data'] };
const locations = {
    source: 'https://example.org/locations.csv', buildTime: '2026-11-16T01:43:51.452Z',
    license: 'https://example.org/license', attribution: { 'Test data': 'https://example.org/data' }, locations: [point],
};
const membership = { areaId: area.id, family: 'indy', access: 'included', source: 'https://example.org/pass' };
const passes = { season: '2026/27', checkedOn: '2026-11-19', memberships: [membership] };

describe('ski-status catalog validation', () => {
    it('rejects duplicate, missing, and orphan area coordinates', () => {
        expect(() => readSkiCatalog([area, area], locations, passes)).toThrow('Duplicate ski area ID test-mountain');
        expect(() => readSkiCatalog([area], { ...locations, locations: [point, point] }, passes)).toThrow('Duplicate map point ID test-mountain');
        expect(() => readSkiCatalog([area], { ...locations, locations: [] }, passes)).toThrow('No map point for test-mountain');
        expect(() => readSkiCatalog([area], { ...locations, locations: [{ ...point, id: 'unknown' }] }, passes)).toThrow('Map point has no ski area unknown');
    });

    it('rejects missing area references and duplicate pass family rows', () => {
        expect(() => readSkiCatalog([area], locations, { ...passes, memberships: [{ ...membership, areaId: 'unknown' }] }))
            .toThrow('Pass membership has no ski area unknown');
        expect(() => readSkiCatalog([area], locations, { ...passes, memberships: [membership, { ...membership, access: 'discount' }] }))
            .toThrow('Duplicate indy membership for test-mountain');
    });

    it('applies the acreage floor to resorts with no official pass listing', () => {
        const smallArea = { ...area, acres: 99 };
        for (const access of ['included', 'listed', 'discount']) {
            expect(readSkiCatalog([smallArea], locations, { ...passes, memberships: [{ ...membership, access }] }).areas[0]?.id).toBe(area.id);
        }
        expect(() => readSkiCatalog([smallArea], locations, { ...passes, memberships: [] })).toThrow('requires 100 skiable acres');
        expect(readSkiCatalog([area], locations, { ...passes, memberships: [] }).areas[0]?.passes).toEqual([]);
    });

    it('retains a matched pass resort whose stats and conditions are unknown', () => {
        const unknown = { ...area, acres: undefined, statsUrl: undefined, reportUrl: undefined };
        expect(readSkiCatalog([unknown], locations, passes).areas[0]).toMatchObject({ id: area.id, passes: [membership] });
        expect(() => readSkiCatalog([{ ...unknown, summitFt: 1_500 }], locations, passes)).toThrow('No mountain statistics source');
    });

    it.each([
        [{ statsUrl: undefined }, /No mountain statistics source/],
        [{ name: '   ' }, /Too small/],
        [{ skiing: 'snowshoeing' }, /Invalid option/],
        [{ terrainParks: 'yes' }, /expected boolean/],
        [{ trailCountQualifier: 'lower-bound' }, /Lower bound.*reported value/],
        [{ baseFt: 3_000, summitFt: 2_500 }, /Inverted base and summit/],
        [{ highestLiftTerminalFt: 3_000, lowestLiftTerminalFt: 3_100 }, /Inverted lift terminal/],
        [{ nightSkiing: false, nightAcres: 20 }, /Conflicting night skiing/],
        [{ nightSkiing: true, nightAcres: 125 }, /Night skiable acreage exceeds/],
        [{ grades: { unit: 'count', values: { Expert: 0.5 } } }, /Use whole trail counts/],
        [{ grades: { unit: 'percent', values: { Expert: 101 } } }, /percentages from 0 to 100/],
        [{ reportUrl: 'https://test:example@example.org/conditions' }, /Use an HTTPS source URL without credentials/],
        [{ reportUrl: 'http://example.org/conditions' }, /Use an HTTPS source URL without credentials/],
        [{ reportUrl: '/conditions' }, /Use an HTTPS source URL without credentials/],
        [{ reportUrl: 'https:example.org/conditions' }, /Use an HTTPS source URL without credentials/],
        [{ reportUrl: 'https://' }, /Use an HTTPS source URL without credentials/],
    ])('rejects invalid area fields %j', (field, reason) => {
        expect(() => readSkiCatalog([{ ...area, ...field }], locations, passes)).toThrow(reason);
    });

    it('accepts negative elevations and night acreage above a published lower bound', () => {
        const lowerBound = { ...area, acresQualifier: 'lower-bound', nightAcres: 125, nightSkiing: true, baseFt: -20, summitFt: 40 };
        const catalog = readSkiCatalog([lowerBound], locations, { ...passes, season: '2099/00' });
        expect(catalog.areas[0]).toMatchObject(lowerBound);
        expect(catalog.passSeason).toBe('2099/00');
    });

    it('requires map attribution and a pass season that ends in the next year', () => {
        expect(() => readSkiCatalog([area], { ...locations, attribution: {} }, passes)).toThrow('Add a location attribution link');
        expect(() => readSkiCatalog([area], locations, { ...passes, season: '2026/28' })).toThrow('Pass season must end the next year');
    });
});

describe('ski-status catalog and browse', () => {
    it('uses a responsive default view and honors links to each explicit view', () => {
        expect(readSkiResultsView(new URLSearchParams(), true)).toBe('split');
        expect(readSkiResultsView(new URLSearchParams('view=unknown'), false)).toBe('table');
        for (const view of ['map', 'split', 'table']) {
            const params = new URLSearchParams({ view });
            expect(readSkiResultsView(params, true)).toBe(view);
            expect(readSkiResultsView(params, false)).toBe(view);
        }
    });

    it('maps each eligible area once and keeps split base data under one resort', () => {
        expect(skiAreas.length).toBeGreaterThanOrEqual(197);
        expect(new Set(skiAreas.map(area => area.id)).size).toBe(skiAreas.length);
        expect(new Set(skiAreas.map(area => area.location.coordinates.join(','))).size).toBe(skiAreas.length);
        expect(skiAreas.every(area => (area.acres ?? 0) >= 100 || area.passes.length > 0)).toBe(true);
        expect(filterSkiAreas(skiAreas, 'alpine meadows', '').map(area => area.id)).toEqual(['palisades-tahoe']);
    });

    it('includes a small pass partner while excluding discount-only access from that filter', () => {
        expect(filterSkiAreas(skiAreas, 'whaleback', '', 'indy').map(area => area.id)).toEqual(['whaleback']);
        expect(filterSkiAreas(skiAreas, 'whiteface', '', 'indy')).toEqual([]);
        expect(filterSkiAreas(skiAreas, 'whiteface', '')[0]?.passes).toContainEqual(expect.objectContaining({ family: 'indy', access: 'discount' }));
        expect(filterSkiAreas(skiAreas, 'quebec le massif', 'QC', 'mountain-collective').map(area => area.id)).toEqual(['le-massif']);
        expect(filterSkiAreas(skiAreas, 'heavenly', 'NV', 'epic').map(area => area.id)).toEqual(['heavenly']);
    });

    it('finds ski areas by full country name', () => {
        const canada = filterSkiAreas(skiAreas, 'Canada', '');
        expect(canada.length).toBeGreaterThanOrEqual(30);
        expect(canada.every(area => area.country === 'CA')).toBe(true);
    });

    it('distinguishes countries from overlapping state codes in filters and displays international locations', () => {
        const { countries, regions } = skiRegionOptions(skiAreas);
        expect(countries).toContainEqual({ value: 'country:CA', label: 'Canada' });
        expect(regions).toContain('CA');
        expect(filterSkiAreas(skiAreas, 'mammoth', 'CA').map(area => area.id)).toContain('mammoth-mountain');
        expect(filterSkiAreas(skiAreas, 'mammoth', 'country:CA')).toEqual([]);
        const found = filterSkiAreas(skiAreas, 'new zealand mt hutt', 'country:NZ', 'ikon');
        expect(found.map(area => area.id)).toEqual(['mt-hutt']);
        expect(formatSkiStat(found[0], 'region', 'metric')).toBe('New Zealand');
        expect(formatSkiLocation(found[0])).toBe('Methven, New Zealand');
    });

    it('keeps dots whose projected centers are inside or on the edges of the map', () => {
        const viewport = { left: 0, top: 0, right: 320, bottom: 180 };
        const centers: [number, number][] = [[0, 0], [320, 180], [160, 90], [-1, 1], [321, 1], [1, -1], [1, 181]];
        const areas = centers.map((coordinates, index) => {
            const area = skiAreas[index];
            return { ...area, location: { ...area.location, coordinates } };
        });
        const visible = skiAreaIdsInViewport(areas, viewport, ([x, y]) => ({ x, y }));
        expect([...visible]).toEqual(areas.slice(0, 3).map(area => area.id));
    });

    it('requires a known yes for night skiing and ignores invalid pass or sort parameters', () => {
        const nightAreas = filterSkiAreas(skiAreas, '', '', undefined, true);
        expect(nightAreas.length).toBeGreaterThan(0);
        expect(nightAreas.every(area => area.nightSkiing === true)).toBe(true);
        expect(readPassFilter(new URLSearchParams('pass=indy'))).toBe('indy');
        expect(readPassFilter(new URLSearchParams('pass=invalid'))).toBeUndefined();
        expect(readSkiSort(new URLSearchParams('sort=acres:desc'))).toEqual({ key: 'acres', direction: 'desc' });
    });

    it('formats lower bounds, elevations, and night availability in both unit settings', () => {
        const peak = skiAreas.find(area => area.id === 'granite-peak')!;
        expect(formatSkiStat(peak, 'name', 'metric')).toBe('Granite Peak');
        expect(formatSkiStat(peak, 'acres', 'imperial')).toBe('200+ ac');
        expect(formatSkiStat(peak, 'acres', 'metric')).toBe('80.9+ ha');
        expect(formatArea(101, 'metric', true)).toBe('40.8+ ha');
        expect(formatSkiStat({ ...peak, verticalFt: 1000 }, 'verticalFt', 'metric')).toBe('305 m');
        expect(formatSkiStat({ ...peak, nightSkiing: false }, 'nightSkiing', 'metric')).toBe('No');
    });

    it('sorts a reported zero ahead of unknown values in either direction and preserves lower bounds', () => {
        const unreported = skiAreas.find(area => area.trailCount === undefined)!;
        const reported = skiAreas.find(area => area.id === 'park-city-mountain')!;
        expect(formatSkiStat(reported, 'trailCount', 'imperial')).toBe('330+');
        const zero = { ...reported, trailCount: 0, trailCountQualifier: undefined };
        expect(formatSkiStat(zero, 'trailCount', 'imperial')).toBe('0');
        const otherUnknown = { ...unreported, id: 'other-unknown', name: 'Z Unknown' };
        for (const direction of ['asc', 'desc'] as const) {
            expect(sortSkiAreas([otherUnknown, unreported, zero], { key: 'trailCount', direction })).toEqual([zero, unreported, otherUnknown]);
        }
        expect(readSkiSort(new URLSearchParams('sort=unrecognized:desc'))).toEqual({ key: 'name', direction: 'asc' });
    });

    it('sorts names and regions as text', () => {
        const rows = [{ ...skiAreas[0], name: 'Ski 2', region: 'VT' }, { ...skiAreas[1], name: 'Ski 10', region: 'CA' }];
        expect(sortSkiAreas(rows, { key: 'name', direction: 'desc' })).toEqual([rows[1], rows[0]]);
        expect(sortSkiAreas(rows, { key: 'region', direction: 'asc' })).toEqual([rows[1], rows[0]]);
    });
});

describe('2026/27 Ikon destination coverage', () => {
    it.each([
        ['AD', ['grandvalira', 'ordino-arcalis', 'pal-arinsal']],
        ['AT', ['ischgl-samnaun', 'kitzbuehel']],
        ['AU', ['mt-buller', 'thredbo']],
        ['CH', ['corvatsch', 'corviglia', 'diavolezza-lagalb', 'zermatt-matterhorn']],
        ['CL', ['valle-nevado']],
        ['CN', ['beidahu-ski-resort', 'lake-songhua-resort', 'yunding-snow-park']],
        ['FR', ['balme-vallorcine', 'brevent-flegere', 'grands-montets', 'les-houches', 'megeve']],
        ['IT', ['3-zinnen-dolomites', 'alpe-lusia-san-pellegrino', 'alta-badia', 'arabba-marmolada', 'cervino-ski-paradise', 'civetta',
            'cortina-d-ampezzo', 'courmayeur-mont-blanc', 'kronplatz', 'la-thuile-espace-san-bernardo', 'monterosa-ski', 'pila',
            'rio-pusteria-bressanone', 'san-martino-rolle-pass', 'val-di-fassa-carezza', 'val-di-fiemme-obereggen', 'val-gardena-alpe-di-siusi']],
        ['JP', ['appi-resort', 'arai-mountain-resort', 'furano-ski-resort', 'madarao-mountain-resort', 'mt-t',
            'myoko-suginohara-ski-resort', 'nekoma-mountain', 'niseko-united', 'shiga-kogen-mountain-resort', 'zao-onsen-ski-resort']],
        ['KR', ['mona-yongpyong']],
        ['NZ', ['coronet-peak', 'mt-hutt', 'the-remarkables']],
    ] as const)('includes the confirmed Ikon areas in %s', (code, ids) => {
        expect(filterSkiAreas(skiAreas, '', `country:${code}`, 'ikon').map(area => area.id)).toEqual(expect.arrayContaining([...ids]));
    });

    it.each([
        ['Aspen Snowmass', 4], ['Big Bear Mountain Resort', 2], ['Chamonix Mont-Blanc Valley', 4],
        ['Dolomiti Superski', 12], ['Grandvalira Resorts Andorra', 3], ['Killington - Pico', 2],
        ['SkiBig3', 3], ['St. Moritz', 3], ['Valle d’Aosta', 5],
    ] as const)('finds all entries for %s by its destination name', (name, count) => {
        expect(filterSkiAreas(skiAreas, name, '', 'ikon')).toHaveLength(count);
    });

    it('keeps the listed Austrian areas without advertising lift access', () => {
        const austrianAreas = filterSkiAreas(skiAreas, '', 'country:AT');
        const onlyListed = austrianAreas.filter(area => area.passes.some(pass => pass.family === 'ikon' && pass.access === 'listed'));
        expect(onlyListed.map(area => area.id)).toEqual(['galtuer', 'kappl', 'see']);
        expect(filterSkiAreas(onlyListed, '', '', 'ikon')).toEqual([]);
        for (const area of onlyListed) {
            expect(markerAppearance(area, 'pass')).toEqual(markerAppearance({ ...area, passes: [] }, 'pass'));
        }
    });
});

describe('2026/27 Epic destination coverage', () => {
    it.each([
        ['AU', ['falls-creek', 'hotham', 'perisher']],
        ['AT', ['hintertux-glacier', 'hochfuegen-hochzillertal', 'kitzsteinhorn', 'lech-am-arlberg', 'mayrhofen',
            'schmittenhoehe', 'silvretta-montafon', 'skicircus-saalbach', 'soelden', 'spieljoch', 'st-anton-am-arlberg',
            'st-christoph-am-arlberg', 'stuben-am-arlberg', 'zillertal-arena', 'zuers-am-arlberg']],
        ['CA', ['fernie-alpine-resort', 'kicking-horse', 'kimberley-alpine-resort', 'mont-sainte-anne', 'nakiska-ski-area',
            'station-touristique-stoneham', 'whistler-blackcomb']],
        ['CH', ['andermatt-gemsstock', 'andermatt-sedrun', 'bruson', 'crans-montana', 'disentis', 'la-tzoumaz', 'nendaz',
            'thyon', 'verbier', 'veysonnaz']],
        ['FR', ['brides-les-bains', 'courchevel', 'les-menuires', 'meribel', 'orelle', 'saint-martin-de-belleville', 'val-thorens']],
        ['IT', ['alpe-cimbra', 'folgarida-marilleva', 'madonna-di-campiglio', 'monte-bondone', 'paganella-ski',
            'pejo-3000', 'pinzolo', 'pontedilegno-tonale']],
        ['JP', ['hakuba-47', 'hakuba-cortina', 'hakuba-goryu', 'hakuba-happo-one', 'hakuba-iwatake', 'hakuba-norikura-onsen',
            'hakuba-sanosaka', 'jigatake', 'kashimayari', 'rusutsu-resort', 'tsugaike-mountain-resort']],
        ['US', ['afton-alps', 'alpine-valley', 'attitash-mountain-resort', 'beaver-creek-resort', 'big-boulder', 'boston-mills',
            'brandywine', 'breckenridge-ski-resort', 'crested-butte-mountain-resort', 'crotched-mountain', 'heavenly',
            'hidden-valley-resort', 'hidden-valley-ski-resort', 'hunter-mountain', 'jack-frost-mountain', 'keystone-resort',
            'kirkwood-mountain-resort', 'laurel-mountain', 'liberty-mountain-resort', 'mad-river-mountain', 'mount-snow',
            'mount-sunapee', 'mt-brighton', 'northstar-california-resort', 'okemo-mountain-resort', 'paoli-peaks',
            'park-city-mountain', 'roundtop-mountain-resort', 'seven-springs-mountain-resort', 'snow-creek', 'stevens-pass',
            'stowe', 'telluride-ski-resort', 'vail-mountain', 'whitetail-resort', 'wildcat-mountain', 'wilmot-mountain']],
    ] as const)('includes the named Epic areas in %s', (code, ids) => {
        expect(filterSkiAreas(skiAreas, '', `country:${code}`, 'epic').map(area => area.id)).toEqual(expect.arrayContaining([...ids]));
    });

    it.each([
        ['Andermatt-Sedrun-Disentis', 3], ['Hakuba Valley', 10], ['Les Trois Vallées', 7],
        ['Resorts of the Canadian Rockies', 6], ['Saalbach & Zell am See-Kaprun', 3], ['Ski Arlberg', 5],
        ['Skirama Dolomiti', 8], ['Verbier 4 Vallées', 6], ['Zillertal', 5],
    ] as const)('finds all Epic entries for %s by group name', (name, count) => {
        expect(filterSkiAreas(skiAreas, name, '', 'epic')).toHaveLength(count);
    });
});

describe('2026/27 Indy destination coverage', () => {
    it('retains every roster profile and its source', () => {
        const indy = skiAreas.flatMap(area => area.passes.filter(pass => pass.family === 'indy').map(pass => ({ area, pass })));
        expect(indy).toHaveLength(303);
        expect(new Set(indy.map(({ pass }) => pass.source)).size).toBe(303);
        expect(indy.filter(({ pass }) => new URL(pass.source).pathname.startsWith('/our-resorts/'))).toHaveLength(302);
        const countries = new Map<string, number>();
        for (const { area } of indy) countries.set(area.country, (countries.get(area.country) ?? 0) + 1);
        expect(Object.fromEntries(countries)).toEqual({
            AT: 13, CA: 43, CH: 5, CL: 1, CZ: 1, ES: 1, FI: 3, FR: 4, GB: 2, IT: 1, JP: 28, NO: 6, SE: 3, SI: 1, US: 191,
        });
        expect(indy.every(({ area }) => area.statsUrl && area.nightSkiing !== undefined)).toBe(true);
    });

    it('finds international areas by country and keeps distinct shared-pass entries', () => {
        const filteredIds = (query: string, country: string) =>
            filterSkiAreas(skiAreas, query, `country:${country}`, 'indy').map(area => area.id);
        expect(filteredIds('amihari', 'JP')).toEqual(['amihari-onsen-ski-resort']);
        expect(filteredIds('corralco', 'CL')).toEqual(['corralco-resort-de-montana']);
        expect(filteredIds('krvavec', 'SI')).toEqual(['krvavec-ski-resort']);
        expect(filteredIds('kühtai', 'AT')).toEqual(['innsbruck-region']);
        expect(filteredIds('portes du soleil', 'FR')).toEqual(['portes-du-soleil']);
        expect(filteredIds('manning park', 'CA')).toEqual(['manning-park', 'manning-park-xc']);
        expect(filteredIds('pila', 'IT')).toContain('pila');
        expect(skiAreas.find(area => area.id === 'pila')?.passes.map(pass => pass.family)).toEqual(['ikon', 'indy']);
    });

    it('keeps included access separate from Allied and heli-ski discounts', () => {
        const pass = readPassFilter(new URLSearchParams('pass=indy-discounts'));
        expect(pass).toBe('indy-discounts');
        expect(passFilterFamily('indy-discounts')).toBe('indy');
        expect(filterSkiAreas(skiAreas, '', '', pass).map(area => area.id))
            .toEqual(['belleayre-mountain', 'gore-mountain', 'mont-ripley-ski-area', 'north-cascade-heli', 'whiteface']);
        expect(filterSkiAreas(skiAreas, '', '', 'indy')).toHaveLength(298);
        expect(filterSkiAreas(skiAreas, 'gore mountain', '', 'indy').map(area => area.id)).toEqual(['gore-mountain-nordic-center']);
        expect(filterSkiAreas(skiAreas, 'stoke mountain', '', 'indy')[0]?.skiing).toBe('indoor');
    });

    it('searches and sorts by skiing type and keeps missing Nordic lift counts empty', () => {
        const nordic = filterSkiAreas(skiAreas, 'cross-country manning', 'BC', 'indy')[0]!;
        const alpine = filterSkiAreas(skiAreas, 'cherry peak', 'UT', 'indy')[0]!;
        expect(nordic.id).toBe('manning-park-xc');
        expect(formatSkiStat(nordic, 'skiing', 'imperial')).toBe('Cross-country');
        expect(formatSkiStat(nordic, 'liftCount', 'imperial')).toBeUndefined();
        expect(formatSkiStat(nordic, 'terrainParks', 'imperial')).toBe('No');
        expect(formatSkiStat(alpine, 'terrainParks', 'imperial')).toBe('Yes');
        expect(formatSkiStat(alpine, 'acres', 'imperial')).toBe('220+ ac');
        expect(sortSkiAreas([alpine, nordic], { key: 'skiing', direction: 'asc' })).toEqual([nordic, alpine]);
    });
});

describe('ski-status marker colors', () => {
    it('distinguishes included passes, multiple passes, and discount-only access', () => {
        const legend = markerLegend('pass', 'imperial');
        const alta = skiAreas.find(area => area.id === 'alta')!;
        const whiteface = skiAreas.find(area => area.id === 'whiteface')!;
        const whaleback = skiAreas.find(area => area.id === 'whaleback')!;
        expect(markerAppearance({ ...alta, passes: [...alta.passes].reverse() }, 'pass')).toEqual({
            color: legend.find(entry => entry.multiple)?.color,
            passBadge: 'ikon-plus',
        });
        expect(markerAppearance(alta, 'pass', 'mountain-collective').passBadge).toBe('mountain-collective-plus');
        expect(markerAppearance(alta, 'pass', 'epic').passBadge).toBe('ikon-plus');
        expect(markerAppearance(whaleback, 'pass')).toEqual({ color: legend.find(entry => entry.family === 'indy')?.color, passBadge: 'indy' });
        expect(markerAppearance({ ...whiteface, passes: whiteface.passes.filter(pass => pass.access === 'discount') }, 'pass'))
            .toEqual({ color: legend.find(entry => entry.label === 'Discount only')?.color });
        expect(markerAppearance({ ...alta, passes: [] }, 'pass')).toEqual({ color: legend.find(entry => entry.label === 'No pass recorded')?.color });
        expect(markerAppearance(alta, 'default')).toEqual({ color: '#67e8f9' });
    });

    it('uses the numeric bin at its boundary and marks unknown values separately', () => {
        const legend = markerLegend('acres', 'metric');
        const source = skiAreas[0];
        expect(legend[0]?.label).toBe('Under 101.2 ha');
        expect(markerAppearance({ ...source, acres: 249 }, 'acres')).toEqual({ color: legend[0]?.color });
        expect(markerAppearance({ ...source, acres: 250 }, 'acres').color).toBe(legend[1]?.color);
        expect(markerAppearance({ ...source, acres: undefined }, 'acres').color).toBe(legend.at(-1)?.color);
        expect(markerLegend('default', 'metric')).toEqual([]);
        expect(readMarkerMode('__proto__')).toBe('default');
        expect(readMarkerMode(null)).toBe('default');
        expect(readMarkerMode('verticalFt')).toBe('verticalFt');
        expect(markerLegend('highestLiftTerminalFt', 'imperial').at(-2)?.label).toBe('9,000 ft and up');
    });

    it('assigns lower bounds to a color only when the published value proves the range', () => {
        const peak = skiAreas.find(area => area.id === 'granite-peak')!;
        const legend = markerLegend('acres', 'imperial');
        expect(markerAppearance(peak, 'acres').color).toBe(legend.at(-1)?.color);
        expect(markerAppearance({ ...peak, acres: 2_500 }, 'acres').color).toBe(legend.at(-2)?.color);
        expect(markerAppearance({ ...peak, acresQualifier: undefined }, 'acres').color).toBe(legend[0]?.color);
    });
});
