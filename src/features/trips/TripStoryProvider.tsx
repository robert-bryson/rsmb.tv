import { type ReactNode, useMemo } from 'react';
import { TripStoryContext } from './TripStoryContext';
import type { TripManifest } from './types';

export function TripStoryProvider({ manifest, children }: { manifest: TripManifest; children: ReactNode }) {
    const value = useMemo(() => ({
        manifest,
        photos: new Map(manifest.photos.map((photo) => [photo.id, photo])),
    }), [manifest]);

    return <TripStoryContext.Provider value={value}>{children}</TripStoryContext.Provider>;
}