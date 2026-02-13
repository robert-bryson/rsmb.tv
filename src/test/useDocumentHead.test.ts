import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentHead } from '../hooks/useDocumentHead';

describe('useDocumentHead', () => {
    afterEach(() => {
        document.title = '';
        document.querySelectorAll('meta[property], meta[name="description"], meta[name^="twitter"]').forEach(el => el.remove());
    });

    it('sets the document title with suffix', () => {
        renderHook(() => useDocumentHead({ title: 'About' }));
        expect(document.title).toBe('About — rsmb');
    });

    it('does not double-suffix for "rsmb"', () => {
        renderHook(() => useDocumentHead({ title: 'rsmb' }));
        expect(document.title).toBe('rsmb');
    });

    it('sets OG meta tags', () => {
        renderHook(() => useDocumentHead({ title: 'Test', description: 'A description' }));
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDesc = document.querySelector('meta[property="og:description"]');
        expect(ogTitle?.getAttribute('content')).toBe('Test — rsmb');
        expect(ogDesc?.getAttribute('content')).toBe('A description');
    });

    it('sets Twitter card tags', () => {
        renderHook(() => useDocumentHead({ title: 'Test', description: 'desc' }));
        const card = document.querySelector('meta[name="twitter:card"]');
        expect(card?.getAttribute('content')).toBe('summary_large_image');
    });

    it('cleans up dynamically created meta tags on unmount', () => {
        const { unmount } = renderHook(() =>
            useDocumentHead({ title: 'Temp', description: 'temp desc' })
        );

        expect(document.querySelector('meta[property="og:title"]')).not.toBeNull();
        unmount();
        // Only newly-created tags should be removed; pre-existing ones stay
        // Since all were created by the hook, they should all be removed
        expect(document.querySelector('meta[property="og:type"]')).toBeNull();
    });
});
