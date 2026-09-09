import { formatDate } from '../../../utils/formatDate';
import { useTripStory } from '../TripStoryContext';

export function TripFacts() {
    const { manifest } = useTripStory();
    const dateRange = manifest.dates.start === manifest.dates.end
        ? formatDate(manifest.dates.start)
        : `${formatDate(manifest.dates.start)} – ${formatDate(manifest.dates.end)}`;
    const facts = [
        ['Dates', dateRange],
        manifest.distanceMiles ? ['Distance', `${manifest.distanceMiles.toLocaleString()} miles`] : null,
        manifest.motorcycle ? ['Motorcycle', manifest.motorcycle] : null,
        manifest.regions?.length ? ['Route', manifest.regions.join(' · ')] : null,
    ].filter((fact): fact is string[] => Boolean(fact));

    return (
        <dl className="trip-breakout my-8 grid gap-x-8 gap-y-4 border-y border-zinc-800 py-5 sm:grid-cols-2 lg:grid-cols-4">
            {facts.map(([label, value]) => (
                <div key={label}>
                    <dt className="text-xs font-medium uppercase text-zinc-500">{label}</dt>
                    <dd className="mt-1 text-sm text-zinc-200">{value}</dd>
                </div>
            ))}
        </dl>
    );
}