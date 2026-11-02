import type { FlightProperties } from '../types';
import { AVERAGE_FLIGHT_SPEED_KMH, FLIGHT_OVERHEAD_HOURS } from '../constants';
import { calculateDistance } from './index';
import { parseFlightDuration, type FlightDurationKind } from './durationInput';

export const DISTANCE_DURATION_SOURCE = 'distance-800-plus-60-v1';

export function flightDurationSourceLabel(source: string): string {
    return source === DISTANCE_DURATION_SOURCE ? 'Distance estimate' : source;
}

export interface ResolvedFlightDuration {
    minutes: number | null;
    kind: Exclude<FlightDurationKind, 'unclassified'> | null;
    source: string | null;
    reportedMinutes: number | null;
}

export interface FlightDurationSummary {
    flightCount: number;
    totalMinutes: number;
    actualMinutes: number;
    scheduledMinutes: number;
    estimatedMinutes: number;
    actualCount: number;
    scheduledCount: number;
    estimatedCount: number;
    unavailableCount: number;
    unclassifiedCount: number;
}

export function resolveFlightDuration(flight: FlightProperties): ResolvedFlightDuration {
    let reportedMinutes: number | null = null;
    try {
        const supplied = parseFlightDuration(flight);
        if (supplied.durationMinutes !== null) {
            if (supplied.durationKind !== 'unclassified') {
                return { minutes: supplied.durationMinutes, kind: supplied.durationKind, source: supplied.durationSource, reportedMinutes: null };
            }
            reportedMinutes = supplied.durationMinutes;
        }
    } catch {
        // Older cached or malformed payloads must never masquerade as recorded time.
    }
    const coordinates = [flight.origin_lat, flight.origin_lon, flight.destination_lat, flight.destination_lon];
    const valid = coordinates.every(Number.isFinite)
        && Math.abs(flight.origin_lat) <= 90 && Math.abs(flight.destination_lat) <= 90
        && Math.abs(flight.origin_lon) <= 180 && Math.abs(flight.destination_lon) <= 180;
    if (!valid) return { minutes: null, kind: null, source: null, reportedMinutes };
    const distance = calculateDistance(...coordinates as [number, number, number, number]);
    const minutes = Math.round((distance / AVERAGE_FLIGHT_SPEED_KMH + FLIGHT_OVERHEAD_HOURS) * 60);
    return { minutes, kind: 'estimated-block', source: DISTANCE_DURATION_SOURCE, reportedMinutes };
}

/** The caller supplies the exact matching legs. Each leg contributes once, regardless of endpoints. */
export function summarizeFlightDurations(flights: readonly FlightProperties[]): FlightDurationSummary {
    const summary: FlightDurationSummary = {
        flightCount: flights.length, totalMinutes: 0, actualMinutes: 0, scheduledMinutes: 0, estimatedMinutes: 0,
        actualCount: 0, scheduledCount: 0, estimatedCount: 0, unavailableCount: 0, unclassifiedCount: 0,
    };
    for (const flight of flights) {
        const duration = resolveFlightDuration(flight);
        if (duration.reportedMinutes !== null) summary.unclassifiedCount++;
        if (duration.minutes === null) { summary.unavailableCount++; continue; }
        summary.totalMinutes += duration.minutes;
        if (duration.kind === 'actual-block') { summary.actualCount++; summary.actualMinutes += duration.minutes; }
        else if (duration.kind === 'scheduled-block') { summary.scheduledCount++; summary.scheduledMinutes += duration.minutes; }
        else { summary.estimatedCount++; summary.estimatedMinutes += duration.minutes; }
    }
    return summary;
}

export function formatFlightDuration(minutes: number | null): string {
    if (minutes === null || !Number.isFinite(minutes)) return 'Unavailable';
    const rounded = Math.round(minutes);
    const hours = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    return hours ? `${hours}h${remainder ? ` ${String(remainder).padStart(2, '0')}m` : ''}` : `${remainder}m`;
}

export function formatFlightDurationAccessible(minutes: number | null): string {
    if (minutes === null || !Number.isFinite(minutes)) return 'Flight time unavailable';
    const rounded = Math.round(minutes);
    const hours = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    return [
        ...(hours ? [`${hours} ${hours === 1 ? 'hour' : 'hours'}`] : []),
        ...(remainder || !hours ? [`${remainder} ${remainder === 1 ? 'minute' : 'minutes'}`] : []),
    ].join(' ');
}

export function formatFlightHours(summary: FlightDurationSummary): string {
    if (summary.flightCount === summary.unavailableCount) return 'Unavailable';
    return `${(summary.totalMinutes / 60).toLocaleString('en-US', { maximumFractionDigits: 1 })} h`;
}

export function flightDurationLabel(summary: FlightDurationSummary): string {
    if (summary.flightCount === summary.unavailableCount) return 'Flight time unavailable';
    return summary.estimatedCount || summary.scheduledCount ? 'Est. flight time' : 'Flight time';
}

export function flightDurationCoverage(summary: FlightDurationSummary): string {
    return [
        `${summary.actualCount} actual`, `${summary.scheduledCount} scheduled`, `${summary.estimatedCount} estimated`,
        ...(summary.unavailableCount ? [`${summary.unavailableCount} unavailable`] : []),
        ...(summary.unclassifiedCount ? [`${summary.unclassifiedCount} reported, timing basis unknown`] : []),
    ].join(' · ');
}

export function flightDurationKindLabel(kind: FlightDurationKind | null | undefined): string {
    return kind === 'actual-block' ? 'Actual' : kind === 'scheduled-block' ? 'Scheduled' : kind === 'unclassified' ? 'Reported' : 'Estimated';
}
