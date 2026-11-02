import sitePages from '../content/sitePages.json' with { type: 'json' };
import { projects } from '../content/projects.ts';
import { absoluteUrl, AUTHOR_PERSON, canonicalUrl, SITE_URL } from './siteMetadata.ts';

type JsonLd = Record<string, unknown>;
export interface PageMetadata {
    title: string;
    description: string;
    ogImage: string;
    ogUrl: string;
    ogType?: 'website' | 'article';
    publishedTime?: string;
    imageAlt?: string;
    imageWidth?: number;
    imageHeight?: number;
    jsonLd: JsonLd;
    breadcrumb: JsonLd | null;
}

/** Only the public post fields are needed by both Vite and the browser. */
export interface PostMetadata {
    slug: string;
    title: string;
    description: string;
    date: string;
    tags: string[];
    format?: string;
    development?: { published: boolean };
}

export const STATIC_PAGE_PATHS = Object.keys(sitePages);
const context = { '@context': 'https://schema.org' };
const website = { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'rsmb', url: SITE_URL, author: AUTHOR_PERSON };

function breadcrumbs(items: Array<{ name: string; url: string }>): JsonLd {
    return {
        ...context, '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url })),
    };
}

function projectApplication(slug: string): JsonLd {
    const project = projects.find(project => project.slug === slug)!;
    const pageUrl = absoluteUrl(`/projects/${slug}`);
    const page = sitePages[`/projects/${slug}` as keyof typeof sitePages];
    const operatingSystem = page && 'operatingSystem' in page ? page.operatingSystem : 'Web';
    return {
        '@type': 'SoftwareApplication', '@id': `${pageUrl}#application`,
        name: project.title, description: project.description,
        url: project.demoUrl ? absoluteUrl(project.demoUrl) : pageUrl,
        applicationCategory: project.applicationCategory, operatingSystem,
        author: AUTHOR_PERSON, keywords: project.tech,
        ...(project.lastUpdated ? { dateModified: project.lastUpdated } : {}),
        ...(project.previewImage ? { screenshot: absoluteUrl(project.previewImage) } : {}),
        ...(project.sourceUrl ? { subjectOf: { '@type': 'SoftwareSourceCode', codeRepository: project.sourceUrl } } : {}),
        ...(slug === 'parc' ? { softwareRequirements: 'Python 3.10+' } : {}),
    };
}

/** Shared by static HTML generation and React so their metadata stays consistent. */
export function staticPageMetadata(pathname: string, posts: PostMetadata[] = []): PageMetadata {
    const page = sitePages[pathname as keyof typeof sitePages];
    if (!page) throw new Error(`Missing page metadata: ${pathname}`);
    const url = canonicalUrl(pathname);
    const { title, description, image } = page;
    const common = { ...context, name: title, description, url, inLanguage: 'en-US', author: AUTHOR_PERSON, isPartOf: website };
    let jsonLd: JsonLd;
    const trail = [{ name: 'Home', url: canonicalUrl('/') }];

    if (pathname === '/') {
        jsonLd = { ...context, ...website, description, inLanguage: 'en-US' };
    } else if (pathname === '/about') {
        jsonLd = {
            ...common, '@type': 'ProfilePage', name: 'About Robby Bryson',
            mainEntity: {
                ...AUTHOR_PERSON, jobTitle: 'Software developer and geospatial engineer',
                worksFor: { '@type': 'Organization', name: 'Xentity', url: 'https://xentity.com' },
                alumniOf: { '@type': 'Organization', name: 'Microsoft', url: 'https://www.microsoft.com' },
                sameAs: ['https://github.com/robert-bryson', 'https://peakbagger.com/climber/Climber.aspx?cid=2884', 'https://www.mountainproject.com/user/107186573/rsmb'],
            },
        };
    } else if (pathname === '/projects' || pathname === '/posts') {
        const items = pathname === '/projects'
            ? projects.map(project => ({ item: { ...projectApplication(project.slug), url: absoluteUrl(`/projects/${project.slug}`) } }))
            : posts.filter(post => post.development?.published !== false).map(post => ({ url: articleUrl(post), name: post.title }));
        jsonLd = {
            ...common, '@type': 'CollectionPage',
            mainEntity: { '@type': 'ItemList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, ...item })) },
        };
    } else {
        const slug = pathname.split('/')[2];
        const projectPath = `/projects/${slug}`;
        const project = projects.find(project => project.slug === slug)!;
        const application = projectApplication(slug);
        trail.push({ name: 'Projects', url: absoluteUrl('/projects') });
        if (pathname === projectPath) {
            jsonLd = { ...context, ...application, description, mainEntityOfPage: { '@type': 'WebPage', '@id': url } };
        } else {
            if (slug !== 'adv-atlas') trail.push({ name: project.title, url: absoluteUrl(projectPath) });
            jsonLd = { ...common, '@type': 'WebPage', name: pathname.endsWith('/map') ? `${project.title} Map` : title, mainEntity: application };
        }
    }
    trail.push({ name: title, url });
    return { title, description, ogImage: absoluteUrl(image), ogUrl: url, imageAlt: `${title === 'rsmb' ? 'rsmb.tv' : title} — Robby Bryson`, imageWidth: 1200, imageHeight: 630, jsonLd, breadcrumb: pathname === '/' ? null : breadcrumbs(trail) };
}

export function articleUrl(post: Pick<PostMetadata, 'format' | 'slug'>): string {
    return absoluteUrl(`/${post.format === 'trip' ? 'trips' : 'blog'}/${post.slug}`);
}

export function articleMetadata(post: PostMetadata, hero?: { src: string; alt?: string; width?: number; height?: number }): PageMetadata {
    const url = articleUrl(post);
    const image = absoluteUrl(hero?.src ?? `/og/blog/${post.slug}.png`);
    return {
        title: post.title, description: post.description, ogImage: image, ogUrl: url,
        ogType: 'article', publishedTime: post.date, imageAlt: hero?.alt ?? post.title,
        imageWidth: hero ? hero.width : 1200, imageHeight: hero ? hero.height : 630,
        jsonLd: {
            ...context, '@type': 'BlogPosting', '@id': `${url}#article`,
            headline: post.title, description: post.description, datePublished: post.date,
            author: AUTHOR_PERSON, publisher: AUTHOR_PERSON, url, image, keywords: post.tags, inLanguage: 'en-US',
            mainEntityOfPage: { '@type': 'WebPage', '@id': url }, isPartOf: website,
        },
        breadcrumb: breadcrumbs([{ name: 'Home', url: canonicalUrl('/') }, { name: 'Posts', url: absoluteUrl('/posts') }, { name: post.title, url }]),
    };
}
