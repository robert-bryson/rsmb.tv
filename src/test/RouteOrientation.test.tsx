import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { RouteOrientation } from '../components/RouteOrientation';

function Navigation() {
    const location = useLocation();
    const navigate = useNavigate();
    const [ready, setReady] = useState(true);
    const [failed, setFailed] = useState(false);
    return <>
        <RouteOrientation />
        <button onClick={() => { setReady(false); navigate('/second'); }}>New page</button>
        <button onClick={() => setReady(true)}>Commit page</button>
        <button onClick={() => setFailed(true)}>Fail page</button>
        <button onClick={() => navigate('?filter=all')}>Filter</button>
        <button onClick={() => navigate(-1)}>Back</button>
        <button onClick={() => navigate('/first', { state: { restoreScroll: true } })}>Return to list</button>
        <button onClick={() => navigate('/first#anchor')}>Anchor</button>
        <main>{failed ? <section data-testid="page-error"><h1>Page unavailable</h1></section>
            : <><h1>{location.pathname}</h1>{ready && <span hidden data-route-path={location.pathname} />}</>}</main>
    </>;
}

function mount() { return render(<MemoryRouter initialEntries={['/first']}><Navigation /></MemoryRouter>); }

describe('route orientation', () => {
    it('waits for lazy content and focuses the completed destination without scrolling', async () => {
        mount();
        const button = screen.getByRole('button', { name: 'New page' });
        button.focus(); fireEvent.click(button);
        expect(button).toHaveFocus();
        fireEvent.click(screen.getByRole('button', { name: 'Commit page' }));
        await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
        expect(document.querySelector('[data-route-announcement]')).toHaveTextContent('/second loaded');
    });

    it('does not move focus for filters, history, restored lists, or fragments', async () => {
        mount();
        const next = screen.getByRole('button', { name: 'New page' });
        fireEvent.click(next); fireEvent.click(screen.getByRole('button', { name: 'Commit page' }));
        await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
        for (const name of ['Filter', 'Back', 'Return to list', 'Anchor']) {
            const button = screen.getByRole('button', { name });
            button.focus(); fireEvent.click(button);
            await new Promise(resolve => requestAnimationFrame(resolve));
            expect(button).toHaveFocus();
        }
    });

    it('announces the destination without stealing focus after new user input', async () => {
        mount();
        fireEvent.click(screen.getByRole('button', { name: 'New page' }));
        const commit = screen.getByRole('button', { name: 'Commit page' });
        commit.focus();
        fireEvent.keyDown(commit, { key: 'Tab' });
        fireEvent.click(commit);
        await waitFor(() => expect(document.querySelector('[data-route-announcement]')).toHaveTextContent('/second loaded'));
        expect(commit).toHaveFocus();
    });

    it('orients a failed destination without waiting for a success marker', async () => {
        mount();
        fireEvent.click(screen.getByRole('button', { name: 'New page' }));
        const main = screen.getByRole('main');
        fireEvent.click(screen.getByRole('button', { name: 'Fail page' }));
        await waitFor(() => expect(main).toHaveFocus());
        expect(document.querySelector('[data-route-announcement]')).toHaveTextContent('Page unavailable loaded');
    });
});
