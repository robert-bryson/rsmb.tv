import { PostTagLink } from '../../../components/PostTagLink';
import { formatDate } from '../../../utils/formatDate';
import type { BlogPostMeta } from '../../../content/posts';
import { TripFacts } from './TripFacts';
import { TripHeroGallery } from './TripHeroGallery';

export function TripStoryHeader({ post }: { post: BlogPostMeta }) {
    return (
        <header className="mb-10">
            <div className="mb-6">
                <time className="text-sm text-zinc-400">{formatDate(post.date)}</time>
                <h1 className="mt-2 text-4xl font-bold leading-tight text-zinc-100 sm:text-5xl">{post.title}</h1>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-300">{post.description}</p>
                {post.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {post.tags.map((tag) => <PostTagLink key={tag} tag={tag} type="trips" />)}
                    </div>
                )}
            </div>
            <TripHeroGallery />
            <TripFacts />
        </header>
    );
}