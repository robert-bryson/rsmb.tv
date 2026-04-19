import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useDocumentHead } from '../hooks/useDocumentHead';

const wrapper = ({ children }: { children: ReactNode }) =>
    MemoryRouter({ initialEntries: ['/about'], children });

describe('useDocumentHead', () => {
    afterEach(() => {
        document.title = '';
        document.querySelectorAll('meta[property], meta[name="description"], meta[name^="twitter"], link[rel="canonical"]').forEach(el => el.remove());
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
});
