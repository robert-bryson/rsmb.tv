import { useEffect, useState } from 'react';
import type { FeatureCollection, Polygon } from 'geojson';
import type { MapPin } from '../../../shared/worldPins';
import { COUNTY_CIRCLE_STEPS, pinCircles } from './geometry';
import { EMPTY } from './mapLayers';

const BATCH_SIZE = 128;
const BATCH_BUDGET_MS = 6;

/** Yield between small batches so first-time circle preparation does not hold
 * the main thread for the entire nationwide dataset. Publish one worker update. */
export function useCountyCircles(pins: MapPin[], context: ReadonlySet<string>, enabled: boolean) {
    const [prepared, setPrepared] = useState<{ pins: MapPin[]; context: ReadonlySet<string>; data: FeatureCollection<Polygon> } | null>(null);
    useEffect(() => {
        if (!enabled || !pins.length || prepared?.pins === pins && prepared.context === context) return;
        const data: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [] };
        let index = 0;
        let timer: ReturnType<typeof setTimeout>;
        const build = () => {
            const end = Math.min(index + BATCH_SIZE, pins.length), start = performance.now();
            do {
                const next = Math.min(index + 8, end);
                data.features.push(...pinCircles(pins.slice(index, next), COUNTY_CIRCLE_STEPS, context).features);
                index = next;
            } while (index < end && performance.now() - start < BATCH_BUDGET_MS);
            if (index < pins.length) timer = setTimeout(build, 0);
            else setPrepared({ pins, context, data });
        };
        timer = setTimeout(build, 0);
        return () => clearTimeout(timer);
    }, [pins, context, enabled, prepared]);
    return enabled && prepared?.pins === pins && prepared.context === context ? prepared.data : EMPTY;
}
