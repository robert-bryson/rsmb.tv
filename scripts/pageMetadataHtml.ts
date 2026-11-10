import type { MetadataImage, PageMetadata } from '../src/utils/pageMetadata.ts';
import { getProjectPreview } from '../src/content/projectImages.ts';
import { homeProjects, HOME_PROJECT_IMAGE_SIZES } from '../src/content/projects.ts';
import { canonicalUrl } from '../src/utils/siteMetadata.ts';

function escapeHtml(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** Discover the homepage's responsive LCP image before the app executes. */
function homeProjectImagePreload(): string | undefined {
    const image = getProjectPreview(homeProjects[0]?.previewImage);
    const srcSet = image?.avifSrcSet || image?.srcSet;
    if (!srcSet) return;
    const type = image?.avifSrcSet ? 'image/avif' : 'image/webp';
    // Omitting href avoids a second, incorrect download in browsers that do not
    // support responsive image preloads. Unsupported formats use the normal img.
    return `<link rel="preload" as="image" data-page-image-preload type="${type}" imagesrcset="${escapeHtml(srcSet)}" imagesizes="${escapeHtml(HOME_PROJECT_IMAGE_SIZES)}" fetchpriority="high" />`;
}

/** Render crawler metadata without executing React, maps, or post content. */
export function pageMetadataHtml(template: string, metadata: PageMetadata, hero?: MetadataImage & { srcSet?: string }): string {
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
    if (metadata.ogUrl === canonicalUrl('/')) {
        const preload = homeProjectImagePreload();
        if (preload) tags.push(preload);
    } else if (hero && metadata.ogType === 'article') {
        const source = hero.srcSet
            ? `imagesrcset="${escapeHtml(hero.srcSet)}" imagesizes="100vw"`
            : `href="${escapeHtml(hero.src)}"`;
        tags.push(`<link rel="preload" as="image" data-page-image-preload ${source} fetchpriority="high" />`);
    }
    // A graph keeps related entities in one script; the runtime replaces it on startup.
    const schema = metadata.breadcrumb
        ? { '@context': 'https://schema.org', '@graph': [metadata.jsonLd, metadata.breadcrumb] }
        : metadata.jsonLd;
    tags.push(`<script type="application/ld+json" data-prerendered>${JSON.stringify(schema).replaceAll('<', '\\u003c')}</script>`);
    return template
        .replace(/<title>.*?<\/title>/s, () => `<title>${escapeHtml(title)}</title>`)
        .replace(/<meta\s+(?:name|property)="([^"]+)"[^>]*>/g, (tag, key: string) => key in values || key.startsWith('article:') || key.startsWith('og:image:') ? '' : tag)
        .replace(/<link\s+rel="canonical"[^>]*>/g, '')
        .replace(/<link\b[^>]*\bdata-page-image-preload[^>]*>/g, '')
        .replace(/<script\b[^>]*data-prerendered[^>]*>.*?<\/script>/gs, '')
        .replace('</head>', () => `${tags.join('\n')}\n</head>`);
}
