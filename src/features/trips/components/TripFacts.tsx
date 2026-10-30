import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { createBlogTagSearch, tripFactTag } from '../../../content/blogTags';
import { createBlogRegionSearch } from '../../../content/blogRegions';
import { formatDateRange } from '../../../utils/formatDate';
import { useTripStory } from '../TripStoryContext';

const factLinkClasses = 'transition-colors hover:text-violet-400 hover:underline focus-visible:text-violet-400 focus-visible:underline underline-offset-4';

function FactTagLink({ tag, children }: { tag: string; children: ReactNode }) {
    return (
        <Link
            to={`/posts${createBlogTagSearch(tripFactTag(tag))}`}
            className={factLinkClasses}
        >
            {children}
        </Link>
    );
}

function RegionLinks({ regions, country = '' }: { regions: string[]; country?: string }) {
    return regions.map((region, index) => (
        <Fragment key={region}>
            {index > 0 && ', '}
            <Link to={`/posts${createBlogRegionSearch(country, region)}`} className={factLinkClasses}>{region}</Link>
        </Fragment>
    ));
}

export function TripFacts() {
    const { manifest } = useTripStory();
    const groupedRegions = new Set(manifest.countries?.flatMap(country => country.regions ?? []));
    const ungroupedRegions = (manifest.regions ?? []).filter(region => !groupedRegions.has(region));
    const facts: { label: string; heading?: ReactNode; value: ReactNode }[] = [
        { label: 'Dates', value: formatDateRange(manifest.dates.start, manifest.dates.end) },
    ];

    if (manifest.ridingDays) {
        facts.push({ label: 'Riding days', value: manifest.ridingDays.toLocaleString() });
    }
    if (manifest.distanceMiles) {
        const miles = Math.round(manifest.distanceMiles).toLocaleString();
        const kilometers = Math.round(manifest.distanceMiles * 1.609344).toLocaleString();
        facts.push({ label: 'Distance', value: `${miles} mi · ${kilometers} km` });
    }
    if (manifest.motorcycle) {
        facts.push({
            label: 'Motorcycle',
            heading: <FactTagLink tag="motorcycle">Motorcycle</FactTagLink>,
            value: <FactTagLink tag={manifest.motorcycle}>{manifest.motorcycle}</FactTagLink>,
        });
    }
    if (manifest.countries?.length || manifest.regions?.length) {
        facts.push({
            label: 'Region',
            value: manifest.countries?.length ? <div className="space-y-2">
                {manifest.countries.map(country => <div key={country.code} className="max-w-full">
                    <Link to={`/posts${createBlogRegionSearch(country.code)}`} className={`${factLinkClasses} font-semibold text-violet-300`}>{country.code}</Link>
                    {!!country.regions?.length && <>
                        {' · '}
                        <RegionLinks regions={country.regions} country={country.code} />
                    </>}
                </div>)}
                {ungroupedRegions.length > 0 && <div><RegionLinks regions={ungroupedRegions} /></div>}
            </div> : <RegionLinks regions={manifest.regions ?? []} />,
        });
    }

    const desktopColumns = [
        'lg:grid-cols-1',
        'lg:grid-cols-2',
        'lg:grid-cols-3',
        'lg:grid-cols-4',
        'lg:grid-cols-[1.2fr_0.65fr_1.2fr_1.2fr_1.1fr]',
    ][facts.length - 1];

    return (
        <dl aria-label="Trip details" className={`trip-breakout my-8 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-zinc-800 py-5 ${desktopColumns}`}>
            {facts.map(({ label, heading, value }) => (
                <div key={label} className={`min-w-0 ${label === 'Region' ? 'col-span-2 lg:col-span-1' : ''}`}>
                    <dt className="text-[0.8125rem] font-semibold uppercase tracking-wider text-zinc-400">{heading ?? label}</dt>
                    <dd className="mt-2 text-base font-medium leading-snug text-zinc-100 sm:text-lg">{value}</dd>
                </div>
            ))}
        </dl>
    );
}
