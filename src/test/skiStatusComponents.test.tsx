import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkiAreaDetails } from '../features/ski-status/SkiAreaDetails';
import { SkiAreaTable } from '../features/ski-status/SkiAreaTable';
import { SkiColumnSettings } from '../features/ski-status/SkiColumnSettings';
import { defaultSkiColumns } from '../features/ski-status/browse';
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

    it.each([
        ['acres', 'Skiable area', '2,614 ac'], ['verticalFt', 'Vertical drop', '2,538 ft'],
        ['summitFt', 'Summit elevation', '11,068 ft'], ['highestLiftTerminalFt', 'Highest lift terminal', 'Unknown'],
    ] as const)('shows the %s color value in the compact list and can sort by it', (colorBy, label, value) => {
        const alta = skiAreas.find(area => area.id === 'alta')!;
        const onSort = vi.fn();
        render(<SkiAreaTable areas={[alta]} units="imperial" sort={{ key: 'region', direction: 'asc' }}
            compact colorBy={colorBy} inView={false} selectedButtonRef={null} onSort={onSort} onSelect={vi.fn()} />);

        const list = within(screen.getByRole('region', { name: 'Ski area list' }));
        expect(list.getAllByRole('columnheader')).toHaveLength(2);
        expect(list.getByRole('cell', { name: value })).toBeVisible();
        fireEvent.click(list.getByRole('button', { name: label }));
        expect(onSort).toHaveBeenCalledWith(colorBy);
    });

    it('uses the map badge and access labels in the compact pass column', () => {
        const areas = skiAreas.filter(area => ['alta', 'north-cascade-heli', 'big-snow-american-dream'].includes(area.id));
        const props = {
            areas, units: 'imperial', sort: { key: 'name', direction: 'asc' }, compact: true, colorBy: 'pass', inView: false,
            selectedButtonRef: null, onSort: vi.fn(), onSelect: vi.fn(),
        } as const;
        const { rerender } = render(<SkiAreaTable {...props} passFilter="mountain-collective" />);

        const list = within(screen.getByRole('region', { name: 'Ski area list' }));
        expect(list.getByRole('columnheader', { name: 'Pass access' })).toBeVisible();
        const multiPass = list.getByRole('cell', { name: 'Mountain Collective and other passes' });
        expect(multiPass.querySelector('img')).toHaveAttribute('src', expect.stringContaining('mountain-collective.png'));
        expect(list.getByRole('cell', { name: 'No confirmed access' })).toBeVisible();
        expect(list.getByRole('cell', { name: 'Discount only' })).toBeVisible();

        rerender(<SkiAreaTable {...props} passFilter="indy-discounts" />);
        expect(list.getByRole('cell', { name: 'Indy discount' })).toBeVisible();
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

describe('ski-status column settings', () => {
    it('adds and removes the named column and restores the defaults', () => {
        const onChange = vi.fn();
        render(<SkiColumnSettings columns={['name', 'acres']} onChange={onChange} />);
        fireEvent.click(screen.getByText('Columns', { exact: true }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Show Skiable area column' }));
        expect(onChange).toHaveBeenLastCalledWith(['name']);
        fireEvent.click(screen.getByRole('checkbox', { name: 'Show Forecast snow column' }));
        expect(onChange).toHaveBeenLastCalledWith(['name', 'acres', 'forecastSnow']);
        fireEvent.click(screen.getByRole('button', { name: 'Reset columns' }));
        expect(onChange).toHaveBeenLastCalledWith(defaultSkiColumns);
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
        expect(links.map(link => link.getAttribute('href'))).toEqual([area.website, area.location.mappedTerrain?.source, more, source]);
        expect(within(details).getByRole('link', { name: 'Resort website and conditions' })).toHaveAttribute('href', area.website);
        expect(within(details).getByRole('link', { name: 'OpenSkiMap terrain' })).toHaveAttribute('href', area.location.mappedTerrain?.source);
        expect(within(details).getByRole('link', { name: 'Indy' })).toHaveAttribute('href', source);
        expect(within(details).getByText('30%')).toBeVisible();
        fireEvent.click(within(details).getByRole('button', { name: 'Close details' }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('shows the source, check date, and scope for published counts, season, and difficulty', () => {
        const area = skiAreas.find(area => area.id === 'whaleback')!;
        const source = 'https://example.org/mountain-facts';
        const note = 'The trail count includes the learning area.';
        render(<SkiAreaDetails units="imperial" onClose={vi.fn()} area={{
            ...area, statsUrl: source, trailCount: 30, seasonWindow: 'December to March',
            statSources: [{ source, checkedOn: '2026-11-19', fields: ['trailCount', 'seasonWindow', 'grades'], note }],
        }} />);

        const disclosure = screen.getByText('Published statistic sources');
        fireEvent.click(disclosure);
        const sources = within(disclosure.closest('details')!);
        expect(sources.getByRole('link', { name: 'Trails, Published season window, Published difficulty' })).toHaveAttribute('href', source);
        expect(sources.getByText('2026-11-19', { selector: 'time' })).toHaveAttribute('datetime', '2026-11-19');
        expect(sources.getByText(note)).toBeVisible();
        expect(screen.queryByRole('link', { name: 'Mountain stats source' })).toBeNull();
    });

    it('keeps the official conditions link when the same URL documents pass access', () => {
        const area = skiAreas.find(area => area.id === 'whaleback')!;
        const reportUrl = area.passes[0].source;
        render(<SkiAreaDetails area={{ ...area, reportUrl }} units="imperial" onClose={vi.fn()} />);

        expect(screen.getByRole('link', { name: 'Official conditions' })).toHaveAttribute('href', reportUrl);
        expect(screen.getByRole('link', { name: 'Indy' })).toHaveAttribute('href', reportUrl);
    });
});
