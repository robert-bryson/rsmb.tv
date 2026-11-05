import { act, fireEvent, render, screen } from '@testing-library/react';
import type { RefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripMapBlock } from '../blog/TripMdxBlocks';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import { dayMapManifest } from './fixtures/tripDayMap';

const moduleState = vi.hoisted(() => ({ pending: undefined as Promise<void> | undefined }));

vi.mock('../features/trips/components/TripRoutePreview', () => ({
    TripRoutePreview: ({ figureRef, onDaySelect, onExplore, dayId }: {
        figureRef: RefObject<HTMLElement | null>;
        onDaySelect: (id: string) => void;
        onExplore?: () => void;
        dayId?: string;
    }) => <figure ref={figureRef}>
        <button aria-pressed={dayId === 'homebound'} onClick={() => onDaySelect('homebound')}>Homebound preview</button>
        <button onClick={onExplore}>Explore interactive map</button>
    </figure>,
}));

vi.mock('../features/trips/components/TripRouteMap', () => ({
    TripRouteMap: ({ initialDayId, active }: { initialDayId?: string; active: boolean }) => {
        if (moduleState.pending) throw moduleState.pending;
        return <output>{active ? 'Active' : 'Suspended'} map: {initialDayId ?? 'none'}</output>;
    },
}));

