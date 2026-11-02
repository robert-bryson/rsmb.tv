import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripAtlasLocations } from '../features/trips/atlas/TripAtlasLocations';
import type { TripAtlasEntry } from '../features/trips/atlas/tripAtlasEntries';

const entry: TripAtlasEntry = {
    id: 'coast', title: 'Coast', description: '', reports: [],
    countries: [{ code: 'US', regions: ['Washington', 'Oregon', 'California'] }, { code: 'CA', regions: ['British Columbia'] }],
};
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mockLayout() {
    let visibleItems = 3;
    let resize = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
        constructor(callback: () => void) { resize = callback; }
        observe() {}
        disconnect = disconnect;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        const index = Array.from(this.parentElement?.querySelectorAll('[data-location]') ?? []).indexOf(this);
        return new DOMRect(0, index < visibleItems ? 0 : 48, 300, 24);
    });
    return {
        disconnect,
        resize(count: number) { visibleItems = count; act(() => resize()); },
    };
}

describe('atlas location lists', () => {
    it('removes clipped names from keyboard navigation and expands without exploring a place', () => {
        mockLayout();
        const onExplore = vi.fn();
        render(<TripAtlasLocations entry={entry} onExplore={onExplore} />);
        expect(screen.getAllByRole('button', { name: /^Explore/ })).toHaveLength(3);
        expect(screen.queryByRole('button', { name: 'Explore California, United States' })).not.toBeInTheDocument();
        const toggle = screen.getByRole('button', { name: 'See all' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(toggle);
        expect(onExplore).not.toHaveBeenCalled();
        expect(screen.getAllByRole('button', { name: /^Explore/ })).toHaveLength(6);
        expect(toggle).toHaveAccessibleName('See less');
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Explore British Columbia, Canada' }));
        expect(onExplore).toHaveBeenCalledExactlyOnceWith({ country: 'CA', region: 'British Columbia' });
        fireEvent.click(toggle);
        expect(screen.queryByRole('button', { name: 'Explore British Columbia, Canada' })).not.toBeInTheDocument();
    });

    it('remeasures visible names after resizing and disconnects its observer when removed', () => {
        const layout = mockLayout();
        const { unmount } = render(<TripAtlasLocations entry={entry} onExplore={vi.fn()} />);
        layout.resize(2);
        expect(screen.getAllByRole('button', { name: /^Explore/ })).toHaveLength(2);
        layout.resize(6);
        expect(screen.getAllByRole('button', { name: /^Explore/ })).toHaveLength(6);
        expect(screen.queryByRole('button', { name: 'See all' })).not.toBeInTheDocument();
        unmount();
        expect(layout.disconnect).toHaveBeenCalledOnce();
    });

    it('keeps all names accessible when layout or resize observation is unavailable', () => {
        vi.stubGlobal('ResizeObserver', undefined);
        render(<TripAtlasLocations entry={entry} onExplore={vi.fn()} />);
        expect(screen.getAllByRole('button', { name: /^Explore/ })).toHaveLength(6);
        expect(screen.queryByRole('button', { name: 'See all' })).not.toBeInTheDocument();
    });

    it('shows missing location metadata without offering a place action', () => {
        render(<TripAtlasLocations entry={{ ...entry, countries: [] }} onExplore={vi.fn()} />);
        expect(screen.getByText('Location not recorded')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('retains an unassigned country label and qualifies its region action with an empty country code', () => {
        const onExplore = vi.fn();
        render(<TripAtlasLocations entry={{ ...entry, countries: [{ code: '', regions: ['Unassigned'] }] }} onExplore={onExplore} />);
        expect(screen.queryByRole('button', { name: 'Explore Other regions' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Explore Unassigned' }));
        expect(onExplore).toHaveBeenCalledExactlyOnceWith({ country: '', region: 'Unassigned' });
    });
});
