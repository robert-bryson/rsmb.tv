import { useState, useEffect } from 'react';
import type { BasemapConfig } from '../constants';

interface TextureLoadingState {
    isLoading: boolean;
    progress: number;
    error: Error | null;
}

interface InternalTextureLoadingState extends TextureLoadingState {
    loadKey: string;
}

/**
 * Hook to preload globe textures and track loading progress.
 */
export function useGlobeTextures(basemap?: BasemapConfig): TextureLoadingState {
    const imageUrl = basemap?.image;
    const bumpUrl = basemap?.bump;
    const loadKey = `${imageUrl ?? ''}|${bumpUrl ?? ''}`;

    const [state, setState] = useState<InternalTextureLoadingState>({
        isLoading: true,
        progress: 0,
        error: null,
        loadKey,
    });

    useEffect(() => {
        if (!imageUrl) return;

        const textures = [imageUrl, ...(bumpUrl ? [bumpUrl] : [])];
        let loadedCount = 0;
        let cancelled = false;

        const loadTexture = (url: string): Promise<void> => {
            return new Promise((resolve, reject) => {
                const img = new Image();

                img.onload = () => {
                    if (cancelled) return;
                    loadedCount++;
                    setState(prev => ({
                        ...prev,
                        loadKey,
                        isLoading: loadedCount < textures.length,
                        progress: (loadedCount / textures.length) * 100,
                        error: null,
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
                    setState({ isLoading: false, progress: 100, error: null, loadKey });
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    setState({ isLoading: false, progress: 0, error, loadKey });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [imageUrl, bumpUrl, loadKey]);

    if (state.loadKey !== loadKey) {
        return {
            isLoading: true,
            progress: 0,
            error: null,
        };
    }

    return {
        isLoading: state.isLoading,
        progress: state.progress,
        error: state.error,
    };
}
