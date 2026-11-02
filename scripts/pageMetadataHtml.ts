import type { PageMetadata } from '../src/utils/pageMetadata.ts';

function escapeHtml(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** Render crawler metadata without executing React, maps, or post content. */
export function pageMetadataHtml(template: string, metadata: PageMetadata): string {
    const title = metadata.title === 'rsmb' ? 'rsmb' : `${metadata.title} — rsmb`;
    const values: Record<string, string> = {
        description: metadata.description,
        'og:title': title, 'og:description': metadata.description,
        'og:type': metadata.ogType ?? 'website', 'og:url': metadata.ogUrl,
        'og:site_name': 'rsmb', 'og:locale': 'en_US',
        'og:image': metadata.ogImage, 'og:image:alt': metadata.imageAlt ?? metadata.title,
        'twitter:card': 'summary_large_image', 'twitter:title': title,
        'twitter:description': metadata.description, 'twitter:image': metadata.ogImage,
        'twitter:image:alt': metadata.imageAlt ?? metadata.title,
        ...(metadata.publishedTime ? { 'article:published_time': metadata.publishedTime } : {}),
        ...(metadata.imageWidth ? { 'og:image:width': String(metadata.imageWidth) } : {}),
        ...(metadata.imageHeight ? { 'og:image:height': String(metadata.imageHeight) } : {}),
    };
    const tags = Object.entries(values).map(([key, value]) =>
        `<meta ${key.startsWith('og:') || key.startsWith('article:') ? 'property' : 'name'}="${key}" content="${escapeHtml(value)}" />`);
    tags.push(`<link rel="canonical" href="${escapeHtml(metadata.ogUrl)}" />`);
    // A graph keeps related entities in one script; the runtime replaces it on startup.
    const schema = metadata.breadcrumb
        ? { '@context': 'https://schema.org', '@graph': [metadata.jsonLd, metadata.breadcrumb] }
        : metadata.jsonLd;
    tags.push(`<script type="application/ld+json" data-prerendered>${JSON.stringify(schema).replaceAll('<', '\\u003c')}</script>`);
    return template
        .replace(/<title>.*?<\/title>/s, () => `<title>${escapeHtml(title)}</title>`)
        .replace(/<meta\s+(?:name|property)="([^"]+)"[^>]*>/g, (tag, key: string) => key in values || key.startsWith('article:') || key.startsWith('og:image:') ? '' : tag)
        .replace(/<link\s+rel="canonical"[^>]*>/g, '')
        .replace(/<script\b[^>]*data-prerendered[^>]*>.*?<\/script>/gs, '')
        .replace('</head>', () => `${tags.join('\n')}\n</head>`);
}
