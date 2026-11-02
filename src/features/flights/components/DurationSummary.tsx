import type { FlightProperties } from '../types';
import { flightDurationCoverage, flightDurationKindLabel, flightDurationLabel, flightDurationSourceLabel, formatFlightDuration, formatFlightDurationAccessible, formatFlightHours, resolveFlightDuration, type FlightDurationSummary } from '../utils/flightDuration';

function DurationValue({ minutes }: { minutes: number | null }) {
    return <>
        <span aria-hidden="true">{formatFlightDuration(minutes)}</span>
        <span className="sr-only">{formatFlightDurationAccessible(minutes)}</span>
    </>;
}

export function FlightDurationDetail({ flight }: { flight: FlightProperties }) {
    const duration = resolveFlightDuration(flight);
    return <>
        <div className="text-purple-300">{duration.minutes === null ? 'Flight time unavailable' : <><DurationValue minutes={duration.minutes} /> · {flightDurationKindLabel(duration.kind)}</>}</div>
        {duration.source && <div>Source: {flightDurationSourceLabel(duration.source)}</div>}
        {duration.reportedMinutes !== null && <div>Reported duration: <DurationValue minutes={duration.reportedMinutes} /> (timing basis unknown; source: {flight.durationSource})</div>}
    </>;
}

export function DurationSummary({ summary }: { summary: FlightDurationSummary }) {
    const count = summary.flightCount - summary.unavailableCount;
    return (
        <section aria-label="Flight time" className="mb-4 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
            <div className="flex flex-wrap justify-between gap-2 text-purple-300">
                <span>{flightDurationLabel(summary)}</span>
                <strong aria-label={count ? `${(summary.totalMinutes / 60).toLocaleString('en-US', { maximumFractionDigits: 1 })} hours` : 'Flight time unavailable'}>{formatFlightHours(summary)}</strong>
            </div>
            {count > 0 && <p className="mt-1 text-xs text-gray-300">Average: <DurationValue minutes={summary.totalMinutes / count} /></p>}
            <p className="mt-1 text-xs text-gray-400">{flightDurationCoverage(summary)}</p>
            <p className="mt-1 text-xs text-gray-500">Gate-to-gate. Estimates use distance and a fixed allowance.</p>
        </section>
    );
}
