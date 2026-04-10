import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useJsonLd } from '../hooks/useJsonLd';

describe('useJsonLd', () => {
    afterEach(() => {
        document.querySelectorAll('script[type="application/ld+json"]').forEach(el => el.remove());
    });

    it('injects a JSON-LD script tag into the head', () => {
        const data = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Test' };
        renderHook(() => useJsonLd(data));

        const script = document.querySelector('script[type="application/ld+json"]');
        expect(script).not.toBeNull();
        expect(JSON.parse(script!.textContent!)).toEqual(data);
    });

    it('does not inject a script when data is null', () => {
        renderHook(() => useJsonLd(null));

        const script = document.querySelector('script[type="application/ld+json"]');
        expect(script).toBeNull();
    });

    it('removes the script on unmount', () => {
        const data = { '@type': 'WebSite', name: 'Test' };
        const { unmount } = renderHook(() => useJsonLd(data));

        expect(document.querySelector('script[type="application/ld+json"]')).not.toBeNull();

        unmount();

        expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
    });

    it('replaces the script when data changes', () => {
        const initial = { '@type': 'WebSite', name: 'Old' };
        const updated = { '@type': 'WebSite', name: 'New' };

        const { rerender } = renderHook(({ data }) => useJsonLd(data), {
            initialProps: { data: initial as Record<string, unknown> | null },
        });

        const script = document.querySelector('script[type="application/ld+json"]');
        expect(JSON.parse(script!.textContent!).name).toBe('Old');

        rerender({ data: updated });

        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        expect(scripts).toHaveLength(1);
        expect(JSON.parse(scripts[0].textContent!).name).toBe('New');
    });
});
