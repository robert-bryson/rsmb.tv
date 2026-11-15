import { IntentLink } from '../components/IntentLink';
import { useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { analyticsResultBucket, trackAnalyticsEvent } from '../utils/analytics';
import { DevelopmentContentStatus } from '../components/DevelopmentContentStatus';
import { PostRegionFilters } from '../components/PostRegionFilters';
import { PostSearch } from '../components/PostSearch';
import { filterPostsByTag, getAllBlogTags, tripFactTag } from '../content/blogTags';
import { filterPostsByRegion, findGeographicTag, getAllBlogRegions } from '../content/blogRegions';
import { getAllPosts } from '../content/posts';
import { searchPosts } from '../content/postSearch';
import { createPostsUrl, getPostType } from '../content/postFilters';
import { getTripSummary } from '../features/trips/tripSummaries';
import { TripThumbnail } from '../features/trips/components/TripThumbnail';
import { TRIP_ATLAS_PATH } from '../features/trips/atlas/tripAtlasView';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { usePostSearchQuery } from '../hooks/usePostSearchQuery';
import { staticPageMetadata } from '../utils/pageMetadata';
import { formatDate } from '../utils/formatDate';

const filterClasses = 'rounded-md px-3 py-1.5 text-sm transition-colors';

export function Posts() {
    const location = useLocation();
    const allPosts = getAllPosts();
    const { query, updateQuery, clearFilters, searchParams, returnUrl } = usePostSearchQuery();
    const searchRef = useRef<HTMLInputElement>(null);
    const activeType = getPostType(searchParams.get('type'));
    const tag = searchParams.get('tag')?.trim() ?? '';
    const geographicTag = findGeographicTag(allPosts, tag);
    const activeTag = geographicTag ? '' : tag;
    const activeCountry = searchParams.get('country')?.trim().toUpperCase() ?? geographicTag?.country ?? '';
    const activeRegion = tripFactTag(searchParams.get('region') ?? geographicTag?.region ?? '');
    const postsByType = allPosts.filter((post) => (
        activeType === 'all'
        || (activeType === 'trips' ? post.format === 'trip' : post.format !== 'trip')
    ));
    const allTags = getAllBlogTags(postsByType);
    const countries = getAllBlogRegions(postsByType);
    const posts = searchPosts(filterPostsByRegion(filterPostsByTag(postsByType, activeTag), activeCountry, activeRegion), query);
    const hasActiveFilters = activeType !== 'all' || !!(activeTag || activeCountry || activeRegion || query);

    const previousFilters = useRef(location.search);
    useEffect(() => {
        if (previousFilters.current === location.search) return;
        const timeout = window.setTimeout(() => {
            previousFilters.current = location.search;
            trackAnalyticsEvent('filters-applied', { feature: 'posts', resultBucket: analyticsResultBucket(posts.length) });
        }, 300);
        return () => window.clearTimeout(timeout);
    }, [location.search, posts.length]);

    const metadata = staticPageMetadata('/posts', allPosts);
    usePageMetadata(metadata);

    return (
        <div>
            <h1 className="mb-2 text-3xl font-bold text-zinc-100">Posts</h1>
            <p className="mb-6 max-w-2xl text-zinc-400">{metadata.description}</p>

            <PostSearch query={query} onChange={updateQuery} inputRef={searchRef} />

            <nav aria-label="Post type" className="mb-5 flex w-fit gap-1 rounded-lg bg-zinc-900 p-1">
                {([
                    ['all', 'All'],
                    ['writing', 'Writing'],
                    ['trips', 'Trips'],
                ] as const).map(([type, label]) => (
                    <IntentLink
                        key={type}
                        to={createPostsUrl({ type, query })}
                        aria-current={activeType === type ? 'page' : undefined}
                        className={`${filterClasses} ${activeType === type
                            ? 'bg-zinc-700 text-zinc-100'
                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                            }`}
                    >
                        {label}
                    </IntentLink>
                ))}
            </nav>

            {activeType === 'trips' && <IntentLink prefetchMode="destination" to={TRIP_ATLAS_PATH} className="mb-5 inline-flex min-h-11 items-center text-sm text-violet-300 hover:underline">Explore ADV Atlas →</IntentLink>}

            <div className="mb-5 space-y-5">
                {allTags.length > 0 && <nav aria-label="Post tags" className="flex flex-wrap items-baseline gap-2">
                    <p className="mr-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">Tags</p>
                    <IntentLink
                        to={createPostsUrl({ type: activeType, country: activeCountry, region: activeRegion, query })}
                        aria-current={!activeTag ? 'page' : undefined}
                        className={`max-w-full rounded-full px-2.5 py-0.5 text-xs transition-colors ${!activeTag
                            ? 'bg-violet-600 text-zinc-100'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                            }`}
                    >
                        All tags
                    </IntentLink>
                    {allTags.map((tag) => (
                        <IntentLink
                            key={tag}
                            to={createPostsUrl({ type: activeType, tag, country: activeCountry, region: activeRegion, query })}
                            aria-current={activeTag === tag ? 'page' : undefined}
                            className={`max-w-full break-words rounded-full px-2.5 py-0.5 text-xs transition-colors ${activeTag === tag
                                ? 'bg-violet-600 text-zinc-100'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                                }`}
                        >
                            {tag}
                        </IntentLink>
                    ))}
                </nav>}
                {countries.length > 0 && <PostRegionFilters
                    key={activeType}
                    countries={countries}
                    activeCountry={activeCountry}
                    activeRegion={activeRegion}
                    createUrl={(country = '', region = '') => createPostsUrl({ type: activeType, tag: activeTag, country, region, query })}
                />}
            </div>

            <div className="mb-6 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-zinc-800/70 pb-3">
                <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-zinc-400">
                    {posts.length === allPosts.length
                        ? `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`
                        : `${posts.length} of ${allPosts.length} posts`}
                </p>
                {hasActiveFilters && <button
                    type="button"
                    onClick={() => {
                        clearFilters();
                        searchRef.current?.focus();
                    }}
                    className="min-h-11 rounded-md px-2 text-sm text-violet-300 hover:underline focus-visible:outline-2 focus-visible:outline-violet-400"
                >Clear all filters</button>}
            </div>

            {posts.length === 0 ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-5 py-8 text-center">
                    <p className="font-medium text-zinc-200">
                        {hasActiveFilters ? 'No posts match these filters.' : 'No posts yet.'}
                    </p>
                    {hasActiveFilters && <p className="mt-2 text-sm text-zinc-400">Try a different search or clear the filters to see more posts.</p>}
                </div>
            ) : (
                <ul className="divide-y divide-zinc-800/70">
                    {posts.map((post) => {
                        const isTrip = post.format === 'trip';
                        const manifest = isTrip ? getTripSummary(post.tripId) : undefined;
                        const hero = manifest?.hero;
                        const tripDetails = isTrip ? [
                            post.tags.includes('motorcycle') && 'motorcycle',
                            manifest?.distanceMiles && `${manifest.distanceMiles.toLocaleString()} miles`,
                            manifest?.ridingDays && `${manifest.ridingDays} riding days`,
                        ].filter(Boolean).join(' · ') : '';

                        return (
                            <li key={post.slug} className="py-6 first:pt-0">
                                <DevelopmentContentStatus post={post} compact />
                                <IntentLink
                                    prefetchMode="destination" to={`/${isTrip ? 'trips' : 'blog'}/${post.slug}`}
                                    state={{ from: returnUrl }}
                                    className="group flex items-start gap-5"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
                                            <time dateTime={post.date}>{formatDate(post.date)}</time>
                                            <span className="text-xs uppercase text-zinc-400">
                                                {isTrip ? 'Trip report' : 'Writing'}
                                            </span>
                                        </div>
                                        <h2 className="mt-1 text-lg font-medium text-zinc-100 group-hover:text-violet-400">
                                            {post.title}
                                        </h2>
                                        <p className="mt-1 text-sm leading-relaxed text-zinc-400">{post.description}</p>
                                        {tripDetails && <p className="mt-2 text-xs text-zinc-300">{tripDetails}</p>}
                                    </div>
                                    {hero && (
                                        <TripThumbnail
                                            photo={hero}
                                            sizes="(min-width: 640px) 144px, 96px"
                                            className="aspect-[4/3] w-24 sm:w-36 shrink-0 rounded-md border border-zinc-800 object-cover"
                                        />
                                    )}
                                </IntentLink>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
