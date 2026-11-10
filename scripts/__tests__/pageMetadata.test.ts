// @vitest-environment node
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as projectImages from '../../src/content/projectImages';
import { HOME_PROJECT_IMAGE_SIZES } from '../../src/content/projects';
import { STATIC_ROUTES } from '../generate-sitemap.js';
import { DEFAULT_PAGES } from '../generate-og-images.js';
import { pageMetadataHtml } from '../pageMetadataHtml';
import siteAliases from '../../src/content/siteAliases.json';
import { articleMetadata, staticPageMetadata, STATIC_PAGE_PATHS } from '../../src/utils/pageMetadata';
import { canonicalUrl } from '../../src/utils/siteMetadata';
import { projects } from '../../src/content/projects';

afterEach(() => vi.restoreAllMocks());

describe('public page discovery', () => {
    it('covers every public route with static metadata, sitemap entries, and a social card', () => {
        const app = fs.readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
        const routes = [...app.matchAll(/<Route path="([^"]+)"/g)].map(match => match[1]);
        const publicPaths = routes.filter(route => !route.includes(':') && route !== '*' && !Object.hasOwn(siteAliases, route));
        expect([...STATIC_PAGE_PATHS].sort()).toEqual(publicPaths.sort());
        expect(STATIC_ROUTES.map(route => route.path).sort()).toEqual([...STATIC_PAGE_PATHS].sort());
        const cards = new Set(DEFAULT_PAGES.map(page => `https://rsmb.tv/og/${page.slug}.png`));
        for (const pathname of STATIC_PAGE_PATHS) {
            const project = projects.find(project => project.slug === pathname.split('/')[2]);
            const image = staticPageMetadata(pathname).ogImage;
            if (project?.previewImage) expect(image).toBe(`https://rsmb.tv${project.previewImage}`);
            else expect(cards.has(image)).toBe(true);
        }
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
    it('preloads the article hero once and clears the hint when the template changes routes', () => {
        const hero = { src: '/beach-1600.webp', srcSet: '/beach-480.webp 480w, /beach-1600.webp 1600w' };
        const metadata = articleMetadata({ slug: 'coast', title: 'Coast', description: 'A ride', date: '2026-01-01', tags: [], format: 'trip' }, hero);
        const html = pageMetadataHtml('<head></head>', metadata, hero);
        const page = new JSDOM(pageMetadataHtml(html, metadata, hero)).window.document;
        expect(page.querySelectorAll('link[data-page-image-preload]')).toHaveLength(1);
        const preload = page.querySelector('link[as="image"]')!;
        expect(preload).toHaveAttribute('imagesrcset', hero.srcSet);
        expect(preload).toHaveAttribute('imagesizes', '100vw');
        expect(preload).toHaveAttribute('fetchpriority', 'high');
        expect(preload.hasAttribute('href')).toBe(false);
        expect(new JSDOM(pageMetadataHtml(html, staticPageMetadata('/about'))).window.document.querySelector('link[data-page-image-preload]')).toBeNull();
    });

    it('emits one homepage preload and removes it when the template is used for another page', () => {
        const template = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
        const home = pageMetadataHtml(template, staticPageMetadata('/'));
        const repeated = pageMetadataHtml(home, staticPageMetadata('/'));
        const homepage = new JSDOM(repeated).window.document;
        expect(homepage.querySelectorAll('link[rel="preload"][as="image"]')).toHaveLength(1);
        const about = new JSDOM(pageMetadataHtml(repeated, staticPageMetadata('/about'))).window.document;
        expect(about.querySelectorAll('link[rel="preload"][as="image"]')).toHaveLength(0);
    });

    it('preloads the WebP candidates when AVIF is unavailable and escapes their attributes', () => {
        const srcSet = '/preview.webp?label="<& 480w';
        vi.spyOn(projectImages, 'getProjectPreview').mockReturnValue({ src: '/preview.webp', srcSet });
        const page = new JSDOM(pageMetadataHtml('<head></head>', staticPageMetadata('/'))).window.document;
        const preload = page.querySelector('link[as="image"]')!;
        expect(preload.getAttribute('type')).toBe('image/webp');
        expect(preload.getAttribute('imagesrcset')).toBe(srcSet);
        expect(preload.getAttribute('imagesizes')).toBe(HOME_PROJECT_IMAGE_SIZES);
        expect(preload.getAttribute('fetchpriority')).toBe('high');
        expect(preload.hasAttribute('href')).toBe(false);
    });

    it.each([undefined, { src: '/original.webp' }])('omits image preloads when no responsive preview is available: %j', image => {
        vi.spyOn(projectImages, 'getProjectPreview').mockReturnValue(image);
        const page = new JSDOM(pageMetadataHtml('<head></head>', staticPageMetadata('/'))).window.document;
        expect(page.querySelector('link[as="image"]')).toBeNull();
    });

    it('preserves image and font preloads owned by the original template', () => {
        const template = '<head><link rel="preload" as="image" href="/other.webp"><link rel="preload" as="font" href="/font.woff2"></head>';
        const home = pageMetadataHtml(template, staticPageMetadata('/'));
        const page = new JSDOM(pageMetadataHtml(home, staticPageMetadata('/about'))).window.document;
        expect(page.querySelectorAll('link[rel="preload"]')).toHaveLength(2);
        expect(page.querySelector('link[as="image"]')).toHaveAttribute('href', '/other.webp');
    });
    it.each(['/projects/flights', '/projects/flights/map'])('shares the project screenshot at %s before JavaScript runs', pathname => {
        const template = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
        const metadata = staticPageMetadata(pathname);
        const page = new JSDOM(pageMetadataHtml(template, metadata)).window.document;
        const image = 'https://rsmb.tv/images/flights/flight-globe.webp';
        expect(page.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Flights — rsmb');
        expect(page.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(image);
        expect(page.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe(image);
        expect(metadata.jsonLd).toMatchObject({ image });
        expect(metadata).toMatchObject({ imageWidth: 1852, imageHeight: 1385 });
    });

    it('replaces old metadata and JSON-LD when rendering another page from a generated document', () => {
        const template = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
        const post = articleMetadata({ slug: 'example', title: 'A trip <&>', description: 'A coast & mountains trip', date: '2026-01-01', tags: [] });
        const article = pageMetadataHtml(template, post);
        const page = new JSDOM(pageMetadataHtml(article, staticPageMetadata('/projects/parc'))).window.document;
        expect(page.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
        expect(page.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://rsmb.tv/projects/parc');
        expect(page.querySelector('meta[property="article:published_time"]')).toBeNull();
        expect(page.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('https://rsmb.tv/images/parc/update-live-progress.webp');
        expect(page.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
        expect(page.documentElement.innerHTML).not.toContain('BlogPosting');
    });

    it('uses the same absolute hero URL and accessible description in social and article metadata', () => {
        const page = articleMetadata({ slug: 'coast', title: 'Coast', description: 'A ride', date: '2026-01-01', tags: [], format: 'trip' }, { src: '/coast.webp', alt: 'Coast from above', width: 1600, height: 1000 });
        expect(page).toMatchObject({ ogImage: 'https://rsmb.tv/coast.webp', ogUrl: 'https://rsmb.tv/trips/coast', imageAlt: 'Coast from above', imageWidth: 1600, imageHeight: 1000 });
        expect(page.jsonLd).toMatchObject({ image: page.ogImage, mainEntityOfPage: { '@id': page.ogUrl }, author: { '@id': 'https://rsmb.tv/#person' } });
    });

    it('uses a regular post image in social tags and JSON-LD', () => {
        const post = { slug: 'illustrated', title: 'Illustrated', description: 'A post', date: '2026-01-01', tags: [], image: { src: '/photos/coast.jpg', alt: 'Coast', width: 1600, height: 900 } };
        const metadata = articleMetadata(post);
        expect(metadata).toMatchObject({ ogImage: 'https://rsmb.tv/photos/coast.jpg', imageAlt: 'Coast', imageWidth: 1600, imageHeight: 900 });
        expect(metadata.jsonLd.image).toBe(metadata.ogImage);
        expect(articleMetadata(post, { src: '/hero.webp' }).ogImage).toBe('https://rsmb.tv/hero.webp');
    });

    it.each([
        ['./coast.jpg', 'https://rsmb.tv/blog/coast.jpg'],
        ['../photos/coast.jpg', 'https://rsmb.tv/photos/coast.jpg'],
        ['/photos/coast.jpg', 'https://rsmb.tv/photos/coast.jpg'],
        ['https://example.com/coast.jpg?size=large&v=2', 'https://example.com/coast.jpg?size=large&v=2'],
    ])('resolves article image %s as the browser does', (src, expected) => {
        const metadata = articleMetadata({ slug: 'illustrated', title: 'Illustrated', description: 'A post', date: '2026-01-01', tags: [], image: { src } });
        expect(metadata.ogImage).toBe(expected);
        expect(metadata.jsonLd.image).toBe(expected);
    });

    it.each(['', '  ', '#heading', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'https://[invalid'])('uses a fallback card for unusable image %s', src => {
        const metadata = articleMetadata({ slug: 'plain', title: 'Plain', description: 'Text only', date: '2026-01-01', tags: [], image: { src, width: 1, height: 1 } });
        expect(metadata).toMatchObject({ ogImage: 'https://rsmb.tv/og/blog/plain.png', imageWidth: 1200, imageHeight: 630, imageAlt: 'Plain' });
    });

    it('uses the post image when an optional hero URL is unusable', () => {
        const metadata = articleMetadata({ slug: 'illustrated', title: 'Illustrated', description: 'A post', date: '2026-01-01', tags: [], image: { src: '/photo.jpg' } }, { src: '' });
        expect(metadata.ogImage).toBe('https://rsmb.tv/photo.jpg');
    });

    it('retains generated cards for pages and posts without images', () => {
        expect(staticPageMetadata('/projects/aborg')).toMatchObject({ ogImage: 'https://rsmb.tv/og/aborg.png', imageWidth: 1200, imageHeight: 630 });
        expect(articleMetadata({ slug: 'plain', title: 'Plain', description: 'Text only', date: '2026-01-01', tags: [] }))
            .toMatchObject({ ogImage: 'https://rsmb.tv/og/blog/plain.png', imageWidth: 1200, imageHeight: 630 });
    });
});
