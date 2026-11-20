import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkiAreaDetails } from '../features/ski-status/SkiAreaDetails';
import { SkiAreaList } from '../features/ski-status/SkiAreaList';
import { SkiAreaTable } from '../features/ski-status/SkiAreaTable';
import { SkiColumnSettings } from '../features/ski-status/SkiColumnSettings';
import { SkiShareButton } from '../features/ski-status/SkiShareButton';
import { defaultSkiColumns } from '../features/ski-status/browse';
import { skiAreas } from '../features/ski-status/catalog';
import type { ResortReport } from '../features/ski-status/conditions';

const listDefaults = {
    conditions: { reports: new Map(), forecasts: new Map(), now: 0 }, statuses: new Map(),
    units: 'imperial', sort: { key: 'name', direction: 'asc' }, onSort: vi.fn(), onSelect: vi.fn(),
} as const;

describe('ski-status results and comparison', () => {
    it('identifies same-name resorts and passes the selecting control for focus restoration', () => {
        const areas = skiAreas.filter(area => area.name === 'Crystal Mountain');
        const onSelect = vi.fn();
        const michigan = areas.find(area => area.region === 'MI');
        render(<SkiAreaList {...listDefaults} areas={areas} colors="operatingStatus" selectedId={michigan?.id} onSelect={onSelect} />);
        const list = within(screen.getByRole('region', { name: 'Ski area list' }));
        expect(list.getByRole('button', { name: 'Crystal Mountain', description: /Thompsonville, MI/ })).toHaveAttribute('aria-pressed', 'true');
        const washington = list.getByRole('button', { name: 'Crystal Mountain', description: /, WA/ });
        fireEvent.click(washington);
        expect(onSelect).toHaveBeenCalledWith(areas.find(area => area.region === 'WA')?.id, washington);
        expect(list.getAllByText('No report')).toHaveLength(2);
    });

    it.each([
        ['acres', 'Skiable area', '2,614 ac'], ['verticalFt', 'Vertical drop', '2,538 ft'],
        ['summitFt', 'Summit elevation', '11,068 ft'], ['highestLiftTerminalFt', 'Highest lift terminal', 'Unknown'],
    ] as const)('shows the %s map value alongside the status and offers sorting', (colors, label, value) => {
        const alta = skiAreas.find(area => area.id === 'alta')!;
        const onSort = vi.fn();
        render(<SkiAreaList {...listDefaults} colors={colors} areas={[alta]} onSort={onSort} />);
        const list = within(screen.getByRole('region', { name: 'Ski area list' }));
        expect(list.getByText(`${label} · ${value}`)).toBeVisible();
        fireEvent.change(list.getByRole('combobox', { name: 'Sort results' }), { target: { value: colors } });
        expect(onSort).toHaveBeenCalledWith(colors);
    });

    it('shows map access labels and logos alongside the resort results', () => {
        const areas = skiAreas.filter(area => ['alta', 'north-cascade-heli', 'big-snow-american-dream'].includes(area.id));
        const { rerender } = render(<SkiAreaList {...listDefaults} areas={areas} colors="pass" passSelection={{ passes: ['mountain-collective'] }} />);
        const list = within(screen.getByRole('region', { name: 'Ski area list' }));
        const multiPass = list.getByText('Mountain Collective + other passes');
        expect(multiPass.querySelector('img')).toHaveAttribute('src', expect.stringContaining('mountain-collective.png'));
        expect(list.getByText('No confirmed access')).toBeVisible();
        expect(list.getByText('Discount only')).toBeVisible();
        rerender(<SkiAreaList {...listDefaults} areas={areas} colors="pass" passSelection={{ passes: ['indy-discounts'] }} />);
        expect(list.getByText('Indy discount')).toBeVisible();
    });

    it('leads with mountain statistics or current reports and preserves resort identity and the active sort', () => {
        const areas = skiAreas.filter(area => area.name === 'Crystal Mountain');
        const onSort = vi.fn();
        const props = { areas, units: 'imperial', sort: { key: 'name', direction: 'asc' }, onSort, onSelect: vi.fn() } as const;
        const { rerender } = render(<SkiAreaTable {...props} />);
        const table = within(screen.getByRole('region', { name: 'Ski area comparison table' }));
        const firstFields = () => table.getAllByRole('columnheader').slice(0, 5).map(header => header.textContent);
        expect(firstFields()).toEqual(['Ski area', 'Region', 'Skiable area', 'Vertical', 'Lifts']);
        expect(table.getByRole('columnheader', { name: 'Ski area' })).toHaveAttribute('aria-sort', 'ascending');
        expect(table.getByRole('button', { name: 'Crystal Mountain', description: /, WA/ })).toBeVisible();
        fireEvent.click(table.getByRole('button', { name: 'Skiable area' }));
        expect(onSort).toHaveBeenCalledWith('acres');
        rerender(<SkiAreaTable {...props} reportsFirst />);
        expect(firstFields()).toEqual(['Ski area', 'Region', 'Operating status', 'Lifts open / total', 'Trails open / total']);
    });

    it('moves focus to the first result added by Show more', () => {
        const areas = skiAreas.slice(0, 43);
        render(<SkiAreaList {...listDefaults} areas={areas} colors="default" />);
        const results = within(screen.getByRole('region', { name: 'Ski area list' }));
        expect(results.getAllByRole('listitem')).toHaveLength(40);
        fireEvent.click(results.getByRole('button', { name: 'Show 3 more' }));
        expect(results.getAllByRole('listitem')).toHaveLength(43);
        expect(results.getByRole('button', { name: areas[40].name })).toHaveFocus();
    });
});

