import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import SkiStatus from '../pages/SkiStatus';
import { loadConditionsFeed, type ConditionsFeed } from '../features/ski-status/conditions-feed';
import { captureSkiMapArea, encodeSkiMapArea } from '../features/ski-status/skiMapArea';

vi.mock('../features/ski-status/SkiStatusMap', () => ({
    default: ({ onSearchArea }: { onSearchArea: (value: string) => void }) => <div>
        <button type="button" onClick={() => onSearchArea(encodeSkiMapArea(captureSkiMapArea([-115, 41], 9, 100, 100,
            ([x, y]) => [-115 + (x - 50) / 100, 41 + (50 - y) / 100])))}>Commit area in Nevada</button>
    </div>,
}));

vi.mock('../features/ski-status/conditions-feed', () => ({ loadConditionsFeed: vi.fn().mockResolvedValue({}) }));

afterEach(() => { vi.useRealTimers(); localStorage.removeItem('ski-status-excluded-locations'); });

it('opens the map first on a narrow screen and keeps catalog results one tap away', async () => {
    render(<MemoryRouter initialEntries={['/projects/ski-status/map']}><SkiStatus /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Ski today' })).toHaveAttribute('aria-pressed', 'true');
    await screen.findByRole('button', { name: 'Commit area in Nevada' });
    expect(screen.queryByRole('region', { name: 'Ski area comparison table' })).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'All resorts' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Results' })); });
    expect(screen.getByRole('region', { name: 'Ski area list' })).toBeVisible();
});

it('commits a searched area and applies the same matches in Compare', async () => {
    render(<MemoryRouter initialEntries={['/projects/ski-status/map?q=whaleback']}><SkiStatus /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Commit area in Nevada' }));
    await screen.findByRole('button', { name: 'Remove Map area' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Compare' })); });
    expect(screen.getByText('No ski areas match these filters.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Map area' }));
    expect(await screen.findByRole('button', { name: 'Whaleback Mountain' })).toBeVisible();
});

it('returns focus to the comparing row after closing an area', async () => {
    render(<MemoryRouter initialEntries={['/projects/ski-status/map?view=table&q=whaleback']}><SkiStatus /></MemoryRouter>);
    const row = screen.getByRole('button', { name: 'Whaleback Mountain' });
    fireEvent.click(row);
    const panel = screen.getByRole('region', { name: 'Whaleback Mountain' });
    expect(panel).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    expect(row).toHaveFocus();
});

it.each([
    { view: 'map', expected: 'Results' },
    { view: 'table', expected: 'Compare' },
])('shows the filtered matches from $view on a narrow screen', async ({ view, expected }) => {
    render(<MemoryRouter initialEntries={[`/projects/ski-status/map?view=${view}&status=all&q=whaleback`]}>
        <SkiStatus />
    </MemoryRouter>);
    const dialog = document.querySelector<HTMLDialogElement>('#ski-filters')!;
    Object.defineProperties(dialog, {
        showModal: { value: () => { dialog.open = true; } },
        close: { value: () => { dialog.open = false; } },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(dialog.open).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Show 1 result' }));
    expect(dialog.open).toBe(false);
    expect(await screen.findByRole('button', { name: expected, pressed: true })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Whaleback Mountain' })).toBeVisible();
});

it('keeps local exclusions when a user edits the locations in a shared view', async () => {
    const preference = 'ski-status-excluded-locations';
    localStorage.setItem(preference, JSON.stringify(['continent:Europe']));
    render(<MemoryRouter initialEntries={['/projects/ski-status/map?view=results&status=all&excludeRegion=country%3AJP']}><SkiStatus /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Remove Exclude Japan' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Remove Exclude Europe' })).toBeNull();

    const dialog = document.querySelector<HTMLDialogElement>('#ski-filters')!;
    Object.defineProperty(dialog, 'showModal', { value: () => { dialog.open = true; } });
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const filters = within(dialog);
    fireEvent.change(filters.getByLabelText('Choose a location'), { target: { value: 'region:US:CA' } });
    await act(async () => { fireEvent.click(filters.getByRole('button', { name: 'Exclude' })); });
    expect(filters.getByRole('button', { name: 'Remove Exclude California' })).toBeVisible();
    expect(JSON.parse(localStorage.getItem(preference)!)).toEqual(['continent:Europe', 'region:US:CA']);

    fireEvent.click(filters.getByRole('button', { name: 'Remove Exclude Japan' }));
    expect(filters.queryByRole('button', { name: 'Remove Exclude Japan' })).toBeNull();
    expect(JSON.parse(localStorage.getItem(preference)!)).toEqual(['continent:Europe', 'region:US:CA']);
});

it('waits for reports and presents the current ski areas when the feed arrives', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const time = '2026-12-25T20:00:00Z';
    vi.setSystemTime(new Date(time));
    let publish!: (feed: ConditionsFeed) => void;
    const load = vi.mocked(loadConditionsFeed);
    load.mockReturnValueOnce(new Promise(resolve => { publish = resolve; }));
    const { unmount } = render(<MemoryRouter initialEntries={['/projects/ski-status/map?view=results']}><SkiStatus /></MemoryRouter>);
    expect(screen.getByText('Checking today’s resort reports…')).toBeVisible();
    await act(async () => publish({ reports: { file: 'test-reports', data: { version: 1, generatedAt: time, reports: [{
        areaId: 'whaleback', status: 'limited', reportedAt: time, retrievedAt: time, lifts: { open: 1 },
        source: { name: 'Test operator', url: 'https://example.org/report', exportable: false },
    }] } } }));
    expect(screen.getByText('1 reporting skiing today', { exact: true })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Whaleback Mountain' })).toBeVisible();
    unmount();
    expect(load.mock.lastCall?.[1].aborted).toBe(true);
});
