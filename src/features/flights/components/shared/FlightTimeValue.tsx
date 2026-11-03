import { flightDurationAvailability, flightDurationLabel, formatFlightDays, formatFlightDurationAccessible, formatFlightHours, type FlightDurationSummary } from '../../utils/flightDuration';

interface FlightTimeValueProps {
  summary: FlightDurationSummary;
  className?: string;
}

/** Compact days and hours with precise time for assistive technology and hours on hover. */
export function FlightTimeValue({ summary, className }: FlightTimeValueProps) {
  const minutes = summary.flightCount > summary.unavailableCount ? summary.totalMinutes : null;
  const label = minutes === null ? 'Flight time unavailable' : `${flightDurationLabel(summary)}: ${formatFlightDurationAccessible(minutes)}`;
  const availability = flightDurationAvailability(summary);
  const context = availability ? ` Time available for ${availability}.` : '';
  const details = `${label}.${context}`;
  const hoverDetails = minutes === null ? details : `${flightDurationLabel(summary)}: ${formatFlightHours(summary)}.${context}`;

  return (
    <span className={className} title={hoverDetails}>
      <span aria-hidden="true">{formatFlightDays(summary)}</span>
      <span className="sr-only">{details}</span>
    </span>
  );
}
