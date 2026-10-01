import { type ReactNode, useMemo } from 'react';
import { TripStoryContext, type TripStoryContextValue } from './TripStoryContext';
import type { TripManifest } from './types';

export function TripStoryProvider({ manifest, children }: { manifest: TripManifest; children: ReactNode }) {
    const value = useMemo<TripStoryContextValue>(() => {
        const galleries = new Set<HTMLElement>();
        return {
            manifest,
            photos: new Map(manifest.photos.map((photo) => [photo.id, photo])),
            registerGallery: (gallery: HTMLElement) => {
                galleries.add(gallery);
                return () => {
                    galleries.delete(gallery);
                };
            },
            getGalleryPhotos: () => [...galleries]
                // Mount order can differ from story order when blocks load asynchronously.
                .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1)
                .flatMap(gallery => [...gallery.querySelectorAll<HTMLAnchorElement>('a[data-pswp-width]')]),
        };
    }, [manifest]);

    return <TripStoryContext.Provider value={value}>{children}</TripStoryContext.Provider>;
}
