import { Link } from 'react-router-dom';
import type { BlogPostMeta } from '../../../content/posts';
import { formatMonthYear } from '../../../utils/formatDate';
import { TripHeroGallery } from './TripHeroGallery';

export function TripStoryHeader({ post, returnTo }: { post: BlogPostMeta; returnTo: string }) {
    return (
        <header className="mb-6">
            <TripHeroGallery>
                <div className="absolute inset-x-6 top-4 z-2 flex items-start justify-between gap-4 text-sm text-zinc-100">
                    <Link to={returnTo} state={{ restoreScroll: true }} className="inline-flex min-h-11 shrink-0 items-center hover:text-violet-300">
                        ← Back to posts
                    </Link>
                    <time dateTime={post.date} className="py-3 text-right">{formatMonthYear(post.date, 'long')}</time>
                </div>
                <div className="trip-hero-content">
                    <h1 className="trip-hero-title font-bold text-white">{post.title}</h1>
                    <p className="mt-4 text-lg leading-relaxed text-zinc-100">{post.description}</p>
                </div>
            </TripHeroGallery>
        </header>
    );
}
