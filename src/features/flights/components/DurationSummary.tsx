import type { FlightProperties } from '../types';
import { flightDurationCoverage, flightDurationKindLabel, flightDurationSourceLabel, formatFlightDuration, formatFlightDurationAccessible, resolveFlightDuration, type FlightDurationSummary } from '../utils/flightDuration';
import { CollapsibleSection, FlightHoursValue, StatItem } from './shared';

function DurationValue({ minutes }: { minutes: number | null }) {
    return <>
        <span aria-hidden="true">{formatFlightDuration(minutes)}</span>
        <span className="sr-only">{formatFlightDurationAccessible(minutes)}</span>
    </>;
}

export function FlightDurationDetail({ flight }: { flight: FlightProperties }) {
    const duration = resolveFlightDuration(flight);
    return <>
        <div>{duration.minutes === null ? 'Flight time unavailable' : <><DurationValue minutes={duration.minutes} /> · {flightDurationKindLabel(duration.kind)}</>}</div>
        {duration.source && <div>Source: {flightDurationSourceLabel(duration.source)}</div>}
        {duration.reportedMinutes !== null && <div>Reported duration: <DurationValue minutes={duration.reportedMinutes} /> (timing basis unknown; source: {flight.durationSource})</div>}
    </>;
}

interface DurationSummaryProps {
    summary: FlightDurationSummary;
    isOpen?: boolean;
    onToggle?: () => void;
}

export function DurationSummary({ summary, isOpen, onToggle }: DurationSummaryProps) {
    const count = summary.flightCount - summary.unavailableCount;
    const estimated = summary.estimatedCount > 0 || summary.scheduledCount > 0;
    return (
        <section aria-label="Flight time">
            <CollapsibleSection title="Flight Time" icon="🕒" isOpen={isOpen} onToggle={onToggle}>
                <div className="grid grid-cols-2 gap-3">
                    <StatItem
                        icon="🕒"
                        label={estimated ? 'Est. Total Time' : 'Total Time'}
                        value={<FlightHoursValue summary={summary} />}
                        subValue={summary.unavailableCount > 0 ? `${count} of ${summary.flightCount} flights` : undefined}
                    />
                    {count > 0 && <StatItem
                        icon="⏱️"
                        label={estimated ? 'Est. Avg Time' : 'Avg Time'}
                        value={<DurationValue minutes={summary.totalMinutes / count} />}
                    />}
                </div>
                <p className="mt-2 text-xs text-gray-400">{flightDurationCoverage(summary)}</p>
                <p className="mt-1 text-xs text-gray-400">Gate-to-gate. Estimates use distance and a fixed allowance.</p>
            </CollapsibleSection>
        </section>
    );
}
