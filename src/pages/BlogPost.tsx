import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useLocation, Link, Navigate } from 'react-router-dom';
import { PostTagLink } from '../components/PostTagLink';
import { DevelopmentContentStatus } from '../components/DevelopmentContentStatus';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { getAllPosts, getPostBySlug } from '../content/posts';
import { PostHeadingProvider } from '../blog/LinkedHeading';
import { mdxComponents } from '../blog/MdxComponents';
import { PostTableOfContents } from '../blog/PostTableOfContents';
import { formatDate } from '../utils/formatDate';
import { AUTHOR_PERSON, SITE_URL, absoluteUrl } from '../utils/siteMetadata';
import { loadTripManifest, getTripManifestIssue } from '../features/trips/tripManifests';
import { getTripSummary } from '../features/trips/tripSummaries';
import { TripStoryHeader } from '../features/trips/components/TripStoryHeader';
import { TripStoryDetails } from '../features/trips/components/TripStoryDetails';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import type { TripManifest } from '../features/trips/types';

interface BlogPostProps {
    collection: 'blog' | 'trips';
}

export function BlogPost({ collection }: BlogPostProps) {
    const location = useLocation();
    const contentRef = useRef<HTMLDivElement>(null);
    const { slug } = useParams<{ slug: string }>();
    const post = slug ? getPostBySlug(slug) : undefined;
    const isTrip = post?.format === 'trip';
    const tripId = isTrip ? post.tripId : undefined;
    const [loaded, setLoaded] = useState<{ id: string; manifest?: TripManifest; error?: string }>();
    useEffect(() => {
        if (!tripId) return;
        let active = true;
        loadTripManifest(tripId).then(manifest => {
            if (active) setLoaded({ id: tripId, manifest });
        }, (error: unknown) => {
            if (active) setLoaded({ id: tripId, error: error instanceof Error ? error.message : 'The trip could not load.' });
        });
        return () => { active = false; };
    }, [tripId]);
    const tripManifest = loaded?.id === tripId ? loaded?.manifest : undefined;
    const summary = getTripSummary(tripId);
    const defaultReturn = isTrip ? '/posts?type=trips' : '/posts?type=writing';
    const from = (location.state as { from?: string } | null)?.from;
    const returnTo = typeof from === 'string' && /^\/posts(?:\?|$)/.test(from) ? from : defaultReturn;
    const related = getAllPosts().filter(candidate => candidate.slug !== post?.slug && (isTrip ? candidate.format === 'trip' : candidate.format !== 'trip'));
    const series = post?.series ?? summary?.series;
    const seriesPosts = series ? getAllPosts().filter(candidate => (candidate.series ?? getTripSummary(candidate.tripId)?.series)?.id === series.id)
        .sort((a, b) => (a.series?.order ?? getTripSummary(a.tripId)?.series?.order ?? 0) - (b.series?.order ?? getTripSummary(b.tripId)?.series?.order ?? 0)) : [];

    const tripManifestIssue = isTrip ? getTripManifestIssue(post.tripId) : undefined;
    const collectionPath = isTrip ? '/trips' : '/blog';
    const collectionName = 'Posts';
    const postUrl = post ? absoluteUrl(`${collectionPath}/${post.slug}`) : undefined;
    const postImage = summary
        ? absoluteUrl(summary.hero.src)
        : post ? absoluteUrl(`/og/blog/${post.slug}.svg`) : undefined;

    useDocumentHead({
        title: post ? post.title : 'Post Not Found',
        description: post?.description ?? 'Blog post not found.',
        ogImage: postImage,
        ogType: 'article',
        publishedTime: post?.date,
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

    if (isTrip && tripId && loaded?.id !== tripId) {
        return <div><h1 className="text-3xl font-bold">{post.title}</h1><p role="status" className="py-8 text-zinc-400">Loading trip…</p></div>;
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
                    {import.meta.env.DEV ? tripManifestIssue ?? loaded?.error ?? 'This story is missing its trip manifest.' : 'This trip is temporarily unavailable. Please reload to try again.'}
                </p>
            </div>
        );
    }

    const { Component } = post;
    const postContent = (
        <PostHeadingProvider key={post.slug}>
            {!isTrip && <PostTableOfContents contentRef={contentRef} />}
            <div ref={contentRef} id="trip-story-body" className="scroll-mt-24">
                {post.development && !post.development.contentAvailable ? (
                    <p className="text-zinc-400">
                        The draft {isTrip ? 'story' : 'post'} body is not available yet.
                    </p>
                ) : (
                    <Suspense fallback={<div className="text-sm text-zinc-400">Loading {isTrip ? 'story' : 'post'}...</div>}>
                        <Component components={mdxComponents} />
                    </Suspense>
                )}
            </div>
            {isTrip && <TripStoryDetails post={post} contentRef={contentRef} />}
        </PostHeadingProvider>
    );

    return (
        <article className={isTrip ? 'trip-story -mt-3' : undefined}>
            <div className={`flex items-baseline justify-between gap-4 text-sm text-zinc-400 ${isTrip ? 'mb-9' : 'mb-6'}`}>
                <Link
                    to={returnTo} state={{ restoreScroll: true }}
                    className="shrink-0 hover:text-violet-400"
                >
                    ← Back to {collectionName.toLowerCase()}
                </Link>
                {isTrip && <time dateTime={post.date} className="text-right">Published {formatDate(post.date)}</time>}
            </div>

            <DevelopmentContentStatus post={post} />

            {tripManifest ? (
                <TripStoryProvider manifest={tripManifest}>
                    <TripStoryHeader post={post} />
                    {postContent}
                </TripStoryProvider>
            ) : (
                <>
                    <header className="mb-8">
                        <time dateTime={post.date} className="text-sm text-zinc-400">{formatDate(post.date)}</time>
                        <h1 className="text-3xl font-bold text-zinc-100 mt-2">{post.title}</h1>
                        {post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {post.tags.map((tag) => (
                                    <PostTagLink key={tag} tag={tag} type="writing" />
                                ))}
                            </div>
                        )}
                    </header>
                    {postContent}
                </>
            )}
            <footer className="mt-12 space-y-5 border-t border-zinc-800 pt-6 text-sm">
                <Link to={returnTo} state={{ restoreScroll: true }} className="inline-flex min-h-11 items-center text-violet-300">← Back to posts</Link>
                {seriesPosts.length > 1 && <nav aria-label={series?.title}><p className="mb-2 font-medium">{series?.title}</p><ol className="space-y-2">{seriesPosts.map(part => <li key={part.slug}><Link aria-current={part.slug === post.slug ? 'page' : undefined} className="text-violet-300 underline" to={`/${part.format === 'trip' ? 'trips' : 'blog'}/${part.slug}`}  state={{ from: returnTo }}>{part.title}</Link></li>)}</ol></nav>}
                {related.length > 0 && <nav aria-label="More posts"><p className="mb-2 font-medium text-zinc-300">{isTrip ? 'More trip reports' : 'Keep reading'}</p><ul className="space-y-2">{related.slice(0, 2).map(next => <li key={next.slug}><Link className="inline-flex min-h-11 items-center text-violet-300 underline" to={`/${next.format === 'trip' ? 'trips' : 'blog'}/${next.slug}`} state={{ from: returnTo }}>{next.title}</Link></li>)}</ul></nav>}
            </footer>
        </article>
    );
}
