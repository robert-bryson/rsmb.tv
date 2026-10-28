import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { dayColor, tripMapDays } from '../tripMapView';
import type { TripManifest } from '../types';

type FocusHandoff = { routeUrl: string; dayId: string; dismissed: boolean };
const focusHandoffs = new WeakMap<Element, FocusHandoff>();

export function TripMapDayControls({ manifest, dayId, highlightedDayId, tooltipId, onSelect, onHighlight, onFocusDay }: {
    manifest: TripManifest;
    dayId?: string;
    highlightedDayId?: string;
    tooltipId?: string;
    onSelect: (dayId?: string) => void;
    onHighlight?: (dayId?: string) => void;
    onFocusDay?: (dayId?: string) => void;
}) {
    const days = tripMapDays(manifest);
    const controlsRef = useRef<HTMLDivElement>(null);
    const suppressFocusFeedbackRef = useRef(false);
    const suppressPointerFeedbackRef = useRef(false);
    const dismissedRef = useRef(false);
    const routeUrl = manifest.route.geoJson;
    useLayoutEffect(() => {
        const controls = controlsRef.current;
        const viewport = controls?.closest('[data-trip-map-viewport]');
        if (!controls || !viewport) return;
        const handoff = focusHandoffs.get(viewport);
        focusHandoffs.delete(viewport);
        if (handoff?.routeUrl === routeUrl && document.activeElement === document.body) {
            // Restoring focus must not reopen feedback already dismissed with Escape.
            const button = [...controls.querySelectorAll<HTMLButtonElement>('button[data-trip-day-id]')]
                .find(button => button.dataset.tripDayId === handoff.dayId);
            if (button) {
                dismissedRef.current = handoff.dismissed;
                suppressFocusFeedbackRef.current = handoff.dismissed;
                suppressPointerFeedbackRef.current = handoff.dismissed;
                button.focus({ preventScroll: true });
            }
        }
        return () => {
            const focused = document.activeElement;
            if (!(focused instanceof HTMLButtonElement) || !controls.contains(focused) || !focused.dataset.tripDayId) return;
            const handoff = { routeUrl, dayId: focused.dataset.tripDayId, dismissed: dismissedRef.current };
            focusHandoffs.set(viewport, handoff);
            // Only a replacement in this commit may inherit focus. Do not retain it for later navigation.
            queueMicrotask(() => {
                if (focusHandoffs.get(viewport) === handoff) focusHandoffs.delete(viewport);
            });
        };
    }, [routeUrl, days.length]);
    if (!days.length) return null;
    return <div ref={controlsRef} role="group" aria-label="Map days" className="flex flex-wrap gap-x-3 gap-y-1 text-sm"
        onKeyDownCapture={event => {
            if (event.key === 'Escape') {
                dismissedRef.current = true;
                suppressFocusFeedbackRef.current = true;
                suppressPointerFeedbackRef.current = true;
            }
        }}>
        {days.map((day, index) => <button key={day.id} type="button" aria-pressed={dayId === day.id}
            data-trip-day-id={day.id}
            data-highlighted={highlightedDayId === day.id || undefined}
            aria-describedby={highlightedDayId === day.id ? tooltipId : undefined}
            className="trip-day-button" style={{ '--trip-day-color': dayColor(manifest, day.id) } as CSSProperties}
            onMouseEnter={() => { if (!suppressPointerFeedbackRef.current) onHighlight?.(day.id); }}
            onMouseMove={() => { suppressPointerFeedbackRef.current = false; onHighlight?.(day.id); }}
            onMouseLeave={() => { suppressPointerFeedbackRef.current = false; onHighlight?.(); }}
            onFocus={() => {
                const suppressed = suppressFocusFeedbackRef.current;
                suppressFocusFeedbackRef.current = false;
                if (!suppressed) { dismissedRef.current = false; onFocusDay?.(day.id); }
            }}
            onBlur={() => { suppressFocusFeedbackRef.current = false; onFocusDay?.(); }}
            onClick={() => onSelect(dayId === day.id ? undefined : day.id)}>
            {index + 1}. {day.title}
        </button>)}
    </div>;
}
