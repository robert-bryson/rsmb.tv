import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StationDetailPanel } from '../features/temperatures/components/StationDetailPanel';
import { jsonFetchResponse } from './helpers/fetch';

const props = { uid: 1, stationName: 'Selected station', state: 'WA', useCelsius: false, onClose: vi.fn() };

afterEach(() => vi.unstubAllGlobals());

describe('StationDetailPanel', () => {
    it('renders a one-day station history with finite chart coordinates', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonFetchResponse({
            meta: { name: 'New station' },
            data: [['2026-10-20', '75', '50', '0']],
        })));
        const { container } = render(<StationDetailPanel {...props} />);

        expect(await screen.findByRole('cell', { name: '10-20' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'New station' })).toBeInTheDocument();
        const label = container.querySelector('svg text[y="96"]');
        expect(label).toHaveTextContent('Oct');
        expect(label).toHaveAttribute('x', '0');
        for (const chartPath of container.querySelectorAll('svg path')) {
            expect(chartPath.getAttribute('d')).not.toMatch(/NaN|Infinity/);
        }
    });

    it('shows missing observations without drawing a temperature chart', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonFetchResponse({
            data: [['2026-10-20', 'M', 'T', '']],
        })));
        const { container } = render(<StationDetailPanel {...props} />);

        expect(await screen.findByText('No chart data available')).toBeInTheDocument();
        expect(screen.getAllByRole('cell', { name: '—' })).toHaveLength(3);
        expect(container.querySelector('svg')).toBeNull();
    });

    it('recovers from a failed request through Retry and displays Celsius values', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonFetchResponse({}, { ok: false, status: 503 }))
            .mockResolvedValueOnce(jsonFetchResponse({ data: [['2026-10-20', '68', '32', '0.5']] }));
        vi.stubGlobal('fetch', fetchMock);
        render(<StationDetailPanel {...props} useCelsius />);

        fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

        expect(await screen.findByRole('cell', { name: '20°C' })).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: '0°C' })).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: '0.5"' })).toBeInTheDocument();
        expect(screen.queryByText('Failed to load station data')).not.toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
