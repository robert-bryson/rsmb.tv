import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { GLOBE_TEXTURE_TIMEOUT_MS, useGlobeTextures } from '../features/flights/hooks/useGlobeTextures';
import type { BasemapConfig } from '../features/flights/constants';

const mockBasemap: BasemapConfig = {
    id: 'night' as const,
    label: 'Night',
    image: '/basemaps/earth-night.webp',
    bump: '/basemaps/earth-topology.webp',
    atmosphere: 'lightskyblue',
    bg: 'rgba(0,0,17,1)',
};

const altBasemap: BasemapConfig = {
    id: 'day' as const,
    label: 'Day',
    image: '/basemaps/earth-day.webp',
    bump: null,
    atmosphere: 'lightskyblue',
    bg: 'rgba(0,0,17,1)',
};

describe('useGlobeTextures', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('bounds a stalled texture and ignores its late completion after retry', () => {
        vi.useFakeTimers();
        const images: { onload: (() => void) | null; onerror: (() => void) | null; src: string }[] = [];
        vi.stubGlobal('Image', class {
            onload = null; onerror = null; src = '';
            constructor() { images.push(this); }
        });
        const { result, unmount } = renderHook(() => useGlobeTextures(altBasemap));
        const late = images[0].onload;
        act(() => vi.advanceTimersByTime(GLOBE_TEXTURE_TIMEOUT_MS));
        expect(result.current.error?.message).toMatch(/too long/);
        act(() => result.current.retry());
        act(() => late?.());
        expect(result.current.isLoading).toBe(true);
        act(() => images[1].onload?.());
        expect(result.current).toMatchObject({ isLoading: false, progress: 100, error: null });
        unmount();
    });

    it('starts in loading state', () => {
        const { result } = renderHook(() => useGlobeTextures(mockBasemap));
        expect(result.current.isLoading).toBe(true);
        expect(result.current.progress).toBe(0);
        expect(result.current.error).toBeNull();
    });

    it.each(['load', 'error'] as const)('starts a new batch when returning to a basemap after %s', outcome => {
        const images: { src: string; onload: (() => void) | null; onerror: (() => void) | null }[] = [];
        vi.stubGlobal('Image', class {
            src = '';
            onload = null;
            onerror = null;
            constructor() { images.push(this); }
        });
        const { result, rerender } = renderHook(({ basemap }) => useGlobeTextures(basemap), {
            initialProps: { basemap: mockBasemap },
        });
        act(() => {
            if (outcome === 'error') images[0].onerror?.();
            else { images[0].onload?.(); images[1].onload?.(); }
        });
        rerender({ basemap: altBasemap });
        const abandonedLoad = images[2].onload;
        rerender({ basemap: mockBasemap });
        expect(result.current).toMatchObject({ isLoading: true, progress: 0, error: null });
        act(() => abandonedLoad?.());
        expect(result.current).toMatchObject({ isLoading: true, progress: 0, error: null });
        act(() => { images[3].onload?.(); images[4].onload?.(); });
        expect(result.current).toMatchObject({ isLoading: false, progress: 100, error: null });
    });

    it('keeps an error after another texture succeeds, and retries with fresh image loads', async () => {
        const images: { src: string; onload: (() => void) | null; onerror: (() => void) | null }[] = [];
        vi.stubGlobal('Image', class {
            src = '';
            onload = null;
            onerror = null;
            constructor() { images.push(this); }
        });
        const { result, unmount } = renderHook(() => useGlobeTextures(mockBasemap));
        await act(async () => { images[0].onerror?.(); });
        await act(async () => { images[1].onload?.(); });
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeInstanceOf(Error);
        act(() => result.current.retry());
        expect(result.current.isLoading).toBe(true);
        expect(result.current.error).toBeNull();
        expect(images).toHaveLength(4);
        await act(async () => { images[2].onload?.(); images[3].onload?.(); });
        expect(result.current).toMatchObject({ isLoading: false, error: null, progress: 100 });
        unmount();
        expect(images.every(image => image.onload === null && image.onerror === null)).toBe(true);
    });

    it('completes loading when textures load successfully', async () => {
        const OriginalImage = globalThis.Image;
        try {
            globalThis.Image = class extends OriginalImage {
                constructor() {
                    super();
                    setTimeout(() => {
                        this.dispatchEvent(new Event('load'));
                        this.onload?.(new Event('load') as never);
                    }, 0);
                }
            } as typeof Image;

            const { result } = renderHook(() => useGlobeTextures(mockBasemap));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.progress).toBe(100);
            expect(result.current.error).toBeNull();
        } finally {
            globalThis.Image = OriginalImage;
        }
    });

    it('sets error when texture fails to load', async () => {
        const OriginalImage = globalThis.Image;
        try {
            globalThis.Image = class extends OriginalImage {
                constructor() {
                    super();
                    setTimeout(() => {
                        this.onerror?.(new Event('error') as never);
                    }, 0);
                }
            } as typeof Image;

            const { result } = renderHook(() => useGlobeTextures(mockBasemap));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.error).toBeInstanceOf(Error);
            expect(result.current.error?.message).toContain('Failed to load texture');
        } finally {
            globalThis.Image = OriginalImage;
        }
    });

    it('does not wait for an image when no texture is required', () => {
        const { result } = renderHook(() => useGlobeTextures(undefined));
        expect(result.current.isLoading).toBe(false);
    });

    it('resets loading state when basemap changes', async () => {
        const OriginalImage = globalThis.Image;
        try {
            globalThis.Image = class extends OriginalImage {
                constructor() {
                    super();
                    setTimeout(() => {
                        this.onload?.(new Event('load') as never);
                    }, 0);
                }
            } as typeof Image;

            const { result, rerender } = renderHook(
                ({ basemap }: { basemap: BasemapConfig }) => useGlobeTextures(basemap),
                { initialProps: { basemap: mockBasemap } },
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
                expect(result.current.progress).toBe(100);
            });

            rerender({ basemap: altBasemap });

            expect(result.current.isLoading).toBe(true);
            expect(result.current.progress).toBe(0);

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
                expect(result.current.progress).toBe(100);
                expect(result.current.error).toBeNull();
            });
        } finally {
            globalThis.Image = OriginalImage;
        }
    });
});
