import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGlobeTextures } from '../features/flights/hooks/useGlobeTextures';
import type { BasemapConfig } from '../features/flights/constants';

const mockBasemap: BasemapConfig = {
    id: 'night' as const,
    label: 'Night',
    image: '/basemaps/earth-night.webp',
    bump: '/basemaps/earth-topology.webp',
    atmosphere: 'lightskyblue',
    bg: 'rgba(0,0,17,1)',
};

describe('useGlobeTextures', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('starts in loading state', () => {
        const { result } = renderHook(() => useGlobeTextures(mockBasemap));
        expect(result.current.isLoading).toBe(true);
        expect(result.current.progress).toBe(0);
        expect(result.current.error).toBeNull();
    });

    it('completes loading when textures load successfully', async () => {
        const OriginalImage = globalThis.Image;
        globalThis.Image = class extends OriginalImage {
            constructor() {
                super();
                setTimeout(() => { this.dispatchEvent(new Event('load')); this.onload?.(new Event('load') as never); }, 0);
            }
        } as typeof Image;

        const { result } = renderHook(() => useGlobeTextures(mockBasemap));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.progress).toBe(100);
        expect(result.current.error).toBeNull();

        globalThis.Image = OriginalImage;
    });

    it('sets error when texture fails to load', async () => {
        const OriginalImage = globalThis.Image;
        globalThis.Image = class extends OriginalImage {
            constructor() {
                super();
                setTimeout(() => { this.onerror?.(new Event('error') as never); }, 0);
            }
        } as typeof Image;

        const { result } = renderHook(() => useGlobeTextures(mockBasemap));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toContain('Failed to load texture');

        globalThis.Image = OriginalImage;
    });

    it('returns loading state when no basemap provided', () => {
        const { result } = renderHook(() => useGlobeTextures(undefined));
        expect(result.current.isLoading).toBe(true);
    });
});
