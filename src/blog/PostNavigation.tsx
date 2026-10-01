import { Link } from 'react-router-dom';
import type { BlogPostMeta } from '../content/posts';
import { getTripSummary } from '../features/trips/tripSummaries';
import type { TripPhotoData } from '../features/trips/types';

function smallestHeroSource(hero: TripPhotoData) {
    const sources = [{ src: hero.src, width: hero.width }];
    for (const candidate of hero.srcSet?.split(',') ?? []) {
        const match = candidate.trim().match(/^(\S+)\s+(\d+)w$/);
        if (match) sources.push({ src: match[1], width: Number(match[2]) });
    }
    return sources.reduce((smallest, source) => source.width < smallest.width ? source : smallest).src;
}

function NeighborLink({ post, direction, returnTo }: {
    post: BlogPostMeta;
    direction: 'previous' | 'next';
    returnTo: string;
}) {
    const hero = getTripSummary(post.tripId)?.hero;
    const previous = direction === 'previous';

    return (
        <Link
            to={`/${post.format === 'trip' ? 'trips' : 'blog'}/${post.slug}`}
            state={{ from: returnTo }}
            rel={previous ? 'prev' : 'next'}
            aria-label={`${previous ? 'Previous post' : 'Next post'} ${post.title}`}
            title={post.description}
            className={`group flex min-w-0 flex-col gap-3 rounded-sm text-violet-300 hover:text-violet-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400 ${previous ? 'items-start text-left' : 'items-end text-right'}`}
        >
            <span className="inline-flex min-h-11 items-center gap-2">
                {previous && <span aria-hidden="true">←</span>}
                {previous ? 'Previous post' : 'Next post'}
                {!previous && <span aria-hidden="true">→</span>}
            </span>
            {hero && (
                <img
                    src={smallestHeroSource(hero)}
                    alt=""
                    width={hero.width}
                    height={hero.height}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[3/2] w-24 max-w-full rounded object-cover sm:w-32"
                />
            )}
            <span className="break-words leading-snug group-hover:underline">{post.title}</span>
        </Link>
    );
}

export function PostNavigation({ previous, next, returnTo }: {
    previous?: BlogPostMeta;
    next?: BlogPostMeta;
    returnTo: string;
}) {
    return (
        <nav aria-label="Post navigation" className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 sm:gap-6">
            <div className="min-w-0">
                {previous && <NeighborLink post={previous} direction="previous" returnTo={returnTo} />}
            </div>
            <Link
                to={returnTo}
                state={{ restoreScroll: true }}
                className="inline-flex min-h-11 items-center justify-center rounded-sm text-center text-violet-300 hover:text-violet-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400"
            >
                Back to posts
            </Link>
            <div className="min-w-0">
                {next && <NeighborLink post={next} direction="next" returnTo={returnTo} />}
            </div>
        </nav>
    );
}
