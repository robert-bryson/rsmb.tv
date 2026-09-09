import { BlogTagLink } from '../../../components/BlogTagLink';
import { formatDate } from '../../../utils/formatDate';
import type { BlogPostMeta } from '../../../content/posts';
import { useTripStory } from '../TripStoryContext';
import { TripFacts } from './TripFacts';
import { TripPhotoFigure } from './TripPhoto';

export function TripStoryHeader({ post }: { post: BlogPostMeta }) {
    const { manifest } = useTripStory();

    return (
        <header className="mb-10">
            <div className="mb-6">
                <time className="text-sm text-zinc-400">{formatDate(post.date)}</time>
                <h1 className="mt-2 text-4xl font-bold leading-tight text-zinc-100 sm:text-5xl">{post.title}</h1>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-300">{post.description}</p>
                {post.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {post.tags.map((tag) => <BlogTagLink key={tag} tag={tag} to="/trips" />)}
                    </div>
                )}
            </div>
            <TripPhotoFigure photo={manifest.hero} priority linked={false} className="trip-breakout" />
            <TripFacts />
        </header>
    );
}