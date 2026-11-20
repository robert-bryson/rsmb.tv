import { act, fireEvent, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import SkiStatus from '../pages/SkiStatus';

vi.mock('../features/ski-status/SkiStatusMap', () => ({
    default: ({ onVisibleAreasChange }: { onVisibleAreasChange: (ids: ReadonlySet<string>) => void }) => <div>
        <button type="button" onClick={() => onVisibleAreasChange(new Set(['whaleback']))}>Show Whaleback on map</button>
        <button type="button" onClick={() => onVisibleAreasChange(new Set())}>Show empty map</button>
    </div>,
}));

it('uses the last map view when the viewport filter is on and leaves the table alone when it is off', async () => {
    const onRender = vi.fn();
    render(<MemoryRouter initialEntries={['/projects/ski-status/map?q=whaleback&view=split']}>
        <Profiler id="ski-status" onRender={onRender}><SkiStatus /></Profiler>
    </MemoryRouter>);

    const emptyMap = await screen.findByRole('button', { name: 'Show empty map' });
    const populatedMap = screen.getByRole('button', { name: 'Show Whaleback on map' });
    const viewportFilter = screen.getByRole('checkbox', { name: 'In map view' });
    const area = () => screen.queryByRole('button', { name: 'Whaleback Mountain' });
    expect(area()).toBeVisible();
    onRender.mockClear();
    fireEvent.click(emptyMap);
    expect(onRender).not.toHaveBeenCalled();
    expect(area()).toBeVisible();

    fireEvent.click(viewportFilter);
    await screen.findByText('No matching ski areas in this map view.');
    expect(area()).toBeNull();

    fireEvent.click(populatedMap);
    expect(area()).toBeVisible();
    onRender.mockClear();
    fireEvent.click(populatedMap);
    expect(onRender).not.toHaveBeenCalled();

    fireEvent.click(emptyMap);
    expect(area()).toBeNull();
    await act(async () => { fireEvent.click(viewportFilter); });
    expect(area()).toBeVisible();
});

it('keeps the table usable while waiting for a map view on a narrow screen', async () => {
    render(<MemoryRouter initialEntries={['/projects/ski-status/map?q=whaleback&inView=1']}>
        <SkiStatus />
    </MemoryRouter>);

    const row = screen.getByRole('button', { name: 'Whaleback Mountain' });
    expect(screen.getByText('Open Map to set the area.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Show empty map' })).toBeNull();
    fireEvent.click(row);
    fireEvent.click(await screen.findByRole('button', { name: 'Close details' }));
    expect(row).toHaveFocus();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Split' })); });

    expect(screen.getByText('Waiting for a map view.')).toBeVisible();
    fireEvent.click(await screen.findByRole('button', { name: 'Show Whaleback on map' }));
    expect(screen.queryByText('Waiting for a map view.')).toBeNull();
    expect(row).toBeVisible();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Table' })); });
    expect(screen.queryByText('Open Map to set the area.')).toBeNull();
    expect(row).toBeVisible();
});
