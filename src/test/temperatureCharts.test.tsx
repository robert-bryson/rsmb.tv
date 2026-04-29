import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

        expect(screen.getByText(/Distribution of 10 all-time county temperature records/i)).toBeInTheDocument();
    });

    it('shows an empty state when record age data has no supported decades', () => {
        render(<RecordAgeChart data={[{ decade: 1880, label: '1880s', highs: 1, lows: 1, ratio: 1 }]} />);

        expect(screen.getByText(/No all-time county record age data is available/i)).toBeInTheDocument();
    });

    it('renders sparse annual data without invalid SVG coordinates', () => {
        const { container } = render(<RecordsBrokenTimeSeries data={[{ year: 2024, highs: 3, lows: 2 }]} />);

        expect(screen.getByText('All-Time County Records Set Per Year')).toBeInTheDocument();
        expect(container.innerHTML).not.toContain('NaN');
        expect(container.innerHTML).not.toContain('Infinity');
    });

    it('clarifies that ratio data is for all-time county records', () => {
        render(
            <HighLowRatioChart
                decadeData={[{ decade: 2020, label: '2020s', highs: 5, lows: 2, ratio: 2.5 }]}
                rollingData={[{ year: 2020, ratio: 2.5, highs10yr: 5, lows10yr: 2 }]}
            />,
        );

        expect(screen.getByText(/Ratio of all-time county record highs to record lows set per decade/i)).toBeInTheDocument();
    });

    it('shows an empty state when ratio data is unavailable', () => {
        render(<HighLowRatioChart decadeData={[]} rollingData={[]} />);

        expect(screen.getByText(/No high-to-low ratio data is available/i)).toBeInTheDocument();
    });
});