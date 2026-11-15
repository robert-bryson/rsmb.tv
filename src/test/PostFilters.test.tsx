import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostFilters } from '../components/PostFilters';

beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(200, 100, 100, 44));
});
afterEach(() => vi.restoreAllMocks());

function renderFilters(count = 0) {
    return render(<><PostFilters count={count}><a href="#tags">Tags</a><a href="#regions">Regions</a></PostFilters><button>Outside</button></>);
}

describe('post filter dropdown', () => {
    it('starts collapsed and toggles the tag and region controls together', () => {
        renderFilters();
        const button = screen.getByRole('button', { name: 'Filters' });
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).toHaveAccessibleDescription('Filter by tag or region');
        expect(screen.queryByRole('region', { name: 'Post filters' })).not.toBeInTheDocument();
        fireEvent.click(button);
        const panel = screen.getByRole('region', { name: 'Post filters' });
        expect(button).toHaveAttribute('aria-controls', panel.id);
        expect(within(panel).getAllByRole('link')).toHaveLength(2);
        fireEvent.click(button);
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('link', { name: 'Tags' })).not.toBeInTheDocument();
    });

    it('closes with Escape and returns focus to the trigger', () => {
        renderFilters();
        const button = screen.getByRole('button', { name: 'Filters' });
        fireEvent.click(button);
        const tags = screen.getByRole('link', { name: 'Tags' });
        act(() => tags.focus());
        fireEvent.keyDown(tags, { key: 'Escape' });
        expect(button).toHaveFocus();
        expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('retains internal focus and dismisses when focus or a pointer moves outside', () => {
        renderFilters();
        const button = screen.getByRole('button', { name: 'Filters' });
        fireEvent.click(button);
        act(() => screen.getByRole('link', { name: 'Tags' }).focus());
        act(() => screen.getByRole('link', { name: 'Regions' }).focus());
        expect(button).toHaveAttribute('aria-expanded', 'true');
        act(() => screen.getByRole('button', { name: 'Outside' }).focus());
        expect(button).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(button);
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
        expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('describes active filters without adding the count to the button name', () => {
        const { rerender } = renderFilters(2);
        const button = screen.getByRole('button', { name: 'Filters' });
        expect(button).toHaveAccessibleDescription('2 active filters');
        rerender(<PostFilters count={1}>Options</PostFilters>);
        expect(button).toHaveAccessibleDescription('1 active filter');
    });
});

describe('post filter review regressions: dismissal and scroll focus', () => {
    it('lets the scroll area take focus without closing or adding a Tab stop', () => {
        renderFilters();
        const button = screen.getByRole('button', { name: 'Filters' });
        fireEvent.click(button);
        const panel = screen.getByRole('region', { name: 'Post filters' });
        act(() => screen.getByRole('link', { name: 'Tags' }).focus());
        act(() => panel.focus());
        expect(panel).toHaveFocus();
        expect(panel).toHaveAttribute('tabindex', '-1');
        expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('returns focus without scrolling when the trigger leaves the viewport', () => {
        let frame: FrameRequestCallback | undefined;
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1; });
        renderFilters();
        const button = screen.getByRole('button', { name: 'Filters' });
        fireEvent.click(button);
        act(() => screen.getByRole('link', { name: 'Tags' }).focus());
        vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue(new DOMRect(200, -100, 100, 44));
        fireEvent.scroll(window);
        act(() => frame?.(0));
        expect(button).toHaveFocus();
        expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('keeps the panel open when a child owns Escape or another key is pressed', () => {
        render(<PostFilters count={0}><button onKeyDown={event => { if (event.key === 'Escape') event.preventDefault(); }}>Nested control</button></PostFilters>);
        const button = screen.getByRole('button', { name: 'Filters' });
        fireEvent.click(button);
        const child = screen.getByRole('button', { name: 'Nested control' });
        act(() => child.focus());
        fireEvent.keyDown(child, { key: 'Escape' });
        fireEvent.keyDown(child, { key: 'ArrowDown' });
        expect(child).toHaveFocus();
        expect(button).toHaveAttribute('aria-expanded', 'true');
    });
});
