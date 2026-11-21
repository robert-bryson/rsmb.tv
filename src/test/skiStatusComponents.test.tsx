import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkiAreaDetails } from '../features/ski-status/SkiAreaDetails';
import { SkiAreaList } from '../features/ski-status/SkiAreaList';
import { SkiAreaTable } from '../features/ski-status/SkiAreaTable';
import { SkiColumnSettings } from '../features/ski-status/SkiColumnSettings';
import { SkiResortLinks } from '../features/ski-status/SkiResortLinks';
import { SkiShareButton } from '../features/ski-status/SkiShareButton';
import { defaultSkiColumns } from '../features/ski-status/browse';
import { skiAreas } from '../features/ski-status/catalog';
import type { ResortReport } from '../features/ski-status/conditions';
import { skiResortIcon, skiSnowHistory } from '../features/ski-status/resortDetailsData';

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
        expect(list.getAllByText('Skiing status unknown')).toHaveLength(2);
    });

    it('shows resort icons in sorted results and falls back through the available files', () => {
        const alta = skiAreas.find(area => area.id === 'alta')!;
        const hurricane = skiAreas.find(area => area.id === 'hurricane-ridge')!;
        const mapIcon = '/archive/alta/map-40.png';
        const detailsIcon = '/archive/alta/details-84.png';
        const archive = new Map([[alta.id, { mapIcon, detailsIcon }]]);
        render(<SkiAreaList {...listDefaults} areas={[hurricane, alta]} archive={archive} colors="pass"
            sort={{ key: 'typicalClosing', direction: 'asc' }} />);

        const button = screen.getByRole('button', { name: alta.name });
        const icon = () => button.querySelector('img');
        expect(icon()).toHaveAttribute('src', mapIcon);
        expect(icon()).toHaveAttribute('alt', '');
        expect(icon()).toHaveAttribute('loading', 'lazy');
        expect(screen.getByRole('button', { name: hurricane.name }).querySelector('img')).toBeNull();

        fireEvent.error(icon()!);
        expect(icon()).toHaveAttribute('src', detailsIcon);
        fireEvent.error(icon()!);
        expect(icon()).toHaveAttribute('src', skiResortIcon(alta.id));
        fireEvent.error(icon()!);
        expect(icon()).toBeNull();
        expect(button).toHaveAccessibleName(alta.name);
        expect(button).toHaveAccessibleDescription(/Typical closing Apr 23/);
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

    it('shows the active sort value and distinguishes zero from a missing value', () => {
        const known = { ...skiAreas.find(area => area.id === 'alta')!, liftCount: 0 };
        const missing = { ...skiAreas.find(area => area.id === 'whaleback')!, liftCount: undefined };
        render(<SkiAreaList {...listDefaults} areas={[known, missing]} colors="default" sort={{ key: 'liftCount', direction: 'asc' }} />);
        const list = within(screen.getByRole('region', { name: 'Ski area list' }));
        const knownButton = list.getByRole('button', { name: known.name });
        const missingButton = list.getByRole('button', { name: missing.name });
        expect(within(knownButton.closest('li')!).getByText('0', { exact: true })).toBeVisible();
        expect(within(missingButton.closest('li')!).getByText('Unknown', { exact: true })).toBeVisible();
        expect(knownButton).toHaveAccessibleDescription(/Lifts 0/);
        expect(missingButton).toHaveAccessibleDescription(/Lifts Unknown/);
    });

    it('shows a sorted map metric once in the selected units', () => {
        const alta = skiAreas.find(area => area.id === 'alta')!;
        render(<SkiAreaList {...listDefaults} areas={[alta]} units="metric" colors="summitFt" sort={{ key: 'summitFt', direction: 'desc' }} />);
        const row = within(screen.getByRole('listitem'));
        expect(row.getByText('Summit', { exact: true })).toBeVisible();
        expect(row.getAllByText(/3,374 m/)).toHaveLength(1);
    });

    it('shows a sorted live count once alongside the other terrain count', () => {
        const area = skiAreas.find(area => area.id === 'alta')!;
        const report: ResortReport = {
            areaId: area.id, status: 'limited', reportedAt: '2026-11-21T15:00:00Z', retrievedAt: '2026-11-21T15:05:00Z',
            source: { name: 'Operator', url: 'https://example.test/conditions', exportable: false },
            lifts: { open: 2, total: 6 }, trails: { open: 10, total: 120 },
        };
        const conditions = { ...listDefaults.conditions, reports: new Map([[area.id, report]]), now: Date.parse('2026-11-21T15:15:00Z') };
        render(<SkiAreaList {...listDefaults} areas={[area]} colors="operatingStatus" conditions={conditions}
            statuses={new Map([[area.id, 'limited']])} sort={{ key: 'reportLifts', direction: 'desc' }} />);
        const row = within(screen.getByRole('listitem'));
        expect(row.getByText('Lifts open / total')).toBeVisible();
        expect(row.getByText('2 / 6', { exact: true })).toBeVisible();
        expect(row.queryByText('2 / 6 lifts open')).toBeNull();
        expect(row.getByText('10 / 120 trails open')).toBeVisible();
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
    function openSnowSources(scope: ReturnType<typeof within> = screen) {
        fireEvent.click(scope.getByText('Snow sources', { selector: 'summary' }));
        return within(scope.getByRole('list', { name: 'Historical snow sources' }));
    }

    it('keeps the qualified map search available when there is no verified article', () => {
        const area = skiAreas.find(area => area.id === 'hunter-mountain')!;
        render(<SkiResortLinks area={{ ...area, id: 'unverified-area' }} />);
        const group = within(screen.getByRole('group', { name: 'Resort links' }));
        expect(group.getByRole('link', { name: 'Search Google Maps' })).toHaveAttribute('href', expect.stringContaining('ski+area'));
        expect(group.getAllByRole('link')).toHaveLength(1);
    });

    it('shows measured depth sources and leaves missing months empty in the selected units', () => {
        const sunshine = skiAreas.find(area => area.id === 'banff-sunshine')!;
        render(<SkiAreaDetails area={sunshine} units="metric" onClose={vi.fn()}
            conditions={{ reports: new Map(), forecasts: new Map(), now: Date.parse('2026-11-20T18:00:00Z') }} />);
        const season = within(screen.getByRole('region', { name: 'Season dates' }));
        expect(season.getByRole('link', { name: '723 cm' })).toHaveAttribute('href', expect.stringContaining('historical-snowfall'));
        expect(season.getByText('Nov 7')).toHaveAttribute('datetime', '2026-11-07');
        expect(season.getByText('May 24')).toHaveAttribute('datetime', '2027-05-24');
        expect(season.getByText('Season 2026/27')).toBeVisible();
        expect(season.getByText('Typical season').parentElement).toHaveTextContent('Nov 8 – May 19');
        expect(season.getByText('Typical season length').parentElement).toHaveTextContent('193 days');
        fireEvent.click(season.getByText('Monthly values', { exact: true }));
        const snowfall = within(season.getByRole('table', { name: 'Average monthly snowfall (cm)' }));
        expect(snowfall.getByRole('row', { name: /November, typical season/ })).toHaveTextContent('137 cm');

        fireEvent.click(season.getByRole('button', { name: 'Snow depth' }));
        const depth = within(season.getByRole('table', { name: 'Survey snow depth (cm)' }));
        expect(within(depth.getByRole('row', { name: /November/ })).getByRole('cell', { name: 'Unavailable' })).toBeVisible();
        expect(season.getByTitle('November · Unavailable')).toHaveTextContent('—');
        const january = within(depth.getByRole('row', { name: /January/ }));
        expect(january.getByRole('link', { name: '102 cm' })).toHaveAttribute('href', expect.stringContaining('janmsc.pdf'));
    });

    it('keeps measured snow months when the opening date changes', () => {
        const aspen = skiAreas.find(area => area.id === 'aspen-highlands')!;
        const conditions = { reports: new Map(), forecasts: new Map(), now: Date.parse('2026-11-21T18:00:00Z') };
        const props = { area: aspen, units: 'metric', onClose: vi.fn() } as const;
        const { rerender } = render(<SkiAreaDetails {...props} conditions={conditions} />);
        const season = within(screen.getByRole('region', { name: 'Season dates' }));
        expect(season.getByText('Dec 12')).toHaveAttribute('datetime', '2026-12-12');
        fireEvent.click(season.getByText('Monthly values', { exact: true }));
        const monthlyRows = () => within(season.getByRole('table', { name: 'Average monthly snowfall (cm)' }))
            .getAllByRole('rowheader').map(header => header.textContent);
        expect(monthlyRows()).toEqual(['November', 'December', 'January', 'February', 'March', 'April']);
        const november = within(season.getByRole('row', { name: /November/ }));
        expect(november.getByRole('cell', { name: '51.1 cm' })).toBeVisible();

        const report: ResortReport = {
            areaId: aspen.id, status: 'season-closed', opensOn: '2026-11-28',
            reportedAt: '2026-11-21T17:30:00Z', retrievedAt: '2026-11-21T17:40:00Z',
            source: { name: 'Operator', url: 'https://example.test/conditions', exportable: false },
        };
        rerender(<SkiAreaDetails {...props} conditions={{ ...conditions, reports: new Map([[aspen.id, report]]) }} />);
        expect(season.getByText('Nov 28')).toHaveAttribute('datetime', '2026-11-28');
        expect(monthlyRows()).toEqual(['November', 'December', 'January', 'February', 'March', 'April']);
    });

    it('switches between zero-based scales and retains measured zeroes', () => {
        const hakuba = skiAreas.find(area => area.id === 'hakuba-happo-one')!;
        const { container } = render(<SkiAreaDetails area={hakuba} units="metric" onClose={vi.fn()} />);
        fireEvent.click(screen.getByText('Monthly values', { exact: true }));
        const snowfall = screen.getByRole('table', { name: 'Average monthly snowfall (cm)' });
        const tickLabels = () => [...container.querySelectorAll('.ski-snow-axis span')].map(tick => Number(tick.textContent));
        const expectMonth = (table: HTMLElement, month: string, value: string) => {
            const row = within(table).getByRole('row', { name: new RegExp(month) });
            expect(within(row).getByRole('cell', { name: value })).toBeVisible();
        };
        expect(tickLabels().at(-1)).toBe(0);
        expectMonth(snowfall, 'January', '216 cm');
        expectMonth(snowfall, 'July', '0 cm');
        const july = screen.getByTitle('July · 0 cm');
        expect(july.querySelector('.ski-snow-bar')).toBeNull();
        expect(july).toHaveTextContent('0');
        const depthButton = screen.getByRole('button', { name: 'Snow depth' });
        fireEvent.click(depthButton);
        expect(depthButton).toHaveAttribute('aria-pressed', 'true');
        const depth = screen.getByRole('table', { name: 'Average monthly maximum depth (cm)' });
        expect(tickLabels().at(-1)).toBe(0);
        // The displayed snowfall and depth series use different ranges.
        expect(tickLabels()[0]).toBeLessThan(216);
        expectMonth(depth, 'January', '82 cm');
        expectMonth(depth, 'July', '0 cm');
        const sources = openSnowSources();
        expect(sources.getByRole('link', { name: 'Average monthly maximum snow depth' })).toBeVisible();
        expect(sources.getByRole('link', { name: 'Annual and monthly snowfall' })).toBeVisible();
        expect(sources.getByText(/Hakuba, Nagano weather station/)).toBeVisible();
    });

    it('leaves a gap in the month axis when an intervening measurement is missing', () => {
        const dryHill = skiAreas.find(area => area.id === 'dry-hill-ski-area')!;
        const { container } = render(<SkiAreaDetails area={dryHill} units="metric" onClose={vi.fn()} />);
        const labels = [...container.querySelectorAll('.ski-snow-month')].map(month => month.textContent);
        expect(labels).toEqual(['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
        expect(screen.getByTitle('May · Unavailable')).toHaveTextContent('—');
    });

    it('shows the annual measurement site when there is no monthly snowfall table', () => {
        const brundage = skiAreas.find(area => area.id === 'brundage-mountain-resort')!;
        render(<SkiAreaDetails area={brundage} units="metric" onClose={vi.fn()} />);
        const season = within(screen.getByRole('region', { name: 'Season dates' }));
        expect(season.queryByText('Monthly values', { exact: true })).toBeNull();
        const sources = openSnowSources(season);
        expect(sources.getByRole('listitem')).toHaveTextContent('Brundage Mountain Resort · Base area');
        expect(sources.getByRole('link', { name: 'Annual snowfall' })).toHaveAttribute('href', 'https://brundage.com/mountain-stats/');
    });

    it('separates an operator annual figure from nearby station measurements', () => {
        const boyne = skiAreas.find(area => area.id === 'boyne-mountain')!;
        render(<SkiAreaDetails area={boyne} units="metric" onClose={vi.fn()} />);
        const season = within(screen.getByRole('region', { name: 'Season dates' }));
        const annualSource = 'https://www.boynemountain.com/mountain-stats';
        expect(season.getByRole('link', { name: '355.6 cm' })).toHaveAttribute('href', annualSource);
        const sources = openSnowSources(season);
        const annual = sources.getByRole('link', { name: 'Annual snowfall' });
        expect(annual).toHaveAttribute('href', annualSource);
        expect(annual.closest('li')).toHaveTextContent('Boyne Mountain Resort');
        expect(sources.getByRole('link', { name: 'Monthly snowfall totals' }).closest('li')).toHaveTextContent('Boyne Falls, MI weather station');
    });

    it('links annual and monthly normals to their own station files', () => {
        const snowSummit = skiAreas.find(area => area.id === 'snow-summit')!;
        render(<SkiAreaDetails area={snowSummit} units="metric" onClose={vi.fn()} />);
        const sources = openSnowSources();
        const station = sources.getByText(/Big Bear Lake, CA weather station/);
        expect(station).toHaveTextContent('1991–2020 reference period');
        for (const [label, file] of [['Annual snowfall', 'annualseasonal'], ['Monthly snowfall totals', 'monthly']]) {
            expect(within(station.closest('li')!).getByRole('link', { name: label }))
                .toHaveAttribute('href', expect.stringContaining(`normals-${file}/1991-2020/access/USC00040741.csv`));
        }
    });

    it('retains the annual citation when older snow data supplies a URL alone', () => {
        const resort = skiAreas.find(area => area.id === 'alta')!;
        const annualSource = 'https://operator.example.test/snow';
        const history = vi.spyOn(skiSnowHistory, 'get').mockReturnValue({ snowfall: {
            label: 'Weather station', source: 'https://weather.example.test/monthly', location: 'Nearby station',
            annualCm: 300, annualSource, monthlyCm: { 1: 30 },
        } });
        try {
            render(<SkiAreaDetails area={resort} units="metric" onClose={vi.fn()} />);
            expect(screen.getByRole('link', { name: '300 cm' })).toHaveAttribute('href', annualSource);
            const sources = openSnowSources();
            const annual = sources.getByRole('link', { name: 'Annual snowfall' });
            expect(annual).toHaveAttribute('href', annualSource);
            expect(annual.closest('li')).toHaveTextContent('operator.example.test');
            expect(sources.getByRole('link', { name: 'Monthly snowfall totals' }).closest('li')).toHaveTextContent('Nearby station');
        } finally {
            history.mockRestore();
        }
    });

    it('uses one annual and monthly citation when their source metadata matches', () => {
        const resort = skiAreas.find(area => area.id === 'alta')!;
        const source = { label: 'Operator', source: 'https://operator.example.test/snow', period: '1991–2020', location: 'Base' };
        const history = vi.spyOn(skiSnowHistory, 'get').mockReturnValue({ snowfall: {
            ...source, annualCm: 300, annualSource: { ...source }, monthlyCm: { 1: 30 },
        } });
        try {
            render(<SkiAreaDetails area={resort} units="metric" onClose={vi.fn()} />);
            const sources = openSnowSources();
            expect(sources.getAllByRole('link')).toHaveLength(1);
            expect(sources.getByRole('link', { name: 'Annual and monthly snowfall' })).toHaveAttribute('href', source.source);
        } finally {
            history.mockRestore();
        }
    });

    it('shows stale report details and renders named terrain only while open', async () => {
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
        const summary = screen.getByText('Reported lifts and trails (2)');
        const disclosure = summary.closest('details')!;
        expect(disclosure.querySelector('table')).toBeNull();
        fireEvent.click(summary);
        const table = within(await screen.findByRole('table', { name: 'Reported lift and trail status' }));
        expect(table.getByRole('row', { name: 'First chair Lift Open (stale)' })).toBeVisible();
        expect(table.getByRole('row', { name: 'First trail Trail Open (record stale)' })).toBeVisible();
        fireEvent.click(summary);
        await waitFor(() => expect(disclosure.querySelector('table')).toBeNull());
    });

    it('shows Mammoth snow, operator forecasts, and named terrain with their source and freshness', async () => {
        const area = skiAreas.find(area => area.id === 'mammoth-mountain')!;
        const report: ResortReport = {
            areaId: area.id, status: 'limited', reportedAt: '2026-11-21T08:40:00-08:00', retrievedAt: '2026-11-21T16:42:00Z',
            source: { name: 'Mammoth Mountain', url: 'https://www.mammothmountain.com/on-the-mountain/mountain-report#lifts-and-trails', exportable: false },
            snowByLocation: [{ location: 'Base', snow24HoursCm: 0 }, { location: 'Summit', baseCm: [101.6, 106.68], snow48HoursCm: 27.94 }],
            forecastDays: [
                { date: '2026-11-21', highC: -5, lowC: -10, description: 'Clear' },
                { date: '2026-11-22', highC: -3, lowC: -7, description: 'Snow' },
            ],
            terrain: { items: [{ id: 'main-run', name: 'Main Run', kind: 'trail', status: 'open', area: 'Main Lodge',
                difficulty: 'Difficult', groomed: true, snowmaking: true }] },
        };
        const conditions = { reports: new Map([[area.id, report]]), forecasts: new Map(), now: Date.parse(report.retrievedAt) };
        const props = { area, units: 'imperial', onClose: vi.fn() } as const;
        const { rerender } = render(<SkiAreaDetails {...props} conditions={conditions} />);
        const summary = within(screen.getByRole('region', { name: 'Conditions summary' }));
        expect(screen.getByRole('link', { name: 'Official conditions' })).toHaveAttribute('href', report.source.url);
        expect(summary.getByText(/Less than an hour old/)).toBeVisible();

        fireEvent.click(summary.getByText('Snow by location'));
        expect(summary.getByText('0 in')).toBeVisible();
        const summit = within(summary.getByRole('heading', { name: 'Summit' }).closest('li')!);
        expect(summit.getByText('40–42 in')).toBeVisible();
        expect(summit.getByText('11 in')).toBeVisible();
        expect(summit.queryByText('Past 24 hours')).not.toBeInTheDocument();

        fireEvent.click(summary.getByText('Operator forecast'));
        const forecast = within(summary.getByRole('table', { name: 'Daily forecast from Mammoth Mountain' }));
        expect(forecast.getByRole('row', { name: /Nov 21/ })).toHaveTextContent('23 °F');
        fireEvent.click(summary.getByText('Reported lifts and trails (1)'));
        const terrain = within(await summary.findByRole('table', { name: 'Reported lift and trail status' }));
        expect(terrain.getByRole('row', { name: /Main Run/ })).toHaveTextContent('Main Lodge · Difficult · Groomed · Snowmaking');

        rerender(<SkiAreaDetails {...props} units="metric" conditions={{ ...conditions, now: Date.parse('2026-11-22T08:00:00Z') }} />);
        expect(summary.getByText('Snow by location (stale)')).toBeVisible();
        expect(summit.getByText('27.9 cm')).toBeVisible();
        expect(forecast.queryByRole('row', { name: /Nov 21/ })).not.toBeInTheDocument();
        expect(forecast.getByRole('row', { name: /Nov 22/ })).toHaveTextContent('-3 °C');

        rerender(<SkiAreaDetails {...props} conditions={{ ...conditions, now: Date.parse('2026-11-23T12:00:00Z') }} />);
        expect(summary.queryByText('Operator forecast')).not.toBeInTheDocument();
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
