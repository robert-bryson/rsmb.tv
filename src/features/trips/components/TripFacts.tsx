import { formatDateRange } from '../../../utils/formatDate';
import { useTripStory } from '../TripStoryContext';

export function TripFacts() {
    const { manifest } = useTripStory();
    const facts = [
        ['Dates', formatDateRange(manifest.dates.start, manifest.dates.end)],
        manifest.ridingDays ? ['Riding days', manifest.ridingDays.toLocaleString()] : null,
        manifest.distanceMiles ? ['Total miles', manifest.distanceMiles.toLocaleString()] : null,
        manifest.motorcycle ? ['Motorcycle', manifest.motorcycle] : null,
        manifest.regions?.length ? ['Region', manifest.regions.join(' · ')] : null,
    ].filter((fact): fact is string[] => Boolean(fact));

    return (
        <dl className="trip-breakout my-8 grid gap-x-8 gap-y-4 border-y border-zinc-800 py-5 sm:grid-cols-2 lg:grid-cols-5">
            {facts.map(([label, value]) => (
                <div key={label}>
                    <dt className="text-xs font-medium uppercase text-zinc-500">{label}</dt>
                    <dd className="mt-1 text-sm text-zinc-200">{value}</dd>
                </div>
            ))}
        </dl>
    );
}