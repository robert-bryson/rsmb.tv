import { Link, useSearchParams } from 'react-router-dom';
import { BlogAllTagsLink, BlogTagLink } from '../components/BlogTagLink';
import { filterPostsByTag, getAllBlogTags } from '../content/blogTags';
import { getTripPosts } from '../content/posts';
import { getTripManifest } from '../features/trips';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { formatDate } from '../utils/formatDate';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';

const description = 'Motorcycle journeys told through photographs, routes, and field notes.';

export function Trips() {
    const allTrips = getTripPosts();
    const [searchParams] = useSearchParams();
    const activeTag = searchParams.get('tag')?.trim() ?? '';
    const allTags = getAllBlogTags(allTrips);
    const trips = filterPostsByTag(allTrips, activeTag);

    useDocumentHead({
        title: 'Trips | rsmb',
        description,
        ogImage: absoluteUrl('/og/trips.svg'),
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Trips',
        description,
        url: absoluteUrl('/trips'),
        author: AUTHOR_PERSON,
        mainEntity: {
            '@type': 'ItemList',
            itemListElement: allTrips.map((trip, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                item: {
                    '@type': 'BlogPosting',
                    headline: trip.title,
                    description: trip.description,
                    datePublished: trip.date,
                    url: absoluteUrl(`/trips/${trip.slug}`),
                    image: getTripManifest(trip.tripId)
                        ? absoluteUrl(getTripManifest(trip.tripId)!.hero.src)
                        : undefined,
                    author: AUTHOR_PERSON,
                },
            })),
        },
    });

    return (
        <div>
            <h1 className="mb-2 text-3xl font-bold text-zinc-100">Trips</h1>
            <p className="mb-7 max-w-2xl text-zinc-400">{description}</p>

            {allTags.length > 0 && (
                <nav aria-label="Trip tags" className="mb-8 flex flex-wrap gap-2">
                    <BlogAllTagsLink active={!activeTag} to="/trips" />
                    {allTags.map((tag) => (
                        <BlogTagLink key={tag} tag={tag} active={activeTag === tag} to="/trips" />
                    ))}
                </nav>
            )}

            {trips.length === 0 ? (
                <p className="text-zinc-400">
                    {activeTag ? `No trips tagged "${activeTag}".` : 'No trip stories yet.'}
                </p>
            ) : (
                <ul className="space-y-10">
                    {trips.map((trip) => {
                        const manifest = getTripManifest(trip.tripId);
                        return (
                            <li key={trip.slug}>
                                <Link to={`/trips/${trip.slug}`} className="group block">
                                    {manifest && (
                                        <img
                                            src={manifest.hero.src}
                                            srcSet={manifest.hero.srcSet}
                                            sizes="(min-width: 768px) 720px, calc(100vw - 3rem)"
                                            width={manifest.hero.width}
                                            height={manifest.hero.height}
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                            className="mb-4 aspect-[16/9] w-full rounded-md border border-zinc-800 object-cover"
                                        />
                                    )}
                                    <time className="text-sm text-zinc-500">{formatDate(trip.date)}</time>
                                    <h2 className="mt-1 text-xl font-semibold text-zinc-100 group-hover:text-violet-400">{trip.title}</h2>
                                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{trip.description}</p>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}