import { useState } from 'react';

/** Pointer feedback takes precedence; leaving it restores keyboard focus feedback. */
export function useTripDayHighlight(routeUrl: string) {
    const [state, setState] = useState<{ routeUrl: string; hoveredId?: string; focusedId?: string }>({ routeUrl });
    if (state.routeUrl !== routeUrl) setState({ routeUrl });
    return {
        dayId: state.hoveredId ?? state.focusedId,
        onHover: (hoveredId?: string) => setState(current => current.hoveredId === hoveredId ? current : { ...current, hoveredId }),
        onFocus: (focusedId?: string) => setState(current => current.focusedId === focusedId ? current : { ...current, focusedId }),
        dismiss: () => setState({ routeUrl }),
    };
}
