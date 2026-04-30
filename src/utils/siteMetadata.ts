/**
 * Runtime site metadata constants and JSON-LD helpers shared across pages.
 *
 * Build-time site metadata utilities live in scripts/siteMetadata.js (Node).
 */

export const SITE_URL = 'https://rsmb.tv';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

/** Schema.org Person reference for the site author. */
export const AUTHOR_PERSON = {
    '@type': 'Person',
    name: 'Robby Bryson',
    url: SITE_URL,
} as const;

/**
 * Resolve a path or absolute URL to an absolute URL on the canonical origin.
 * Pass-through for values that are already absolute (http/https/mailto/etc.).
 */
export function absoluteUrl(pathOrUrl: string): string {
    if (/^[a-z][a-z0-9+.-]*:/i.test(pathOrUrl)) {
        return pathOrUrl;
    }
    const separator = pathOrUrl.startsWith('/') ? '' : '/';
    return `${SITE_URL}${separator}${pathOrUrl}`;
}
