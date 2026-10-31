import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useAtlasUrlState } from '../features/trips/atlas/useAtlasUrlState';

function Harness() {
    const { params, updateParams } = useAtlasUrlState();
    const location = useLocation();
    const navigate = useNavigate();
    return <>
        <output data-testid="query">{params.toString()}</output>
        <output data-testid="state">{JSON.stringify(location.state)}</output>
        <output data-testid="hash">{location.hash}</output>
        <button onClick={() => {
            updateParams(next => { next.set('trip', 'coast'); });
            updateParams(next => { next.set('panel', 'compact'); });
            updateParams(next => { next.set('camera', '-123,48,7,0,0'); });
        }}>Compose</button>
        <button onClick={() => updateParams(next => { next.set('milesMin', '600'); return next; }, false)}>Apply</button>
        <button onClick={() => { void navigate(-1); }}>Back</button>
    </>;
}

describe('atlas URL updates', () => {
    it('composes same-event writes, preserves return state and fragments, and keeps Apply as one Back step', () => {
        render(<MemoryRouter initialEntries={[{ pathname: '/projects/adv-atlas/map', search: '?country=CA', hash: '#map', state: { returnKey: 'origin' } }]}><Harness /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Compose' }));
        expect(screen.getByTestId('query')).toHaveTextContent('country=CA&trip=coast&panel=compact&camera=-123%2C48%2C7%2C0%2C0');
        expect(screen.getByTestId('state')).toHaveTextContent('{"returnKey":"origin"}');
        expect(screen.getByTestId('hash')).toHaveTextContent('#map');
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        expect(screen.getByTestId('query')).toHaveTextContent('milesMin=600');
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(screen.getByTestId('query')).not.toHaveTextContent('milesMin');
        expect(screen.getByTestId('query')).toHaveTextContent('trip=coast&panel=compact');
    });
});
