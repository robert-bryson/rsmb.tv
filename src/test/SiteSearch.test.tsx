import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteSearch } from '../components/Layout/SiteSearch';
import { loadSiteSearchIndex } from '../navigation/siteSearchIndex';
import type { SiteSearchDocument } from '../content/siteSearch';

vi.mock('../navigation/siteSearchIndex', () => ({ loadSiteSearchIndex: vi.fn() }));

const documents: SiteSearchDocument[] = [
    { url: '/trips/coast', kind: 'Trip report', title: 'A weekend away', description: 'Camping by the sea.', content: 'We explored a temperate rainforest and an old driftwood fort.' },
    { url: '/projects/forest', kind: 'Project', title: 'Forest maps', description: 'Explore forests and rainforests.', content: 'A cartography project.', keywords: 'Python' },
    { url: '/about', kind: 'Page', title: 'About', description: 'My background.', content: 'Geospatial engineering in Québec.' },
];

function Location() { return <span data-testid="location">{useLocation().pathname}</span>; }
function renderSearch() {
    render(<MemoryRouter><SiteSearch /><Location /><button>Outside</button></MemoryRouter>);
    return screen.getByRole('searchbox', { name: 'Search site' });
}

beforeEach(() => { vi.clearAllMocks(); vi.mocked(loadSiteSearchIndex).mockResolvedValue(documents); });

describe('header site search', () => {
    it('loads the text index on focus and searches article bodies with highlighted excerpts', async () => {
        const input = renderSearch();
        expect(loadSiteSearchIndex).not.toHaveBeenCalled();
        act(() => input.focus());
        fireEvent.change(input, { target: { value: 'driftwood' } });
        const result = await screen.findByRole('link', { name: /A weekend away/ });
        expect(result).toHaveAttribute('href', '/trips/coast');
        expect(result.querySelector('mark')).toHaveTextContent('driftwood');
        expect(screen.getByRole('status')).toHaveTextContent('1 result across the site');
        expect(screen.getByTestId('location')).toHaveTextContent('/');
    });

    it('lets keyboard users browse results, close with Escape, and return focus to the field', async () => {
        const input = renderSearch();
        act(() => input.focus());
        fireEvent.change(input, { target: { value: 'rainforest' } });
        const results = await screen.findByRole('list', { name: 'Search matches' });
        const links = within(results).getAllByRole('link');
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(links[0]).toHaveFocus();
        fireEvent.keyDown(links[0], { key: 'ArrowDown' });
        expect(links[1]).toHaveFocus();
        fireEvent.keyDown(links[1], { key: 'Escape' });
        expect(input).toHaveFocus();
        expect(screen.queryByRole('region', { name: 'Search results' })).not.toBeInTheDocument();
        fireEvent.click(input);
        expect(screen.getByRole('region', { name: 'Search results' })).toBeInTheDocument();
    });

    it('opens the first result on Enter and clears search after navigation', async () => {
        const input = renderSearch();
        fireEvent.change(input, { target: { value: 'python' } });
        await screen.findByRole('link', { name: /Forest maps/ });
        fireEvent.submit(screen.getByRole('search', { name: 'Site search' }));
        expect(screen.getByTestId('location')).toHaveTextContent('/projects/forest');
        expect(input).toHaveValue('');
        expect(screen.queryByRole('region', { name: 'Search results' })).not.toBeInTheDocument();
    });

    it('shows an empty state, clears the field, and dismisses when focus leaves search', async () => {
        const input = renderSearch();
        act(() => input.focus());
        fireEvent.change(input, { target: { value: 'missing keyword' } });
        await screen.findByText(/No results for/);
        act(() => screen.getByRole('button', { name: 'Outside' }).focus());
        expect(screen.queryByRole('region', { name: 'Search results' })).not.toBeInTheDocument();
        act(() => input.focus());
        fireEvent.click(screen.getByRole('button', { name: 'Clear site search' }));
        expect(input).toHaveValue('');
        expect(input).toHaveFocus();
    });

    it('offers a working retry after the index fails to load', async () => {
        vi.mocked(loadSiteSearchIndex).mockRejectedValueOnce(new Error('Network unavailable'));
        const input = renderSearch();
        fireEvent.change(input, { target: { value: 'quebec' } });
        fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
        await screen.findByRole('link', { name: /About/ });
        expect(loadSiteSearchIndex).toHaveBeenCalledTimes(2);
    });

    it('ignores punctuation-only queries and does not leave results open after an outside click', async () => {
        const input = renderSearch();
        fireEvent.change(input, { target: { value: '---' } });
        await waitFor(() => expect(loadSiteSearchIndex).toHaveBeenCalledOnce());
        expect(screen.queryByRole('region', { name: 'Search results' })).not.toBeInTheDocument();
        fireEvent.change(input, { target: { value: 'python' } });
        await screen.findByRole('link', { name: /Forest maps/ });
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
        expect(screen.queryByRole('region', { name: 'Search results' })).not.toBeInTheDocument();
    });
});

