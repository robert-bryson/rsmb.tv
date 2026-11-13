import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchValidatedJson } from '../../data/validatedJson';
import { invalidateCache } from '../../data/fetchCache';
import { pinsDataSchema, parseStateBoundaries, parseCountyBoundaries } from '../../../shared/pins';
import { parseWorldBoundaries, parseWorldCountries, parseWorldRegionPins, worldPinsDataSchema, WORLD_COUNTRY_LOOKUP } from '../../../shared/worldPins';

export const PINS_DATA_ROOT = `${import.meta.env.BASE_URL}data/pins-of-inaccessibility`;
const parsePins = (value: unknown) => pinsDataSchema.parse(value);
const parseWorldPins = (value: unknown) => worldPinsDataSchema.parse(value);

export function usePinResource<T>(filename: string, parse: (value: unknown) => T, enabled = true, baseUrl = PINS_DATA_ROOT) {
    const url = `${baseUrl}/${filename}`;
    // A changed inventory can require a new validator at the same URL.
    // Keep parser functions stable, as with the other effect dependencies.
    const [stored, setResource] = useState<{ url: string; parse: typeof parse; data: T | null; loading: boolean; error: string | null }>({ url, parse, data: null, loading: true, error: null });
    const resource = stored.url === url && stored.parse === parse ? stored : { url, data: null, loading: true, error: null };
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => {
        invalidateCache(url);
        setResource({ url, parse, data: null, loading: true, error: null });
        setAttempt(value => value + 1);
    }, [url, parse]);
    useEffect(() => {
        if (!enabled || resource.data) return;
        let cancelled = false;
        void fetchValidatedJson(url, parse, { ttl: 3_600_000 }).then(data => {
            if (!cancelled) setResource({ url, parse, data, loading: false, error: null });
        }).catch(() => {
            if (!cancelled) setResource({ url, parse, data: null, loading: false, error: `Could not load ${filename}.` });
        });
        return () => { cancelled = true; };
    }, [url, filename, parse, enabled, attempt, resource.data]);
    return { url, data: resource.data, loading: enabled && resource.loading, error: enabled ? resource.error : null, retry };
}

export function usePinsData(showCounties: boolean, enabled = true) {
    const pins = usePinResource('pins.json', parsePins, enabled);
    const states = usePinResource('states.geojson', parseStateBoundaries, enabled);
    const counties = usePinResource('counties.geojson', parseCountyBoundaries, enabled && showCounties);
    return { pins, states, counties };
}

export function useWorldPinsData(countryCode: string, showRegions = true) {
    const enabled = countryCode !== 'USA';
    const country = WORLD_COUNTRY_LOOKUP.get(countryCode);
    const regional = enabled && !!country && country.regionIds.length > 0;
    const parseRegions = useMemo(() => (value: unknown) => parseWorldRegionPins(value, countryCode), [countryCode]);
    const parseOutlines = useMemo(() => (value: unknown) => parseWorldBoundaries(value, countryCode), [countryCode]);
    const pins = usePinResource('world/pins.json', parseWorldPins, enabled);
    const countries = usePinResource('world/countries.geojson', parseWorldCountries, enabled);
    const regions = usePinResource(`world/regions/${country?.code ?? 'unused'}.json`, parseRegions, regional);
    const outlines = usePinResource(`world/regions/${country?.code ?? 'unused'}.geojson`, parseOutlines, regional && showRegions);
    return { pins, countries, regions, outlines };
}
