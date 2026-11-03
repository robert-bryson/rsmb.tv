import type { FlightProperties } from '../types';
import { flightDurationAvailability, flightDurationKindLabel, flightDurationSourceLabel, formatFlightDuration, formatFlightDurationAccessible, resolveFlightDuration, type FlightDurationRecord, type FlightDurationSummary } from '../utils/flightDuration';
import { CollapsibleSection, FlightTimeValue, StatItem } from './shared';

function DurationValue({ minutes }: { minutes: number | null }) {
    return <>
        <span aria-hidden="true">{formatFlightDuration(minutes)}</span>
        <span className="sr-only">{formatFlightDurationAccessible(minutes)}</span>
    </>;
}

export function FlightDurationDetail({ flight }: { flight: FlightProperties }) {
    const duration = resolveFlightDuration(flight);
    const kindLabel = flightDurationKindLabel(duration.kind);
    const source = flightDurationSourceLabel(duration);
    return <>
        <div>{duration.minutes === null ? 'Flight time unavailable' : <><DurationValue minutes={duration.minutes} />{kindLabel && ` · ${kindLabel}`}</>}</div>
        {source && <div>Source: {source}</div>}
        {duration.reportedMinutes !== null && <div>Reported duration: <DurationValue minutes={duration.reportedMinutes} /> (timing basis unknown; source: {flight.durationSource})</div>}
    </>;
}

interface DurationSummaryProps {
    summary: FlightDurationSummary;
    isOpen?: boolean;
    onToggle?: () => void;
}

function DurationExtreme({ record, longest }: { record: FlightDurationRecord; longest: boolean }) {
    return <StatItem
        icon={longest ? '🛫' : '🛬'}
        label={`${longest ? 'Longest' : 'Shortest'} Flight Time`}
        value={<DurationValue minutes={record.minutes} />}
        subValue={flightDurationKindLabel(record.kind)}
    />;
}

export function DurationSummary({ summary, isOpen, onToggle }: DurationSummaryProps) {
    const count = summary.flightCount - summary.unavailableCount;
    return (
        <section aria-label="Flight time">
            <CollapsibleSection title="Flight Time" icon="🕒" isOpen={isOpen} onToggle={onToggle}>
                <div className="grid grid-cols-2 gap-3">
                    <StatItem
                        icon="🕒"
                        label="Total Time"
                        value={<FlightTimeValue summary={summary} />}
                        subValue={flightDurationAvailability(summary)}
                    />
                    {count > 0 && <StatItem
                        icon="⏱️"
                        label="Avg Time"
                        value={<DurationValue minutes={summary.totalMinutes / count} />}
                    />}
                    {summary.longest && <DurationExtreme record={summary.longest} longest />}
                    {summary.shortest && <DurationExtreme record={summary.shortest} longest={false} />}
                </div>
            </CollapsibleSection>
        </section>
    );
}
