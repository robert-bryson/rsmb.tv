import { useEffect } from 'react';

/**
 * Injects a JSON-LD `<script>` tag into the document head.
 * Removes it on unmount or when data changes.
 */
export function useJsonLd(data: Record<string, unknown> | null) {
    const serialized = data ? JSON.stringify(data) : null;

    useEffect(() => {
        if (!serialized) return;

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = serialized;
        document.head.appendChild(script);

        return () => {
            script.remove();
        };
    }, [serialized]);
}
