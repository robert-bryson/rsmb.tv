import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripMapDayControls } from '../features/trips/components/TripMapDayControls';
import { useTripMapHighlight } from '../features/trips/useTripMapHighlight';
import { dayMapManifest } from './fixtures/tripDayMap';

afterEach(() => vi.restoreAllMocks());

function map(phase: string, geoJson = dayMapManifest.route.geoJson, visible = true) {
    return <div>
        <button>Outside map</button>
        <div data-trip-map-viewport>
            {visible && <TripMapDayControls key={phase}
                manifest={{ ...dayMapManifest, route: { ...dayMapManifest.route, geoJson } }} onSelect={() => {}} />}
        </div>
    </div>;
}

function FeedbackMap({ phase }: { phase: string }) {
    const highlight = useTripMapHighlight(dayMapManifest.route.geoJson);
    return <div data-trip-map-viewport onKeyDown={event => { if (event.key === 'Escape') highlight.dismiss(); }}>
        <TripMapDayControls key={phase} manifest={dayMapManifest} onSelect={() => {}}
            highlightedDayId={highlight.id} onFocusDay={highlight.onFocus} onHighlight={highlight.onHover} />
    </div>;
}

describe('day control focus handoff', () => {
    it.each(['immediate', 'deferred'])('does not reopen dismissed feedback with %s focus delivery', async timing => {
        const { rerender } = render(<FeedbackMap phase="preview" />);
        const day = screen.getByRole('button', { name: '2. Homebound' });
        act(() => day.focus());
        expect(day).toHaveAttribute('data-highlighted', 'true');
        fireEvent.keyDown(day, { key: 'Escape' });
        expect(day).not.toHaveAttribute('data-highlighted');
        fireEvent.mouseEnter(day);
        expect(day).not.toHaveAttribute('data-highlighted');
        fireEvent.mouseMove(day);
        expect(day).toHaveAttribute('data-highlighted', 'true');
        fireEvent.keyDown(day, { key: 'Escape' });
        if (timing === 'deferred') {
            const focus = HTMLElement.prototype.focus;
            vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
                queueMicrotask(() => focus.call(this, options));
            });
        }
        rerender(<FeedbackMap phase="interactive" />);
        await act(async () => { await Promise.resolve(); });
        const replacement = screen.getByRole('button', { name: '2. Homebound' });
        expect(replacement).toHaveFocus();
        expect(replacement).not.toHaveAttribute('data-highlighted');
        fireEvent.mouseEnter(replacement);
        expect(replacement).not.toHaveAttribute('data-highlighted');
        fireEvent.mouseMove(replacement);
        expect(replacement).toHaveAttribute('data-highlighted', 'true');
        fireEvent.mouseLeave(replacement);
        expect(replacement).not.toHaveAttribute('data-highlighted');
    });

    it('preserves keyboard feedback when another day had pointer priority before replacement', () => {
        const { rerender } = render(<FeedbackMap phase="preview" />);
        act(() => screen.getByRole('button', { name: '1. Coastbound' }).focus());
        fireEvent.mouseEnter(screen.getByRole('button', { name: '2. Homebound' }));
        rerender(<FeedbackMap phase="interactive" />);
        const focused = screen.getByRole('button', { name: '1. Coastbound' });
        expect(focused).toHaveFocus();
        fireEvent.mouseLeave(screen.getByRole('button', { name: '2. Homebound' }));
        expect(focused).toHaveAttribute('data-highlighted', 'true');
    });

    it('restores the focused day through preview and interactive replacements', () => {
        const { rerender } = render(map('preview'));
        const day = screen.getByRole('button', { name: '2. Homebound' });
        day.focus();
        for (const phase of ['loading-preview', 'interactive', 'failed-preview']) {
            rerender(map(phase));
            expect(screen.getByRole('button', { name: '2. Homebound' })).toHaveFocus();
        }
        expect(day).not.toBeInTheDocument();
    });

    it('does not move focus from a control outside the map', () => {
        const { rerender } = render(map('preview'));
        const outside = screen.getByRole('button', { name: 'Outside map' });
        outside.focus();
        rerender(map('interactive'));
        expect(outside).toHaveFocus();
    });

    it('does not restore focus when a replacement belongs to another route', () => {
        const { rerender } = render(map('preview'));
        screen.getByRole('button', { name: '2. Homebound' }).focus();
        rerender(map('interactive', '/replacement.geojson'));
        expect(screen.getByRole('button', { name: '2. Homebound' })).not.toHaveFocus();
    });

    it('discards a pending handoff when no replacement mounts in the same commit', async () => {
        const { rerender } = render(map('preview'));
        screen.getByRole('button', { name: '2. Homebound' }).focus();
        rerender(map('none', dayMapManifest.route.geoJson, false));
        await act(async () => { await Promise.resolve(); });
        rerender(map('interactive'));
        expect(screen.getByRole('button', { name: '2. Homebound' })).not.toHaveFocus();
    });
});
