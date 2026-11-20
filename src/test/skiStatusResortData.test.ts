import { describe, expect, it } from 'vitest';
import { skiAreas } from '../features/ski-status/catalog';
import { readResortDetails, skiAreaExternalLinks, skiResortIcon, skiSnowHistory } from '../features/ski-status/resortDetailsData';

const source = 'https://example.test/measurements';
const iconSources = { 'google-maps': source, wikipedia: source };
const assets = { './resort-icons/google-maps.png': '/maps.png', './resort-icons/wikipedia.ico': '/wikipedia.ico' };
const areas = [{ id: 'resort' }];
const links = { wikipediaTitles: {}, iconSources };
const measurement = { label: 'Snow course', source };

describe('ski-status resort data', () => {
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

    it('requires catalog IDs for snow profiles and Wikipedia articles', () => {
        const snow = { snowfall: { ...measurement, annualCm: 40 } };
        expect(() => readResortDetails({ removed: snow }, links, areas, assets)).toThrow('Resort details have no ski area removed');
        expect(() => readResortDetails({}, { ...links, wikipediaTitles: { removed: 'Some Resort' } }, areas, assets))
            .toThrow('Resort details have no ski area removed');
        expect(() => readResortDetails({}, { ...links, wikipediaTitles: { resort: '..' } }, areas, assets)).toThrow();
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

    it('uses exact coordinates for a verified entrance and searches by name for a mapped lift base', () => {
        const sunshine = skiAreas.find(area => area.id === 'banff-sunshine')!;
        const direct = skiAreaExternalLinks(sunshine);
        expect(new URL(direct.maps).searchParams.get('query')).toBe('51.114965,-115.763609');
        expect(direct.wikipedia).toBe('https://en.wikipedia.org/wiki/Banff_Sunshine');
        expect(skiResortIcon(sunshine.id)).toContain('banff-sunshine');
        expect(skiSnowHistory.get(sunshine.id)?.snowfall?.annualCm).toBe(723);

        const fallback = skiAreaExternalLinks({
            ...sunshine, id: 'constructor', location: { ...sunshine.location, base: { ...sunshine.location.base!, kind: 'lift-base' } },
        });
        expect(fallback.article).toBeUndefined();
        expect(new URL(fallback.maps).searchParams.get('query')).toContain(sunshine.name);
        expect(new URL(fallback.wikipedia).searchParams.get('search')).toContain(sunshine.name);
        expect(skiResortIcon('constructor')).toBeUndefined();
    });
});
