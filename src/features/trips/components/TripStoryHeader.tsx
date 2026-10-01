import type { BlogPostMeta } from '../../../content/posts';
import { TripHeroGallery } from './TripHeroGallery';

export function TripStoryHeader({ post }: { post: BlogPostMeta }) {
    return (
        <header className="mb-6">
            <div className="mb-8">
                <h1 className="text-4xl font-bold leading-tight text-zinc-100 sm:text-5xl">{post.title}</h1>
                <p className="mt-4 text-lg leading-relaxed text-zinc-300">{post.description}</p>
            </div>
            <TripHeroGallery />
        </header>
    );
}