afterEach(() => {
    moduleState.pending = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function renderPreview(observersAvailable = true) {
    const callbacks: IntersectionObserverCallback[] = [];
    vi.stubGlobal('IntersectionObserver', observersAvailable ? class {
        constructor(callback: IntersectionObserverCallback) { callbacks.push(callback); }
        observe() {}
        disconnect() {}
    } : undefined);
    const result = render(<TripStoryProvider manifest={dayMapManifest}><TripMapBlock /></TripStoryProvider>);
    vi.spyOn(result.container.querySelector<HTMLElement>('[data-trip-map-viewport]')!, 'getBoundingClientRect')
        .mockReturnValue({ top: 0, bottom: 400, height: 400 } as DOMRect);
    return {
        ...result,
        activate: () => act(async () => callbacks[0]([
            { isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry,
        ], {} as IntersectionObserver)),
        suspend: () => act(async () => callbacks[1]([
            { isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry,
        ], {} as IntersectionObserver)),
    };
}

function delayMap() {
    let resolve!: () => void;
    moduleState.pending = new Promise<void>(ready => { resolve = ready; });
    return () => act(async () => {
        moduleState.pending = undefined;
        resolve();
    });
}

describe('trip map activation during preview input', () => {
    it.each(['ready', 'loading'] as const)('retains the pressed button when the map is %s', async timing => {
        const releaseMap = timing === 'loading' ? delayMap() : undefined;
        const { activate } = renderPreview();
        const day = screen.getByRole('button', { name: 'Homebound preview' });
        fireEvent.pointerDown(day, { button: 0, isPrimary: true });
        await activate();
        await releaseMap?.();
        expect(day).toBeInTheDocument();
        expect(screen.queryByText(/Active map/)).not.toBeInTheDocument();
        fireEvent.pointerUp(day);
        fireEvent.click(day);
        expect(await screen.findByText('Active map: homebound')).toBeVisible();
    });

    it('retains a Space-key target until its native click', async () => {
        const { activate } = renderPreview();
        const day = screen.getByRole('button', { name: 'Homebound preview' });
        day.focus();
        fireEvent.keyDown(day, { key: ' ' });
        await activate();
        expect(day).toHaveFocus();
        fireEvent.keyUp(day, { key: ' ' });
        fireEvent.click(day);
        expect(await screen.findByText('Active map: homebound')).toBeVisible();
    });

    for (const activation of ['automatic', 'explicit', 'overlapping', 'repeated', 'without observers'] as const) {
        it.each(['pointer', 'Space'] as const)(`retains %s input during a pending ${activation} activation`, async input => {
            const releaseMap = delayMap();
            const { activate } = renderPreview(activation !== 'without observers');
            if (activation === 'automatic') await activate();
            if (activation === 'overlapping') {
                const explore = screen.getByRole('button', { name: 'Explore interactive map' });
                fireEvent.pointerDown(explore, { button: 0, isPrimary: true });
                await activate();
                fireEvent.pointerUp(explore);
                fireEvent.click(explore);
            }
            if (activation === 'explicit' || activation === 'repeated') {
                fireEvent.click(screen.getByRole('button', { name: 'Explore interactive map' }));
                if (activation === 'repeated') fireEvent.click(screen.getByRole('button', { name: 'Explore interactive map' }));
            }
            const day = screen.getByRole('button', { name: 'Homebound preview' });
            if (input === 'pointer') fireEvent.pointerDown(day, { button: 0, isPrimary: true });
            else {
                day.focus();
                fireEvent.keyDown(day, { key: ' ' });
            }
            expect(day).toBeInTheDocument();
            await releaseMap();
            expect(day).toBeInTheDocument();
            if (input === 'pointer') fireEvent.pointerUp(day);
            else fireEvent.keyUp(day, { key: ' ' });
            fireEvent.click(day);
            expect(await screen.findByText('Active map: homebound')).toBeVisible();
        });
    }

    it('retains a pointer press when focus leaves the preview', async () => {
        const { activate } = renderPreview();
        const day = screen.getByRole('button', { name: 'Homebound preview' });
        day.focus();
        fireEvent.pointerDown(day, { button: 0, isPrimary: true });
        act(() => day.blur());
        await activate();
        expect(day).toBeInTheDocument();
        fireEvent.pointerUp(day);
        fireEvent.click(day);
        expect(await screen.findByText('Active map: homebound')).toBeVisible();
    });

    it('ignores releases from another touch pointer', async () => {
        const { activate } = renderPreview();
        const day = screen.getByRole('button', { name: 'Homebound preview' });
        fireEvent.pointerDown(day, { button: 0, isPrimary: true, pointerId: 1 });
        await activate();
        fireEvent.pointerUp(document.body, { pointerId: 2 });
        fireEvent.pointerCancel(document.body, { pointerId: 2 });
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
        expect(day).toBeInTheDocument();
        fireEvent.pointerCancel(day, { pointerId: 1 });
        expect(await screen.findByText('Active map: none')).toBeVisible();
    });

    it.each(['pointer cancellation', 'window blur', 'release outside'] as const)(
        'allows activation after %s ends an incomplete press', async cancellation => {
            const { activate } = renderPreview();
            const day = screen.getByRole('button', { name: 'Homebound preview' });
            fireEvent.pointerDown(day, { button: 0, isPrimary: true });
            await activate();
            expect(day).toBeInTheDocument();
            if (cancellation === 'pointer cancellation') fireEvent.pointerCancel(day);
            else if (cancellation === 'window blur') fireEvent(window, new Event('blur'));
            else fireEvent.pointerUp(document.body);
            expect(await screen.findByText('Active map: none')).toBeVisible();
        },
    );

    it('releases a keyboard press outside the preview and ignores unrelated key releases', async () => {
        const { activate } = renderPreview();
        const day = screen.getByRole('button', { name: 'Homebound preview' });
        fireEvent.keyDown(day, { key: 'Enter' });
        await activate();
        fireEvent.keyUp(document.body, { key: 'a' });
        expect(day).toBeInTheDocument();
        fireEvent.keyUp(document.body, { key: 'Enter' });
        expect(await screen.findByText('Active map: none')).toBeVisible();
    });

    it('allows activation when keyboard focus leaves a pressed preview', async () => {
        const { activate } = renderPreview();
        const day = screen.getByRole('button', { name: 'Homebound preview' });
        day.focus();
        fireEvent.keyDown(day, { key: ' ' });
        await activate();
        act(() => day.blur());
        expect(await screen.findByText('Active map: none')).toBeVisible();
    });

    it('does not delay activation for a context-menu press', async () => {
        const { activate } = renderPreview();
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Homebound preview' }), { button: 2, isPrimary: true });
        await activate();
        expect(await screen.findByText('Active map: none')).toBeVisible();
    });

    it('keeps an offscreen suspension after a pending activation resolves', async () => {
        const releaseMap = delayMap();
        const { activate, suspend } = renderPreview();
        await activate();
        await suspend();
        await releaseMap();
        expect(await screen.findByText('Suspended map: none')).toBeVisible();
    });
});
