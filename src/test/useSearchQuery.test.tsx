import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { advanceSearchCommit } from './helpers/search';

const deferredWrites = vi.hoisted(() => [] as Array<() => void>);

vi.mock('react-router-dom', async importOriginal => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return {
        ...actual,
        useSearchParams: (...args: Parameters<typeof actual.useSearchParams>) => {
            const [params, write] = actual.useSearchParams(...args);
            return [params, (...update: Parameters<typeof write>) => deferredWrites.push(() => write(...update))];
        },
    };
});

function Harness() {
    const { query, updateQuery, commitQuery, clearFilters, returnUrl } = useSearchQuery();
    const location = useLocation();
    const navigate = useNavigate();
    const [saved, setSaved] = useState({ url: '', state: null as unknown });
    return <>
        <input aria-label="Search" value={query} onChange={event => updateQuery(event.target.value)} />
        <span data-testid="url">{location.pathname + location.search}</span>
        <span data-testid="return">{returnUrl}</span>
        <span data-testid="state">{JSON.stringify(location.state)}</span>
        <button onClick={clearFilters}>Clear filters</button>
        <button onClick={commitQuery}>Commit search</button>
        <button onClick={() => navigate('/projects?q=external', { replace: true, state: location.state })}>Replace with context</button>
        <button onClick={() => navigate('/projects?q=external', { state: location.state })}>Push with context</button>
        <button onClick={() => setSaved({ url: location.pathname + location.search, state: location.state })}>Save entry</button>
        <button onClick={() => navigate(saved.url, { replace: true, state: saved.state })}>Restore saved entry</button>
        <button onClick={() => navigate(-1)}>Back</button>
        <button onClick={() => navigate(1)}>Forward</button>
    </>;
}

function openSearch(state: unknown = { context: 'saved-list', restoreScroll: true }) {
    return render(<MemoryRouter initialEntries={['/about', { pathname: '/projects', search: '?category=maps', state }]}>
        <Harness />
    </MemoryRouter>);
}

function commitNextWrite() {
    advanceSearchCommit();
    const write = deferredWrites.shift();
    expect(write).toBeDefined();
    act(() => { write!(); });
}

