import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_URL = 'https://rsmb.tv';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

interface DocumentHeadOptions {
    title: string;
    description?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogUrl?: string;
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
}: DocumentHeadOptions) {
    const { pathname } = useLocation();

    useEffect(() => {
        const fullTitle = title === 'rsmb' ? 'rsmb' : `${title} — rsmb`;
        document.title = fullTitle;

        const metas: HTMLMetaElement[] = [];
        const originalValues = new Map<HTMLMetaElement, string>();
        let canonicalLink: HTMLLinkElement | null = null;
        let createdCanonical = false;

        function setMetaTag(attr: 'property' | 'name', key: string, content: string) {
            let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
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
        setMetaTag('property', 'og:type', 'website');

        if (ogDescription || description) {
            setMetaTag('property', 'og:description', ogDescription || description || '');
        }

        const image = ogImage || DEFAULT_OG_IMAGE;
        setMetaTag('property', 'og:image', image);

        const url = ogUrl || `${SITE_URL}${pathname}`;
        setMetaTag('property', 'og:url', url);

        // Set canonical link
        canonicalLink = document.querySelector('link[rel="canonical"]');
        if (!canonicalLink) {
            canonicalLink = document.createElement('link');
            canonicalLink.setAttribute('rel', 'canonical');
            document.head.appendChild(canonicalLink);
            createdCanonical = true;
        }
        canonicalLink.setAttribute('href', url);

        // Twitter card tags
        setMetaTag('name', 'twitter:card', 'summary_large_image');
        setMetaTag('name', 'twitter:title', ogTitle || fullTitle);
        if (ogDescription || description) {
            setMetaTag('name', 'twitter:description', ogDescription || description || '');
        }
        setMetaTag('name', 'twitter:image', image);

        return () => {
            metas.forEach(el => el.remove());
            originalValues.forEach((value, el) => { el.content = value; });
            if (createdCanonical && canonicalLink) {
                canonicalLink.remove();
            }
        };
    }, [title, description, ogTitle, ogDescription, ogImage, ogUrl, pathname]);
}
