import { z } from 'zod';
import linksData from '../../../projects/ski-status/data/resort-links.json';
import snowData from '../../../projects/ski-status/data/snow-history.json';
import { formatSkiLocation } from './skiGeography';
import { skiAreas, type SkiArea, type Skiing } from './catalog';
import { httpsUrl, skiId } from './schemas';

const label = z.string().trim().min(1);
const month = z.string().regex(/^(?:[1-9]|1[0-2])$/);
const centimetres = z.number().nonnegative();
const monthlyValues = z.record(month, centimetres).refine(values => Object.keys(values).length > 0, 'Add a monthly measurement');
const snowSource = {
    label, source: httpsUrl, period: label.optional(), location: label.optional(),
};
const snowfall = z.strictObject({
    ...snowSource, annualCm: centimetres.optional(),
    annualSource: z.union([httpsUrl, z.strictObject(snowSource)]).optional(),
    monthlyCm: monthlyValues.optional(),
}).refine(record => record.annualCm !== undefined || record.monthlyCm, 'Add a snowfall measurement')
    .refine(record => !record.annualSource || record.annualCm !== undefined, 'Annual source requires annual snowfall');
const depth = z.strictObject({
    ...snowSource, kind: z.enum(['base', 'survey', 'station', 'monthly-peak']), monthlyCm: monthlyValues,
    monthlySources: z.record(month, httpsUrl).optional(),
}).refine(record => Object.keys(record.monthlySources ?? {}).every(month => Object.hasOwn(record.monthlyCm, month)),
    'Monthly depth source requires a measurement');
const snowProfiles = z.record(skiId, z.strictObject({ snowfall: snowfall.optional(), depth: depth.optional() })
    .refine(record => record.snowfall || record.depth, 'Add a snow record'));

const googleMapsUrl = httpsUrl.refine(value => {
    if (!URL.canParse(value)) return false;
    const { origin, pathname } = new URL(value);
    if (origin === 'https://maps.app.goo.gl') return /^\/[\w-]+$/.test(pathname);
    if (origin === 'https://maps.google.com' && pathname === '/') return true;
    return ['https://www.google.com', 'https://google.com', 'https://maps.google.com'].includes(origin)
        && (pathname === '/maps' || pathname.startsWith('/maps/'));
}, 'Use a Google Maps destination URL');
const wikipediaTarget = label.refine(value => {
    const [title, section, ...rest] = value.split('#');
    return Boolean(title.trim() && title !== '.' && title !== '..' && !rest.length && (section === undefined || section.trim()));
}, 'Use a Wikipedia title with an optional section');
const resortLinks = z.strictObject({
    wikipediaTitles: z.record(skiId, wikipediaTarget),
    googleMaps: z.record(skiId, z.strictObject({ url: googleMapsUrl, source: httpsUrl })).default({}),
    iconSources: z.record(skiId, httpsUrl),
});
const serviceIconIds = ['google-maps', 'wikipedia'];
const iconAssets = import.meta.glob<string>('./resort-icons/*.{png,ico}', { eager: true, query: '?url&no-inline', import: 'default' });

export function readResortDetails(snowInput: unknown, linksInput: unknown, areas: readonly { id: string }[],
    assets: Readonly<Record<string, string>>) {
    const areaIds = new Set(areas.map(area => area.id));
    const history = new Map(Object.entries(snowProfiles.parse(snowInput)));
    const { wikipediaTitles, googleMaps, iconSources } = resortLinks.parse(linksInput);
    const articles = new Map(Object.entries(wikipediaTitles));
    const mapDestinations = new Map(Object.entries(googleMaps));
    for (const id of [...history.keys(), ...articles.keys(), ...mapDestinations.keys()]) {
        if (!areaIds.has(id)) throw new Error(`Resort details have no ski area ${id}`);
    }

    const icons = new Map<string, string>();
    for (const [path, url] of Object.entries(assets)) {
        const id = path.slice(path.lastIndexOf('/') + 1, path.lastIndexOf('.'));
        if (icons.has(id)) throw new Error(`Duplicate resort icon ${id}`);
        if (!Object.hasOwn(iconSources, id)) throw new Error(`No source for resort icon ${id}`);
        icons.set(id, url);
    }
    for (const id of Object.keys(iconSources)) {
        if (!areaIds.has(id) && !serviceIconIds.includes(id)) throw new Error(`Resort icon has no ski area ${id}`);
        if (!icons.has(id)) throw new Error(`Missing resort icon file ${id}`);
    }
    for (const id of serviceIconIds) {
        if (!icons.has(id)) throw new Error(`Missing link icon ${id}`);
    }
    return { history, articles, mapDestinations, icons };
}

const { history, articles, mapDestinations, icons } = readResortDetails(snowData, linksData, skiAreas, iconAssets);
export const skiSnowHistory: ReadonlyMap<string, z.infer<typeof snowProfiles>[string]> = history;

export function skiResortIcon(id: string) {
    return icons.get(id);
}

const mapSearchCategories: Record<Skiing, string> = {
    downhill: 'ski area', both: 'ski area', 'cross-country': 'cross-country skiing', indoor: 'indoor skiing',
    'heli-skiing': 'heli-skiing', 'cat-skiing': 'cat skiing', 'ski-touring': 'ski touring',
    'dry-slope': 'dry ski slope', freeride: 'freeride skiing',
};

function wikiPath(value: string) {
    return encodeURIComponent(value.replaceAll(' ', '_'));
}

export function skiAreaExternalLinks(area: SkiArea) {
    const destination = mapDestinations.get(area.id);
    const entrance = area.location.base?.kind === 'entrance' ? area.location.base.coordinates : undefined;
    const mapQuery = entrance ? `${entrance[1]},${entrance[0]}`
        : `${area.name}, ${mapSearchCategories[area.skiing]}, ${formatSkiLocation(area)}`;
    const mapParameters = new URLSearchParams({ api: '1', query: mapQuery });
    const [title, section] = articles.get(area.id)?.split('#') ?? [];
    return {
        maps: destination?.url ?? `https://www.google.com/maps/search/?${mapParameters}`,
        searchesMaps: !destination && !entrance,
        wikipedia: title ? `https://en.wikipedia.org/wiki/${wikiPath(title)}${section ? `#${wikiPath(section)}` : ''}` : undefined,
        article: section ?? title,
    };
}
