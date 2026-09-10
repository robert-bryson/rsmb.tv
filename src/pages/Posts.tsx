import { Link, useSearchParams } from 'react-router-dom';
import { DevelopmentContentStatus } from '../components/DevelopmentContentStatus';
import { filterPostsByTag, getAllBlogTags } from '../content/blogTags';
import { getAllPosts } from '../content/posts';
import { getTripHero, getTripManifest } from '../features/trips';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { formatDate } from '../utils/formatDate';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';

const description = 'Writing about projects, engineering, journeys, and other things I find interesting.';

type PostType = 'all' | 'writing' | 'trips';

function getPostType(value: string | null): PostType {
    return value === 'writing' || value === 'trips' ? value : 'all';
}

function createPostsUrl(type: PostType, tag = '') {
    const params = new URLSearchParams();
    if (type !== 'all') params.set('type', type);
    if (tag) params.set('tag', tag);
    const search = params.toString();
    return `/posts${search ? `?${search}` : ''}`;
}

const filterClasses = 'rounded-md px-3 py-1.5 text-sm transition-colors';

export function Posts() {
    const allPosts = getAllPosts();
    const [searchParams] = useSearchParams();
    const activeType = getPostType(searchParams.get('type'));
    const activeTag = searchParams.get('tag')?.trim() ?? '';
    const postsByType = allPosts.filter((post) => (
        activeType === 'all'
        || (activeType === 'trips' ? post.format === 'trip' : post.format !== 'trip')
    ));
    const allTags = getAllBlogTags(postsByType);
    const posts = filterPostsByTag(postsByType, activeTag);

    useDocumentHead({
        title: 'Posts | rsmb',
        description,
        ogImage: absoluteUrl('/og/blog.svg'),
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Posts',
        description,
        url: absoluteUrl('/posts'),
        author: AUTHOR_PERSON,
        mainEntity: {
            '@type': 'ItemList',
            itemListElement: allPosts.map((post, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                url: absoluteUrl(`/${post.format === 'trip' ? 'trips' : 'blog'}/${post.slug}`),
                name: post.title,
            })),
        },
    });

    return (
        <div>
            <h1 className="mb-2 text-3xl font-bold text-zinc-100">Posts</h1>
            <p className="mb-6 max-w-2xl text-zinc-400">{description}</p>

            <nav aria-label="Post type" className="mb-5 flex w-fit gap-1 rounded-lg bg-zinc-900 p-1">
                {([
                    ['all', 'All'],
                    ['writing', 'Writing'],
                    ['trips', 'Trips'],
                ] as const).map(([type, label]) => (
                    <Link
                        key={type}
                        to={createPostsUrl(type)}
                        aria-current={activeType === type ? 'page' : undefined}
                        className={`${filterClasses} ${activeType === type
                                ? 'bg-zinc-700 text-zinc-100'
                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                            }`}
                    >
                        {label}
                    </Link>
                ))}
            </nav>

            {allTags.length > 0 && (
                <nav aria-label="Post tags" className="mb-8 flex flex-wrap gap-2">
                    <Link
                        to={createPostsUrl(activeType)}
                        aria-current={!activeTag ? 'page' : undefined}
                        className={`max-w-full rounded-full px-2.5 py-0.5 text-xs transition-colors ${!activeTag
                                ? 'bg-violet-600 text-zinc-100'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                            }`}
                    >
                        All tags
                    </Link>
                    {allTags.map((tag) => (
                        <Link
                            key={tag}
                            to={createPostsUrl(activeType, tag)}
                            aria-current={activeTag === tag ? 'page' : undefined}
                            className={`max-w-full break-words rounded-full px-2.5 py-0.5 text-xs transition-colors ${activeTag === tag
                                    ? 'bg-violet-600 text-zinc-100'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                                }`}
                        >
                            {tag}
                        </Link>
                    ))}
                </nav>
            )}

            {posts.length === 0 ? (
                <p className="text-zinc-400">
                    {activeTag ? `No posts tagged "${activeTag}" in this view.` : 'No posts yet.'}
                </p>
            ) : (
                <ul className="divide-y divide-zinc-800/70">
                    {posts.map((post) => {
                        const isTrip = post.format === 'trip';
                        const manifest = isTrip ? getTripManifest(post.tripId) : undefined;
                        const hero = manifest ? getTripHero(manifest) : undefined;

                        return (
                            <li key={post.slug} className="py-6 first:pt-0">
                                <DevelopmentContentStatus post={post} compact />
                                <Link
                                    to={`/${isTrip ? 'trips' : 'blog'}/${post.slug}`}
                                    className="group flex items-start gap-5"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
                                            <time>{formatDate(post.date)}</time>
                                            <span className="text-xs uppercase text-zinc-500">
                                                {isTrip ? 'Trip report' : 'Writing'}
                                            </span>
                                        </div>
                                        <h2 className="mt-1 text-lg font-medium text-zinc-100 group-hover:text-violet-400">
                                            {post.title}
                                        </h2>
                                        <p className="mt-1 text-sm leading-relaxed text-zinc-400">{post.description}</p>
                                    </div>
                                    {hero && (
                                        <img
                                            src={hero.src}
                                            srcSet={hero.srcSet}
                                            sizes="144px"
                                            width={hero.width}
                                            height={hero.height}
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                            className="hidden aspect-[4/3] w-36 shrink-0 rounded-md border border-zinc-800 object-cover sm:block"
                                        />
                                    )}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}