import { useEffect } from 'react';

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
    useEffect(() => {
        const fullTitle = title === 'rsmb' ? 'rsmb' : `${title} — rsmb`;
        document.title = fullTitle;

        const metas: HTMLMetaElement[] = [];

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
        if (ogImage) {
            setMeta('og:image', ogImage);
        }
        if (ogUrl) {
            setMeta('og:url', ogUrl);
        }

        // Twitter card tags
        setNameMeta('twitter:card', 'summary_large_image');
        setNameMeta('twitter:title', ogTitle || fullTitle);
        if (ogDescription || description) {
            setNameMeta('twitter:description', ogDescription || description || '');
        }
        if (ogImage) {
            setNameMeta('twitter:image', ogImage);
        }

        return () => {
            // Remove dynamically created meta tags
            metas.forEach(el => el.remove());
        };
    }, [title, description, ogTitle, ogDescription, ogImage, ogUrl]);
}
