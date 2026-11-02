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
import { PostNavigation } from '../blog/PostNavigation';
import { formatDate } from '../utils/formatDate';
import { isDevelopmentContent } from '../utils/developmentContent';
import { articleMetadata } from '../utils/pageMetadata';
import { loadTripManifest, getTripManifestIssue } from '../features/trips/tripManifests';
import { getTripSummary } from '../features/trips/tripSummaries';
import { TripStoryHeader } from '../features/trips/components/TripStoryHeader';
import { TripStoryDetails } from '../features/trips/components/TripStoryDetails';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import type { TripManifest } from '../features/trips/types';
import { getPostReturnDestination } from '../blog/postReturnDestination';

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
    const returnDestination = getPostReturnDestination(location.state, isTrip ? 'trips' : 'blog');
    const collectionPosts = getAllPosts().filter(candidate => isTrip ? candidate.format === 'trip' : candidate.format !== 'trip');
    const postIndex = collectionPosts.findIndex(candidate => candidate.slug === post?.slug);
    // Posts are newest first: the previous post is older, and the next is newer.
    const previousPost = postIndex >= 0 ? collectionPosts[postIndex + 1] : undefined;
    const nextPost = postIndex > 0 ? collectionPosts[postIndex - 1] : undefined;
    const series = post?.series ?? summary?.series;
    const seriesPosts = series ? getAllPosts().filter(candidate => (candidate.series ?? getTripSummary(candidate.tripId)?.series)?.id === series.id)
        .sort((a, b) => (a.series?.order ?? getTripSummary(a.tripId)?.series?.order ?? 0) - (b.series?.order ?? getTripSummary(b.tripId)?.series?.order ?? 0)) : [];

    const tripManifestIssue = isTrip ? getTripManifestIssue(post.tripId) : undefined;
    const metadata = post ? articleMetadata(post, summary?.hero) : undefined;

    useDocumentHead({
        ...metadata,
        title: post?.title ?? 'Post Not Found',
        description: post?.description ?? 'Blog post not found.',
        noIndex: !post || post.development?.published === false,
    });
    useJsonLd(metadata?.jsonLd ?? null);
    useJsonLd(metadata?.breadcrumb ?? null);

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
        return <Navigate to={`/${canonicalCollection}/${post.slug}${location.search}${location.hash}`} state={location.state} replace />;
    }

    if (isTrip && tripId && loaded?.id !== tripId) {
        return <div><h1 className="text-3xl font-bold">{post.title}</h1><p role="status" className="py-8 text-zinc-400">Loading trip…</p></div>;
    }
    if (isTrip && !tripManifest) {
        return (
            <div>
                <Link to={returnDestination.to} state={returnDestination.returnState} className="mb-6 inline-block text-sm text-zinc-400 hover:text-violet-400">
                    ← {returnDestination.label}
                </Link>
                <DevelopmentContentStatus post={post} />
                {isDevelopmentContent() ? <>
                    <h1 className="mb-2 text-2xl font-bold text-zinc-100">{post.title}</h1>
                    <p className="mb-6 text-zinc-400">{post.description}</p>
                    <h2 className="mb-4 text-2xl font-bold text-zinc-100">Trip not configured</h2>
                </> : <h1 className="mb-4 text-2xl font-bold text-zinc-100">Trip not configured</h1>}
                <p className="text-zinc-400">
                    {isDevelopmentContent() ? tripManifestIssue ?? loaded?.error ?? 'This story is missing its trip manifest.' : 'This trip is temporarily unavailable. Please reload to try again.'}
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
            {isTrip && <TripStoryDetails contentRef={contentRef} />}
        </PostHeadingProvider>
    );

    return (
        <article className={isTrip ? 'trip-story' : undefined}>
            {!isTrip && <div className="mb-6 flex items-baseline justify-between gap-4 text-sm text-zinc-400">
                <Link
                    to={returnDestination.to} state={returnDestination.returnState}
                    className="shrink-0 hover:text-violet-400"
                >
                    ← {returnDestination.label}
                </Link>
            </div>}

            {tripManifest ? (
                <TripStoryProvider manifest={tripManifest}>
                    <TripStoryHeader post={post} returnDestination={returnDestination} />
                    <DevelopmentContentStatus post={post} />
                    {postContent}
                </TripStoryProvider>
            ) : (
                <>
                    <DevelopmentContentStatus post={post} />
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
                {seriesPosts.length > 1 && <nav aria-label={series?.title}>
                    <p className="mb-2 font-medium">{series?.title}</p>
                    <ol className="space-y-2">{seriesPosts.map(part => <li key={part.slug}>
                        <Link aria-current={part.slug === post.slug ? 'page' : undefined} className="text-violet-300 underline"
                            to={`/${part.format === 'trip' ? 'trips' : 'blog'}/${part.slug}`} state={returnDestination.onwardState}>
                            {part.title}
                        </Link>
                    </li>)}</ol>
                </nav>}
                <PostNavigation previous={previousPost} next={nextPost} returnDestination={returnDestination} />
            </footer>
        </article>
    );
}
