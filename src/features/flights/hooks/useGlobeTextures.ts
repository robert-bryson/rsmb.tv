import { useState, useEffect } from 'react';
import type { BasemapConfig } from '../constants';

interface TextureLoadingState {
    isLoading: boolean;
    progress: number;
    error: Error | null;
}

/**
 * Hook to preload globe textures and track loading progress.
 */
export function useGlobeTextures(basemap?: BasemapConfig): TextureLoadingState {
    const [state, setState] = useState<TextureLoadingState>({
        isLoading: true,
        progress: 0,
        error: null,
    });

    const imageUrl = basemap?.image;
    const bumpUrl = basemap?.bump;

    useEffect(() => {
        if (!imageUrl) return;

        const textures = [imageUrl, ...(bumpUrl ? [bumpUrl] : [])];
        let loadedCount = 0;
        let cancelled = false;

        setState({ isLoading: true, progress: 0, error: null });

        const loadTexture = (url: string): Promise<void> => {
            return new Promise((resolve, reject) => {
                const img = new Image();

                img.onload = () => {
                    if (cancelled) return;
                    loadedCount++;
                    setState(prev => ({
                        ...prev,
                        progress: (loadedCount / textures.length) * 100,
                    }));
                    resolve();
                };

                img.onerror = () => {
                    if (cancelled) return;
                    reject(new Error(`Failed to load texture: ${url}`));
                };

                img.src = url;
            });
        };

        Promise.all(textures.map(loadTexture))
            .then(() => {
                if (!cancelled) {
                    setState({ isLoading: false, progress: 100, error: null });
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    setState({ isLoading: false, progress: 0, error });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [imageUrl, bumpUrl]);

    return state;
}
