import { useCallback, useRef } from 'react';
import { trackAnalyticsEvent, type MapAction, type MapFeature } from '../utils/analytics';

/** User actions only: URL restoration and renderer initialization never call this. */
export function useMapInteraction(feature: MapFeature) {
    const interacted = useRef(false);
    return useCallback((action: MapAction) => {
        if (interacted.current) return;
        interacted.current = true;
        trackAnalyticsEvent('map-interacted', { feature, action });
    }, [feature]);
}
