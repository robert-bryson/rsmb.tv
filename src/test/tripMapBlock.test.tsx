import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripMapBlock } from '../blog/TripMdxBlocks';

vi.mock('../features/trips/components/TripRoutePreview', () => ({
    TripRoutePreview: ({ onExplore }: { onExplore?: () => void }) => <div>
        <p>Route preview</p><button onClick={onExplore}>Explore interactive map</button>
    </div>,
}));
vi.mock('../features/trips/components/TripRouteMap', () => ({
    TripRouteMap: ({ active }: { active: boolean }) => <div><p>{active ? 'Active map' : 'Suspended map'}</p><button>Map control</button></div>,
}));

const fullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
afterEach(() => {
    vi.unstubAllGlobals();
    if (fullscreenDescriptor) Object.defineProperty(document, 'fullscreenElement', fullscreenDescriptor);
    else Reflect.deleteProperty(document, 'fullscreenElement');
});

describe('trip map lifecycle', () => {
    function observe() {
        const observers: { callback: IntersectionObserverCallback; options?: IntersectionObserverInit; disconnect: ReturnType<typeof vi.fn> }[] = [];
        vi.stubGlobal('IntersectionObserver', class {
            disconnect = vi.fn();
            observe = vi.fn();
            constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
                observers.push({ callback, options, disconnect: this.disconnect });
            }
        });
        const notify = (index: number, visible: boolean) => act(() => observers[index].callback([
            { isIntersecting: visible, intersectionRatio: visible ? 1 : 0 } as IntersectionObserverEntry,
        ], {} as IntersectionObserver));
        return { observers, notify };
    }

    it('activates on visibility, suspends far away, and reactivates on return', async () => {
        const { observers, notify } = observe();
        const { unmount } = render(<TripMapBlock />);
        expect(screen.getByText('Route preview')).toBeInTheDocument();
        expect(observers[1].options?.rootMargin).toBe('1200px');
        notify(1, true);
        expect(screen.queryByText('Active map')).not.toBeInTheDocument();
        notify(0, true);
        await screen.findByText('Active map');
        notify(1, false);
        expect(screen.getByText('Suspended map')).toBeInTheDocument();
        notify(1, true);
        expect(screen.getByText('Suspended map')).toBeInTheDocument();
        notify(0, true);
        expect(screen.getByText('Active map')).toBeInTheDocument();
        unmount();
        expect(observers.every(observer => observer.disconnect.mock.calls.length === 1)).toBe(true);
    });

    it('keeps a focused map until focus leaves it', async () => {
        const { notify } = observe();
        render(<TripMapBlock />);
        notify(0, true);
        const control = await screen.findByRole('button', { name: 'Map control' });
        control.focus();
        notify(1, false);
        expect(screen.getByText('Active map')).toBeInTheDocument();
        fireEvent.blur(control);
        control.blur();
        await waitFor(() => expect(screen.getByText('Suspended map')).toBeInTheDocument());
    });

    it('allows explicit activation before the visibility observer fires', async () => {
        observe();
        render(<TripMapBlock />);
        fireEvent.click(screen.getByRole('button', { name: 'Explore interactive map' }));
        expect(await screen.findByText('Active map')).toBeVisible();
    });

    it.each(['map', 'ancestor'])('retains a fullscreen %s until fullscreen exits', async target => {
        const { notify } = observe();
        const { container } = render(<TripMapBlock />);
        notify(0, true);
        await screen.findByText('Active map');
        let fullscreenElement: Element | null = target === 'map' ? container.querySelector('button')!.parentElement : container;
        Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
        notify(1, false);
        expect(screen.getByText('Active map')).toBeInTheDocument();
        fullscreenElement = null;
        fireEvent(document, new Event('fullscreenchange'));
        expect(screen.getByText('Suspended map')).toBeInTheDocument();
    });

    it('ignores a deferred focus-out callback after the block unmounts', async () => {
        const { notify } = observe();
        const { unmount } = render(<TripMapBlock />);
        notify(0, true);
        const control = await screen.findByRole('button', { name: 'Map control' });
        control.focus();
        notify(1, false);
        fireEvent.blur(control);
        unmount();
        await act(async () => {});
        expect(screen.queryByText('Suspended map')).not.toBeInTheDocument();
    });
});
