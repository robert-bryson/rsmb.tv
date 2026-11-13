import { canonicalPathname } from '../utils/siteMetadata';
import { getPostBySlug } from '../content/posts';
import { pageLoaders, type PageLoaderKey } from './pageLoaders';
import { temperatureDataView } from '../features/temperatures/temperatureDataView';

export type PrefetchMode = 'page' | 'destination' | 'none';
export type PrefetchRollout = 'off' | 'pages' | 'all';
export interface PrefetchTarget {
    key: string;
    page: PageLoaderKey;
    map?: 'flights' | 'temperatures' | 'tornadoes' | 'atlas' | 'pins';
    slug?: string;
    search: string;
}

const aliases: Record<string, string> = {
    '/blog': '/posts', '/trips': '/posts',
    '/projects/adv-atlas': '/projects/adv-atlas/map',
    '/projects/motorcycle-trips': '/projects/adv-atlas/map',
    '/projects/motorcycle-trips/map': '/projects/adv-atlas/map',
};
const maps: Record<string, PrefetchTarget['map']> = {
    '/projects/flights/map': 'flights', '/projects/temperature-records/map': 'temperatures',
    '/projects/tornado-tracks/map': 'tornadoes', '/projects/adv-atlas/map': 'atlas',
    '/projects/pins-of-inaccessibility/map': 'pins',
};

export function prefetchRollout(value: string | undefined = import.meta.env.VITE_INTENT_PREFETCH): PrefetchRollout {
    if (!value || value === 'all') return 'all';
    return value === 'pages' ? 'pages' : 'off';
}

export function resolvePrefetchTarget(href: string, currentHref: string, base = import.meta.env.BASE_URL,
    findPost = getPostBySlug): PrefetchTarget | null {
    try {
        const current = new URL(currentHref);
        const url = new URL(href, current);
        if (!/^https?:$/.test(url.protocol) || url.origin !== current.origin || url.username || url.password) return null;
        const root = `${base.replace(/\/+$/, '')}/`;
        if (!url.pathname.startsWith(root)) return null;
        const localPath = (pathname: string) => canonicalPathname(`/${pathname.slice(root.length)}`);
        const canonical = (path: string) => aliases[path] ?? path;
        const path = canonical(localPath(url.pathname));
        if (path === canonical(localPath(current.pathname))) return null;
        const article = /^\/(?:blog|trips)\/([^/]+)$/.exec(path);
        if (article) {
            const post = findPost(decodeURIComponent(article[1]));
            if (!post || post.development?.contentAvailable === false) return null;
            return { key: `/${post.format === 'trip' ? 'trips' : 'blog'}/${post.slug}`, page: 'article', slug: post.slug, search: url.search };
        }
        if (!Object.hasOwn(pageLoaders, path)) return null;
        const map = maps[path];
        // Only temperature view affects the small data allowlist; filters/camera do not.
        return { key: map === 'temperatures' ? `${path}?view=${temperatureDataView(url.search)}` : path,
            page: path as PageLoaderKey, map, search: url.search };
    } catch { return null; }
}
