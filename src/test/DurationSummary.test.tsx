import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DurationSummary, FlightDurationDetail } from '../features/flights/components/DurationSummary';
import { summarizeFlightDurations } from '../features/flights/utils/flightDuration';
import { makeFlight } from './helpers/flights';

describe('flight duration presentation', () => {
    it('uses resolved coverage as the average denominator and supplies readable spoken time', () => {
        render(<DurationSummary summary={summarizeFlightDurations([
            makeFlight({ durationMinutes: 165 }),
            makeFlight({ durationMinutes: null, durationKind: null, durationSource: null, origin_lat: NaN }),
        ])} />);
        expect(screen.getByRole('region', { name: 'Flight time' })).toHaveTextContent('1 actual · 0 scheduled · 0 estimated · 1 unavailable');
        expect(screen.getByText('2 hours 45 minutes')).toHaveClass('sr-only');
        expect(screen.getByLabelText('2.8 hours')).toHaveTextContent('2.8 h');
    });

    it.each([{ legs: [] }, { legs: [makeFlight({ durationMinutes: null, durationKind: null, durationSource: null, origin_lon: Infinity })] }])('does not present missing values as zero or recorded time', ({ legs }) => {
        render(<DurationSummary summary={summarizeFlightDurations(legs)} />);
        expect(screen.getByText('Flight time unavailable')).toBeVisible();
        expect(screen.queryByText(/Average:/)).not.toBeInTheDocument();
        expect(screen.queryByText('0 h')).not.toBeInTheDocument();
    });

    it('retains and escapes the source and supplies readable individual wording', () => {
        render(<FlightDurationDetail flight={makeFlight({ durationMinutes: 165, durationSource: '<script>evidence</script>' })} />);
        expect(screen.getByText('2h 45m')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByText('2 hours 45 minutes')).toHaveClass('sr-only');
        expect(screen.getByText('Source: <script>evidence</script>')).toBeVisible();
        expect(document.querySelector('script')).toBeNull();
    });

    it('keeps unclassified reported time separate from the distance estimate', () => {
        render(<FlightDurationDetail flight={makeFlight({ durationMinutes: 40, durationKind: 'unclassified', durationSource: 'old log' })} />);
        expect(screen.getByText('Source: Distance estimate')).toBeVisible();
        expect(screen.getByText(/timing basis unknown; source: old log/)).toHaveTextContent('Reported duration: 40m');
    });

    it('reports unavailable time when neither recorded time nor usable coordinates exist', () => {
        render(<FlightDurationDetail flight={makeFlight({ durationMinutes: null, durationKind: null, durationSource: null, origin_lat: NaN })} />);
        expect(screen.getByText('Flight time unavailable')).toBeVisible();
        expect(screen.queryByText(/Source:/)).not.toBeInTheDocument();
    });
});
