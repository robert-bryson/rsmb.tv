import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkiAreaDetails } from '../features/ski-status/SkiAreaDetails';
import { SkiAreaTable } from '../features/ski-status/SkiAreaTable';
import { skiAreas } from '../features/ski-status/catalog';

describe('ski-status comparison table', () => {
    it('identifies same-name areas by location and exposes the active sort', () => {
        const areas = skiAreas.filter(area => area.name === 'Crystal Mountain');
        const onSelect = vi.fn();
        const onSort = vi.fn();
        const [michigan] = areas.filter(area => area.region === 'MI');
        render(<SkiAreaTable areas={areas} units="imperial" sort={{ key: 'name', direction: 'asc' }}
            compact selected={michigan} inView={false} selectedButtonRef={null} onSelect={onSelect} onSort={onSort} />);

        const table = screen.getByRole('region', { name: 'Ski area list' });
        expect(within(table).getByRole('columnheader', { name: 'Ski area' })).toHaveAttribute('aria-sort', 'ascending');
        expect(within(table).getByRole('button', { name: 'Crystal Mountain', description: 'Thompsonville, MI' }))
            .toHaveAttribute('aria-pressed', 'true');
        const washington = within(table).getByRole('button', { name: 'Crystal Mountain', description: /, WA$/ });
        fireEvent.click(washington);
        expect(onSelect).toHaveBeenCalledWith(areas.find(area => area.region === 'WA')?.id);
        fireEvent.click(within(table).getByRole('button', { name: 'Skiable area' }));
        expect(onSort).toHaveBeenCalledWith('acres');
    });

    it('identifies the reason for an empty table', () => {
        const props = {
            areas: [], units: 'imperial', sort: { key: 'name', direction: 'asc' }, compact: false,
            selectedButtonRef: null, onSelect: vi.fn(), onSort: vi.fn(),
        } as const;
        const { rerender } = render(<SkiAreaTable {...props} inView />);
        expect(screen.getByText('No matching ski areas in this map view.')).toBeVisible();
        rerender(<SkiAreaTable {...props} inView={false} />);
        expect(screen.getByText('No ski areas match these filters.')).toBeVisible();
    });
});

describe('ski-status area details', () => {
    it('shows each source once and retains its pass label', () => {
        const area = skiAreas.find(area => area.id === 'whaleback')!;
        const source = area.passes[0].source;
        const more = 'https://example.org/another-source';
        const onClose = vi.fn();
        render(<SkiAreaDetails units="imperial" onClose={onClose} area={{
            ...area, reportUrl: area.website, statsUrl: source, additionalSources: [source, area.website, more, more],
        }} />);

        const details = screen.getByRole('region', { name: 'Whaleback Mountain' });
        const links = within(details).getAllByRole('link');
        expect(links.map(link => link.getAttribute('href'))).toEqual([area.website, more, source]);
        expect(within(details).getByRole('link', { name: 'Resort website and conditions' })).toHaveAttribute('href', area.website);
        expect(within(details).getByRole('link', { name: 'Indy' })).toHaveAttribute('href', source);
        expect(within(details).getByText('30%')).toBeVisible();
        fireEvent.click(within(details).getByRole('button', { name: 'Close details' }));
        expect(onClose).toHaveBeenCalledOnce();
    });
});
