import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DurationSummary } from '../features/flights/components/DurationSummary';
import { FlightTimeValue } from '../features/flights/components/shared/FlightTimeValue';
import {
    formatFlightDays,
    summarizeFlightDurations,
} from '../features/flights/utils/flightDuration';
import type { FlightDurationKind } from '../features/flights/utils/durationInput';
import { makeFlight } from './helpers/flights';

describe('flight time regressions', () => {
    it('shows timing coverage and the estimate method without hover', () => {
        render(<DurationSummary summary={summarizeFlightDurations([
            makeFlight(),
            makeFlight({ durationMinutes: 80, durationKind: 'scheduled-block' }),
            makeFlight({ durationMinutes: 40, durationKind: 'unclassified' }),
            makeFlight({ durationMinutes: null, durationKind: null, durationSource: null, origin_lat: NaN }),
        ])} />);

        const region = screen.getByRole('region', { name: 'Flight time' });
        expect(within(region).getByText('1 actual · 1 scheduled · 1 estimated · 1 unavailable · 1 reported, timing basis unknown')).toBeVisible();
        expect(within(region).getByText('Gate-to-gate. Estimates use distance and a fixed allowance.')).toBeVisible();
    });

    it.each([
        { actual: 45, other: 180, actualLabel: 'Shortest Flight Time', otherLabel: 'Est. Longest Flight Time' },
        { actual: 180, other: 45, actualLabel: 'Longest Flight Time', otherLabel: 'Est. Shortest Flight Time' },
    ])('labels each extreme from its own timing basis: $actualLabel', ({ actual, other, actualLabel, otherLabel }) => {
        render(<DurationSummary summary={summarizeFlightDurations([
            makeFlight({ durationMinutes: actual }),
            makeFlight({ durationMinutes: other, durationKind: 'scheduled-block' }),
        ])} />);

        expect(screen.getByText(actualLabel).parentElement).toHaveTextContent('Actual');
        expect(screen.getByText(otherLabel).parentElement).toHaveTextContent('Scheduled');
        expect(screen.getByText('Est. Total Time')).toBeVisible();
        expect(screen.getByText('Est. Avg Time')).toBeVisible();
    });

    it('excludes unavailable legs from extrema and retains supplied and fallback estimates', () => {
        const summary = summarizeFlightDurations([
            makeFlight({ durationMinutes: null, durationKind: null, durationSource: null, origin_lon: Infinity }),
            makeFlight({ durationMinutes: 30, durationKind: 'estimated-block' }),
            makeFlight({ durationMinutes: 10, durationKind: 'unclassified', origin_lat: 0, origin_lon: 0, destination_lat: 0, destination_lon: 0 }),
        ]);

        expect(summary).toMatchObject({
            flightCount: 3, unavailableCount: 1, totalMinutes: 90,
            shortest: { minutes: 30, kind: 'estimated-block' },
            longest: { minutes: 60, kind: 'estimated-block' },
        });
        render(<DurationSummary summary={summary} />);
        expect(screen.getByText('Est. Shortest Flight Time').parentElement).toHaveTextContent('Estimated');
        expect(screen.getByText('Est. Longest Flight Time').parentElement).toHaveTextContent('Estimated');
    });

    it.each([
        ['actual-block', 'scheduled-block', 'actual-block'],
        ['actual-block', 'estimated-block', 'actual-block'],
        ['scheduled-block', 'estimated-block', 'scheduled-block'],
    ] satisfies [FlightDurationKind, FlightDurationKind, FlightDurationKind][])('resolves tied %s and %s records consistently', (first, second, preferred) => {
        const flights = [makeFlight({ durationKind: first }), makeFlight({ durationKind: second })];
        for (const order of [flights, [...flights].reverse()]) {
            const summary = summarizeFlightDurations(order);
            expect(summary).toMatchObject({
                shortest: { minutes: 65, kind: preferred },
                longest: { minutes: 65, kind: preferred },
                totalMinutes: 130,
            });
        }
    });

    it.each([
        [1, '1m'], [59, '59m'], [60, '1h'], [89, '1h'], [90, '2h'],
        [1409, '23h'], [1410, '1d 0h'], [1440, '1d 0h'], [2879, '2d 0h'],
    ] as const)('rounds %i minutes to %s without changing canonical time', (durationMinutes, expected) => {
        const summary = summarizeFlightDurations([makeFlight({ durationMinutes })]);
        expect(formatFlightDays(summary)).toBe(expected);
        expect(summary.totalMinutes).toBe(durationMinutes);
    });

    it('keeps a partial total readable as days, decimal hours, and precise spoken time', () => {
        const summary = summarizeFlightDurations([
            makeFlight({ durationMinutes: 70044 }),
            makeFlight({ durationMinutes: null, durationKind: null, durationSource: null, origin_lat: NaN }),
        ]);
        render(<FlightTimeValue summary={summary} />);

        const compact = screen.getByText('48d 15h');
        expect(compact).toHaveAttribute('aria-hidden', 'true');
        expect(compact.parentElement).toHaveAttribute('title', expect.stringContaining('1,167.4 h'));
        const spoken = screen.getByText(/^Flight time: 1167 hours 24 minutes\./);
        expect(spoken).toHaveClass('sr-only');
        expect(spoken).toHaveTextContent('1 actual · 0 scheduled · 0 estimated · 1 unavailable');
    });
});