beforeEach(() => { vi.useFakeTimers(); deferredWrites.length = 0; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('search write ownership review regressions', () => {
    it('keeps urgent input and return links ahead of delayed router commits', () => {
        openSearch({ context: 'saved-list', restoreScroll: true, siteSearchQuery: 'maps' });
        const input = screen.getByRole('textbox', { name: 'Search' });
        fireEvent.change(input, { target: { value: 'p' } });
        advanceSearchCommit();
        fireEvent.change(input, { target: { value: 'python' } });
        expect(screen.getByTestId('url')).toHaveTextContent('/projects?category=maps');
        expect(screen.getByTestId('return')).toHaveTextContent('/projects?category=maps&q=python');
        commitNextWrite();
        expect(input).toHaveValue('python');
        expect(screen.getByTestId('url')).toHaveTextContent('/projects?category=maps&q=p');
        commitNextWrite();
        expect(input).toHaveValue('python');
        expect(screen.getByTestId('url')).toHaveTextContent('/projects?category=maps&q=python');
        const state = JSON.parse(screen.getByTestId('state').textContent!);
        expect(state.context).toBe('saved-list');
        expect(state).not.toHaveProperty('restoreScroll');
        expect(state).not.toHaveProperty('siteSearchQuery');
    });

    it('keeps the latest input when its own pending commits arrive out of order', () => {
        openSearch();
        const input = screen.getByRole('textbox', { name: 'Search' });
        fireEvent.change(input, { target: { value: 'p' } });
        advanceSearchCommit();
        fireEvent.change(input, { target: { value: 'python' } });
        advanceSearchCommit();
        const [earlier, later] = deferredWrites.splice(0);
        act(() => { later(); });
        act(() => { earlier(); });
        expect(input).toHaveValue('python');
        expect(screen.getByTestId('return')).toHaveTextContent('/projects?category=maps&q=python');
        fireEvent.change(input, { target: { value: 'python maps' } });
        commitNextWrite();
        expect(screen.getByTestId('url')).toHaveTextContent('/projects?category=maps&q=python+maps');
    });

    it.each(['Replace with context', 'Push with context'])('accepts another query when navigation reuses input state: %s', action => {
        openSearch();
        const input = screen.getByRole('textbox', { name: 'Search' });
        fireEvent.change(input, { target: { value: 'python' } });
        commitNextWrite();
        fireEvent.click(screen.getByRole('button', { name: action }));
        expect(screen.getByTestId('url')).toHaveTextContent('/projects?q=external');
        expect(input).toHaveValue('external');
        expect(screen.getByTestId('return')).toHaveTextContent('/projects?q=external');
    });

    it('does not recognize a previously consumed write as a new input commit', () => {
        openSearch();
        const input = screen.getByRole('textbox', { name: 'Search' });
        fireEvent.change(input, { target: { value: 'first' } });
        commitNextWrite();
        fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));
        fireEvent.change(input, { target: { value: 'second' } });
        commitNextWrite();
        fireEvent.click(screen.getByRole('button', { name: 'Restore saved entry' }));
        expect(screen.getByTestId('url')).toHaveTextContent('/projects?category=maps&q=first');
        expect(input).toHaveValue('first');
    });

    it('clears filters without losing unrelated state and restores history queries', () => {
        openSearch();
        const input = screen.getByRole('textbox', { name: 'Search' });
        fireEvent.change(input, { target: { value: 'python' } });
        commitNextWrite();
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        expect(input).toHaveValue('');
        commitNextWrite();
        expect(screen.getByTestId('url').textContent).toBe('/projects');
        expect(JSON.parse(screen.getByTestId('state').textContent!)).toEqual({
            context: 'saved-list',
            __rsmbSearchOwner: { owner: expect.any(String), revision: 2, search: '', navigation: 'PUSH' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(input).toHaveValue('python');
        fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
        expect(input).toHaveValue('');
    });

    it('keeps a cleared category and newer text while earlier writes commit', () => {
        openSearch();
        const input = screen.getByRole('textbox', { name: 'Search' });
        fireEvent.change(input, { target: { value: 'p' } });
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        fireEvent.change(input, { target: { value: 'python' } });
        expect(screen.getByTestId('return').textContent).toBe('/projects?q=python');
        commitNextWrite();
        expect(input).toHaveValue('python');
        commitNextWrite();
        expect(input).toHaveValue('python');
        commitNextWrite();
        expect(screen.getByTestId('url').textContent).toBe('/projects?q=python');
    });

    it('coalesces rapid edits into one URL write while input remains immediate', () => {
        openSearch();
        const input = screen.getByRole('textbox', { name: 'Search' });
        for (const query of ['p', 'py', 'pyt', 'python']) fireEvent.change(input, { target: { value: query } });
        expect(input).toHaveValue('python');
        expect(deferredWrites).toHaveLength(0);
        act(() => { vi.advanceTimersByTime(399); });
        expect(deferredWrites).toHaveLength(0);
        act(() => { vi.advanceTimersByTime(1); });
        expect(deferredWrites).toHaveLength(1);
        commitNextWrite();
        expect(screen.getByTestId('url')).toHaveTextContent('/projects?category=maps&q=python');
    });

    it('commits explicitly without leaving a duplicate timer write', () => {
        openSearch();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'python' } });
        fireEvent.click(screen.getByRole('button', { name: 'Commit search' }));
        expect(deferredWrites).toHaveLength(1);
        advanceSearchCommit();
        expect(deferredWrites).toHaveLength(1);
        commitNextWrite();
    });

    it('cancels an uncommitted query when another navigation takes over', () => {
        openSearch();
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'python' } });
        fireEvent.click(screen.getByRole('button', { name: 'Replace with context' }));
        advanceSearchCommit();
        expect(input).toHaveValue('external');
        expect(deferredWrites).toHaveLength(0);
    });

    it('cancels delayed writes on native history navigation and unmount', () => {
        const view = openSearch();
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'python' } });
        act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
        advanceSearchCommit();
        expect(deferredWrites).toHaveLength(0);
        fireEvent.change(input, { target: { value: 'python maps' } });
        view.unmount();
        advanceSearchCommit();
        expect(deferredWrites).toHaveLength(0);
    });
});
