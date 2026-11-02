// @vitest-environment node
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { STATIC_ROUTES } from '../generate-sitemap.js';
import { DEFAULT_PAGES } from '../generate-og-images.js';
import { pageMetadataHtml } from '../pageMetadataHtml';
import siteAliases from '../../src/content/siteAliases.json';
import { articleMetadata, staticPageMetadata, STATIC_PAGE_PATHS } from '../../src/utils/pageMetadata';
import { canonicalUrl } from '../../src/utils/siteMetadata';

describe('public page discovery', () => {
    it('covers every public route with static metadata, sitemap entries, and a social card', () => {
        const app = fs.readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
        const routes = [...app.matchAll(/<Route path="([^"]+)"/g)].map(match => match[1]);
        const publicPaths = routes.filter(route => !route.includes(':') && route !== '*' && !Object.hasOwn(siteAliases, route));
        expect([...STATIC_PAGE_PATHS].sort()).toEqual(publicPaths.sort());
        expect(STATIC_ROUTES.map(route => route.path).sort()).toEqual([...STATIC_PAGE_PATHS].sort());
        const cards = new Set(DEFAULT_PAGES.map(page => `https://rsmb.tv/og/${page.slug}.png`));
        for (const pathname of STATIC_PAGE_PATHS) expect(cards.has(staticPageMetadata(pathname).ogImage)).toBe(true);
    });

    it('describes CLI projects accurately and connects maps to their application and breadcrumbs', () => {
        expect(staticPageMetadata('/projects/parc').jsonLd).toMatchObject({
            '@type': 'SoftwareApplication', operatingSystem: 'Cross-platform',
            subjectOf: { codeRepository: 'https://github.com/robert-bryson/parc' },
        });
        const map = staticPageMetadata('/projects/flights/map');
        expect(map.jsonLd).toMatchObject({ '@type': 'WebPage', mainEntity: { '@id': 'https://rsmb.tv/projects/flights#application' } });
        expect(map.breadcrumb).toMatchObject({ itemListElement: [
            { position: 1, name: 'Home' }, { position: 2, name: 'Projects' },
            { position: 3, name: 'Flights', item: 'https://rsmb.tv/projects/flights' },
            { position: 4, item: 'https://rsmb.tv/projects/flights/map' },
        ] });
    });

    it('keeps unpublished posts out of public collection metadata', () => {
        const post = { slug: 'public', title: 'Public', description: 'A post', date: '2026-01-01', tags: [] };
        const metadata = staticPageMetadata('/posts', [post, { ...post, slug: 'private', development: { published: false } }]);
        expect(JSON.stringify(metadata)).toContain('/blog/public');
        expect(JSON.stringify(metadata)).not.toContain('/blog/private');
    });

    it.each(['/about', '/about/', '/about.html', '/about.html/?source=share#heading'])('uses the same canonical URL for %s', pathname => {
        expect(canonicalUrl(pathname)).toBe('https://rsmb.tv/about');
    });
});

describe('crawler HTML', () => {
    it('replaces old metadata and JSON-LD when rendering another page from a generated document', () => {
        const template = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
        const post = articleMetadata({ slug: 'example', title: 'A trip <&>', description: 'A coast & mountains trip', date: '2026-01-01', tags: [] });
        const article = pageMetadataHtml(template, post);
        const page = new JSDOM(pageMetadataHtml(article, staticPageMetadata('/projects/parc'))).window.document;
        expect(page.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
        expect(page.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://rsmb.tv/projects/parc');
        expect(page.querySelector('meta[property="article:published_time"]')).toBeNull();
        expect(page.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('https://rsmb.tv/og/parc.png');
        expect(page.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
        expect(page.documentElement.innerHTML).not.toContain('BlogPosting');
    });

    it('uses the same absolute hero URL and accessible description in social and article metadata', () => {
        const page = articleMetadata({ slug: 'coast', title: 'Coast', description: 'A ride', date: '2026-01-01', tags: [], format: 'trip' }, { src: '/coast.webp', alt: 'Coast from above', width: 1600, height: 1000 });
        expect(page).toMatchObject({ ogImage: 'https://rsmb.tv/coast.webp', ogUrl: 'https://rsmb.tv/trips/coast', imageAlt: 'Coast from above', imageWidth: 1600, imageHeight: 1000 });
        expect(page.jsonLd).toMatchObject({ image: page.ogImage, mainEntityOfPage: { '@id': page.ogUrl }, author: { '@id': 'https://rsmb.tv/#person' } });
    });
});
