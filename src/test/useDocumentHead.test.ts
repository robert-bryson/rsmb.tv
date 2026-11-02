import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useDocumentHead } from '../hooks/useDocumentHead';

const wrapper = ({ children }: { children: ReactNode }) =>
    MemoryRouter({ initialEntries: ['/about'], children });

describe('useDocumentHead', () => {
    afterEach(() => {
        cleanup();
        document.title = '';
        document.querySelectorAll('meta[property], meta[name="description"], meta[name="robots"], meta[name^="twitter"], link[rel="canonical"]').forEach(el => el.remove());
    });

    it('sets the document title with suffix', () => {
        renderHook(() => useDocumentHead({ title: 'About' }), { wrapper });
        expect(document.title).toBe('About — rsmb');
    });

    it('does not double-suffix for "rsmb"', () => {
        renderHook(() => useDocumentHead({ title: 'rsmb' }), { wrapper });
        expect(document.title).toBe('rsmb');
    });

    it('sets OG meta tags', () => {
        renderHook(() => useDocumentHead({ title: 'Test', description: 'A description' }), { wrapper });
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDesc = document.querySelector('meta[property="og:description"]');
        expect(ogTitle?.getAttribute('content')).toBe('Test — rsmb');
        expect(ogDesc?.getAttribute('content')).toBe('A description');
    });

    it('sets og:url from current route', () => {
        renderHook(() => useDocumentHead({ title: 'About' }), { wrapper });
        const ogUrl = document.querySelector('meta[property="og:url"]');
        expect(ogUrl?.getAttribute('content')).toBe('https://rsmb.tv/about');
    });

    it('sets canonical link', () => {
        renderHook(() => useDocumentHead({ title: 'About' }), { wrapper });
        const canonical = document.querySelector('link[rel="canonical"]');
        expect(canonical?.getAttribute('href')).toBe('https://rsmb.tv/about');
    });

    it('sets Twitter card tags', () => {
        renderHook(() => useDocumentHead({ title: 'Test', description: 'desc' }), { wrapper });
        const card = document.querySelector('meta[name="twitter:card"]');
        expect(card?.getAttribute('content')).toBe('summary_large_image');
    });

    it('cleans up dynamically created meta tags on unmount', () => {
        const { unmount } = renderHook(() =>
            useDocumentHead({ title: 'Temp', description: 'temp desc' }), { wrapper }
        );

        expect(document.querySelector('meta[property="og:title"]')).not.toBeNull();
        unmount();
        expect(document.querySelector('meta[property="og:type"]')).toBeNull();
    });

    it('removes canonical link only once on unmount', () => {
        const { unmount } = renderHook(() =>
            useDocumentHead({ title: 'Test' }), { wrapper }
        );

        const canonical = document.querySelector('link[rel="canonical"]');
        expect(canonical).not.toBeNull();

        unmount();
        expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    });

    it('restores pre-existing meta content on unmount', () => {
        // Create a pre-existing og:title
        const existing = document.createElement('meta');
        existing.setAttribute('property', 'og:title');
        existing.content = 'Original Title';
        document.head.appendChild(existing);

        const { unmount } = renderHook(() =>
            useDocumentHead({ title: 'Override', ogTitle: 'New Title' }), { wrapper }
        );

        expect(existing.content).toBe('New Title');
        unmount();
        expect(existing.content).toBe('Original Title');
    });

    it('uses default OG image when none provided', () => {
        renderHook(() => useDocumentHead({ title: 'Test' }), { wrapper });
        const ogImage = document.querySelector('meta[property="og:image"]');
        expect(ogImage?.getAttribute('content')).toBe('https://rsmb.tv/og-image.png');
    });

    it('uses custom OG image when provided', () => {
        renderHook(() => useDocumentHead({ title: 'Test', ogImage: 'https://rsmb.tv/og/custom.png' }), { wrapper });
        const ogImage = document.querySelector('meta[property="og:image"]');
        expect(ogImage?.getAttribute('content')).toBe('https://rsmb.tv/og/custom.png');
    });

    it('uses custom ogUrl when provided', () => {
        renderHook(() => useDocumentHead({ title: 'Test', ogUrl: 'https://rsmb.tv/custom' }), { wrapper });
        const ogUrl = document.querySelector('meta[property="og:url"]');
        expect(ogUrl?.getAttribute('content')).toBe('https://rsmb.tv/custom');
    });

    it('clears article-only metadata on a page change and restores a pre-existing canonical on cleanup', () => {
        const link = document.createElement('link');
        link.rel = 'canonical';
        link.href = 'https://rsmb.tv/trips/coast';
        const published = document.createElement('meta');
        published.setAttribute('property', 'article:published_time');
        published.content = '2026-01-01';
        document.head.append(link, published);
        const { unmount } = renderHook(() => useDocumentHead({ title: 'About' }), { wrapper });
        expect(link.href).toBe('https://rsmb.tv/about');
        expect(document.querySelector('meta[property="article:published_time"]')).toBeNull();
        unmount();
        expect(link.href).toBe('https://rsmb.tv/trips/coast');
        expect(published.isConnected).toBe(true);
    });

    it('removes noindex when a missing page is replaced with a valid page', () => {
        const { rerender } = renderHook(({ missing }) => useDocumentHead({ title: missing ? 'Not Found' : 'About', noIndex: missing }), { wrapper, initialProps: { missing: true } });
        expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow');
        rerender({ missing: false });
        expect(document.querySelector('meta[name="robots"]')).toBeNull();
    });

    it.each([
        ['noindex, nofollow', 'noindex, nofollow'],
        ['INDEX, NOFOLLOW, noarchive', 'noindex, NOFOLLOW, noarchive'],
        ['none', 'none'],
    ])('preserves site crawler restrictions: %s', (original, expected) => {
        const robots = document.createElement('meta');
        robots.name = 'robots';
        robots.content = original;
        document.head.appendChild(robots);

        const { rerender, unmount } = renderHook(({ missing }) => useDocumentHead({
            title: missing ? 'Not Found' : 'About', noIndex: missing,
        }), { wrapper, initialProps: { missing: true } });

        expect(robots.content).toBe(expected);
        expect(document.querySelectorAll('meta[name="robots"]')).toHaveLength(1);
        rerender({ missing: false });
        expect(robots.content).toBe(original);
        unmount();
        expect(robots.content).toBe(original);
        expect(robots.isConnected).toBe(true);
    });
});