describe('ski-status share control', () => {
    const url = 'https://rsmb.tv/projects/ski-status/map?view=results&q=whaleback';
    const shareButton = () => screen.getByRole('button', { name: 'Share current view' });
    function navigatorApis(share?: ReturnType<typeof vi.fn>, writeText?: ReturnType<typeof vi.fn>) {
        vi.stubGlobal('navigator', Object.defineProperties(Object.create(navigator), {
            share: { value: share }, clipboard: { value: writeText && { writeText } },
        }));
    }

    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('announces the copied link while keeping the share icon and accessible name', async () => {
        vi.useFakeTimers();
        const copy = vi.fn().mockResolvedValue(undefined);
        navigatorApis(undefined, copy);
        render(<SkiShareButton getUrl={() => url} />);
        await act(async () => fireEvent.click(shareButton()));
        expect(copy).toHaveBeenCalledExactlyOnceWith(url);
        expect(shareButton()).toHaveAccessibleName('Share current view');
        expect(shareButton().querySelector('svg')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Link copied');
        act(() => { vi.advanceTimersByTime(2500); });
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('keeps one native share pending and respects cancellation', async () => {
        let cancel!: (reason: Error) => void;
        const native = vi.fn(() => new Promise<void>((_resolve, reject) => { cancel = reject; }));
        const copy = vi.fn();
        navigatorApis(native, copy);
        render(<SkiShareButton getUrl={() => url} />);
        await act(async () => { fireEvent.click(shareButton()); fireEvent.click(shareButton()); });
        expect(native).toHaveBeenCalledExactlyOnceWith({ title: 'ski-status', url });
        await act(async () => { cancel(new DOMException('Cancelled', 'AbortError')); });
        expect(copy).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('selects the URL in a dialog if the clipboard refuses it', async () => {
        navigatorApis(undefined, vi.fn().mockRejectedValue(new Error('Denied')));
        const prototype = HTMLDialogElement.prototype;
        const original = Object.getOwnPropertyDescriptor(prototype, 'showModal');
        Object.defineProperty(prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.open = true; } });
        try {
            render(<SkiShareButton getUrl={() => url} />);
            await act(async () => fireEvent.click(shareButton()));
            const link = screen.getByRole<HTMLInputElement>('textbox', { name: 'Copy this link' });
            expect(link).toHaveValue(url);
            expect(link).toHaveFocus();
            expect(link.selectionStart).toBe(0);
            expect(link.selectionEnd).toBe(url.length);
        } finally {
            if (original) Object.defineProperty(prototype, 'showModal', original);
            else Reflect.deleteProperty(prototype, 'showModal');
        }
    });
});

describe('ski-status column settings', () => {
    it('adds and removes the named column and restores the defaults', () => {
        const onChange = vi.fn();
        render(<SkiColumnSettings columns={['name', 'acres']} onChange={onChange} />);
        fireEvent.click(screen.getByRole('checkbox', { name: 'Show Skiable area column' }));
        expect(onChange).toHaveBeenLastCalledWith(['name']);
        fireEvent.click(screen.getByRole('checkbox', { name: 'Show Forecast snow column' }));
        expect(onChange).toHaveBeenLastCalledWith(['name', 'acres', 'forecastSnow']);
        fireEvent.click(screen.getByRole('button', { name: 'Reset columns' }));
        expect(onChange).toHaveBeenLastCalledWith(defaultSkiColumns);
    });
});

describe('ski-status area details', () => {
    it('shows measured depth sources and leaves missing months empty in the selected units', () => {
        const sunshine = skiAreas.find(area => area.id === 'banff-sunshine')!;
        render(<SkiAreaDetails area={sunshine} units="metric" onClose={vi.fn()}
            conditions={{ reports: new Map(), forecasts: new Map(), now: Date.parse('2026-11-20T18:00:00Z') }} />);
        const season = within(screen.getByRole('region', { name: 'Season dates' }));
        expect(season.getByRole('link', { name: '723 cm' })).toHaveAttribute('href', expect.stringContaining('historical-snowfall'));
        expect(season.getByText('Nov 7')).toHaveAttribute('datetime', '2026-11-07');
        expect(season.getByText('May 24')).toHaveAttribute('datetime', '2027-05-24');
        const snow = within(season.getByRole('table', { name: 'Typical monthly snow' }));
        const november = within(snow.getByRole('row', { name: /November/ }));
        expect(november.getByRole('cell', { name: '137 cm' })).toBeVisible();
        expect(november.getByRole('cell', { name: 'Unavailable' })).toBeVisible();
        const january = within(snow.getByRole('row', { name: /January/ }));
        expect(january.getByRole('link', { name: '102 cm' })).toHaveAttribute('href', expect.stringContaining('janmsc.pdf'));
    });

    it('marks counts, named terrain and night operations from the previous local day as stale', () => {
        const area = skiAreas.find(area => area.id === 'alta')!;
        const report: ResortReport = {
            areaId: area.id, status: 'limited', reportedAt: '2026-11-21T06:30:00Z', retrievedAt: '2026-11-21T06:35:00Z',
            source: { name: 'Test operator', url: 'https://example.test/conditions', exportable: false },
            lifts: { open: 2, total: 5 }, nightOpen: true, hours: '9 AM to 4 PM',
            terrain: { items: [
                { id: 'lift:untimed', name: 'First chair', kind: 'lift', status: 'open' },
                { id: 'trail:timed', name: 'First trail', kind: 'trail', status: 'open', updatedAt: '2026-11-21T06:20:00Z' },
            ] },
        };
        render(<SkiAreaDetails area={area} units="imperial" onClose={vi.fn()} conditions={{
            reports: new Map([[area.id, report]]), forecasts: new Map(), now: Date.parse('2026-11-21T07:00:00Z'),
        }} />);
        expect(screen.getByText('Stale report')).toBeVisible();
        expect(screen.getByText('2 / 5 (stale)')).toBeVisible();
        expect(screen.getByText('Night operations open (stale)')).toBeVisible();
        expect(screen.getByText('9 AM to 4 PM (stale)')).toBeVisible();
        fireEvent.click(screen.getByText('Reported lifts and trails (2)'));
        const table = within(screen.getByRole('table', { name: 'Reported lift and trail status' }));
        expect(table.getByRole('row', { name: 'First chair Lift Open (stale)' })).toBeVisible();
        expect(table.getByRole('row', { name: 'First trail Trail Open (record stale)' })).toBeVisible();
    });

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
        expect(links.map(link => link.getAttribute('href'))).toEqual([
            'https://www.google.com/maps/search/?api=1&query=43.601503%2C-72.181118', 'https://en.wikipedia.org/wiki/Whaleback_(ski_area)',
            area.website, area.location.mappedTerrain?.source, more, source,
        ]);
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
