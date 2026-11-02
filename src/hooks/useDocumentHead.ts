import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { canonicalUrl, absoluteUrl, DEFAULT_OG_IMAGE } from '../utils/siteMetadata';

interface DocumentHeadOptions {
    title: string;
    description?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogUrl?: string;
    ogType?: 'website' | 'article';
    publishedTime?: string;
    imageAlt?: string;
    imageWidth?: number;
    imageHeight?: number;
    noIndex?: boolean;
}

/**
 * Sets document title and meta tags for SEO and social sharing.
 * Automatically sets og:url and canonical link from the current route.
 * Cleans up meta tags on unmount. No extra dependencies needed.
 */
export function useDocumentHead({
    title,
    description,
    ogTitle,
    ogDescription,
    ogImage,
    ogUrl,
    ogType = 'website',
    publishedTime,
    imageAlt,
    imageWidth,
    imageHeight,
    noIndex,
}: DocumentHeadOptions) {
    const { pathname } = useLocation();

    useEffect(() => {
        const cleanTitle = title.replace(/\s*[|—]\s*rsmb$/, '');
        const fullTitle = title === 'rsmb' ? 'rsmb' : `${cleanTitle} — rsmb`;
        document.title = fullTitle;

        const metas: HTMLMetaElement[] = [];
        const originalValues = new Map<HTMLMetaElement, string>();
        let canonicalLink: HTMLLinkElement | null = null;
        let createdCanonical = false;
        let originalCanonical: string | null = null;

        function setMetaTag(attr: 'property' | 'name', key: string, content?: string) {
            let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
            if (content === undefined) {
                if (el) {
                    originalValues.set(el, el.content);
                    el.remove();
                }
                return;
            }
            if (!el) {
                el = document.createElement('meta');
                el.setAttribute(attr, key);
                document.head.appendChild(el);
                metas.push(el);
            } else if (!originalValues.has(el)) {
                originalValues.set(el, el.content);
            }
            el.content = content;
        }

        if (description) {
            setMetaTag('name', 'description', description);
        }

        setMetaTag('property', 'og:title', ogTitle || fullTitle);
        setMetaTag('property', 'og:type', ogType);
        setMetaTag('property', 'article:published_time', publishedTime);
        setMetaTag('property', 'og:site_name', 'rsmb');
        setMetaTag('property', 'og:locale', 'en_US');
        if (noIndex) {
            const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
            const rules = (robots?.content ?? 'follow').split(',').map(rule => rule.trim())
                .filter(rule => rule && !/^(index|all)$/i.test(rule));
            if (!rules.some(rule => /^(noindex|none)$/i.test(rule))) rules.unshift('noindex');
            setMetaTag('name', 'robots', rules.join(', '));
        }

        if (ogDescription || description) {
            setMetaTag('property', 'og:description', ogDescription || description || '');
        }

        const image = absoluteUrl(ogImage || DEFAULT_OG_IMAGE);
        setMetaTag('property', 'og:image', image);
        setMetaTag('property', 'og:image:alt', imageAlt || cleanTitle);
        setMetaTag('property', 'og:image:width', imageWidth?.toString());
        setMetaTag('property', 'og:image:height', imageHeight?.toString());

        const url = ogUrl || canonicalUrl(pathname);
        setMetaTag('property', 'og:url', url);

        // Set canonical link
        canonicalLink = document.querySelector('link[rel="canonical"]');
        if (!canonicalLink) {
            canonicalLink = document.createElement('link');
            canonicalLink.setAttribute('rel', 'canonical');
            document.head.appendChild(canonicalLink);
            createdCanonical = true;
        } else {
            originalCanonical = canonicalLink.getAttribute('href');
        }
        canonicalLink.setAttribute('href', url);

        // Twitter card tags
        setMetaTag('name', 'twitter:card', 'summary_large_image');
        setMetaTag('name', 'twitter:title', ogTitle || fullTitle);
        if (ogDescription || description) {
            setMetaTag('name', 'twitter:description', ogDescription || description || '');
        }
        setMetaTag('name', 'twitter:image', image);
        setMetaTag('name', 'twitter:image:alt', imageAlt || cleanTitle);

        return () => {
            metas.forEach(el => el.remove());
            originalValues.forEach((value, el) => {
                el.content = value;
                if (!el.isConnected) document.head.appendChild(el);
            });
            if (createdCanonical && canonicalLink) {
                canonicalLink.remove();
            } else if (canonicalLink) {
                if (originalCanonical === null) canonicalLink.removeAttribute('href');
                else canonicalLink.setAttribute('href', originalCanonical);
            }
        };
    }, [title, description, ogTitle, ogDescription, ogImage, ogUrl, ogType, publishedTime, imageAlt, imageWidth, imageHeight, noIndex, pathname]);
}
