import { useEffect, useEffectEvent, type RefObject } from 'react';

/** Keep pointer and keyboard dismissal consistent in the map and its SVG fallback. */
export function useTripMapDismiss(figure: RefObject<HTMLElement | null>, enabled: boolean, onDismiss: (action: { resetSelection: boolean }) => void) {
    const dismiss = useEffectEvent(onDismiss);
    useEffect(() => {
        if (!enabled) return;
        const clickOutside = (event: MouseEvent) => {
            // The viewport survives the SVG-to-canvas handoff during a button click.
            const boundary = figure.current?.closest('[data-trip-map-viewport]') ?? figure.current;
            if (boundary && !event.composedPath().includes(boundary)) dismiss({ resetSelection: true });
        };
        const escape = (event: KeyboardEvent) => {
            // Hover feedback can be open while keyboard focus is elsewhere.
            const boundary = figure.current?.closest('[data-trip-map-viewport]') ?? figure.current;
            if (event.key === 'Escape') dismiss({
                resetSelection: Boolean(boundary && event.composedPath().includes(boundary)),
            });
        };
        document.addEventListener('click', clickOutside);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('click', clickOutside);
            document.removeEventListener('keydown', escape);
        };
    }, [figure, enabled]);
}
