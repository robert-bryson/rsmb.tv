import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

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
        let canonicalLink: HTMLLinkElement | null = null;

        function setMeta(property: string, content: string) {
            let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
            if (!el) {
                el = document.createElement('meta');
                el.setAttribute('property', property);
                document.head.appendChild(el);
                metas.push(el);
            }
            el.content = content;
        }

        function setNameMeta(name: string, content: string) {
            let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
            if (!el) {
                el = document.createElement('meta');
                el.setAttribute('name', name);
                document.head.appendChild(el);
                metas.push(el);
            }
            el.content = content;
        }

        if (description) {
            setNameMeta('description', description);
        }

        setMeta('og:title', ogTitle || fullTitle);
        setMeta('og:type', 'website');

        if (ogDescription || description) {
            setMeta('og:description', ogDescription || description || '');
        }

        const image = ogImage || 'https://rsmb.tv/og-image.png';
        setMeta('og:image', image);

        const url = ogUrl || `https://rsmb.tv${pathname}`;
        setMeta('og:url', url);

        // Set canonical link
        canonicalLink = document.querySelector('link[rel="canonical"]');
        if (!canonicalLink) {
            canonicalLink = document.createElement('link');
            canonicalLink.setAttribute('rel', 'canonical');
            document.head.appendChild(canonicalLink);
        }
        canonicalLink.setAttribute('href', url);

        // Twitter card tags
        setNameMeta('twitter:card', 'summary_large_image');
        setNameMeta('twitter:title', ogTitle || fullTitle);
        if (ogDescription || description) {
            setNameMeta('twitter:description', ogDescription || description || '');
        }
        setNameMeta('twitter:image', image);

        return () => {
            metas.forEach(el => el.remove());
            // Only remove canonical if we created it
            if (canonicalLink && !document.querySelector('link[rel="canonical"][data-static]')) {
                canonicalLink.remove();
            }
        };
    }, [title, description, ogTitle, ogDescription, ogImage, ogUrl, pathname]);
}