describe('November 15 search review regressions', () => {
    it('keeps composition keys in the input and does not submit an unfinished word', async () => {
        const input = renderSearch();
        act(() => input.focus());
        fireEvent.change(input, { target: { value: 'python' } });
        await screen.findByRole('link', { name: /Forest maps/ });
        fireEvent.compositionStart(input);
        expect(fireEvent.keyDown(input, { key: 'ArrowDown', isComposing: true })).toBe(true);
        expect(input).toHaveFocus();
        fireEvent.submit(screen.getByRole('search', { name: 'Site search' }));
        expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
        expect(input).toHaveValue('python');
        fireEvent.compositionEnd(input);
        // Safari can end composition before the final keydown, with code 229.
        expect(fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })).toBe(false);
        fireEvent.submit(screen.getByRole('search', { name: 'Site search' }));
        expect(screen.getByTestId('location')).toHaveTextContent('/projects/forest');
    });

    it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])('preserves modified arrow keys: %j', async modifier => {
        const input = renderSearch();
        act(() => input.focus());
        fireEvent.change(input, { target: { value: 'python' } });
        await screen.findByRole('link', { name: /Forest maps/ });
        expect(fireEvent.keyDown(input, { key: 'ArrowDown', ...modifier })).toBe(true);
        expect(input).toHaveFocus();
    });

    it('shares a pending index request and keeps dismissed results closed when it finishes', async () => {
        let resolve!: (value: SiteSearchDocument[]) => void;
        vi.mocked(loadSiteSearchIndex).mockReturnValue(new Promise(done => { resolve = done; }));
        const input = renderSearch();
        act(() => input.focus());
        fireEvent.click(input);
        fireEvent.change(input, { target: { value: 'forest' } });
        fireEvent.change(input, { target: { value: 'python' } });
        expect(loadSiteSearchIndex).toHaveBeenCalledOnce();
        expect(screen.getByRole('status')).toHaveTextContent('Searching…');
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
        await act(async () => resolve(documents));
        expect(screen.queryByRole('region', { name: 'Search results' })).not.toBeInTheDocument();
        fireEvent.click(input);
        expect(screen.getByRole('link', { name: /Forest maps/ })).toBeInTheDocument();
    });

    it('handles both ends of keyboard navigation without leaving stale result references', async () => {
        const input = renderSearch();
        act(() => input.focus());
        fireEvent.change(input, { target: { value: 'rainforest' } });
        const list = await screen.findByRole('list', { name: 'Search matches' });
        const links = within(list).getAllByRole('link');
        fireEvent.keyDown(input, { key: 'ArrowUp' });
        expect(links.at(-1)).toHaveFocus();
        fireEvent.keyDown(links.at(-1)!, { key: 'ArrowDown' });
        expect(input).toHaveFocus();
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(links[0], { key: 'ArrowUp' });
        expect(input).toHaveFocus();
        fireEvent.change(input, { target: { value: 'python' } });
        fireEvent.keyDown(input, { key: 'ArrowUp' });
        expect(screen.getByRole('link', { name: /Forest maps/ })).toHaveFocus();
    });
});
