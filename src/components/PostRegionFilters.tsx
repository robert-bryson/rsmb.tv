import { tripFactTag } from '../content/blogTags';
import type { BlogCountry } from '../content/blogRegions';
import { PostFilterLink } from './PostFilterLink';

interface RegionFilterProps {
    countries: BlogCountry[];
    activeCountry: string;
    activeRegion: string;
    createUrl: (country?: string, region?: string) => string;
}

export function PostRegionFilters({ countries, activeCountry, activeRegion, createUrl }: RegionFilterProps) {
    return <nav aria-label="Post regions" className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Regions</p>
            <PostFilterLink to={createUrl()} active={!activeCountry && !activeRegion}>All regions</PostFilterLink>
        </div>
        {countries.map(country => <div key={country.code} role="group" aria-label={country.name} className="flex flex-wrap items-baseline gap-2">
            {country.code ? <PostFilterLink to={createUrl(country.code)} active={activeCountry === country.code && !activeRegion}>
                {country.name}
            </PostFilterLink> : <span className="text-sm font-medium text-zinc-300">{country.name}</span>}
            <span aria-hidden="true" className="text-zinc-600">–</span>
            {country.regions.map(region => {
                const key = tripFactTag(region.name);
                return <PostFilterLink key={key} to={createUrl(country.code, key)}
                    active={(!activeCountry || activeCountry === country.code) && activeRegion === key}>
                    {region.name}
                    <span className="ml-1.5 tabular-nums opacity-70" aria-label={`${region.count} ${region.count === 1 ? 'post' : 'posts'}`}>{region.count}</span>
                </PostFilterLink>;
            })}
            {country.regions.length === 0 && <span className="text-xs text-zinc-400">{country.count} {country.count === 1 ? 'post' : 'posts'}</span>}
        </div>)}
    </nav>;
}
