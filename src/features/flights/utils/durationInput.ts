export const FLIGHT_DURATION_KINDS = ['actual-block', 'scheduled-block', 'estimated-block', 'unclassified'] as const;
export type FlightDurationKind = typeof FLIGHT_DURATION_KINDS[number];

export interface FlightDurationInput {
    durationMinutes: number | null;
    durationKind: FlightDurationKind | null;
    durationSource: string | null;
}

/** Shared by Sheet ingestion, CSV conversion, and the browser. Durations are elapsed minutes, never local clocks. */
export function parseFlightDuration(input: Partial<Record<keyof FlightDurationInput, unknown>>): FlightDurationInput {
    const minutes = String(input.durationMinutes ?? '').trim();
    const kind = String(input.durationKind ?? '').trim();
    const source = String(input.durationSource ?? '').trim();
    if (!minutes && !kind && !source) {
        return { durationMinutes: null, durationKind: null, durationSource: null };
    }
    if (!/^\d+$/.test(minutes) || !Number.isSafeInteger(Number(minutes)) || Number(minutes) <= 0) {
        throw new Error('durationMinutes must be a positive whole number of minutes, or all duration fields must be blank');
    }
    if (!FLIGHT_DURATION_KINDS.includes(kind as FlightDurationKind)) {
        throw new Error(`durationKind must be one of: ${FLIGHT_DURATION_KINDS.join(', ')}`);
    }
    if (!source) throw new Error('durationSource is required when durationMinutes is supplied');
    return { durationMinutes: Number(minutes), durationKind: kind as FlightDurationKind, durationSource: source };
}
