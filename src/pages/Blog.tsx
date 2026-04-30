import { Link } from 'react-router-dom';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { getAllPosts } from '../content/posts';
import { formatDate } from '../utils/formatDate';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';

const description = 'Thoughts on projects, engineering, and things I find interesting.';

export function Blog() {
    const posts = getAllPosts();

    useDocumentHead({
        title: 'Blog | rsmb',
        description,
        ogImage: 'https://rsmb.tv/og/blog.svg',
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'rsmb Blog',
        description,
        url: absoluteUrl('/blog'),
        author: AUTHOR_PERSON,
        blogPost: posts.map((post) => ({
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            url: absoluteUrl(`/blog/${post.slug}`),
            image: absoluteUrl(`/og/blog/${post.slug}.svg`),
            author: AUTHOR_PERSON,
            keywords: post.tags,
        })),
    });

    return (
        <div>
            <h1 className="text-3xl font-bold text-zinc-100 mb-2">Blog</h1>
            <p className="text-zinc-400 mb-8">
                Thoughts on projects, engineering, and things I find interesting.
            </p>

            {posts.length === 0 ? (
                <p className="text-zinc-400">No posts yet. Check back soon.</p>
            ) : (
                <ul className="space-y-6">
                    {posts.map((post) => (
                        <li key={post.slug}>
                            <Link
                                to={`/blog/${post.slug}`}
                                className="group block"
                            >
                                <time className="text-sm text-zinc-400">{formatDate(post.date)}</time>
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
