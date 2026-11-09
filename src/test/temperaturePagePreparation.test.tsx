import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import TemperatureRecords from '../pages/TemperatureRecords';

const mocks = vi.hoisted(() => ({ warm: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../features/temperatures/loadTemperatureMap', () => ({
    loadTemperatureMap: async () => ({ default: () => <output>Temperature renderer ready</output> }),
    warmTemperatureData: mocks.warm,
}));

it('prepares required data with normal priority only when the selected data view changes', async () => {
    function Page() {
        const navigate = useNavigate();
        return <>
            <button onClick={() => navigate('?view=recent&lat=45&lng=-100&zoom=5')}>Move camera</button>
            <button onClick={() => navigate('?view=state')}>State view</button>
            <button onClick={() => navigate('?view=state&state=MO')}>Select Missouri</button>
            <TemperatureRecords />
        </>;
    }
    render(<MemoryRouter initialEntries={['/projects/temperature-records/map']}><Page /></MemoryRouter>);
    expect(await screen.findByText('Temperature renderer ready')).toBeVisible();
    expect(mocks.warm).toHaveBeenCalledExactlyOnceWith('?view=recent', 'auto');
    fireEvent.click(screen.getByRole('button', { name: 'Move camera' }));
    expect(mocks.warm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'State view' }));
    await waitFor(() => expect(mocks.warm).toHaveBeenLastCalledWith('?view=state', 'auto'));
    fireEvent.click(screen.getByRole('button', { name: 'Select Missouri' }));
    expect(mocks.warm).toHaveBeenCalledTimes(2);
});
