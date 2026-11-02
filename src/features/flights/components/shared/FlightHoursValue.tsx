import { flightDurationCoverage, flightDurationLabel, formatFlightDurationAccessible, formatFlightHours, type FlightDurationSummary } from '../../utils/flightDuration';

interface FlightHoursValueProps {
  summary: FlightDurationSummary;
  className?: string;
}

/** Compact hours with complete wording for assistive technology and hover details. */
export function FlightHoursValue({ summary, className }: FlightHoursValueProps) {
  const minutes = summary.flightCount > summary.unavailableCount ? summary.totalMinutes : null;
  const label = minutes === null ? 'Flight time unavailable' : `${flightDurationLabel(summary)}: ${formatFlightDurationAccessible(minutes)}`;
  const details = `${label}. ${flightDurationCoverage(summary)}. Gate-to-gate. Estimates use distance and a fixed allowance.`;

  return (
    <span className={className} title={details}>
      <span aria-hidden="true">{formatFlightHours(summary)}</span>
      <span className="sr-only">{details}</span>
    </span>
  );
}
