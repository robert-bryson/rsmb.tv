import { describe, expect, it } from 'vitest';
import { skiAreas } from '../features/ski-status/catalog';
import { readResortDetails, skiAreaExternalLinks, skiResortIcon, skiResortIconCandidates, skiSnowHistory } from '../features/ski-status/resortDetailsData';
import { readResortPeaks, resortPeaks } from '../features/ski-status/resortPeaks';

const source = 'https://example.test/measurements';
const iconSources = { 'google-maps': source, wikipedia: source };
const assets = { './resort-icons/google-maps.png': '/maps.png', './resort-icons/wikipedia.ico': '/wikipedia.ico' };
const areas = [{ id: 'resort' }];
const links = { wikipediaTitles: {}, iconSources };
const measurement = { label: 'Snow course', source };
const peak = {
    id: 'example-peak', name: 'Example Peak', coordinates: [-111, 45], elevationFt: 7000,
    locationSource: source, checkedOn: '2026-11-21', trailMaps: [{ areaId: 'resort', source }],
};

describe('ski-status resort data', () => {
    it('uses each resort icon URL once and prefers the requested size', () => {
        const runtime = skiResortIcon('alta')!;
        const detailsIcon = '/archive/alta/details-84.png';
        const archive = { mapIcon: runtime, detailsIcon };
        expect(skiResortIconCandidates('alta', archive)).toEqual({ urls: [runtime, detailsIcon], runtime });
        expect(skiResortIconCandidates('alta', archive, 'detailsIcon')).toEqual({ urls: [detailsIcon, runtime], runtime });
        expect(skiResortIconCandidates('hurricane-ridge')).toEqual({ urls: [], runtime: undefined });
    });

    it('keeps one summit for multiple resorts with their own maps', () => {
        const shared = { ...peak, trailMaps: [...peak.trailMaps, { areaId: 'other-resort', source }] };
        expect(readResortPeaks([shared], [...areas, { id: 'other-resort' }])).toEqual([shared]);
        expect(() => readResortPeaks([shared], areas)).toThrow('Peak example-peak has no ski area other-resort');
        expect(() => readResortPeaks([peak, peak], areas)).toThrow('Duplicate peak example-peak');
        expect(() => readResortPeaks([{ ...peak, trailMaps: [...peak.trailMaps, ...peak.trailMaps] }], areas))
            .toThrow('Duplicate trail map for example-peak and resort');
    });

    it('validates the summit point and the map and location sources', () => {
        expect(() => readResortPeaks([{ ...peak, coordinates: [45, -111] }], areas)).toThrow();
        expect(() => readResortPeaks([{ ...peak, locationSource: 'http://example.test' }], areas)).toThrow();
        expect(() => readResortPeaks([{ ...peak, trailMaps: [] }], areas)).toThrow();
        expect(resortPeaks.find(({ id }) => id === 'sargents-brundage')).toMatchObject({
            name: 'Sargents', elevationFt: 7803, trailMaps: [{ areaId: 'brundage-mountain-resort' }],
        });
    });

    it('accepts a separate HTTPS source for a published summit elevation', () => {
        const sourcedPeak = { ...peak, elevationSource: 'https://example.test/summit-map' };
        expect(readResortPeaks([sourcedPeak], areas)).toEqual([sourcedPeak]);
        expect(() => readResortPeaks([{ ...sourcedPeak, elevationFt: undefined }], areas))
            .toThrow('Elevation source requires a summit elevation');
        expect(() => readResortPeaks([{ ...sourcedPeak, elevationSource: 'http://example.test/map' }], areas)).toThrow();
    });

    it('uses the published skiable vertical at Mt. Norquay', () => {
        const norquay = skiAreas.find(area => area.id === 'mt-norquay');
        expect(norquay?.verticalFt).toBe(1650);
        expect(norquay?.statSources?.find(({ fields }) => fields.includes('verticalFt'))?.source)
            .toMatch(/^https:\/\/banffnorquay\.com\//);
    });

    it('keeps zero measurements and requires an actual value for each source', () => {
        const depth = { ...measurement, kind: 'survey', monthlyCm: { 1: 0 }, monthlySources: { 1: source } };
        const data = { resort: { snowfall: { ...measurement, annualCm: 0, annualSource: source }, depth } };
        const { history } = readResortDetails(data, links, areas, assets);
        expect(history.get('resort')).toEqual(data.resort);
        expect(() => readResortDetails({ resort: {} }, links, areas, assets)).toThrow('Add a snow record');
        expect(() => readResortDetails({ resort: { depth: { ...depth, monthlyCm: {} } } }, links, areas, assets)).toThrow('Add a monthly measurement');
        expect(() => readResortDetails({ resort: { depth: { ...depth, monthlySources: { 2: source } } } }, links, areas, assets))
            .toThrow('Monthly depth source requires a measurement');
        expect(() => readResortDetails({ resort: { snowfall: { ...measurement, monthlyCm: { 1: 10 }, annualSource: source } } }, links, areas, assets))
            .toThrow('Annual source requires annual snowfall');
    });

    it('validates annual snowfall citations independently from the monthly series', () => {
        const annualSource = { label: 'Base station', source: 'https://example.test/annual', period: '1991–2020', location: 'Visitor base' };
        const load = (snowfall: unknown) => readResortDetails({ resort: { snowfall } }, links, areas, assets).history.get('resort')?.snowfall;
        const monthly = { ...measurement, monthlyCm: { 1: 10 } };
        const combined = { ...monthly, annualCm: 100, annualSource };
        expect(load(combined)).toEqual(combined);
        expect(() => load({ ...monthly, annualSource })).toThrow('Annual source requires annual snowfall');
        expect(() => load({ ...combined, annualSource: { ...annualSource, source: 'http://example.test/insecure' } })).toThrow();
        expect(() => load({ ...combined, annualSource: { ...annualSource, location: '  ' } })).toThrow();
    });

    it('requires catalog IDs for snow profiles and Wikipedia articles', () => {
        const snow = { snowfall: { ...measurement, annualCm: 40 } };
        expect(() => readResortDetails({ removed: snow }, links, areas, assets)).toThrow('Resort details have no ski area removed');
        expect(() => readResortDetails({}, { ...links, wikipediaTitles: { removed: 'Some Resort' } }, areas, assets))
            .toThrow('Resort details have no ski area removed');
        expect(() => readResortDetails({}, { ...links, wikipediaTitles: { resort: '..' } }, areas, assets)).toThrow();
        expect(() => readResortDetails({}, { ...links, wikipediaTitles: { resort: 'Resort#' } }, areas, assets)).toThrow();
    });

    it('requires a catalog ID and source for each direct Google Maps destination', () => {
        const url = 'https://www.google.com/maps?cid=123';
        const googleMaps = { resort: { url, source } };
        expect(readResortDetails({}, { ...links, googleMaps }, areas, assets).mapDestinations.get('resort')).toEqual({ url, source });
        expect(() => readResortDetails({}, { ...links, googleMaps }, [], assets)).toThrow('Resort details have no ski area resort');
        expect(() => readResortDetails({}, { ...links, googleMaps: { resort: { url } } }, areas, assets)).toThrow();
        expect(() => readResortDetails({}, {
            ...links, googleMaps: { resort: { url: 'https://www.google.com/url?q=https://example.test', source } },
        }, areas, assets)).toThrow('Use a Google Maps destination URL');
    });

    it('keeps operator annual snowfall and nearby station measurements attributed to their sources', () => {
        const station = 'https://www.ncei.noaa.gov/pub/data/ghcn/daily/all/USC00200925.dly';
        expect(skiSnowHistory.get('boyne-mountain')).toMatchObject({
            snowfall: {
                annualCm: 355.6,
                annualSource: { label: 'Boyne Mountain Resort', source: 'https://www.boynemountain.com/mountain-stats' },
                source: station,
                location: expect.stringContaining('Boyne Falls, MI'),
                monthlyCm: { 1: 69.8 },
            },
            depth: { kind: 'station', source: station, monthlyCm: { 1: 16.4 } },
        });
    });

    it('requires one source and one file per icon and includes both service icons', () => {
        const withResortFile = { ...assets, './resort-icons/resort.png': '/resort.png' };
        const withResortSource = { ...links, iconSources: { ...iconSources, resort: source } };
        expect(readResortDetails({}, withResortSource, areas, withResortFile).icons.get('resort')).toBe('/resort.png');
        expect(() => readResortDetails({}, links, areas, withResortFile)).toThrow('No source for resort icon resort');
        expect(() => readResortDetails({}, withResortSource, areas, assets)).toThrow('Missing resort icon file resort');
        expect(() => readResortDetails({}, withResortSource, [], withResortFile)).toThrow('Resort icon has no ski area resort');
        expect(() => readResortDetails({}, withResortSource, areas, { ...withResortFile, './resort-icons/resort.ico': '/resort.ico' }))
            .toThrow('Duplicate resort icon resort');
        expect(() => readResortDetails({}, { ...links, iconSources: { wikipedia: source } }, areas, { './resort-icons/wikipedia.ico': '/wikipedia.ico' }))
            .toThrow('Missing link icon google-maps');
    });

    it('uses verified entrance coordinates and labels a search by ski activity when the entrance is unverified', () => {
        const sunshine = skiAreas.find(area => area.id === 'banff-sunshine')!;
        const direct = skiAreaExternalLinks(sunshine);
        expect(new URL(direct.maps).searchParams.get('query')).toBe('51.114965,-115.763609');
        expect(direct.searchesMaps).toBe(false);
        expect(direct.wikipedia).toBe('https://en.wikipedia.org/wiki/Banff_Sunshine');
        expect(skiResortIcon(sunshine.id)).toContain('banff-sunshine');
        expect(skiSnowHistory.get(sunshine.id)?.snowfall?.annualCm).toBe(723);

        const fallback = skiAreaExternalLinks({
            ...sunshine, id: 'constructor', name: 'Mountain', skiing: 'cross-country',
            location: { ...sunshine.location, base: { ...sunshine.location.base!, kind: 'lift-base' } },
        });
        expect(fallback.article).toBeUndefined();
        expect(fallback.wikipedia).toBeUndefined();
        expect(fallback.searchesMaps).toBe(true);
        expect(new URL(fallback.maps).searchParams.get('query')).toMatch(/^Mountain, cross-country skiing, /);
        expect(skiResortIcon('constructor')).toBeUndefined();
    });

    it('links Hunter and both Crystal Mountains to their distinct ski areas', () => {
        const linksFor = (id: string) => skiAreaExternalLinks(skiAreas.find(area => area.id === id)!);
        const hunter = linksFor('hunter-mountain');
        expect(hunter.searchesMaps).toBe(false);
        expect(hunter.wikipedia).toBe('https://en.wikipedia.org/wiki/Hunter_Mountain_(ski_area)');
        const hunterWithoutListing = { ...skiAreas.find(area => area.id === 'hunter-mountain')!, id: 'area-with-entrance' };
        const entrance = skiAreaExternalLinks(hunterWithoutListing);
        expect(entrance.searchesMaps).toBe(false);
        expect(new URL(entrance.maps).searchParams.get('query')).toBe('42.2048167,-74.2099667');
        const washington = linksFor('crystal-mountain');
        const michigan = linksFor('crystal-mountain-mi');
        expect(washington.maps).not.toBe(michigan.maps);
        expect(washington.wikipedia).toBe('https://en.wikipedia.org/wiki/Crystal_Mountain_(Washington)');
        expect(michigan.wikipedia).toBe('https://en.wikipedia.org/wiki/Crystal_Mountain_(Michigan)');
    });

    it('opens the verified Whiteface ski area section of its mountain article', () => {
        const area = skiAreas.find(area => area.id === 'whiteface')!;
        expect(skiAreaExternalLinks(area)).toMatchObject({
            article: 'Whiteface Mountain Ski Area',
            wikipedia: 'https://en.wikipedia.org/wiki/Whiteface_Mountain#Whiteface_Mountain_Ski_Area',
        });
    });
});
