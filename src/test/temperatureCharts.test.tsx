import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HighLowRatioChart } from '../features/temperatures/components/HighLowRatioChart';
import { RecordAgeChart } from '../features/temperatures/components/RecordAgeChart';
import { RecordsBrokenTimeSeries } from '../features/temperatures/components/RecordsBrokenTimeSeries';

describe('temperature trend charts', () => {
    it('computes the record age total from rendered data instead of hardcoded copy', () => {
        render(
            <RecordAgeChart
                data={[
                    { decade: 1880, label: '1880s', highs: 100, lows: 100, ratio: 1 },
                    { decade: 1900, label: '1900s', highs: 1, lows: 2, ratio: 0.5 },
                    { decade: 1910, label: '1910s', highs: 3, lows: 4, ratio: 0.75 },
                ]}
            />,
        );

        expect(screen.getByText(/Distribution of 10 standing county temperature records/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /1900s: 1 standing highs and 2 standing lows/i })).toBeInTheDocument();
    });

    it('shows an empty state when record age data has no supported decades', () => {
        render(<RecordAgeChart data={[{ decade: 1880, label: '1880s', highs: 1, lows: 1, ratio: 1 }]} />);

        expect(screen.getByText(/No standing county record-age data is available/i)).toBeInTheDocument();
    });

    it('supports keyboard selection and restores the locked range after focus leaves', () => {
        const onHoverPeriod = vi.fn();
        const onSelectDecade = vi.fn();
        render(
            <RecordAgeChart
                data={[
                    { decade: 1900, label: '1900s', highs: 1, lows: 2, ratio: 0.5 },
                    { decade: 1910, label: '1910s', highs: 3, lows: 4, ratio: 0.75 },
                ]}
                selectedDecade={1900}
                onHoverPeriod={onHoverPeriod}
                onSelectDecade={onSelectDecade}
            />,
        );

        const nextDecade = screen.getByRole('button', { name: /1910s:/i });
        fireEvent.focus(nextDecade);
        fireEvent.keyDown(nextDecade, { key: 'Enter' });
        expect(onSelectDecade).toHaveBeenCalledWith(1910);

        fireEvent.blur(nextDecade);
        expect(onHoverPeriod).toHaveBeenLastCalledWith({ startYear: 1900, endYear: 1909 });
        expect(screen.getByRole('button', { name: /1900s:/i })).toHaveAttribute('aria-pressed', 'true');
    });

    it('renders sparse annual data without invalid SVG coordinates', () => {
        const { container } = render(<RecordsBrokenTimeSeries data={[{ year: 2024, highs: 3, lows: 2 }]} />);

        expect(screen.getByText('Standing County Records by Year Set')).toBeInTheDocument();
        expect(container.innerHTML).not.toContain('NaN');
        expect(container.innerHTML).not.toContain('Infinity');
    });

    it('clarifies that ratio data is for standing county records', () => {
        render(
            <HighLowRatioChart
                decadeData={[{ decade: 2020, label: '2020s', highs: 5, lows: 2, ratio: 2.5 }]}
                rollingData={[{ year: 2020, ratio: 2.5, highs10yr: 5, lows10yr: 2 }]}
            />,
        );

        expect(screen.getByText(/Ratio of today's standing county highs to lows/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /2020s: 2.50 standing highs per standing low/i })).toBeInTheDocument();
    });

    it('shows absolute counts alongside an active high-to-low ratio', () => {
        render(
            <HighLowRatioChart
                decadeData={[{ decade: 2020, label: '2020s', highs: 5, lows: 2, ratio: 2.5 }]}
                rollingData={[]}
            />,
        );

        fireEvent.mouseEnter(screen.getByRole('button', { name: /2020s:/i }));

        expect(screen.getByLabelText(/2020s: 5 highs \/ 2 lows = 2.50 : 1/i)).toBeInTheDocument();
    });

    it('shows an empty state when ratio data is unavailable', () => {
        render(<HighLowRatioChart decadeData={[]} rollingData={[]} />);

        expect(screen.getByText(/No high-to-low ratio data is available/i)).toBeInTheDocument();
    });

    it('clears a locked ratio decade when it is activated again', () => {
        const onSelectDecade = vi.fn();
        render(
            <HighLowRatioChart
                decadeData={[{ decade: 2020, label: '2020s', highs: 5, lows: 2, ratio: 2.5 }]}
                rollingData={[]}
                selectedDecade={2020}
                onSelectDecade={onSelectDecade}
            />,
        );

        const decade = screen.getByRole('button', { name: /2020s:/i });
        expect(decade).toHaveAttribute('aria-pressed', 'true');
        fireEvent.keyDown(decade, { key: ' ' });
        expect(onSelectDecade).toHaveBeenCalledWith(null);
    });
});