import { useMemo } from 'react';
import { parsePinDetails, pinDetailsManifestSchema, pinDetailsMatch, pinDetailsScope } from '../../../shared/pinDetails';
import type { MapPin } from '../../../shared/worldPins';
import { usePinResource } from './data';

export const PIN_DETAILS_BASE_URL = (import.meta.env.VITE_PINS_CONTEXT_DATA_BASE_URL || 'https://data.rsmb.tv/maps/pins/context').replace(/\/$/, '');
const parseManifest = (value: unknown) => pinDetailsManifestSchema.parse(value);

export function usePinDetails(pin: MapPin | null) {
    const manifest = usePinResource('manifest-v1.json', parseManifest, !!pin, PIN_DETAILS_BASE_URL);
    const scope = pin ? pinDetailsScope(pin) : 'countries.json';
    const file = manifest.data?.files[scope];
    const parse = useMemo(() => (value: unknown) => parsePinDetails(value, scope, file?.count ?? 0), [scope, file?.count]);
    const resource = usePinResource(`releases/${manifest.data?.release ?? 'unused'}/${scope}`, parse, !!pin && !!file, PIN_DETAILS_BASE_URL);
    const details = resource.data?.pins.find(details => details.id === pin?.id);
    const data = pin && details && pinDetailsMatch(pin, details) ? details : null;
    const loading = !!pin && (manifest.loading || !!file && resource.loading);
    const error = !!pin && !loading && (!!manifest.error || !!resource.error || !data);
    return {
        data, loading, error,
        retry: () => { manifest.retry(); resource.retry(); },
    };
}
