import { Suspense } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { PostTagLink } from '../components/PostTagLink';
import { DevelopmentContentStatus } from '../components/DevelopmentContentStatus';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { getPostBySlug } from '../content/posts';
import { mdxComponents } from '../blog/MdxComponents';
import { formatDate } from '../utils/formatDate';
import { AUTHOR_PERSON, SITE_URL, absoluteUrl } from '../utils/siteMetadata';
import { getTripHero, getTripManifest, getTripManifestIssue, TripStoryHeader, TripStoryProvider } from '../features/trips';

interface BlogPostProps {
    collection: 'blog' | 'trips';
}

export function BlogPost({ collection }: BlogPostProps) {
    const { slug } = useParams<{ slug: string }>();
    const post = slug ? getPostBySlug(slug) : undefined;
    const isTrip = post?.format === 'trip';
    const tripManifest = isTrip ? getTripManifest(post.tripId) : undefined;
    const tripManifestIssue = isTrip ? getTripManifestIssue(post.tripId) : undefined;
    const collectionPath = isTrip ? '/trips' : '/blog';
    const collectionName = 'Posts';
    const postUrl = post ? absoluteUrl(`${collectionPath}/${post.slug}`) : undefined;
    const postImage = tripManifest
        ? absoluteUrl(getTripHero(tripManifest).src)
        : post ? absoluteUrl(`/og/blog/${post.slug}.svg`) : undefined;

    useDocumentHead({
        title: post ? `${post.title} | rsmb` : 'Post Not Found | rsmb',
        description: post?.description ?? 'Blog post not found.',
        ogImage: postImage,
    });

    useJsonLd(post ? {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        author: AUTHOR_PERSON,
        url: postUrl,
        image: postImage,
        keywords: post.tags,
    } : null);

    useJsonLd(post ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: collectionName, item: absoluteUrl('/posts') },
            { '@type': 'ListItem', position: 3, name: post.title, item: postUrl },
        ],
    } : null);

    if (!post) {
        return (
            <div>
                <h1 className="text-2xl font-bold text-zinc-100 mb-4">Post not found</h1>
                <Link to="/posts" className="text-violet-400 hover:text-violet-300">
                    ← Back to posts
                </Link>
            </div>
        );
    }

    const canonicalCollection = isTrip ? 'trips' : 'blog';
    if (collection !== canonicalCollection) {
        return <Navigate to={`/${canonicalCollection}/${post.slug}`} replace />;
    }

    if (isTrip && !tripManifest) {
        return (
            <div>
                <Link to="/posts?type=trips" className="mb-6 inline-block text-sm text-zinc-400 hover:text-violet-400">
                    ← Back to posts
                </Link>
                <DevelopmentContentStatus post={post} />
                <h1 className="mb-4 text-2xl font-bold text-zinc-100">Trip not configured</h1>
                <p className="text-zinc-400">
                    {tripManifestIssue ?? 'This story is missing its trip manifest.'}
                </p>
            </div>
        );
    }

    const { Component } = post;

    return (
        <article className={isTrip ? 'trip-story' : undefined}>
            <Link
                to={collectionPath}
                className="text-sm text-zinc-400 hover:text-violet-400 mb-6 inline-block"
            >
                ← Back to {collectionName.toLowerCase()}
            </Link>

            <DevelopmentContentStatus post={post} />

            {tripManifest ? (
                <TripStoryProvider manifest={tripManifest}>
                    <TripStoryHeader post={post} />
                    {post.development && !post.development.contentAvailable ? (
                        <p className="text-zinc-400">The draft story body is not available yet.</p>
                    ) : (
                        <Suspense fallback={<div className="text-sm text-zinc-400">Loading story...</div>}>
                            <Component components={mdxComponents} />
                        </Suspense>
                    )}
                </TripStoryProvider>
            ) : (
                <>
                    <header className="mb-8">
                        <time className="text-sm text-zinc-400">{formatDate(post.date)}</time>
                        <h1 className="text-3xl font-bold text-zinc-100 mt-2">{post.title}</h1>
                        {post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {post.tags.map((tag) => (
                                    <PostTagLink key={tag} tag={tag} type="writing" />
                                ))}
                            </div>
                        )}
                    </header>
                    {post.development && !post.development.contentAvailable ? (
                        <p className="text-zinc-400">The draft post body is not available yet.</p>
                    ) : (
                        <Suspense fallback={<div className="text-sm text-zinc-400">Loading post...</div>}>
                            <Component components={mdxComponents} />
                        </Suspense>
                    )}
                </>
            )}
        </article>
    );
}
