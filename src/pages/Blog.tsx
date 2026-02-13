import { Link } from 'react-router-dom';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { getAllPosts } from '../content/posts';

function formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

export function Blog() {
    useDocumentHead({
        title: 'Blog | rsmb',
        description: 'Thoughts on projects, engineering, and things I find interesting.',
    });

    const posts = getAllPosts();

    return (
        <div>
            <h1 className="text-3xl font-bold text-zinc-100 mb-2">Blog</h1>
            <p className="text-zinc-400 mb-8">
                Thoughts on projects, engineering, and things I find interesting.
            </p>

            {posts.length === 0 ? (
                <p className="text-zinc-500">No posts yet. Check back soon.</p>
            ) : (
                <ul className="space-y-6">
                    {posts.map((post) => (
                        <li key={post.slug}>
                            <Link
                                to={`/blog/${post.slug}`}
                                className="group block"
                            >
                                <time className="text-sm text-zinc-500">{formatDate(post.date)}</time>
                                <h2 className="text-lg font-medium text-zinc-100 group-hover:text-violet-400 mt-1">
                                    {post.title}
                                </h2>
                                <p className="text-zinc-400 text-sm mt-1">{post.description}</p>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default Blog;
