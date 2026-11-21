import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import SkiStatus from '../pages/SkiStatus';
import { captureSkiMapArea, encodeSkiMapArea } from '../features/ski-status/skiMapArea';

vi.mock('../features/ski-status/SkiStatusMap', () => ({
    default: ({ onSearchArea }: { onSearchArea: (value: string) => void }) => <div>
        <button type="button" onClick={() => onSearchArea(encodeSkiMapArea(captureSkiMapArea([-115, 41], 9, 100, 100,
            ([x, y]) => [-115 + (x - 50) / 100, 41 + (50 - y) / 100])))}>Commit area in Nevada</button>
    </div>,
}));

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
