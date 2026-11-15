import { Suspense } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { useSearchQuery } from '../hooks/useSearchQuery';

function SearchField() {
    const { query, updateQuery, commitQuery, returnUrl } = useSearchQuery();
    return <>
        <input aria-label="Search" value={query} onChange={event => updateQuery(event.target.value)} onBlur={commitQuery} />
        <span data-testid="return">{returnUrl}</span>
    </>;
}

function PendingRoute({ gate }: { gate: { paused: boolean; promise: Promise<void>; observed: () => void } }) {
    const location = useLocation();
    if (location.search.includes('q=') && gate.paused) {
        gate.observed();
        throw gate.promise;
    }
    return <span data-testid="url">{location.pathname + location.search}</span>;
}

it('keeps urgent input when a router transition renders and is then suspended', async () => {
    let release!: () => void;
    const gate = { paused: true, observed: vi.fn(), promise: new Promise<void>(resolve => { release = resolve; }) };
    render(<MemoryRouter initialEntries={['/projects?category=maps']}>
        <Suspense fallback={<p>Pending route</p>}>
            <SearchField />
            <PendingRoute gate={gate} />
        </Suspense>
    </MemoryRouter>);
    const input = screen.getByRole('textbox', { name: 'Search' });
    await act(async () => { fireEvent.change(input, { target: { value: 'p' } }); fireEvent.blur(input); });
    expect(gate.observed).toHaveBeenCalled();
    expect(input).toHaveValue('p');
    expect(screen.getByTestId('url')).toHaveTextContent('/projects?category=maps');
    await act(async () => { fireEvent.change(input, { target: { value: 'python' } }); fireEvent.blur(input); });
    expect(input).toHaveValue('python');
    expect(screen.getByTestId('return')).toHaveTextContent('/projects?category=maps&q=python');
    await act(async () => { gate.paused = false; release(); });
    expect(input).toHaveValue('python');
    expect(screen.getByTestId('url')).toHaveTextContent('/projects?category=maps&q=python');
});
