import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { createBlogTagSearch, tripFactTag } from '../../../content/blogTags';
import { formatDateRange } from '../../../utils/formatDate';
import { useTripStory } from '../TripStoryContext';

function FactTagLink({ tag, children }: { tag: string; children: ReactNode }) {
    return (
        <Link
            to={`/posts${createBlogTagSearch(tripFactTag(tag))}`}
            className="transition-colors hover:text-violet-400 hover:underline focus-visible:text-violet-400 focus-visible:underline underline-offset-4"
        >
            {children}
        </Link>
    );
}

export function TripFacts() {
    const { manifest } = useTripStory();
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
    if (manifest.regions?.length) {
        facts.push({
            label: 'Region',
            value: manifest.regions.map((region, index) => (
                <Fragment key={region}>
                    {index > 0 && ' · '}
                    <FactTagLink tag={region}>{region}</FactTagLink>
                </Fragment>
            )),
        });
    }

    return (
        <dl className="trip-breakout my-8 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-zinc-800 py-5 sm:grid-cols-2 lg:grid-cols-5">
            {facts.map(({ label, heading, value }) => (
                <div key={label}>
                    <dt className="text-xs font-medium uppercase text-zinc-400">{heading ?? label}</dt>
                    <dd className="mt-1 text-sm text-zinc-200">{value}</dd>
                </div>
            ))}
        </dl>
    );
}
