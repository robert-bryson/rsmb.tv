import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripMapBlock } from '../blog/TripMdxBlocks';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import { dayMapManifest } from './fixtures/tripDayMap';

vi.mock('../features/trips/components/TripRoutePreview', () => ({
    TripRoutePreview: ({ onExplore, onDaySelect }: { onExplore?: () => void; onDaySelect?: (id: string) => void }) => <div>
        <p>Route preview</p><button onClick={onExplore}>Explore interactive map</button>
        <button onClick={() => onDaySelect?.('coastbound')}>Choose Coastbound</button>
    </div>,
}));
vi.mock('../features/trips/components/TripRouteMap', () => ({
    TripRouteMap: ({ active, initialDayId }: { active: boolean; initialDayId?: string }) => <div>
        <p>{active ? 'Active map' : 'Suspended map'}</p><p>Requested day: {initialDayId}</p><button>Map control</button>
    </div>,
}));

const fullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
function renderMapBlock() {
    return render(<TripStoryProvider manifest={dayMapManifest}><TripMapBlock /></TripStoryProvider>);
}

afterEach(() => {
    vi.unstubAllGlobals();
    if (fullscreenDescriptor) Object.defineProperty(document, 'fullscreenElement', fullscreenDescriptor);
    else Reflect.deleteProperty(document, 'fullscreenElement');
});

describe('trip map lifecycle', () => {
    it('hands a preview day selection to the interactive map', async () => {
        const { notify } = observe();
        renderMapBlock();
        fireEvent.click(screen.getByRole('button', { name: 'Choose Coastbound' }));
        notify(0, true);
        await screen.findByText('Active map');
        expect(screen.getByText('Requested day: coastbound')).toBeInTheDocument();
    });

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
        const { unmount } = renderMapBlock();
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
        renderMapBlock();
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
        renderMapBlock();
        fireEvent.click(screen.getByRole('button', { name: 'Explore interactive map' }));
        expect(await screen.findByText('Active map')).toBeVisible();
    });

    it.each(['map', 'ancestor'])('retains a fullscreen %s until fullscreen exits', async target => {
        const { notify } = observe();
        const { container } = renderMapBlock();
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
        const { unmount } = renderMapBlock();
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
