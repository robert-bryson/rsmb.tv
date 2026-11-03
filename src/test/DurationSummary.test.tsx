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
        const value = screen.getByText('3h').closest('[title]');
        expect(value).toHaveAttribute('title', 'Flight time: 2.8 h. Time available for 1 of 2 flights.');
        expect(screen.getByRole('region', { name: 'Flight time' })).toHaveTextContent('1 of 2 flights');
        expect(screen.getAllByText('2 hours 45 minutes')).toHaveLength(3);
        expect(screen.getAllByText('2 hours 45 minutes').every(element => element.classList.contains('sr-only'))).toBe(true);
        expect(value).toHaveTextContent('3h');
    });

    it('shows the longest and shortest resolved flight times in hours and minutes', () => {
        render(<DurationSummary summary={summarizeFlightDurations([
            makeFlight({ durationMinutes: 165 }),
            makeFlight({ durationMinutes: 45 }),
            makeFlight({ durationMinutes: null, durationKind: null, durationSource: null, origin_lat: NaN }),
        ])} />);
        expect(screen.getByText('Longest Flight Time').parentElement).toHaveTextContent('2h 45m');
        expect(screen.getByText('Shortest Flight Time').parentElement).toHaveTextContent('45m');
    });

    it.each([{ legs: [] }, { legs: [makeFlight({ durationMinutes: null, durationKind: null, durationSource: null, origin_lon: Infinity })] }])('does not present missing values as zero or recorded time', ({ legs }) => {
        render(<DurationSummary summary={summarizeFlightDurations(legs)} />);
        expect(screen.getByText('Unavailable')).toBeVisible();
        expect(screen.getByText(/^Flight time unavailable\./)).toHaveClass('sr-only');
        expect(screen.queryByText('Avg Time')).not.toBeInTheDocument();
        expect(screen.queryByText(/Longest Flight Time/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Shortest Flight Time/)).not.toBeInTheDocument();
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
        expect(screen.queryByText(/Estimated|Distance estimate/)).not.toBeInTheDocument();
        expect(screen.getByText(/timing basis unknown; source: old log/)).toHaveTextContent('Reported duration: 40m');
    });

    it('reports unavailable time when neither recorded time nor usable coordinates exist', () => {
        render(<FlightDurationDetail flight={makeFlight({ durationMinutes: null, durationKind: null, durationSource: null, origin_lat: NaN })} />);
        expect(screen.getByText('Flight time unavailable')).toBeVisible();
        expect(screen.queryByText(/Source:/)).not.toBeInTheDocument();
    });
});
