import { useCallback, useEffect, useState } from 'react';
import { fetchValidatedJson } from '../../data/validatedJson';
import { invalidateCache } from '../../data/fetchCache';
import { pinsDataSchema, parseStateBoundaries, parseCountyBoundaries } from '../../../shared/pins';

export const PINS_DATA_ROOT = `${import.meta.env.BASE_URL}data/pins-of-inaccessibility`;
const parsePins = (value: unknown) => pinsDataSchema.parse(value);

function usePinResource<T>(filename: string, parse: (value: unknown) => T, enabled = true) {
    const url = `${PINS_DATA_ROOT}/${filename}`;
    const [resource, setResource] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null });
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => {
        invalidateCache(url);
        setResource(previous => ({ ...previous, loading: true, error: null }));
        setAttempt(value => value + 1);
    }, [url]);
    useEffect(() => {
        if (!enabled || resource.data) return;
        let cancelled = false;
        void fetchValidatedJson(url, parse, { ttl: 3_600_000 }).then(data => {
            if (!cancelled) setResource({ data, loading: false, error: null });
        }).catch(() => {
            if (!cancelled) setResource({ data: null, loading: false, error: `Could not load ${filename}.` });
        });
        return () => { cancelled = true; };
    }, [url, filename, parse, enabled, attempt, resource.data]);
    return { ...resource, loading: enabled && resource.loading, error: enabled ? resource.error : null, retry };
}

export function usePinsData(showCounties: boolean) {
    const pins = usePinResource('pins.json', parsePins);
    const states = usePinResource('states.geojson', parseStateBoundaries);
    const counties = usePinResource('counties.geojson', parseCountyBoundaries, showCounties);
    return { pins, states, counties };
}
