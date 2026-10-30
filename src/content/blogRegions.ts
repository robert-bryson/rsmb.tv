import { tripFactTag } from './blogTags';

export interface PostCountry {
    code: string;
    regions: string[];
}

type LocatedPost = { countries?: PostCountry[]; tags?: string[] };

export interface BlogCountry {
    code: string;
    name: string;
    count: number;
    regions: { name: string; count: number }[];
}

// Recognize geographic Sheet tags even when a post has no trip manifest.
const defaultCountries: PostCountry[] = [
    { code: 'US', regions: [
        'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
        'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois',
        'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts',
        'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
        'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
        'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
        'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
        'West Virginia', 'Wisconsin', 'Wyoming',
    ] },
    { code: 'CA', regions: [
        'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
        'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
        'Quebec', 'Saskatchewan', 'Yukon',
    ] },
];

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

export function getCountryName(code: string): string {
    return code ? countryNames.of(code) ?? code : 'Other regions';
}

export function separatePostGeography(
    tags: string[],
    countries: { code: string; regions?: string[] }[] = [],
    legacyRegions: string[] = [],
): { tags: string[]; countries: PostCountry[] } {
    const countryTags = new Map<string, string>();
    const regionTags = new Map<string, { code: string; name: string }[]>();
    for (const country of [...defaultCountries, ...countries]) {
        countryTags.set(tripFactTag(country.code), country.code);
        countryTags.set(tripFactTag(getCountryName(country.code)), country.code);
        for (const region of country.regions ?? []) {
            const key = tripFactTag(region);
            const matches = regionTags.get(key) ?? [];
            if (!matches.some(match => match.code === country.code)) {
                matches.push({ code: country.code, name: region.trim().replace(/\s+/g, ' ') });
            }
            regionTags.set(key, matches);
        }
    }
    countryTags.set('usa', 'US');
    countryTags.set('united-states-of-america', 'US');

    const locations = new Map<string, Map<string, string>>();
    function add(code: string, region?: string) {
        const regions = locations.get(code) ?? new Map<string, string>();
        if (region) {
            const key = tripFactTag(region);
            const name = regionTags.get(key)?.find(match => match.code === code)?.name
                ?? region.trim().replace(/\s+/g, ' ');
            regions.set(key, name);
        }
        locations.set(code, regions);
    }

    for (const country of countries) {
        add(country.code);
        for (const region of country.regions ?? []) add(country.code, region);
    }
    for (const region of legacyRegions) {
        const key = tripFactTag(region);
        if ([...locations.values()].some(regions => regions.has(key))) continue;
        const matches = regionTags.get(key) ?? [];
        const code = matches.length === 1 ? matches[0].code : countries.length === 1 ? countries[0].code : '';
        add(code, region);
    }

    const topicTags = tags.filter(tag => {
        const key = tripFactTag(tag);
        const countryCode = countryTags.get(key);
        if (countryCode) {
            add(countryCode);
            return false;
        }
        const matches = regionTags.get(key) ?? [];
        if (matches.length) {
            const relevant = matches.length === 1 ? matches : matches.filter(match => locations.has(match.code));
            if (relevant.length) {
                for (const match of relevant) add(match.code, match.name);
                return false;
            }
        }
        return ![...locations.values()].some(regions => regions.has(key));
    });

    return {
        tags: topicTags,
        countries: [...locations].map(([code, regions]) => ({ code, regions: [...regions.values()] })),
    };
}

export function getAllBlogRegions(posts: LocatedPost[]): BlogCountry[] {
    const groups = new Map<string, { count: number; regions: Map<string, { name: string; count: number }> }>();
    for (const post of posts) {
        const seen = new Set<string>();
        for (const country of post.countries ?? []) {
            const group = groups.get(country.code) ?? { count: 0, regions: new Map() };
            if (!seen.has(country.code)) group.count += 1;
            seen.add(country.code);
            for (const name of country.regions) {
                const key = `${country.code}/${tripFactTag(name)}`;
                if (seen.has(key)) continue;
                seen.add(key);
                const region = group.regions.get(key) ?? { name, count: 0 };
                region.count += 1;
                group.regions.set(key, region);
            }
            groups.set(country.code, group);
        }
    }
    return [...groups].map(([code, group]) => ({
        code,
        name: getCountryName(code),
        count: group.count,
        regions: [...group.regions.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function filterPostsByRegion<Post extends LocatedPost>(posts: Post[], country: string, region = ''): Post[] {
    if (!country && !region) return posts;
    return posts.filter(post => post.countries?.some(location => (
        (!country || location.code === country)
        && (!region || location.regions.some(name => tripFactTag(name) === region))
    )));
}

export function createBlogRegionSearch(country = '', region = ''): string {
    const params = new URLSearchParams();
    const code = country.trim().toUpperCase();
    const name = tripFactTag(region);
    if (code) params.set('country', code);
    if (name) params.set('region', name);
    const search = params.toString();
    return search ? `?${search}` : '';
}

/** Resolve existing fact links and bookmarked geographic tag URLs. */
export function findGeographicTag(posts: LocatedPost[], tag: string): { country: string; region: string } | undefined {
    // A visible topical tag must select its posts even if another post has a matching country name.
    if (!tag || posts.some(post => post.tags?.includes(tag))) return undefined;
    const key = ['usa', 'united-states-of-america'].includes(tripFactTag(tag)) ? 'us' : tripFactTag(tag);
    const countries = posts.flatMap(post => post.countries ?? []);
    const codeMatch = countries.find(country => key === tripFactTag(country.code));
    if (codeMatch) return { country: codeMatch.code, region: '' };
    // Historic region links used names; country links used two-letter codes.
    if (countries.some(country => country.regions.some(region => tripFactTag(region) === key))) {
        return { country: '', region: key };
    }
    const nameMatch = countries.find(country => key === tripFactTag(getCountryName(country.code)));
    return nameMatch ? { country: nameMatch.code, region: '' } : undefined;
}
