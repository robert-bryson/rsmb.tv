import { useState, useEffect, useCallback, useMemo } from 'react';
import type { BasemapConfig } from '../constants';

interface TextureLoadingState {
    isLoading: boolean;
    progress: number;
    error: Error | null;
}

export const GLOBE_TEXTURE_TIMEOUT_MS = 30_000;

/** Preloads a texture batch. Retry starts a fresh batch and renderer instance. */
export function useGlobeTextures(basemap?: BasemapConfig) {
    const imageUrl = basemap?.image;
    const bumpUrl = basemap?.bump;
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => setAttempt(value => value + 1), []);
    // Each visit needs its own identity, including A -> B -> A before B loads.
    const batch = useMemo(() => ({ imageUrl, bumpUrl, attempt }), [imageUrl, bumpUrl, attempt]);
    const [state, setState] = useState<TextureLoadingState & { batch: typeof batch }>({
        isLoading: true, progress: 0, error: null, batch,
    });

    useEffect(() => {
        if (!imageUrl) return;
        const textures = [imageUrl, ...(bumpUrl ? [bumpUrl] : [])];
        const images: HTMLImageElement[] = [];
        let loadedCount = 0;
        let failed = false;
        let cancelled = false;
        const timeout = setTimeout(() => {
            if (cancelled || failed) return;
            failed = true;
            setState({ batch, isLoading: false, progress: 0, error: new Error('The globe background took too long to load. Please try again.') });
        }, GLOBE_TEXTURE_TIMEOUT_MS);

        for (const url of textures) {
            const image = new Image();
            // Match Three's TextureLoader so the browser can share the request.
            image.crossOrigin = 'anonymous';
            images.push(image);
            image.onload = () => {
                if (cancelled || failed) return;
                image.onload = null;
                image.onerror = null;
                loadedCount++;
                if (loadedCount === textures.length) clearTimeout(timeout);
                setState({
                    batch, error: null,
                    isLoading: loadedCount < textures.length,
                    progress: loadedCount / textures.length * 100,
                });
            };
            image.onerror = () => {
                if (cancelled || failed) return;
                failed = true;
                clearTimeout(timeout);
                setState({ isLoading: false, progress: 0, error: new Error(`Failed to load texture: ${url}`), batch });
            };
            image.src = url;
        }
        return () => {
            cancelled = true;
            clearTimeout(timeout);
            for (const image of images) {
                image.onload = null;
                image.onerror = null;
            }
        };
    }, [imageUrl, bumpUrl, batch]);

    const current: TextureLoadingState = !imageUrl
        ? { isLoading: false, progress: 100, error: null }
        : state.batch !== batch
            ? { isLoading: true, progress: 0, error: null }
            : state;
    return { isLoading: current.isLoading, progress: current.progress, error: current.error, retry, attempt };
}
