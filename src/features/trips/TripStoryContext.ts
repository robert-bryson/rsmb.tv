import { createContext, useContext } from 'react';
import type { TripManifest, TripPhotoData } from './types';

export interface TripStoryContextValue {
    manifest: TripManifest;
    photos: Map<string, TripPhotoData>;
}

export const TripStoryContext = createContext<TripStoryContextValue | null>(null);

export function useTripStory() {
    const value = useContext(TripStoryContext);
    if (!value) throw new Error('Trip story components must be rendered inside TripStoryProvider.');
    return value;
}