import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostRegionFilters } from '../components/PostRegionFilters';
import { createBlogRegionSearch } from '../content/blogRegions';

const countries = [{
    code: 'US', name: 'United States', count: 4,
    regions: ['Washington', 'Oregon', 'California', 'Alaska'].map(name => ({ name, count: 1 })),
}];
let width: number;
let observers: { resize: () => void; disconnect: ReturnType<typeof vi.fn> }[];

beforeEach(() => {
    width = 300;
    observers = [];
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        return { width: (this.textContent?.length ?? 0) * 8 + 20 } as DOMRect;
    });
    vi.stubGlobal('ResizeObserver', class {
        disconnect = vi.fn();
        constructor(callback: () => void) { observers.push({ resize: callback, disconnect: this.disconnect }); }
        observe() {}
    });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function renderFilters(country = '', region = '') {
    return render(<MemoryRouter><PostRegionFilters
        countries={countries} activeCountry={country} activeRegion={region}
        createUrl={(country, region) => `/posts${createBlogRegionSearch(country, region)}`}
    /></MemoryRouter>);
}

describe('filter review regressions: responsive region controls', () => {
    it('keeps the selected region accessible across collapse, expansion, and resize', () => {
        const { unmount } = renderFilters('US', 'alaska');
        const group = within(screen.getByRole('group', { name: 'United States' }));
        expect(group.getByRole('link', { name: /Alaska/ })).toHaveAttribute('aria-current', 'page');
        expect(group.queryByRole('link', { name: /California/ })).not.toBeInTheDocument();
        const toggle = group.getByRole('button', { name: 'See all (4)' });
        expect(toggle).toHaveAttribute('aria-controls', screen.getByRole('group', { name: 'United States' }).id);
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(group.getAllByRole('link')).toHaveLength(5);
        fireEvent.click(toggle);
        expect(group.getByRole('link', { name: /Alaska/ })).toBeInTheDocument();

        act(() => { width = 2000; observers.forEach(observer => observer.resize()); });
        expect(group.getAllByRole('link')).toHaveLength(5);
        expect(group.queryByRole('button')).not.toBeInTheDocument();
        act(() => { width = 300; observers.forEach(observer => observer.resize()); });
        expect(group.getByRole('link', { name: /Alaska/ })).toHaveAttribute('aria-current', 'page');
        expect(group.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
        unmount();
        expect(observers.every(observer => observer.disconnect.mock.calls.length === 1)).toBe(true);
    });

    it('keeps the first region available when only the country and toggle fit', () => {
        width = 100;
        renderFilters('US');
        const group = within(screen.getByRole('group', { name: 'United States' }));
        expect(group.getByRole('link', { name: 'United States' })).toHaveAttribute('aria-current', 'page');
        expect(group.getByRole('link', { name: /Washington/ })).toHaveAttribute('href', '/posts?country=US&region=washington');
        expect(group.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    });

    it('keeps every link available in an unmeasurable container without ResizeObserver', () => {
        width = 0;
        vi.stubGlobal('ResizeObserver', undefined);
        renderFilters();
        const nav = within(screen.getByRole('navigation', { name: 'Post regions' }));
        expect(nav.getByRole('link', { name: 'All regions' })).toHaveAttribute('aria-current', 'page');
        expect(nav.getAllByRole('link')).toHaveLength(6);
        expect(nav.queryByRole('button')).not.toBeInTheDocument();
    });

    it('keeps unassigned regions selectable without inventing a country', () => {
        render(<MemoryRouter><PostRegionFilters
            countries={[{ code: '', name: 'Other regions', count: 1, regions: [{ name: 'Coast', count: 1 }] }]}
            activeCountry="" activeRegion="coast" createUrl={(country, region) => `/posts${createBlogRegionSearch(country, region)}`}
        /></MemoryRouter>);
        expect(screen.getByRole('link', { name: /Coast/ })).toHaveAttribute('href', '/posts?region=coast');
        expect(screen.getByRole('link', { name: /Coast/ })).toHaveAttribute('aria-current', 'page');
        expect(screen.queryByRole('link', { name: 'Other regions' })).not.toBeInTheDocument();
    });
});
