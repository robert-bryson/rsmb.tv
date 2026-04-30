/**
 * Test helpers for inspecting JSON-LD `<script>` tags injected by useJsonLd.
 */

export function getAllJsonLd(): Array<Record<string, unknown>> {
    return Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(
        (script) => JSON.parse(script.textContent ?? '{}') as Record<string, unknown>,
    );
}

export function getJsonLdByType<T = Record<string, unknown>>(type: string): T | undefined {
    return getAllJsonLd().find((data) => data['@type'] === type) as T | undefined;
}
